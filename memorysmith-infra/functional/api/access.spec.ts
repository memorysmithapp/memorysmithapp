/**
 * Access: the session, subscriptions, members and the platform queue
 * (software-vision.md, sections 5 and 8; architecture-guide.md, section 8).
 *
 * The accounts of the run never become members of each other's subscriptions:
 * a membership would break the isolation another case asserts. A case that
 * needs a member, or a subscription to approve, creates an account of its own.
 */

import { apiToken, localeOf } from '../support/accounts.js';
import type { Api } from '../support/api.js';
import { expect, test, unknownId } from './fixtures.js';

interface Session {
  user: { userId: string; email: string; isPlatformAdmin: boolean };
  activeSubscription: { subscriptionId: string; status: string; quota: string } | null;
  subscriptions: Array<{ subscriptionId: string; status: string; quota: string; isOwner: boolean }>;
  role: string;
  welcomeSeen: boolean;
}

test.describe('the session', () => {
  test('[route:GET /access/session] says who signed in, what they own and the role it gives them', async ({
    owner,
    state,
  }) => {
    const session = await owner.ok<Session>('GET', '/access/session');

    expect(session.user.email).toBe(state.accounts.owner.email);
    expect(session.user.isPlatformAdmin).toBe(false);
    expect(session.activeSubscription?.subscriptionId).toBe(state.accounts.owner.subscriptionId);
    expect(session.role).toBe('OWNER');
  });

  test('[route:POST /access/session/subscription] switches to a subscription the account holds, and to no other', async ({
    owner,
    state,
  }) => {
    const own = await owner.call('POST', '/access/session/subscription', {
      subscriptionId: state.accounts.owner.subscriptionId,
    });
    const foreign = await owner.call<{ code: string }>('POST', '/access/session/subscription', {
      subscriptionId: state.accounts.other.subscriptionId,
    });

    expect(own.status).toBe(204);
    expect(foreign.status).toBe(404);
  });

  test('[route:GET /access/connector] names no connector for a session of the interface', async ({
    owner,
  }) => {
    expect((await owner.call('GET', '/access/connector')).status).toBe(404);
  });

  test('[route:PUT /access/session/locale] records the language every message to the account is written in, and refuses one the product does not write in', async ({
    owner,
    state,
  }) => {
    const chosen = await owner.call('PUT', '/access/session/locale', { locale: 'en_US' });
    const unknown = await owner.call<{ code: string }>('PUT', '/access/session/locale', {
      locale: 'fr_FR',
    });

    expect(chosen.status).toBe(204);
    expect(unknown.status).toBe(400);
    expect(unknown.body.code).toBe('VALIDATION');
    expect(await localeOf(state, state.accounts.owner)).toBe('en_US');
  });

  test('[route:POST /access/session/welcomed] records the welcome once, and the session says so from then on', async ({
    owner,
  }) => {
    const recorded = await owner.call('POST', '/access/session/welcomed');
    const after = await owner.ok<Session>('GET', '/access/session');
    // Twice, because the second one is what the user menu does: it may not
    // move the date, and it may not fail either.
    const again = await owner.call('POST', '/access/session/welcomed');

    expect(recorded.status).toBe(204);
    expect(after.welcomeSeen).toBe(true);
    expect(again.status).toBe(204);
  });
});

test.describe('subscriptions', () => {
  test('[route:POST /access/subscriptions] asks for a subscription once, and names the one already owned', async ({
    owner,
    newcomer,
    state,
  }) => {
    const asked = await newcomer.api.call<{ subscriptionId: string }>(
      'POST',
      '/access/subscriptions',
      { type: 'individual', quota: '500MB' },
    );
    const again = await owner.call<{ code: string; details: { subscriptionId: string } }>(
      'POST',
      '/access/subscriptions',
      { type: 'individual', quota: '1GB' },
    );

    expect(asked.status).toBe(201);
    expect(again.status).toBe(409);
    expect(again.body.details.subscriptionId).toBe(state.accounts.owner.subscriptionId);

    // Nothing is written in a subscription nobody approved.
    const fresh = newcomer.api.as(await apiToken(state, newcomer.account, true));
    expect((await fresh.call('GET', '/knowledge/notebooks')).status).toBe(403);
  });
});

