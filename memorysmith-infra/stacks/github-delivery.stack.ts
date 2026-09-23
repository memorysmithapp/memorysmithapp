/**
 * What lets GitHub Actions deliver (architecture-guide.md, section 20).
 *
 * No AWS key is stored anywhere. A run of a workflow asks GitHub for a token
 * signed by GitHub's OIDC provider, which says which repository and which
 * GitHub environment it runs for, and exchanges it for credentials of one of
 * the two roles below, valid for the run. A role is assumed only by a run of
 * THIS repository in the GitHub environment of the same name, so a fork, a
 * pull request from one or another repository cannot assume either, and a run
 * outside the environment `production` cannot assume the role of production.
 *
 * The account holds both environments, and one stack declares the provider and
 * both roles: an account has one OIDC provider per issuer. It is deployed once,
 * by hand, from a workstation, like every bootstrap, and only from a synth of
 * production, the environment that owns the account.
 *
 * What a role may do is what a delivery does: assume the roles `cdk bootstrap`
 * created, which deploy, and read whether the sending identity is verified.
 * Staging may also do what its suites do after the deploy — the adapter tests
 * against its tables and bucket, the functional suite's accounts in its pool,
 * and the maintenance jobs — and every one of those permissions names staging.
 * The price is the one the AWS pipeline paid (section 20.1): both roles deploy
 * through the same bootstrap roles, which can change anything in the account,
 * so what keeps a branch away from production is who may assume which role.
 */

import { Duration, Stack, type StackProps } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';
import { physicalName, stackId, type EnvironmentConfig } from '../config/environments.js';

/** The issuer of the tokens GitHub Actions signs. */
export const GITHUB_ISSUER = 'token.actions.githubusercontent.com';

export interface GithubDeliveryStackProps extends StackProps {
  /** `owner/name`: the one repository whose runs may assume the roles. */
  readonly repository: string;
  readonly production: EnvironmentConfig;
  readonly staging: EnvironmentConfig;
}

export class GithubDeliveryStack extends Stack {
  readonly roles: Record<'production' | 'staging', iam.Role>;

  constructor(scope: Construct, id: string, props: GithubDeliveryStackProps) {
    super(scope, id, props);

    const provider = new iam.OidcProviderNative(this, 'GithubProvider', {
      url: `https://${GITHUB_ISSUER}`,
      clientIds: ['sts.amazonaws.com'],
    });

    const arn = (service: string, resource: string): string =>
      `arn:${this.partition}:${service}:${this.region}:${this.account}:${resource}`;

    const roleOf = (environment: EnvironmentConfig): iam.Role => {
      const role = new iam.Role(
        this,
        `${environment.name === 'production' ? 'Production' : 'Staging'}Role`,
        {
          roleName: physicalName(environment, 'memorysmith-github'),
          description: `Assumed by GitHub Actions of ${props.repository} in its ${environment.name} environment.`,
          maxSessionDuration: Duration.hours(2),
          assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
            StringEquals: {
              [`${GITHUB_ISSUER}:aud`]: 'sts.amazonaws.com',
              // The repository AND the GitHub environment: a branch, a pull
              // request or a tag alone never matches.
              [`${GITHUB_ISSUER}:sub`]: `repo:${props.repository}:environment:${environment.name}`,
            },
          }),
        },
      );
      // What deploys: the roles `cdk bootstrap` created in this account.
      role.addToPolicy(
        new iam.PolicyStatement({
          actions: ['sts:AssumeRole'],
          resources: [`arn:${this.partition}:iam::${this.account}:role/cdk-hnb659fds-*`],
        }),
      );
      // The wait of a delivery reads whether the sending identity is verified.
      role.addToPolicy(
        new iam.PolicyStatement({
          actions: ['ses:GetEmailIdentity'],
          resources: [arn('ses', `identity/${environment.hostedZoneName}`)],
        }),
      );
      return role;
    };

    const production = roleOf(props.production);
    const staging = roleOf(props.staging);
    this.roles = { production, staging };

    // ---- What only staging runs after its deploy ---------------------------

    const env = props.staging;
    const describe = (names: readonly string[]): iam.PolicyStatement =>
      new iam.PolicyStatement({
        actions: ['cloudformation:DescribeStacks'],
        resources: names.map((name) => arn('cloudformation', `stack/${stackId(env, name)}/*`)),
      });
    staging.addToPolicy(describe(['Data', 'Identity', 'Frontend']));

    /**
     * The adapter tests and the maintenance jobs, against the tables and the
     * bucket of staging: every case writes under a subscription of its own,
     * and a job writes only with `--apply`. Delete too, because the case of
     * the purge destroys what it wrote (RN-KNW-047).
     */
    const tables = arn('dynamodb', `table/mv-*-${env.name}`);
    staging.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'dynamodb:DescribeTable',
          'dynamodb:GetItem',
          'dynamodb:BatchGetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
          'dynamodb:Query',
          'dynamodb:Scan',
          'dynamodb:BatchWriteItem',
          'dynamodb:TransactWriteItems',
          'dynamodb:ConditionCheckItem',
        ],
        resources: [tables, `${tables}/index/*`],
      }),
    );
    const content = `arn:${this.partition}:s3:::${stackId(env, 'Data').toLowerCase()}-contentbucket*`;
    staging.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          's3:GetObject',
          's3:GetObjectVersion',
          's3:PutObject',
          's3:DeleteObject',
          's3:DeleteObjectVersion',
        ],
        resources: [`${content}/*`],
      }),
    );
    staging.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:ListBucket', 's3:ListBucketVersions'],
        resources: [content],
      }),
    );

    // The document that names the functional suite to the connector, on the site of staging.
    staging.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:PutObject'],
        resources: [
          `arn:${this.partition}:s3:::${stackId(env, 'Frontend').toLowerCase()}-sitebucket*/functional/*`,
        ],
      }),
    );
    // The accounts of a functional run, created, signed in and deleted by the
    // run itself, and only in a pool that says it is staging.
    staging.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminSetUserPassword',
          'cognito-idp:AdminAddUserToGroup',
          'cognito-idp:AdminInitiateAuth',
          'cognito-idp:AdminGetUser',
          'cognito-idp:AdminDeleteUser',
        ],
        resources: [arn('cognito-idp', 'userpool/*')],
        conditions: { StringEquals: { 'aws:ResourceTag/app:environment': env.name } },
      }),
    );
  }
}
