/**
 * The pipeline of an environment (architecture-guide.md, section 20).
 *
 * The same code is instantiated per environment, and both pipelines live in
 * the one account that holds production and staging. Branch code runs only in
 * the staging pipeline, which only a person starts, and the production
 * pipeline listens only to main. Inside the account, what keeps the two apart
 * is the name of everything they create and, where a permission would reach
 * both, a condition on the `app:environment` tag. The price is named in
 * section 20.1: both pipelines deploy through the bootstrap roles of the
 * account, which can change anything in it, so a defect on a branch can reach
 * production.
 *
 * Every stage is a CodeBuild project running the same `pnpm` scripts a
 * workstation runs, over a whole clone of the repository, so the version can
 * be computed from it. The stage right after the source deploys this stack, so
 * a change to the pipeline takes effect on the execution that carries it.
 */

import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as iam from 'aws-cdk-lib/aws-iam';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import type { Construct } from 'constructs';
import { physicalName, stackId, type EnvironmentConfig } from '../config/environments.js';

/**
 * What a merge to main has to touch to start production: what is deployed. A
 * merge of documentation or governance starts nothing, which is what a change
 * that alters nothing deployable is (development-process.md, section 9).
 */
export const DEPLOYED_PATHS = [
  'memorysmith-backend/**',
  'memorysmith-frontend/**',
  'memorysmith-infra/**',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
] as const;

/**
 * The stacks of the product, in the order a delivery deploys them. The
 * teardown of staging deletes them in the reverse order, and declares the same
 * list, because a command never imports a stack.
 */
export const PRODUCT_STACKS = [
  'Network',
  'Frontend',
  'Data',
  'Identity',
  'Api',
  'Projections',
  'Agent',
  'FrontendRelease',
] as const;

export interface PipelineStackProps extends StackProps {
  readonly environment: EnvironmentConfig;
}

export class PipelineStack extends Stack {
  readonly pipeline: codepipeline.Pipeline;

  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    const { environment } = props;
    const production = environment.name === 'production';
    const [owner = '', repo = ''] = environment.pipeline.repository.split('/');
    const zone = environment.hostedZoneName;
    const ids = (names: readonly string[]): string =>
      names.map((name) => stackId(environment, name)).join(' ');

