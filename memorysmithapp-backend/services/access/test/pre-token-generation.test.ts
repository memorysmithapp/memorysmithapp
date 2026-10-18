/**
 * The pre-token-generation trigger, with the table answered in memory. What
 * it proves is INV-12: a member of `platform-admin` never carries a
 * subscription claim, even when a link to one exists.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

type Handler = (event: {
  request: {
    userAttributes: Record<string, string>;
    groupConfiguration?: { groupsToOverride?: string[] };
  };
  response?: unknown;
}) => Promise<{ response?: unknown }>;

let handler: Handler;

beforeAll(async () => {
  process.env['ACCESS_TABLE'] = 'mv-access-test';
  ({ handler } = (await import('../src/adapters/inbound/pre-token-generation.js')) as {
    handler: Handler;
  });
});

afterEach(() => vi.restoreAllMocks());

/** One user linked to one active subscription. */
function linkedToOne() {
  return vi
    .spyOn(DynamoDBDocumentClient.prototype, 'send')
    .mockImplementation(async (command: unknown) => {
      const name = (command as { constructor: { name: string } }).constructor.name;
      if (name === 'QueryCommand') {
        return { Items: [{ subscriptionId: '01SUBSCRIPTION0000000000AA', isDefault: true }] };
      }
      return { Item: { status: 'active' } };
    });
}

const claimsOf = (result: { response?: unknown }) =>
  (
    result.response as {
      claimsAndScopeOverrideDetails: {
        accessTokenGeneration: { claimsToAddOrOverride: Record<string, string> };
      };
    }
  ).claimsAndScopeOverrideDetails.accessTokenGeneration.claimsToAddOrOverride;

const attributes = { sub: 'a1b2c3d4-5678-90ab-cdef-EXAMPLE11111', email: 'ana@example.com' };

describe('pre-token generation', () => {
  it('gives a linked user the subscription it chose', async () => {
    linkedToOne();
    const claims = claimsOf(await handler({ request: { userAttributes: attributes } }));
    expect(claims['subscription_id']).toBe('01SUBSCRIPTION0000000000AA');
    expect(claims['subscription_status']).toBe('active');
  });

  it('gives a platform admin no subscription, even with a link, and never reads one', async () => {
    const send = linkedToOne();
    const claims = claimsOf(
      await handler({
        request: {
          userAttributes: attributes,
          groupConfiguration: { groupsToOverride: ['platform-admin'] },
        },
      }),
    );
    expect(claims['subscription_id']).toBeUndefined();
    expect(claims['subscription_status']).toBeUndefined();
    expect(claims['email']).toBe('ana@example.com');
    expect(send).not.toHaveBeenCalled();
  });
});
