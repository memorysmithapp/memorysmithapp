/**
 * Access: the session, subscriptions, members and the platform queue
 * (software-vision.md, sections 5 and 8; architecture-guide.md, section 8).
 *
 * The accounts of the run never become members of each other's subscriptions:
 * a membership would break the isolation another case asserts. A case that
 * needs a member, or a subscription to approve, creates an account of its own.
 */

import { subscriptionUsageSchema } from '@memorysmith/contracts';
import { apiToken, localeOf } from '../support/accounts.js';
import { eventually } from '../support/eventually.js';
import type { Api } from '../support/api.js';
import { expect, test, unknownId } from './fixtures.js';

interface Session {
  user: { userId: string; email: string; name: string; isPlatformAdmin: boolean; avatar: string };
  activeSubscription: { subscriptionId: string; status: string; quota: string } | null;
  subscriptions: Array<{ subscriptionId: string; status: string; quota: string; isOwner: boolean }>;
  role: string;
  usedBytes: number;
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

  test('[route:GET /access/usage] says what fills the space, from the same total the session says', async ({
    owner,
  }) => {
    // One budget, joined in one place: the panel and the session never disagree.
    // Another case may write between the two reads, so the pair is read again
    // until it is read at one moment; it is never accepted apart.
    const { usage } = await eventually(
      'the usage and the session reading the same total',
      async () => ({
        usage: subscriptionUsageSchema.parse(await owner.ok('GET', '/access/usage')),
        session: await owner.ok<Session>('GET', '/access/session'),
      }),
      ({ usage: read, session }) => read.usedBytes === session.usedBytes,
    );

    expect(usage.quotaBytes).toBeGreaterThan(0);
    // Largest first, which is the order the screen draws them in.
    const bytes = usage.notebooks.map((line) => line.bytes);
    expect(bytes).toEqual([...bytes].sort((left, right) => right - left));
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

test.describe('the person', () => {
  test('[route:GET /access/profile] [route:PUT /access/profile] records the name the person typed, and the session answers it from then on', async ({
    owner,
  }) => {
    const chosen = `Owner ${Date.now()}`;
    const saved = await owner.call('PUT', '/access/profile', {
      name: chosen,
      avatar: 'initials',
    });
    const profile = await owner.ok<{ name: string; avatar: string; email: string }>(
      'GET',
      '/access/profile',
    );
    const session = await owner.ok<Session>('GET', '/access/session');

    expect(saved.status).toBe(204);
    expect(profile.name).toBe(chosen);
    expect(profile.avatar).toBe('initials');
    // And the name wins over the one the TOKEN carries, which is the one that
    // was true when it was minted (RN-ACC-021).
    expect(session.user.name).toBe(chosen);
    expect(session.user.avatar).toBe('initials');
  });

  test('[route:PUT /access/profile] refuses a name that is not one, and a source that does not exist', async ({
    owner,
  }) => {
    const empty = await owner.call<{ code: string }>('PUT', '/access/profile', {
      name: '   ',
      avatar: 'gravatar',
    });
    const invented = await owner.call<{ code: string }>('PUT', '/access/profile', {
      name: 'Owner',
      avatar: 'a-url-of-my-own',
    });
    // And a source with nothing behind it: choosing the upload without ever
    // having sent a picture would leave every screen drawing nothing.
    const nothing = await owner.call<{ code: string }>('PUT', '/access/profile', {
      name: 'Owner',
      avatar: 'upload',
    });

    expect(empty.status).toBe(400);
    expect(invented.status).toBe(400);
    expect(invented.body.code).toBe('VALIDATION');
    expect(nothing.status).toBe(400);
  });

  test('[route:PUT /access/profile/picture] keeps a picture and refuses bytes that are not the type they claim', async ({
    owner,
  }) => {
    // The smallest real PNG there is, which is what makes this a check of the
    // BYTES and not of a name: nothing here is called anything.
    const png =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const kept = await owner.call('PUT', '/access/profile/picture', {
      mime: 'image/png',
      bytes: png,
    });
    const profile = await owner.ok<{ picture: string | null }>('GET', '/access/profile');
    // A PDF declared as a picture: the bytes say otherwise and that is what decides.
    const lying = await owner.call<{ code: string }>('PUT', '/access/profile/picture', {
      mime: 'image/png',
      bytes: Buffer.from('%PDF-1.7\n').toString('base64'),
    });
    const unknown = await owner.call<{ code: string }>('PUT', '/access/profile/picture', {
      mime: 'image/gif',
      bytes: png,
    });

    expect(kept.status).toBe(204);
    expect(profile.picture?.startsWith('data:image/png;base64,')).toBe(true);
    expect(lying.status).toBe(400);
    expect(unknown.status).toBe(400);
  });

  test('[route:POST /access/password] refuses a change that does not state the current password', async ({
    owner,
  }) => {
    /**
     * The refusal and not the change: changing the password of the account the
     * rest of this suite signs in with would end every other case of the run.
     * What is worth proving here is the half that guards it, and that the
     * refusal says nothing about WHICH half failed.
     */
    const wrong = await owner.call<{ code: string; message: string }>('POST', '/access/password', {
      current: 'not-the-password-of-this-account',
      next: 'Another-Password-12345',
    });
    const empty = await owner.call<{ code: string }>('POST', '/access/password', {
      current: '',
      next: 'Another-Password-12345',
    });

    expect(wrong.status).toBe(400);
    expect(wrong.body.code).toBe('VALIDATION');
    expect(wrong.body.message).not.toContain('password policy');
    expect(empty.status).toBe(400);
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
