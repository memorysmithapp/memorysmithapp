/**
 * The pipeline of an environment, in its own account (architecture-guide.md,
 * section 20).
 *
 * The same code is instantiated per environment, and there is NO TRUST between
 * the accounts: branch code only ever runs in the staging account, and the
 * production pipeline exists only in the production account and listens only
 * to main. A tooling account deploying to both was rejected, because branch
 * code would run in the account holding the trust to production.
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

/** The stacks of the product, in the order a delivery deploys them. */
const PRODUCT_STACKS = [
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
     * is accepted, so the network and the hosting go first, then the wait on
     * DNS, then everything else (section 17).
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
          `pnpm exec cdk deploy --app cdk.out --require-approval never ${ids(PRODUCT_STACKS)}`,
        ],
        { compute: codebuild.ComputeType.MEDIUM, timeout: Duration.minutes(90) },
      ),
    );

    const smoke = project('Smoke', [
      ...served,
      `pnpm -s -C memorysmith-infra smoke --environment "$ENVIRONMENT" --version "$VERSION" --site https://${zone} --api https://api.${zone} --mcp https://mcp.${zone}`,
    ]);

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

    if (production && environment.pipeline.release) {
      const release = environment.pipeline.release;
      const key = secretsmanager.Secret.fromSecretNameV2(
        this,
        'ReleaseAppKey',
        release.privateKeySecret,
      );
      const publish = new codebuild.PipelineProject(this, 'Release', {
        projectName: physicalName(environment, 'memorysmith-release'),
        environment: {
          buildImage: codebuild.LinuxArmBuildImage.AMAZON_LINUX_2023_STANDARD_3_0,
          computeType: codebuild.ComputeType.SMALL,
          environmentVariables: {
            GITHUB_REPOSITORY: { value: environment.pipeline.repository },
            GITHUB_APP_ID: { value: release.appId },
            GITHUB_APP_INSTALLATION_ID: { value: release.installationId },
            GITHUB_APP_KEY_SECRET_ID: { value: key.secretName },
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