    const logs = new LogGroup(this, 'BuildLogs', {
      retention: RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    /** A stage: the workspace installed, then the commands, in one shell. */
    const project = (
      name: string,
      commands: readonly string[],
      options: { readonly compute?: codebuild.ComputeType; readonly timeout?: Duration } = {},
    ): codebuild.PipelineProject => {
      const built = new codebuild.PipelineProject(this, name, {
        projectName: physicalName(environment, `memorysmith-${name.toLowerCase()}`),
        environment: {
          buildImage: codebuild.LinuxArmBuildImage.AMAZON_LINUX_2023_STANDARD_3_0,
          computeType: options.compute ?? codebuild.ComputeType.SMALL,
        },
        timeout: options.timeout ?? Duration.minutes(30),
        logging: { cloudWatch: { logGroup: logs, prefix: name } },
        buildSpec: codebuild.BuildSpec.fromObject({
          version: '0.2',
          env: {
            // A whole clone, with credentials for the git commands that follow:
            // the served version counts the commits ahead of main.
            'git-credential-helper': 'yes',
            variables: { ENVIRONMENT: environment.name, CI: 'true' },
          },
          phases: {
            install: {
              'runtime-versions': { nodejs: 22 },
              commands: ['corepack enable', 'pnpm install --frozen-lockfile'],
            },
            build: { commands: [...commands] },
          },
        }),
      });
      built.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['codeconnections:UseConnection', 'codestar-connections:UseConnection'],
          resources: [environment.pipeline.connectionArn],
        }),
      );
      return built;
    };

    /**
     * What deploys: the roles `cdk bootstrap` created in THIS account, and
     * nothing else. No role anywhere trusts another account.
     */
    const deploys = (built: codebuild.PipelineProject): codebuild.PipelineProject => {
      built.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['sts:AssumeRole'],
          resources: [`arn:${this.partition}:iam::${this.account}:role/cdk-hnb659fds-*`],
        }),
      );
      return built;
    };

    const served = [
      'VERSION=$(pnpm -s -C memorysmith-infra served-version --environment "$ENVIRONMENT" --branch "$SOURCE_BRANCH")',
      'echo "serving $VERSION"',
    ];

    const selfUpdate = deploys(
      project('SelfUpdate', [
        `pnpm -C memorysmith-infra exec cdk deploy ${stackId(environment, 'Pipeline')} --exclusively --require-approval never -c environment=${environment.name}`,
      ]),
    );

    const quality = project(
      'Quality',
      ['pnpm lint', 'pnpm format', 'pnpm typecheck', 'pnpm depcruise', 'pnpm -r --if-present test'],
      { compute: codebuild.ComputeType.MEDIUM },
    );

    /**
     * Build once, deploy in the order Cognito imposes: the site of the
     * environment has to resolve an A record before a sign-in domain below it
     * is accepted, and the pool sends only from a verified identity, so the
     * network and the hosting go first, then the wait on DNS and on the sending
     * identity, then everything else (section 17).
     */
    const deliver = deploys(
      project(
        'Deliver',
        [
          ...served,
          'pnpm -C memorysmith-frontend build',
          'cd memorysmith-infra',
          `pnpm exec cdk synth --quiet -c environment=${environment.name} -c version="$VERSION" -c commit="$CODEBUILD_RESOLVED_SOURCE_VERSION"`,
          `pnpm exec cdk deploy --app cdk.out --require-approval never ${ids(['Network', 'Frontend'])}`,
          `pnpm -s wait-for-dns --name ${zone}`,
          `pnpm -s wait-for-email-identity --identity ${zone}`,
          `pnpm exec cdk deploy --app cdk.out --require-approval never ${ids(PRODUCT_STACKS)}`,
        ],
        { compute: codebuild.ComputeType.MEDIUM, timeout: Duration.minutes(90) },
      ),
    );
    // The wait reads whether the sending identity is verified, and nothing else of SES.
    deliver.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:GetEmailIdentity'],
        resources: [`arn:${this.partition}:ses:${this.region}:${this.account}:identity/${zone}`],
      }),
    );

    const smoke = project('Smoke', [
      ...served,
      `pnpm -s -C memorysmith-infra smoke --environment "$ENVIRONMENT" --version "$VERSION" --site https://${zone} --api https://api.${zone} --mcp https://mcp.${zone}`,
    ]);

    /**
     * The adapter tests, against the real DynamoDB and S3 of staging, after the
     * deploy: the tables and the bucket are the environment's, and every case
     * writes under a subscription of its own. Staging only: production is
     * never written to by a test.
     */
    const adapters = production
      ? null
      : project('Adapters', [
          `export CONTENT_BUCKET=$(aws cloudformation describe-stacks --stack-name ${stackId(environment, 'Data')} --query "Stacks[0].Outputs[?OutputKey=='ContentBucketName'].OutputValue" --output text)`,
          `export KNOWLEDGE_TABLE=${physicalName(environment, 'mv-knowledge')} ACCESS_TABLE=${physicalName(environment, 'mv-access')} DISCOVERY_TABLE=${physicalName(environment, 'mv-discovery')}`,
          'pnpm -r --if-present test:adapters',
        ]);
    if (adapters) {
      const tables = ['mv-knowledge', 'mv-access', 'mv-discovery'].map(
        (base) =>
          `arn:${this.partition}:dynamodb:${this.region}:${this.account}:table/${physicalName(environment, base)}`,
      );
      adapters.addToRolePolicy(
        new iam.PolicyStatement({
          actions: [
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:UpdateItem',
            'dynamodb:DeleteItem',
            'dynamodb:Query',
            'dynamodb:BatchWriteItem',
            'dynamodb:TransactWriteItems',
            'dynamodb:ConditionCheckItem',
          ],
          resources: [...tables, ...tables.map((table) => `${table}/index/*`)],
        }),
      );
      adapters.addToRolePolicy(
        new iam.PolicyStatement({
          // Delete too: the case of the purge destroys what it wrote, under a
          // subscription of its own, in staging only (RN-KNW-047).
          actions: [
            's3:GetObject',
            's3:GetObjectVersion',
            's3:PutObject',
            's3:DeleteObject',
            's3:DeleteObjectVersion',
          ],
          resources: [
            `arn:${this.partition}:s3:::${stackId(environment, 'Data').toLowerCase()}-contentbucket*/*`,
          ],
        }),
      );
      adapters.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['s3:ListBucketVersions'],
          resources: [
            `arn:${this.partition}:s3:::${stackId(environment, 'Data').toLowerCase()}-contentbucket*`,
          ],
        }),
      );
      adapters.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['cloudformation:DescribeStacks'],
          resources: [
            `arn:${this.partition}:cloudformation:${this.region}:${this.account}:stack/${stackId(environment, 'Data')}/*`,
          ],
        }),
      );
    }

    /**
     * The functional suite, against staging, once its adapters passed
     * (architecture-guide.md, section 19). Chromium wants the libraries
     * Playwright installs, which it installs on Ubuntu, so this stage builds
     * on the standard image and not on the image of the other stages.
     *
     * The report goes to a private bucket after the build, whether the suite
     * passed or not: a failed suite is when somebody reads it, and a failed
     * stage stops the pipeline before a stage of its own could publish it.
     */
    const reports = production
      ? null
      : new s3.Bucket(this, 'FunctionalReports', {
          blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
          encryption: s3.BucketEncryption.S3_MANAGED,
          enforceSSL: true,
          lifecycleRules: [{ expiration: Duration.days(30) }],
          removalPolicy: RemovalPolicy.DESTROY,
          autoDeleteObjects: true,
        });
    const functional = reports
      ? new codebuild.PipelineProject(this, 'Functional', {
          projectName: physicalName(environment, 'memorysmith-functional'),
          environment: {
            buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
            computeType: codebuild.ComputeType.MEDIUM,
          },
          timeout: Duration.minutes(60),
          logging: { cloudWatch: { logGroup: logs, prefix: 'Functional' } },
          buildSpec: codebuild.BuildSpec.fromObject({
            version: '0.2',
            env: {
              'git-credential-helper': 'yes',
              variables: {
                ENVIRONMENT: environment.name,
                FUNCTIONAL_ENVIRONMENT: environment.name,
                CI: 'true',
              },
            },
            phases: {
              install: {
                'runtime-versions': { nodejs: 22 },
                commands: [
                  'corepack enable',
                  'pnpm install --frozen-lockfile',
                  'pnpm -C memorysmith-infra exec playwright install --with-deps chromium',
                ],
              },
              build: {
                commands: [
                  ...served,
                  'FUNCTIONAL_VERSION="$VERSION" pnpm -C memorysmith-infra functional',
                ],
              },
              post_build: {
                commands: [
                  `aws s3 cp memorysmith-infra/functional-report s3://${reports.bucketName}/$CODEBUILD_BUILD_NUMBER/ --recursive --only-show-errors || true`,
                ],
              },
            },
          }),
        })
      : null;
    if (functional && reports) {
      reports.grantPut(functional);
      // The document that names the suite to the connector, on the site of staging.
      functional.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['s3:PutObject'],
          resources: [
            `arn:${this.partition}:s3:::${stackId(environment, 'Frontend').toLowerCase()}-sitebucket*/functional/*`,
          ],
        }),
      );
      functional.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['codeconnections:UseConnection', 'codestar-connections:UseConnection'],
          resources: [environment.pipeline.connectionArn],
        }),
      );
      functional.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['cloudformation:DescribeStacks'],
          resources: [
            `arn:${this.partition}:cloudformation:${this.region}:${this.account}:stack/${stackId(environment, 'Identity')}/*`,
            `arn:${this.partition}:cloudformation:${this.region}:${this.account}:stack/${stackId(environment, 'Frontend')}/*`,
          ],
        }),
      );
      // The accounts of a run, created, signed in and deleted by the run itself,
      // and only in the pool of this environment: production shares the account.
      functional.addToRolePolicy(
        new iam.PolicyStatement({
          actions: [
            'cognito-idp:AdminCreateUser',
            'cognito-idp:AdminSetUserPassword',
            'cognito-idp:AdminAddUserToGroup',
            'cognito-idp:AdminInitiateAuth',
            'cognito-idp:AdminGetUser',
            'cognito-idp:AdminDeleteUser',
          ],
          resources: [
            `arn:${this.partition}:cognito-idp:${this.region}:${this.account}:userpool/*`,
          ],
          conditions: {
            StringEquals: { 'aws:ResourceTag/app:environment': environment.name },
          },
        }),
      );
    }

    /**
     * Tearing staging down: a project started by hand, by `pnpm staging:destroy`,
     * and never a stage. It exists only in staging, because production has no
     * destroy path. Nothing of an execution precedes it, so it reads the
     * repository on its own, through the same read-only connection.
     *
     * CloudFormation deletes each stack with the execution role `cdk bootstrap`
     * created, which the stack remembers. This role holds the right to ask for
     * that, and to purge what the stacks retain, and it is denied, explicitly,
     * the pipeline stack and the bucket of its artifacts: what runs it.
     */
    if (!production) {
      const teardown = new codebuild.Project(this, 'DestroyStaging', {
        projectName: physicalName(environment, 'memorysmith-destroy'),
        source: codebuild.Source.gitHub({ owner, repo, reportBuildStatus: false }),
        environment: {
          buildImage: codebuild.LinuxArmBuildImage.AMAZON_LINUX_2023_STANDARD_3_0,
          computeType: codebuild.ComputeType.SMALL,
        },
        timeout: Duration.hours(3),
        logging: { cloudWatch: { logGroup: logs, prefix: 'DestroyStaging' } },
        buildSpec: codebuild.BuildSpec.fromObject({
          version: '0.2',
          env: { variables: { ENVIRONMENT: environment.name } },
          phases: {
            install: {
              'runtime-versions': { nodejs: 22 },
              commands: ['corepack enable', 'pnpm install --frozen-lockfile'],
            },
            build: { commands: ['pnpm -C memorysmith-infra destroy-staging'] },
          },
        }),
      });
      (teardown.node.defaultChild as codebuild.CfnProject).addPropertyOverride('Source.Auth', {
        Type: 'CODECONNECTIONS',
        Resource: environment.pipeline.connectionArn,
      });

      const arn = (service: string, resource: string): string =>
        `arn:${this.partition}:${service}:${this.region}:${this.account}:${resource}`;
      const allow = (actions: string[], resources: string[]): void => {
        teardown.addToRolePolicy(new iam.PolicyStatement({ actions, resources }));
      };
      const prefix = stackId(environment, '');
      const buckets = `arn:${this.partition}:s3:::${prefix.toLowerCase()}*`;
      const artifacts = `arn:${this.partition}:s3:::${stackId(environment, 'Pipeline').toLowerCase()}*`;

      /**
       * The right to read the repository, in a policy of its own. CodeBuild
       * checks, when the project is created, that its role may already use the
       * connection, and refuses it with "User is not authorized to access
       * connection" otherwise, so the project waits for this policy. It cannot be
       * the default policy of the role: that one names the project, and a project
       * waiting for a policy that names it is a cycle.
       */
      const connection = new iam.Policy(this, 'DestroyStagingConnection', {
        roles: teardown.role ? [teardown.role] : [],
        statements: [
          new iam.PolicyStatement({
            // GetConnection too: CodeBuild reads the connection on the role's
            // behalf, and the documentation names it beside GetConnectionToken.
            actions: [
              'codeconnections:UseConnection',
              'codestar-connections:UseConnection',
              'codeconnections:GetConnection',
              'codestar-connections:GetConnection',
              'codeconnections:GetConnectionToken',
              'codestar-connections:GetConnectionToken',
            ],
            resources: [environment.pipeline.connectionArn],
          }),
        ],
      });
      (teardown.node.defaultChild as codebuild.CfnProject).addDependency(
        connection.node.defaultChild as iam.CfnPolicy,
      );
      allow(
        [
          'cloudformation:DescribeStacks',
          'cloudformation:ListStackResources',
          'cloudformation:DeleteStack',
        ],
        [arn('cloudformation', `stack/${prefix}*/*`)],
      );
      teardown.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['iam:PassRole'],
          resources: [
            `arn:${this.partition}:iam::${this.account}:role/cdk-hnb659fds-cfn-exec-role-*`,
          ],
          conditions: { StringEquals: { 'iam:PassedToService': 'cloudformation.amazonaws.com' } },
        }),
      );
      allow(['dynamodb:DeleteTable'], [arn('dynamodb', `table/mv-*-${environment.name}`)]);
      allow(['s3:ListBucketVersions', 's3:DeleteBucket'], [buckets]);
      allow(['s3:DeleteObject', 's3:DeleteObjectVersion'], [`${buckets}/*`]);
      // A pool is deleted only when it says it is staging: production lives in the
      // same account, and a pool id read from the wrong stack must not be enough.
      teardown.addToRolePolicy(
        new iam.PolicyStatement({
          actions: [
            'cognito-idp:DescribeUserPool',
            'cognito-idp:DeleteUserPoolDomain',
            'cognito-idp:DeleteUserPool',
          ],
          resources: [arn('cognito-idp', 'userpool/*')],
          conditions: {
            StringEquals: { 'aws:ResourceTag/app:environment': environment.name },
          },
        }),
      );
      allow(['logs:DescribeLogGroups', 'lambda:ListFunctions'], ['*']);
      allow(['logs:DeleteLogGroup'], [arn('logs', `log-group:/aws/lambda/${prefix}*`)]);
      teardown.addToRolePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.DENY,
          actions: [
            'cloudformation:DeleteStack',
            's3:DeleteBucket',
            's3:DeleteObject',
            's3:DeleteObjectVersion',
          ],
          resources: [
            arn('cloudformation', `stack/${stackId(environment, 'Pipeline')}/*`),
            artifacts,
            `${artifacts}/*`,
          ],
        }),
      );
    }

    // ---- The pipeline -------------------------------------------------------

    const source = new codepipeline.Artifact('Source');
    const sourceAction = new actions.CodeStarConnectionsSourceAction({
      actionName: 'Source',
      owner,
      repo,
      branch: 'main',
      output: source,
      connectionArn: environment.pipeline.connectionArn,
      codeBuildCloneOutput: true,
      // Production starts from its trigger below, and staging from a person.
      triggerOnPush: false,
    });

    const branch = new codepipeline.Variable({
      variableName: 'SOURCE_BRANCH',
      defaultValue: 'main',
      description:
        'The branch the commit belongs to, which the version staging serves is computed from.',
    });

    const build = (actionName: string, built: codebuild.PipelineProject) =>
      new actions.CodeBuildAction({
        actionName,
        project: built,
        input: source,
        environmentVariables: {
          SOURCE_BRANCH: { value: production ? 'main' : branch.reference() },
        },
      });

    this.pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: physicalName(environment, 'memorysmith'),
      pipelineType: codepipeline.PipelineType.V2,
      // Two merges deploy in order in production; in staging the last run wins.
      executionMode: production
        ? codepipeline.ExecutionMode.QUEUED
        : codepipeline.ExecutionMode.SUPERSEDED,
      restartExecutionOnUpdate: true,
      crossAccountKeys: false,
      ...(production ? {} : { variables: [branch] }),
      ...(production
        ? {
            triggers: [
              {
                providerType: codepipeline.ProviderType.CODE_STAR_SOURCE_CONNECTION,
                gitConfiguration: {
                  sourceAction,
                  pushFilter: [
                    { branchesIncludes: ['main'], filePathsIncludes: [...DEPLOYED_PATHS] },
                  ],
                },
              },
            ],
          }
        : {}),
    });

    this.pipeline.addStage({ stageName: 'Source', actions: [sourceAction] });
    this.pipeline.addStage({ stageName: 'SelfUpdate', actions: [build('SelfUpdate', selfUpdate)] });
    if (production) {
      // Before anything is built: a change without a bump stops here.
      const releaseChecks = project('ReleaseChecks', ['pnpm -C memorysmith-infra release-checks']);
      this.pipeline.addStage({
        stageName: 'ReleaseChecks',
        actions: [build('ReleaseChecks', releaseChecks)],
      });
    }
    this.pipeline.addStage({ stageName: 'Quality', actions: [build('Quality', quality)] });
    this.pipeline.addStage({ stageName: 'Deliver', actions: [build('Deliver', deliver)] });
    this.pipeline.addStage({ stageName: 'Smoke', actions: [build('Smoke', smoke)] });
    if (adapters) {
      this.pipeline.addStage({ stageName: 'Adapters', actions: [build('Adapters', adapters)] });
    }
    if (functional) {
      this.pipeline.addStage({
        stageName: 'Functional',
        actions: [build('Functional', functional)],
      });
    }

    if (production && environment.pipeline.release) {
      const release = environment.pipeline.release;
      /**
       * The token the release is written with, read straight into the
       * environment of the build by CodeBuild: the command takes it from
       * `GITHUB_TOKEN` and never stores it. It used to be the private key of
       * a GitHub App, which existed because a pipeline has no person inside
       * it to sign as; the App is gone and a token says the same thing with
       * one secret instead of three identifiers.
       */
      const key = secretsmanager.Secret.fromSecretNameV2(this, 'ReleaseToken', release.tokenSecret);
      const publish = new codebuild.PipelineProject(this, 'Release', {
        projectName: physicalName(environment, 'memorysmith-release'),
        environment: {
          buildImage: codebuild.LinuxArmBuildImage.AMAZON_LINUX_2023_STANDARD_3_0,
          computeType: codebuild.ComputeType.SMALL,
          environmentVariables: {
            GITHUB_REPOSITORY: { value: environment.pipeline.repository },
            GITHUB_TOKEN: {
              value: key.secretName,
              type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
            },
          },
        },
        logging: { cloudWatch: { logGroup: logs, prefix: 'Release' } },
        buildSpec: codebuild.BuildSpec.fromObject({
          version: '0.2',
          phases: {
            install: {
              'runtime-versions': { nodejs: 22 },
              commands: ['corepack enable', 'pnpm install --frozen-lockfile'],
            },
            build: {
              commands: [
                'COMMIT="$CODEBUILD_RESOLVED_SOURCE_VERSION" pnpm -s -C memorysmith-infra publish-release',
              ],
            },
          },
        }),
      });
      key.grantRead(publish);
      publish.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['codeconnections:UseConnection', 'codestar-connections:UseConnection'],
          resources: [environment.pipeline.connectionArn],
        }),
      );
      this.pipeline.addStage({
        stageName: 'Release',
        actions: [build('Release', publish)],
      });
    }
  }
}
