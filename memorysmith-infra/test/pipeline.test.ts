/**
 * The pipeline of each environment (architecture-guide.md, section 20). What
 * these cases protect is what would otherwise be found in the account itself:
 * which pipeline starts on its own, in which order the stages run, that no role
 * trusts anything outside the account, and that a permission able to reach both
 * environments of a shared account reaches only its own.
 */

import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { environmentOf } from '../config/environments.js';
import { DEPLOYED_PATHS, PipelineStack } from '../stacks/pipeline.stack.js';

const PIPELINE = {
  connectionArn: 'arn:aws:codeconnections:us-east-1:111111111111:connection/test',
  repository: 'memorysmithapp/memorysmithapp',
};

const ENVIRONMENTS = {
  production: {
    account: '111111111111',
    region: 'us-east-1',
    hostedZoneName: 'memorysmith.app',
    hostedZoneId: 'ZPRODUCTION',
    delegations: [],
    pipeline: {
      ...PIPELINE,
      release: { appId: '1', installationId: '2', privateKeySecret: 'memorysmith/release-app' },
    },
  },
  staging: {
    account: '222222222222',
    region: 'us-east-1',
    hostedZoneName: 'stg.memorysmith.app',
    hostedZoneId: 'ZSTAGING',
    delegations: [],
    pipeline: {
      ...PIPELINE,
      connectionArn: PIPELINE.connectionArn.replace('111111111111', '222222222222'),
    },
  },
};

function pipelineOf(name: 'production' | 'staging') {
  const app = new App({ context: { environment: name, environments: ENVIRONMENTS } });
  const environment = environmentOf(app.node);
  const stack = new PipelineStack(app, 'Pipeline', {
    env: { account: environment.account, region: environment.region },
    environment,
  });
  const template = Template.fromStack(stack);
  const pipeline = Object.values(template.findResources('AWS::CodePipeline::Pipeline'))[0]
    ?.Properties;
  return { template, pipeline };
}

const stagesOf = (pipeline: { Stages: Array<{ Name: string }> }) =>
  pipeline.Stages.map((stage) => stage.Name);

describe('the staging pipeline', () => {
  it('is a V2 pipeline where the last run wins, with the branch as a variable', () => {
    const { pipeline } = pipelineOf('staging');
    expect(pipeline.PipelineType).toBe('V2');
    expect(pipeline.ExecutionMode).toBe('SUPERSEDED');
    expect(pipeline.Variables).toEqual([
      expect.objectContaining({ Name: 'SOURCE_BRANCH', DefaultValue: 'main' }),
    ]);
  });

  it('starts only when somebody asks, never on a push', () => {
    const { pipeline } = pipelineOf('staging');
    expect(pipeline.Triggers ?? []).toEqual([]);
  });

  it('updates itself, checks the quality, delivers and proves what it delivered', () => {
    expect(stagesOf(pipelineOf('staging').pipeline)).toEqual([
      'Source',
      'SelfUpdate',
      'Quality',
      'Deliver',
      'Smoke',
      'Adapters',
      'Functional',
    ]);
  });
});

describe('the production pipeline', () => {
  it('queues its executions, so two merges deploy in order', () => {
    expect(pipelineOf('production').pipeline.ExecutionMode).toBe('QUEUED');
  });

  it('starts on a push to main that touches what is deployed, and on nothing else', () => {
    const { pipeline } = pipelineOf('production');
    expect(pipeline.Triggers).toEqual([
      {
        ProviderType: 'CodeStarSourceConnection',
        GitConfiguration: {
          SourceActionName: 'Source',
          Push: [
            { Branches: { Includes: ['main'] }, FilePaths: { Includes: [...DEPLOYED_PATHS] } },
          ],
        },
      },
    ]);
  });

  it('checks the release before anything is built, and publishes it only after the smoke', () => {
    expect(stagesOf(pipelineOf('production').pipeline)).toEqual([
      'Source',
      'SelfUpdate',
      'ReleaseChecks',
      'Quality',
      'Deliver',
      'Smoke',
      'Release',
    ]);
  });
});

type Statement = { Effect: string; Action: string | string[]; Resource: unknown };

