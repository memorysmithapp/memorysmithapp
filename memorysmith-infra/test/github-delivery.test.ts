/**
 * The roles GitHub Actions delivers with (architecture-guide.md, section 20).
 * What these cases protect is what would otherwise be found in the account
 * itself: that no run outside this repository and the GitHub environment of the
 * same name can assume a role, and that what staging's suites may touch names
 * staging.
 */

import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { environmentOf } from '../config/environments.js';
import { GITHUB_ISSUER, GithubDeliveryStack } from '../stacks/github-delivery.stack.js';

const ENVIRONMENTS = {
  production: {
    account: '111111111111',
    region: 'us-east-1',
    hostedZoneName: 'memorysmith.app',
    hostedZoneId: 'ZPRODUCTION',
    delegations: [],
  },
  staging: {
    account: '111111111111',
    region: 'us-east-1',
    hostedZoneName: 'stg.memorysmith.app',
    hostedZoneId: 'ZSTAGING',
    delegations: [],
  },
};

function synth(): Template {
  const app = new App({ context: { environments: ENVIRONMENTS } });
  const named = (name: string) =>
    environmentOf({
      tryGetContext: (key) => (key === 'environment' ? name : app.node.tryGetContext(key)),
    });
  const stack = new GithubDeliveryStack(app, 'MemorysmithGithubDelivery', {
    env: { account: '111111111111', region: 'us-east-1' },
    repository: 'memorysmithapp/memorysmithapp',
    subject: 'repo:memorysmithapp@311768902/memorysmithapp@1319284044',
    production: named('production'),
    staging: named('staging'),
  });
  return Template.fromStack(stack);
}

type Statement = {
  Action: string | string[];
  Resource?: unknown;
  Condition?: Record<string, Record<string, string>>;
};

function roleNamed(template: Template, name: string): Record<string, unknown> {
  const roles = template.findResources('AWS::IAM::Role', { Properties: { RoleName: name } });
  const [role] = Object.values(roles);
  expect(role).toBeDefined();
  return role as Record<string, unknown>;
}

function policiesOf(template: Template, logicalPrefix: string): Statement[] {
  const policies = template.findResources('AWS::IAM::Policy');
  return Object.entries(policies)
    .filter(([id]) => id.startsWith(logicalPrefix))
    .flatMap(
      ([, policy]) =>
        (policy as { Properties: { PolicyDocument: { Statement: Statement[] } } }).Properties
          .PolicyDocument.Statement,
    );
}

const actionsOf = (statements: Statement[]): string[] =>
  statements.flatMap((statement) =>
    Array.isArray(statement.Action) ? statement.Action : [statement.Action],
  );

describe('who may assume a role', () => {
  it('is a run of this repository in the GitHub environment of the same name, and nothing else', () => {
    const template = synth();
    for (const environment of ['production', 'staging']) {
      const role = roleNamed(template, `memorysmith-github-${environment}`) as {
        Properties: { AssumeRolePolicyDocument: { Statement: Statement[] } };
      };
      const [trust] = role.Properties.AssumeRolePolicyDocument.Statement;
      expect(trust?.Action).toBe('sts:AssumeRoleWithWebIdentity');
      expect(trust?.Condition).toEqual({
        StringEquals: {
          [`${GITHUB_ISSUER}:aud`]: 'sts.amazonaws.com',
          [`${GITHUB_ISSUER}:sub`]: `repo:memorysmithapp@311768902/memorysmithapp@1319284044:environment:${environment}`,
        },
      });
    }
  });

  it('trusts the one provider of GitHub, and no account', () => {
    const template = synth();
    template.resourceCountIs('AWS::IAM::OIDCProvider', 1);
    template.hasResourceProperties('AWS::IAM::OIDCProvider', {
      Url: `https://${GITHUB_ISSUER}`,
      ClientIdList: ['sts.amazonaws.com'],
    });
    const trusts = Object.values(template.findResources('AWS::IAM::Role')).flatMap(
      (role) =>
        (
          role as {
            Properties: { AssumeRolePolicyDocument: { Statement: { Principal: unknown }[] } };
          }
        ).Properties.AssumeRolePolicyDocument.Statement,
    );
    for (const trust of trusts) {
      expect(JSON.stringify(trust.Principal)).not.toContain(':root');
    }
  });
});

describe('what a role may do', () => {
  it('deploys through the bootstrap roles of this account in both environments', () => {
    const template = synth();
    for (const prefix of ['ProductionRole', 'StagingRole']) {
      const statements = policiesOf(template, prefix);
      expect(statements).toContainEqual(
        expect.objectContaining({
          Action: 'sts:AssumeRole',
          Resource: {
            'Fn::Join': [
              '',
              ['arn:', { Ref: 'AWS::Partition' }, ':iam::111111111111:role/cdk-hnb659fds-*'],
            ],
          },
        }),
      );
    }
  });

  it('lets production deliver and nothing more: no table, bucket or pool of either environment', () => {
    const actions = actionsOf(policiesOf(synth(), 'ProductionRole'));
    expect(actions.sort()).toEqual(['ses:GetEmailIdentity', 'sts:AssumeRole']);
  });

  it('names staging in every table, bucket and stack its suites reach', () => {
    const statements = policiesOf(synth(), 'StagingRole');
    const reach = JSON.stringify(
      statements.filter((statement) => !actionsOf([statement]).includes('sts:AssumeRole')),
    );
    expect(reach).not.toMatch(/[Pp]roduction/);
    expect(reach).toContain('mv-*-staging');
    expect(reach).toContain('memorysmithstagingdata-contentbucket*');
  });

  it('touches the accounts of a user pool only when the pool says it is staging', () => {
    const cognito = policiesOf(synth(), 'StagingRole').find((statement) =>
      actionsOf([statement]).includes('cognito-idp:AdminCreateUser'),
    );
    expect(cognito?.Condition).toEqual({
      StringEquals: { 'aws:ResourceTag/app:environment': 'staging' },
    });
  });

  it('deletes nothing it did not write: no stack, table, bucket or pool', () => {
    const actions = actionsOf(policiesOf(synth(), 'StagingRole'));
    for (const forbidden of [
      'cloudformation:DeleteStack',
      'dynamodb:DeleteTable',
      's3:DeleteBucket',
      'cognito-idp:DeleteUserPool',
    ]) {
      expect(actions).not.toContain(forbidden);
    }
  });
});
