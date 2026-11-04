/**
 * Tearing staging down: what it refuses,
 * the order it deletes in, and what it purges once the stacks are gone. The
 * calls to AWS are the account's; what decides what gets deleted is here.
 */

import { describe, expect, it } from 'vitest';
import {
  bootstrapRefusalOf,
  chunks,
  DELIVERY_ORDER,
  installationRefusalOf,
  installationTeardownOrder,
  orphanLogGroups,
  refusalOf,
  retainedOf,
  stackIdOf,
  teardownOrder,
  validationRecordsOf,
} from '../commands/lib/teardown.js';
import { stackId } from '../config/environments.js';
import { readFileSync } from 'node:fs';

const PRODUCTION = '111111111111';
const STAGING = '222222222222';

describe('what a teardown refuses', () => {
  it('refuses production before it looks at a credential, and under its own account too', () => {
    for (const callerAccount of [null, PRODUCTION]) {
      expect(
        refusalOf({ environment: 'production', callerAccount, environmentAccount: PRODUCTION }),
      ).toBe(
        'Only staging is ever torn down: production has no destroy path. Nothing was deleted.',
      );
    }
  });

  it('refuses the credentials of any account but the one staging lives in', () => {
    expect(
      refusalOf({ environment: 'staging', callerAccount: PRODUCTION, environmentAccount: STAGING }),
    ).toBe(
      'These credentials belong to account 111111111111, and staging lives in 222222222222. Nothing was deleted.',
    );
  });

  it('refuses a staging whose account cdk.json does not name', () => {
    expect(
      refusalOf({ environment: 'staging', callerAccount: STAGING, environmentAccount: undefined }),
    ).toBe('cdk.json names no account for staging. Nothing was deleted.');
  });

  it('goes ahead with staging, under the account of staging', () => {
    expect(
      refusalOf({ environment: 'staging', callerAccount: null, environmentAccount: STAGING }),
    ).toBeNull();
    expect(
      refusalOf({ environment: 'staging', callerAccount: STAGING, environmentAccount: STAGING }),
    ).toBeNull();
  });
});

