/**
 * The pre-token-generation trigger, with the table answered in memory. What
 * it proves is INV-12: a member of `platform-admin` never carries a
 * subscription claim, even when a link to one exists.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

type Handler = (event: {
  triggerSource?: string;
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
        return { Items: [{ subscriptionId: '01ARZ3NDEKTSV4RRFFQ69G5FAV', isDefault: true }] };
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
    expect(claims['subscription_id']).toBe('01ARZ3NDEKTSV4RRFFQ69G5FAV');
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

describe('the face of a federated person, on every sign-in (RN-ACC-046, #561)', () => {
  const federated = {
    ...attributes,
    identities: JSON.stringify([{ providerName: 'Acme', userId: 'f3b1c2d4' }]),
  };
  const putsOf = (send: ReturnType<typeof linkedToOne>) =>
    send.mock.calls
      .map(
        ([command]) =>
          command as { constructor: { name: string }; input: { Item?: Record<string, unknown> } },
      )
      .filter((command) => command.constructor.name === 'PutCommand')
      .map((command) => command.input.Item);

  afterEach(() => {
    delete process.env['FACES'];
  });

  it('gives a federated person their initials on a sign-in, where no directory is named', async () => {
    process.env['FACES'] = 'on';
    const send = linkedToOne();

    const claims = claimsOf(
      await handler({
        triggerSource: 'TokenGeneration_HostedAuth',
        request: { userAttributes: federated },
      }),
    );

    expect(claims['subscription_id']).toBe('01ARZ3NDEKTSV4RRFFQ69G5FAV');
    expect(putsOf(send)).toEqual([
      expect.objectContaining({
        PK: 'S#01ARZ3NDEKTSV4RRFFQ69G5FAV',
        SK: `AVATAR#${attributes.sub}`,
        source: 'initials',
      }),
    ]);
  });

  it('never on a refresh of the token, for no account with a password, and not unless the installation says so', async () => {
    process.env['FACES'] = 'on';
    const refresh = linkedToOne();
    await handler({
      triggerSource: 'TokenGeneration_RefreshTokens',
      request: { userAttributes: federated },
    });
    expect(putsOf(refresh)).toEqual([]);
    vi.restoreAllMocks();

    const password = linkedToOne();
    await handler({
      triggerSource: 'TokenGeneration_HostedAuth',
      request: { userAttributes: attributes },
    });
    expect(putsOf(password)).toEqual([]);
    vi.restoreAllMocks();

    delete process.env['FACES'];
    const off = linkedToOne();
    await handler({
      triggerSource: 'TokenGeneration_HostedAuth',
      request: { userAttributes: federated },
    });
    expect(putsOf(off)).toEqual([]);
  });

  it('issues the token as it would have when keeping the face fails', async () => {
    process.env['FACES'] = 'on';
    vi.spyOn(DynamoDBDocumentClient.prototype, 'send').mockImplementation(
      async (command: unknown) => {
        const name = (command as { constructor: { name: string } }).constructor.name;
        if (name === 'QueryCommand') {
          return { Items: [{ subscriptionId: '01ARZ3NDEKTSV4RRFFQ69G5FAV', isDefault: true }] };
        }
        if (name === 'PutCommand') throw new Error('throttled');
        if ((command as { input: { Key?: { SK?: string } } }).input.Key?.SK === 'META') {
          return { Item: { status: 'active' } };
        }
        return {};
      },
    );

    const claims = claimsOf(
      await handler({
        triggerSource: 'TokenGeneration_HostedAuth',
        request: { userAttributes: federated },
      }),
    );

    expect(claims['subscription_status']).toBe('active');
  });
});