/** The statements of every policy of the stack, or of the role of one project. */
function statementsOf(name: 'production' | 'staging', project?: string): Statement[] {
  return Object.values(pipelineOf(name).template.findResources('AWS::IAM::Policy'))
    .filter(
      (policy) => !project || JSON.stringify(policy.Properties.Roles).includes(`${project}Role`),
    )
    .flatMap((policy) => policy.Properties.PolicyDocument.Statement as Statement[]);
}

const touching = (statements: Statement[], service: string) =>
  statements.filter((statement) =>
    [statement.Action].flat().some((action) => action.startsWith(`${service}:`)),
  );

describe('the adapter tests of a pipeline', () => {
  it('never run in production, where nothing of the pipeline touches a table', () => {
    expect(touching(statementsOf('production'), 'dynamodb')).toEqual([]);
  });

  it('reach the items of the knowledge and access tables of staging, and nothing else', () => {
    const statements = touching(statementsOf('staging', 'Adapters'), 'dynamodb');
    const actions = statements.flatMap((statement) => [statement.Action].flat());
    expect(actions).not.toHaveLength(0);
    for (const action of actions) expect(action).not.toMatch(/Table|Stream|Scan|\*/);

    const resources = statements.flatMap((statement) => [statement.Resource].flat());
    for (const resource of resources) {
      expect(JSON.stringify(resource)).toMatch(
        /:222222222222:table\/mv-(knowledge|access)-staging/,
      );
    }
  });

  it('reach the objects of the content bucket of staging, and nothing else of it', () => {
    const statements = touching(statementsOf('staging', 'Adapters'), 's3').filter((statement) =>
      JSON.stringify(statement.Resource).includes('contentbucket'),
    );
    expect(statements).toHaveLength(1);
    expect(statements[0]?.Action).toEqual(['s3:GetObject', 's3:GetObjectVersion', 's3:PutObject']);
    expect(JSON.stringify(statements[0]?.Resource)).toContain(
      ':s3:::memorysmithstagingdata-contentbucket*/*',
    );
  });
});

describe('the teardown of an environment', () => {
  const projectsOf = (name: 'production' | 'staging') =>
    Object.values(pipelineOf(name).template.findResources('AWS::CodeBuild::Project')).map(
      (project) => project.Properties as { Name: string; Source: unknown },
    );

  it('does not exist in production, which has no destroy path', () => {
    for (const project of projectsOf('production')) expect(project.Name).not.toContain('destroy');
  });

  it('is a project of staging, started by hand and reading the repository through its connection', () => {
    const teardown = projectsOf('staging').find(
      (project) => project.Name === 'memorysmith-destroy-staging',
    );
    expect(teardown?.Source).toMatchObject({
      Type: 'GITHUB',
      ReportBuildStatus: false,
      Auth: { Type: 'CODECONNECTIONS', Resource: ENVIRONMENTS.staging.pipeline.connectionArn },
    });
    expect(stagesOf(pipelineOf('staging').pipeline)).not.toContain('DestroyStaging');
  });

  it('is denied the pipeline stack and the bucket of its artifacts, which are what runs it', () => {
    const denied = statementsOf('staging', 'DestroyStaging').filter(
      (statement) => statement.Effect === 'Deny',
    );
    expect(denied).toHaveLength(1);
    expect(denied[0]?.Action).toContain('cloudformation:DeleteStack');
    expect(denied[0]?.Action).toContain('s3:DeleteBucket');
    const resources = JSON.stringify(denied[0]?.Resource);
    expect(resources).toContain(':222222222222:stack/MemorysmithStagingPipeline/*');
    expect(resources).toContain(':s3:::memorysmithstagingpipeline*');
  });

  it('is created only once its role may use the connection, which CodeBuild checks on creation', () => {
    const resources = pipelineOf('staging').template.toJSON().Resources as Record<
      string,
      { Type: string; Properties?: Record<string, unknown>; DependsOn?: string[] }
    >;
    const teardown = Object.values(resources).find(
      (resource) =>
        resource.Type === 'AWS::CodeBuild::Project' &&
        resource.Properties?.['Name'] === 'memorysmith-destroy-staging',
    );
    const [policy, granting] =
      Object.entries(resources).find(
        ([id, resource]) =>
          resource.Type === 'AWS::IAM::Policy' && id.startsWith('DestroyStagingConnection'),
      ) ?? [];
    expect(policy).toBeDefined();
    expect(JSON.stringify(granting)).toContain('codeconnections:GetConnectionToken');
    expect(teardown?.DependsOn).toContain(policy);
  });

  it('deletes a user pool only when the pool is tagged staging, because production may share the account', () => {
    const statements = touching(statementsOf('staging', 'DestroyStaging'), 'cognito-idp');
    expect(statements).toHaveLength(1);
    expect((statements[0] as { Condition?: unknown }).Condition).toEqual({
      StringEquals: { 'aws:ResourceTag/app:environment': 'staging' },
    });
  });
});

