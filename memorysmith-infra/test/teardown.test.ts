/**
 * Tearing staging down (architecture-guide.md, section 20): what it refuses,
 * the order it deletes in, and what it purges once the stacks are gone. The
 * calls to AWS are the account's; what decides what gets deleted is here.
 */

import { describe, expect, it } from 'vitest';
import {
  chunks,
  DELIVERY_ORDER,
  orphanLogGroups,
  refusalOf,
  retainedOf,
  stackIdOf,
  teardownOrder,
} from '../commands/lib/teardown.js';
import { stackId } from '../config/environments.js';
import { PRODUCT_STACKS } from '../stacks/pipeline.stack.js';

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
  it('is the reverse of a delivery, and never names the pipeline that runs it', () => {
    expect(DELIVERY_ORDER).toEqual(PRODUCT_STACKS);
    expect(teardownOrder('staging')).toEqual(
      [...PRODUCT_STACKS].reverse().map((name) => stackId({ name: 'staging' }, name)),
    );
    expect(teardownOrder('staging').join(' ')).not.toContain('Pipeline');
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
          '/aws/lambda/MemorysmithStagingPipeline-Anything',
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