describe('the order of a teardown', () => {
  it('is the reverse of a delivery, and never names the roles GitHub delivers with', () => {
    expect(teardownOrder('staging')).toEqual(
      [...DELIVERY_ORDER].reverse().map((name) => stackId({ name: 'staging' }, name)),
    );
    expect(teardownOrder('staging').join(' ')).not.toContain('Github');
  });

  it('names every stack of the product the app declares, and only those', () => {
    const app = readFileSync(new URL('../bin/app.ts', import.meta.url), 'utf8');
    const declared = [...app.matchAll(/new \w+Stack\(app, id\('(\w+)'\)/g)].map(
      (match) => match[1],
    );
    expect([...declared].sort()).toEqual([...DELIVERY_ORDER].sort());
  });

  it('names a stack the way the app does', () => {
    expect(stackIdOf('staging', 'FrontendRelease')).toBe(
      stackId({ name: 'staging' }, 'FrontendRelease'),
    );
  });
});

describe('what the stacks leave behind', () => {
  it('is the tables, the buckets and the user pool, and not what a stack deletes on its own', () => {
    expect(
      retainedOf([
        { type: 'AWS::DynamoDB::Table', physicalId: 'mv-audit-staging' },
        { type: 'AWS::S3::Bucket', physicalId: 'memorysmithstagingdata-contentbucket1a2b-xyz' },
        { type: 'AWS::Cognito::UserPool', physicalId: 'us-east-1_abc' },
        { type: 'AWS::Cognito::UserPoolDomain', physicalId: 'auth.stg.memorysmith.app' },
        { type: 'AWS::Lambda::Function', physicalId: 'MemorysmithStagingApi-Handler' },
        { type: 'AWS::Logs::LogGroup', physicalId: '/aws/lambda/MemorysmithStagingApi-Handler' },
        { type: 'AWS::DynamoDB::Table', physicalId: '' },
      ]),
    ).toEqual([
      { kind: 'table', name: 'mv-audit-staging' },
      { kind: 'bucket', name: 'memorysmithstagingdata-contentbucket1a2b-xyz' },
      { kind: 'user-pool', id: 'us-east-1_abc' },
    ]);
  });

  it('names a log group orphan only when its function of staging is gone', () => {
    expect(
      orphanLogGroups({
        environment: 'staging',
        groups: [
          '/aws/lambda/MemorysmithStagingApi-Handler',
          '/aws/lambda/MemorysmithStagingFrontendRelease-Deploy',
          '/aws/lambda/MemorysmithProductionApi-Handler',
        ],
        functions: ['MemorysmithStagingFrontendRelease-Deploy'],
      }),
    ).toEqual(['/aws/lambda/MemorysmithStagingApi-Handler']);
  });

  it('empties a bucket a thousand versions at a time, the most one delete takes', () => {
    const versions = Array.from({ length: 2345 }, (_, index) => index);
    expect(chunks(versions).map((batch) => batch.length)).toEqual([1000, 1000, 345]);
    expect(chunks([])).toEqual([]);
  });
});

describe('tearing an installation of somebody else down (#391)', () => {
  it('refuses the project’s own installation before it looks at a credential', () => {
    for (const callerAccount of [null, PRODUCTION]) {
      expect(
        installationRefusalOf({ installation: null, callerAccount, account: PRODUCTION }),
      ).toContain('the project’s own has no destroy path. Nothing was deleted.');
    }
  });

  it('refuses the credentials of any account but the installation’s', () => {
    expect(
      installationRefusalOf({ installation: 'acme', callerAccount: PRODUCTION, account: STAGING }),
    ).toBe(
      'These credentials belong to account 111111111111, and acme lives in 222222222222. Nothing was deleted.',
    );
    expect(
      installationRefusalOf({ installation: 'acme', callerAccount: STAGING, account: STAGING }),
    ).toBeNull();
  });

  it('takes the stacks down in the reverse of a delivery, a stack before what it imports', () => {
    const order = installationTeardownOrder({
      environment: 'production',
      installation: 'acme',
      region: 'sa-east-1',
      edge: true,
    });
    const names = order.map((each) => each.stack);
    // FrontendRelease imports from Api: deleting Api first is what CloudFormation cancels.
    expect(names.indexOf('MemorysmithAcmeProductionFrontendRelease')).toBeLessThan(
      names.indexOf('MemorysmithAcmeProductionApi'),
    );
    expect(names.slice(0, DELIVERY_ORDER.length)).toEqual(
      [...DELIVERY_ORDER]
        .reverse()
        .map((name) => stackId({ name: 'production', installation: 'acme' }, name)),
    );
    expect(order.at(-2)).toEqual({ stack: 'MemorysmithAcmeProductionEdge', region: 'us-east-1' });
    expect(order.at(-1)).toEqual({
      stack: 'MemorysmithAcmeProductionDelivery',
      region: 'sa-east-1',
    });
    expect(
      installationTeardownOrder({
        environment: 'production',
        installation: 'acme',
        region: 'us-east-1',
        edge: false,
      }).some((each) => each.stack.endsWith('Edge')),
    ).toBe(false);
  });

  it('keeps the bootstrap of a region while another stack still deploys with it', () => {
    expect(bootstrapRefusalOf('us-east-1', [])).toBeNull();
    expect(bootstrapRefusalOf('us-east-1', ['MemorysmithProductionNetwork'])).toBe(
      'the CDK bootstrap of us-east-1 stays: MemorysmithProductionNetwork still deploys with it',
    );
  });

  it('finds the log groups of its functions that are gone, and none of another installation', () => {
    expect(
      orphanLogGroups({
        environment: 'production',
        installation: 'acme',
        groups: [
          '/aws/lambda/MemorysmithAcmeProduction-CustomS3AutoDeleteObject-abc',
          '/aws/lambda/MemorysmithAcmeProductionAge-AgentFunction-alive',
          '/aws/lambda/MemorysmithProductionApi-CoreApi-xyz',
        ],
        functions: ['MemorysmithAcmeProductionAge-AgentFunction-alive'],
      }),
    ).toEqual(['/aws/lambda/MemorysmithAcmeProduction-CustomS3AutoDeleteObject-abc']);
  });

  it('chooses the records that validated the certificates of its hosts, and nothing else of the zone', () => {
    const validation = (name: string) => ({
      name: `${name}.`,
      type: 'CNAME',
      values: ['_8ffd44860a1d003f029829b778a01862.wzccmgtwzk.acm-validations.aws.'],
    });
    const ours = [
      validation('_757b03edc179214186ca4cc08a859da4.memorysmith.rapcinski.me'),
      validation('_06b8d29eaac0d90d3aa7477da19f803e.www.memorysmith.rapcinski.me'),
      validation('_20734d10de1f00dea27c9eb87607acda.api.memorysmith.rapcinski.me'),
      validation('_b39beb48c1dca4ab2ce6b9fad9e2f9ab.mcp.memorysmith.rapcinski.me'),
      validation('_e05341c4bf9a30ed5cfbefdbd4c4cd38.auth.memorysmith.rapcinski.me'),
      validation('_79abb6b8efb78e0a2de6abdcba2860a3.uploads.memorysmith.rapcinski.me'),
      validation('_93ae956da9b7230880e078d637eef0df.files.memorysmith.rapcinski.me'),
    ];
    const theirs = [
      { name: 'memorysmith.rapcinski.me.', type: 'NS', values: ['ns-629.awsdns-14.net.'] },
      { name: 'memorysmith.rapcinski.me.', type: 'SOA', values: ['ns-629.awsdns-14.net. …'] },
      validation('_0a1b2c3d4e5f60718293a4b5c6d7e8f9.blog.memorysmith.rapcinski.me'),
      validation('_0a1b2c3d4e5f60718293a4b5c6d7e8f9.rapcinski.me'),
      {
        name: '_aa11.api.memorysmith.rapcinski.me.',
        type: 'CNAME',
        values: ['elsewhere.example.com.'],
      },
      {
        name: '_aa11.api.memorysmith.rapcinski.me.',
        type: 'TXT',
        values: ['"_x.wzccmgtwzk.acm-validations.aws."'],
      },
      { name: 'api.memorysmith.rapcinski.me.', type: 'CNAME', values: ['x.acm-validations.aws.'] },
    ];
    expect(validationRecordsOf('memorysmith.rapcinski.me', [...theirs, ...ours])).toEqual(ours);
    expect(validationRecordsOf('Memorysmith.Rapcinski.me.', ours)).toEqual(ours);
  });
});