describe('the functional suite of a pipeline', () => {
  it('never runs in production, which a test never writes to', () => {
    expect(stagesOf(pipelineOf('production').pipeline)).not.toContain('Functional');
  });

  it('creates accounts in the pool of staging, publishes only under functional/ of its site, touches no table, and keeps its report private for 30 days', () => {
    const statements = statementsOf('staging', 'Functional');
    expect(touching(statements, 'dynamodb')).toEqual([]);
    const cognito = touching(statements, 'cognito-idp');
    expect(JSON.stringify(cognito)).toContain(':222222222222:userpool/*');
    expect(cognito).not.toHaveLength(0);
    // Production may share the account: a pool is reached only when it says staging.
    for (const statement of cognito) {
      expect((statement as { Condition?: unknown }).Condition).toEqual({
        StringEquals: { 'aws:ResourceTag/app:environment': 'staging' },
      });
    }
    expect(JSON.stringify(touching(statements, 's3'))).toContain(
      ':s3:::memorysmithstagingfrontend-sitebucket*/functional/*',
    );

    const buckets = Object.values(
      pipelineOf('staging').template.findResources('AWS::S3::Bucket'),
    ).map((bucket) => JSON.stringify(bucket.Properties));
    expect(
      buckets.some(
        (bucket) =>
          bucket.includes('"ExpirationInDays":30') && bucket.includes('"BlockPublicAcls":true'),
      ),
    ).toBe(true);
  });
});

describe('the trust of a pipeline', () => {
  it('ends at its own account: no role is assumed by anything of another account', () => {
    for (const [name, own, other] of [
      ['production', '111111111111', '222222222222'],
      ['staging', '222222222222', '111111111111'],
    ] as const) {
      const roles = pipelineOf(name).template.findResources('AWS::IAM::Role');
      for (const role of Object.values(roles)) {
        for (const statement of role.Properties.AssumeRolePolicyDocument.Statement) {
          const principal = JSON.stringify(statement.Principal);
          expect(principal).not.toContain(other);
          if (!('AWS' in statement.Principal)) continue;
          // Otherwise the pipeline of this very account assuming the role of one
          // of its own actions: its account, or a role declared in this stack.
          const reference = statement.Principal.AWS as { 'Fn::GetAtt'?: [string, string] };
          const ownRole = reference['Fn::GetAtt']?.[0];
          expect(principal.includes(own) || (ownRole !== undefined && ownRole in roles)).toBe(true);
        }
      }
    }
  });

  it('deploys only through the bootstrap roles of its own account', () => {
    const { template } = pipelineOf('staging');
    const assumed = Object.values(template.findResources('AWS::IAM::Policy')).flatMap((policy) =>
      policy.Properties.PolicyDocument.Statement.filter(
        (statement: { Action: unknown }) => statement.Action === 'sts:AssumeRole',
      ).map((statement: { Resource: unknown }) => JSON.stringify(statement.Resource)),
    );
    const bootstrap = assumed.filter((resource) => resource.includes('cdk-hnb659fds'));
    expect(bootstrap.length).toBeGreaterThan(0);
    for (const resource of bootstrap) {
      expect(resource).toContain(':iam::222222222222:role/cdk-hnb659fds-*');
    }
    for (const resource of assumed) expect(resource).not.toContain('111111111111');
  });
});
