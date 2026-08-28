/**
 * The isolation tests of architecture-guide.md section 19. They are not
 * optional, and they exist from the delivery that makes them possible.
 *
 *  - two subscriptions, A trying to read B, expecting 404 and not 403;
 *  - a PLATFORM_ADMIN token, which carries no subscription_id, against any
 *    Knowledge route: it must fail by IMPOSSIBILITY OF BUILDING THE KEY, not
 *    by a role check (RN-SUB-016).
 *
 * The second one asserts on WHY it failed, because a test that passes because
 * someone wrote an `if` would prove nothing.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { SubscriptionContext, SubscriptionId } from '@memorysmith/kernel';
import { buildTestApp } from './wiring.js';

type App = ReturnType<typeof buildTestApp>;

let harness: App;

beforeEach(() => {
  harness = buildTestApp();
});

/** Signs a user in and takes their subscription through approval. */
async function onboard(
  app: App,
  input: { token: string; sub: string; email: string },
): Promise<string> {
  app.verifier.issue(input.token, { sub: input.sub, email: input.email });
  const created = await app.app.request('/access/subscriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${input.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  expect(created.status).toBe(201);
  const { subscriptionId } = (await created.json()) as { subscriptionId: string };

  // A platform admin approves it: without that, nobody has access at all.
  app.verifier.issue('platform-token', {
    sub: 'platform-admin',
    email: 'admin@memorysmith.app',
    groups: ['platform-admin'],
  });
  const approved = await app.app.request(
    `/access/platform/subscriptions/${subscriptionId}/approve`,
    {
      method: 'POST',
      headers: { authorization: 'Bearer platform-token', 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    },
  );
  expect(approved.status).toBe(204);

  // From here on the token carries the subscription claim, as the Cognito
  // pre-token-generation trigger injects it in production (section 8.5).
  app.verifier.issue(input.token, {
    sub: input.sub,
    email: input.email,
    subscription_id: subscriptionId,
    subscription_status: 'active',
  });
  return subscriptionId;
}

async function createVault(app: App, token: string, name: string): Promise<string> {
  const created = await app.app.request('/knowledge/vaults', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name, description: 'Base de normas' }),
  });
  expect(created.status).toBe(201);
  const { vaultId } = (await created.json()) as { vaultId: string };
  return vaultId;
}