test.describe('members', () => {
  test('[route:GET /access/members] lists the members of the subscription, to its owner', async ({
    owner,
  }) => {
    const answer = await owner.call<unknown[]>('GET', '/access/members');

    expect(answer.status).toBe(200);
    expect(Array.isArray(answer.body)).toBe(true);
  });

  test('[route:PATCH /access/members/:user] [route:DELETE /access/members/:user] refuses to change or remove who is not a member, and never the owner', async ({
    owner,
  }) => {
    const session = await owner.ok<Session>('GET', '/access/session');
    const stranger = unknownId();

    expect(
      (await owner.call('PATCH', `/access/members/${stranger}`, { role: 'EDITOR' })).status,
    ).toBe(404);
    expect((await owner.call('DELETE', `/access/members/${stranger}`)).status).toBe(404);
    expect((await owner.call('DELETE', `/access/members/${session.user.userId}`)).status).toBe(409);
  });

  test('[route:POST /access/subscriptions/:s/ownership] hands the subscription only to one of its members', async ({
    owner,
    state,
  }) => {
    const answer = await owner.call<{ code: string }>(
      'POST',
      `/access/subscriptions/${state.accounts.owner.subscriptionId}/ownership`,
      { toUserId: unknownId() },
    );

    expect(answer.status).toBe(400);
    expect(answer.body.code).toBe('VALIDATION');
  });
});

test.describe('the platform', () => {
  const pending = async (newcomer: { api: Api }) =>
    (
      await newcomer.api.ok<{ subscriptionId: string }>('POST', '/access/subscriptions', {
        type: 'individual',
        quota: '500MB',
      })
    ).subscriptionId;

  test('[route:GET /access/platform/subscriptions] shows the queue to a platform administrator, and to nobody else', async ({
    admin,
    owner,
    newcomer,
  }) => {
    const subscriptionId = await pending(newcomer);

    const queue = await admin.ok<Array<{ subscriptionId: string; ownerEmail: string }>>(
      'GET',
      '/access/platform/subscriptions?status=pending_approval',
    );
    expect(queue.find((each) => each.subscriptionId === subscriptionId)?.ownerEmail).toBe(
      newcomer.account.email,
    );
    expect((await owner.call('GET', '/access/platform/subscriptions')).status).toBe(404);
  });

  test('[route:POST /access/platform/subscriptions/:s/approve] [route:POST /access/platform/subscriptions/:s/suspend] [route:POST /access/platform/subscriptions/:s/reactivate] takes a subscription through its life', async ({
    admin,
    newcomer,
    state,
  }) => {
    const subscriptionId = await pending(newcomer);
    const base = `/access/platform/subscriptions/${subscriptionId}`;
    const statusSeen = async () =>
      (
        await newcomer.api
          .as(await apiToken(state, newcomer.account, true))
          .ok<Session>('GET', '/access/session')
      ).subscriptions.find((each) => each.subscriptionId === subscriptionId)?.status;

    expect((await admin.call('POST', `${base}/approve`, { status: 'trial' })).status).toBe(204);
    expect(await statusSeen()).toBe('trial');
    expect((await admin.call('POST', `${base}/suspend`)).status).toBe(204);
    expect(await statusSeen()).toBe('suspended');
    expect((await admin.call('POST', `${base}/reactivate`, { status: 'active' })).status).toBe(204);
    expect(await statusSeen()).toBe('active');
  });

  test('[route:POST /access/platform/subscriptions/:s/reject] rejects a request with a reason, and never without one', async ({
    admin,
    newcomer,
  }) => {
    const subscriptionId = await pending(newcomer);
    const base = `/access/platform/subscriptions/${subscriptionId}`;

    expect((await admin.call('POST', `${base}/reject`, {})).status).toBe(400);
    expect(
      (await admin.call('POST', `${base}/reject`, { reason: 'A functional case asked for it.' }))
        .status,
    ).toBe(204);
  });

  test('[route:PUT /access/platform/subscriptions/:s/status] [route:PATCH /access/platform/subscriptions/:s/plan] sets a status outside the transitions, and changes the plan', async ({
    admin,
    newcomer,
    state,
  }) => {
    const subscriptionId = await pending(newcomer);
    const base = `/access/platform/subscriptions/${subscriptionId}`;

    expect((await admin.call('PUT', `${base}/status`, { status: 'canceled' })).status).toBe(204);
    expect((await admin.call('PATCH', `${base}/plan`, { quota: '2GB' })).status).toBe(204);

    const session = await newcomer.api
      .as(await apiToken(state, newcomer.account, true))
      .ok<Session>('GET', '/access/session');
    const link = session.subscriptions.find((each) => each.subscriptionId === subscriptionId);
    expect(link?.status).toBe('canceled');
    expect(link?.quota).toBe('2GB');
  });

  test('knows a platform administrator, who operates the platform and owns nothing in it', async ({
    admin,
    state,
  }) => {
    const session = await admin.ok<Session>('GET', '/access/session');

    expect(session.user.email).toBe(state.accounts.admin.email);
    expect(session.user.isPlatformAdmin).toBe(true);
    expect(session.activeSubscription).toBeNull();
  });
});