describe('Isolation between subscriptions', () => {
  it('answers 404, not 403, for a vault of another subscription', async () => {
    await onboard(harness, {
      token: 'token-a',
      sub: 'user-a',
      email: 'a@example.com',
    });
    await onboard(harness, {
      token: 'token-b',
      sub: 'user-b',
      email: 'b@example.com',
    });

    const vaultOfB = await createVault(harness, 'token-b', 'Normas de B');

    const attempt = await harness.app.request(`/knowledge/vaults/${vaultOfB}`, {
      headers: { authorization: 'Bearer token-a' },
    });

    // Indistinguishable from a vault that does not exist (RN-SUB-004): a 403
    // would confirm the existence of something A must not know about.
    expect(attempt.status).toBe(404);
    expect(attempt.status).not.toBe(403);
    const body = (await attempt.json()) as { code: string };
    expect(body.code).toBe('NOT_FOUND');
  });

  it('never lists a vault of another subscription', async () => {
    await onboard(harness, {
      token: 'token-a',
      sub: 'user-a',
      email: 'a@example.com',
    });
    await onboard(harness, {
      token: 'token-b',
      sub: 'user-b',
      email: 'b@example.com',
    });
    await createVault(harness, 'token-b', 'Normas de B');
    await createVault(harness, 'token-a', 'Normas de A');

    const listed = await harness.app.request('/knowledge/vaults', {
      headers: { authorization: 'Bearer token-a' },
    });
    const vaults = (await listed.json()) as Array<{ name: string }>;
    expect(vaults.map((vault) => vault.name)).toEqual(['Normas de A']);
  });

  it('refuses to write into a vault of another subscription', async () => {
    await onboard(harness, {
      token: 'token-a',
      sub: 'user-a',
      email: 'a@example.com',
    });
    await onboard(harness, {
      token: 'token-b',
      sub: 'user-b',
      email: 'b@example.com',
    });
    const vaultOfB = await createVault(harness, 'token-b', 'Normas de B');

    const attempt = await harness.app.request(`/knowledge/vaults/${vaultOfB}/folders`, {
      method: 'POST',
      headers: { authorization: 'Bearer token-a', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Injetada', description: 'nao deveria existir' }),
    });
    expect(attempt.status).toBe(404);
  });
});

describe('The platform session reaches no content', () => {
  it('cannot even build a subscription context, which is where it fails', () => {
    // The structural guarantee, asserted directly: a platform token has no
    // subscription_id claim, and SubscriptionContext is the only door into
    // every repository of the Knowledge context.
    const attempt = SubscriptionContext.fromClaims({ sub: 'platform-admin' });
    expect(attempt.ok).toBe(false);
    if (attempt.ok) return;
    expect(attempt.error.message).toContain('no subscription');
  });

  it('is refused by every Knowledge route, before any role check', async () => {
    await onboard(harness, {
      token: 'token-a',
      sub: 'user-a',
      email: 'a@example.com',
    });
    const vaultOfA = await createVault(harness, 'token-a', 'Normas de A');

    harness.verifier.issue('platform-token', {
      sub: 'platform-admin',
      email: 'admin@memorysmith.app',
      groups: ['platform-admin'],
    });

    for (const path of ['/knowledge/vaults', `/knowledge/vaults/${vaultOfA}`]) {
      const attempt = await harness.app.request(path, {
        headers: { authorization: 'Bearer platform-token' },
      });
      expect(attempt.status).toBe(404);
      const body = (await attempt.json()) as { code: string; message: string };
      // The failure names the missing subscription, which is the composition
      // failure, and not a role that was checked and refused.
      expect(body.code).toBe('FORBIDDEN');
      expect(body.message).toContain('no active subscription');
    }
  });

  it('still sees the platform queue, which is metadata only', async () => {
    await onboard(harness, {
      token: 'token-a',
      sub: 'user-a',
      email: 'a@example.com',
    });
    const queue = await harness.app.request('/access/platform/subscriptions?status=active', {
      headers: { authorization: 'Bearer platform-token' },
    });
    expect(queue.status).toBe(200);
    const rows = (await queue.json()) as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    // Holder, status, plan, dates and a member count. Nothing else, and no
    // name: a subscription has none (RN-SUB-020).
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual([
      'memberCount',
      'ownerEmail',
      'quota',
      'requestedAt',
      'status',
      'subscriptionId',
      'type',
    ]);
  });

  it('cannot approve a subscription without the platform group', async () => {
    const subscriptionId = await onboard(harness, {
      token: 'token-a',
      sub: 'user-a',
      email: 'a@example.com',
    });
    const attempt = await harness.app.request(
      `/access/platform/subscriptions/${subscriptionId}/suspend`,
      { method: 'POST', headers: { authorization: 'Bearer token-a' } },
    );
    expect(attempt.status).toBe(404);
  });
});

describe('Subscription status governs access, never address', () => {
  it('stops every Knowledge route while the subscription is suspended', async () => {
    const subscriptionId = await onboard(harness, {
      token: 'token-a',
      sub: 'user-a',
      email: 'a@example.com',
    });
    const vaultId = await createVault(harness, 'token-a', 'Normas de A');

    await harness.app.request(`/access/platform/subscriptions/${subscriptionId}/suspend`, {
      method: 'POST',
      headers: { authorization: 'Bearer platform-token' },
    });

    const blocked = await harness.app.request(`/knowledge/vaults/${vaultId}`, {
      headers: { authorization: 'Bearer token-a' },
    });
    expect(blocked.status).toBe(403);
    const body = (await blocked.json()) as { details?: { status?: string } };
    expect(body.details?.status).toBe('suspended');

    // Reactivating brings the SAME data back, under the same identifier.
    await harness.app.request(`/access/platform/subscriptions/${subscriptionId}/reactivate`, {
      method: 'POST',
      headers: { authorization: 'Bearer platform-token', 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    const restored = await harness.app.request(`/knowledge/vaults/${vaultId}`, {
      headers: { authorization: 'Bearer token-a' },
    });
    expect(restored.status).toBe(200);
    expect(SubscriptionId.fromClaim(subscriptionId).ok).toBe(true);
  });
});
