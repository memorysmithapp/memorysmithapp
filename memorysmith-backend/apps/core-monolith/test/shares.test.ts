/**
 * A notebook shared with a person who holds another subscription
 * (RN-ACC-024 to RN-ACC-030): the one door through the boundary, opened by
 * the consent of both sides.
 *
 * Each case is held against the whole monolith, because the door is made of
 * three contexts: Access keeps the share, the core opens it on the path of a
 * notebook, and Knowledge, Discovery and Audit answer through it as if the
 * grantee were a reader of the owner's subscription.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { UserId } from '@memorysmith/kernel';
import { Email } from '@memorysmith/svc-access/domain/values';
import { outboxItemFor } from '@memorysmith/svc-access/adapters/items';
import { envelopeOf } from '@memorysmith/svc-knowledge/adapters/relay';
import { parseEvent } from '@memorysmith/contracts';
import { buildTestApp } from './wiring.js';

type App = ReturnType<typeof buildTestApp>;

let harness: App;
let ownerSubscription: string;
let notebookId: string;
let folderId: string;

const OWNER = { token: 'token-owner', sub: 'user-owner', email: 'owner@example.com' };
const GRANTEE = { token: 'token-grantee', sub: 'user-grantee', email: 'grantee@example.com' };

async function call(
  token: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<Response> {
  return harness.app.request(path, {
    method: init.method ?? 'GET',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function onboard(input: { token: string; sub: string; email: string }): Promise<string> {
  harness.verifier.issue(input.token, { sub: input.sub, email: input.email });
  const created = await call(input.token, '/access/subscriptions', { method: 'POST', body: {} });
  expect(created.status).toBe(201);
  const { subscriptionId } = await json<{ subscriptionId: string }>(created);
  harness.verifier.issue('platform-token', {
    sub: 'platform-admin',
    email: 'admin@memorysmith.app',
    groups: ['platform-admin'],
  });
  const approved = await call(
    'platform-token',
    `/access/platform/subscriptions/${subscriptionId}/approve`,
    {
      method: 'POST',
      body: { status: 'active' },
    },
  );
  expect(approved.status).toBe(204);
  harness.verifier.issue(input.token, {
    sub: input.sub,
    email: input.email,
    subscription_id: subscriptionId,
    subscription_status: 'active',
  });
  // Identity lives in the identity provider, which is where a share looks an e-mail up.
  const email = Email.create(input.email);
  const user = UserId.create(input.sub);
  if (email.ok && user.ok) harness.accounts.register(email.value, user.value);
  return subscriptionId;
}

async function share(email = GRANTEE.email): Promise<Response> {
  return call(OWNER.token, `/access/notebooks/${notebookId}/shares`, {
    method: 'POST',
    body: { email, access: 'read' },
  });
}

async function accept(): Promise<void> {
  expect(
    (await call(GRANTEE.token, `/access/shared/${notebookId}/accept`, { method: 'POST' })).status,
  ).toBe(204);
}

beforeEach(async () => {
  harness = buildTestApp();
  ownerSubscription = await onboard(OWNER);
  await onboard(GRANTEE);

  notebookId = (
    await json<{ notebookId: string }>(
      await call(OWNER.token, '/knowledge/notebooks', {
        method: 'POST',
        body: { name: 'Normas', description: 'Texto normativo por artigo' },
      }),
    )
  ).notebookId;
  folderId = (
    await json<{ folderId: string }>(
      await call(OWNER.token, `/knowledge/notebooks/${notebookId}/folders`, {
        method: 'POST',
        body: { name: 'Leis', description: 'Uma lei por nota.' },
      }),
    )
  ).folderId;
  await call(OWNER.token, `/knowledge/notebooks/${notebookId}/notes`, {
    method: 'POST',
    body: { folderId, content: '---\nname: Lei 14.133\n---\n\n# Lei 14.133\n\nLicitações.' },
  });
});

describe('sharing a notebook with a person of another subscription', () => {
  it('waits for the grantee, who sees only the name and the description until accepting', async () => {
    expect((await share()).status).toBe(204);

    const incoming = await json<Array<Record<string, unknown>>>(
      await call(GRANTEE.token, '/access/shared'),
    );
    expect(incoming).toEqual([
      expect.objectContaining({
        notebookId,
        name: 'Normas',
        description: 'Texto normativo por artigo',
        ownerEmail: OWNER.email,
        access: 'read',
        state: 'pending',
        noteCount: null,
        updatedAt: null,
      }),
    ]);

    // Nothing else of it is reachable before the answer (RN-ACC-026).
    expect((await call(GRANTEE.token, `/knowledge/notebooks/${notebookId}`)).status).toBe(404);
    expect((await call(GRANTEE.token, `/discovery/notebooks/${notebookId}/names`)).status).toBe(
      404,
    );

    const notices = await json<{ notifications: Array<{ kind: string; person: string }> }>(
      await call(GRANTEE.token, '/access/notifications'),
    );
    expect(notices.notifications).toEqual([
      expect.objectContaining({ kind: 'shared', person: OWNER.email, notebookName: 'Normas' }),
    ]);
  });

  it('answers an e-mail with no account exactly as any other, and keeps nothing', async () => {
    const answered = await share('nobody@example.com');
    expect(answered.status).toBe(204);
    const listed = await json<unknown[]>(
      await call(OWNER.token, `/access/notebooks/${notebookId}/shares`),
    );
    expect(listed).toEqual([]);
  });

  it('refuses read-write, which no share grants yet', async () => {
    const refused = await call(OWNER.token, `/access/notebooks/${notebookId}/shares`, {
      method: 'POST',
      body: { email: GRANTEE.email, access: 'read-write' },
    });
    expect(refused.status).toBe(400);
  });

  it('opens the whole notebook for reading once accepted, and refuses every write naming the owner', async () => {
    await share();
    await accept();

    // The owner is told, and sees the share as accepted.
    const ownerNotices = await json<{ notifications: Array<{ kind: string; person: string }> }>(
      await call(OWNER.token, '/access/notifications'),
    );
    expect(ownerNotices.notifications).toEqual([
      expect.objectContaining({ kind: 'accepted', person: GRANTEE.email }),
    ]);
    const lines = await json<Array<{ state: string }>>(
      await call(OWNER.token, `/access/notebooks/${notebookId}/shares`),
    );
    expect(lines.map((line) => line.state)).toEqual(['accepted']);
    const all = await json<Array<{ notebookId: string; state: string }>>(
      await call(OWNER.token, '/access/shares'),
    );
    expect(all).toEqual([expect.objectContaining({ notebookId, state: 'accepted' })]);
    expect(await json<unknown[]>(await call(GRANTEE.token, '/access/shares'))).toEqual([]);

    // Everything a reader reaches (RN-ACC-027).
    const notebook = await call(GRANTEE.token, `/knowledge/notebooks/${notebookId}`);
    expect(notebook.status).toBe(200);
    expect((await json<{ effectiveRole: string }>(notebook)).effectiveRole).toBe('VIEWER');
    expect((await call(GRANTEE.token, `/knowledge/notebooks/${notebookId}/context`)).status).toBe(
      200,
    );
    const notes = await json<{ notes: Array<{ noteId: string }> } | Array<{ noteId: string }>>(
      await call(GRANTEE.token, `/knowledge/notebooks/${notebookId}/notes`),
    );
    const listed = Array.isArray(notes) ? notes : notes.notes;
    expect(listed).toHaveLength(1);
    const noteId = listed[0]!.noteId;
    expect(
      (await call(GRANTEE.token, `/knowledge/notebooks/${notebookId}/notes/${noteId}`)).status,
    ).toBe(200);
    expect(
      (await call(GRANTEE.token, `/audit/notebooks/${notebookId}/notes/${noteId}/history`)).status,
    ).toBe(200);
    expect(
      (
        await call(GRANTEE.token, `/discovery/notebooks/${notebookId}/search`, {
          method: 'POST',
          body: { query: 'Licitações' },
        })
      ).status,
    ).toBe(200);

    // A write is refused visibly, with the reason and the owner.
    const write = await call(GRANTEE.token, `/knowledge/notebooks/${notebookId}/folders`, {
      method: 'POST',
      body: { name: 'Minhas', description: 'Não deveria existir.' },
    });
    expect(write.status).toBe(403);
    expect((await json<{ message: string }>(write)).message).toContain(OWNER.email);

    // The card now carries what a card shows.
    const incoming = await json<Array<{ state: string; noteCount: number | null }>>(
      await call(GRANTEE.token, '/access/shared'),
    );
    // The count is the relay's, which this harness does not run: what matters
    // is that an accepted share carries one and a pending one does not.
    expect(incoming).toEqual([
      expect.objectContaining({ state: 'accepted', noteCount: expect.any(Number) }),
    ]);

    // And the grantee's own list stays their own: a shared notebook appears on
    // Home only, from /access/shared (RN-ACC-030).
    const own = await json<unknown[]>(await call(GRANTEE.token, '/knowledge/notebooks'));
    expect(own).toEqual([]);

    expect(harness.events.ofType('NotebookShared')).toHaveLength(1);
    expect(harness.events.ofType('NotebookShareAccepted')).toHaveLength(1);
  });

  it('lets the owner share again after a rejection, which the owner is told of', async () => {
    await share();
    expect(
      (await call(GRANTEE.token, `/access/shared/${notebookId}/reject`, { method: 'POST' })).status,
    ).toBe(204);

    expect(await json<unknown[]>(await call(GRANTEE.token, '/access/shared'))).toEqual([]);
    const notices = await json<{ notifications: Array<{ kind: string }> }>(
      await call(OWNER.token, '/access/notifications'),
    );
    expect(notices.notifications.map((notice) => notice.kind)).toEqual(['rejected']);

    expect((await share()).status).toBe(204);
    const lines = await json<Array<{ state: string }>>(
      await call(OWNER.token, `/access/notebooks/${notebookId}/shares`),
    );
    expect(lines.map((line) => line.state)).toEqual(['pending']);
  });

  it('closes the door on a revocation, and tells the grantee until they dismiss it', async () => {
    await share();
    await accept();
    const revoked = await call(
      OWNER.token,
      `/access/notebooks/${notebookId}/shares/${GRANTEE.sub}`,
      {
        method: 'DELETE',
      },
    );
    expect(revoked.status).toBe(204);

    expect((await call(GRANTEE.token, `/knowledge/notebooks/${notebookId}`)).status).toBe(404);
    expect(await json<unknown[]>(await call(GRANTEE.token, '/access/shared'))).toEqual([]);
    const notices = await json<{ notifications: Array<{ kind: string }> }>(
      await call(GRANTEE.token, '/access/notifications'),
    );
    expect(notices.notifications.map((notice) => notice.kind)).toEqual(['revoked']);

    expect(
      (await call(GRANTEE.token, `/access/shared/${notebookId}`, { method: 'DELETE' })).status,
    ).toBe(204);
    const after = await json<{ notifications: unknown[] }>(
      await call(GRANTEE.token, '/access/notifications'),
    );
    expect(after.notifications).toEqual([]);
  });

  it('lets the grantee leave without telling the owner, whose list still says so', async () => {
    await share();
    await accept();
    await call(OWNER.token, `/access/notebooks/${notebookId}/shares/${GRANTEE.sub}/seen`, {
      method: 'POST',
    });

    const left = await call(GRANTEE.token, `/access/shared/${notebookId}/leave`, {
      method: 'POST',
      body: { notifyOwner: false },
    });
    expect(left.status).toBe(204);
    expect((await call(GRANTEE.token, `/knowledge/notebooks/${notebookId}`)).status).toBe(404);

    const notices = await json<{ notifications: unknown[] }>(
      await call(OWNER.token, '/access/notifications'),
    );
    expect(notices.notifications).toEqual([]);
    const lines = await json<Array<{ state: string }>>(
      await call(OWNER.token, `/access/notebooks/${notebookId}/shares`),
    );
    expect(lines.map((line) => line.state)).toEqual(['left']);
  });

  it("hides the notebook while the owner's subscription grants no access", async () => {
    await share();
    await accept();
    const suspended = await call(
      'platform-token',
      `/access/platform/subscriptions/${ownerSubscription}/suspend`,
      {
        method: 'POST',
        body: { reason: 'Pagamento' },
      },
    );
    expect(suspended.status).toBe(204);

    expect(await json<unknown[]>(await call(GRANTEE.token, '/access/shared'))).toEqual([]);
    expect((await call(GRANTEE.token, `/knowledge/notebooks/${notebookId}`)).status).toBe(404);
  });

  it('takes every share of a notebook with it when the notebook is deleted', async () => {
    await share();
    await accept();
    expect(
      (await call(OWNER.token, `/knowledge/notebooks/${notebookId}`, { method: 'DELETE' })).status,
    ).toBe(204);

    expect(await json<unknown[]>(await call(GRANTEE.token, '/access/shared'))).toEqual([]);
    expect([...harness.accessDb.shares.keys()]).toEqual([]);
  });

  it('lets the grantee export it, kept as a transfer of their own', async () => {
    await share();
    await accept();
    const started = await call(GRANTEE.token, `/portability/notebooks/${notebookId}/export`, {
      method: 'POST',
    });
    expect(started.status).toBe(202);
    const { transferId } = await json<{ transferId: string }>(started);

    const transfer = await json<{ status: string; total: number }>(
      await call(GRANTEE.token, `/portability/transfers/${transferId}`),
    );
    expect(transfer.status).toBe('ready');
    expect(transfer.total).toBe(1);
    // It is the grantee's: the owner's Transfers never see it.
    expect((await call(OWNER.token, `/portability/transfers/${transferId}`)).status).toBe(404);
  });

  it('is offered to the owner alone: a grantee cannot share what was shared with them', async () => {
    await share();
    await accept();
    const attempt = await call(GRANTEE.token, `/access/notebooks/${notebookId}/shares`, {
      method: 'POST',
      body: { email: 'third@example.com', access: 'read' },
    });
    expect(attempt.status).toBe(404);
  });

  it('writes events the relay of Access publishes, each valid against its schema', async () => {
    await share();
    await accept();
    await call(GRANTEE.token, `/access/shared/${notebookId}/leave`, {
      method: 'POST',
      body: { notifyOwner: true },
    });
    await share();
    await call(GRANTEE.token, `/access/shared/${notebookId}/reject`, { method: 'POST' });
    await share();
    await call(OWNER.token, `/access/notebooks/${notebookId}/shares/${GRANTEE.sub}`, {
      method: 'DELETE',
    });

    // The relay validates every envelope before publishing it, and one that
    // fails holds the whole batch back: so every event of a share is put
    // through exactly what the relay does with it.
    const shareEvents = harness.events.published.filter((event) =>
      event.type.startsWith('NotebookShare'),
    );
    expect(shareEvents.map((event) => event.type)).toEqual([
      'NotebookShared',
      'NotebookShareAccepted',
      'NotebookShareLeft',
      'NotebookShared',
      'NotebookShareRejected',
      'NotebookShared',
      'NotebookShareRevoked',
    ]);
    for (const event of shareEvents) {
      expect(event.subscriptionId.value).toBe(ownerSubscription);
      expect(() =>
        parseEvent(envelopeOf(outboxItemFor(event, `S#${ownerSubscription}`))),
      ).not.toThrow();
    }
  });

  it('leaves no event of Access the relay would refuse, now that its outbox is drained', async () => {
    // Onboarding, approval and a suspension: events Access wrote for versions
    // and that nothing published until its relay existed.
    await call('platform-token', `/access/platform/subscriptions/${ownerSubscription}/suspend`, {
      method: 'POST',
      body: { reason: 'Pagamento' },
    });
    await call('platform-token', `/access/platform/subscriptions/${ownerSubscription}/reactivate`, {
      method: 'POST',
      body: {},
    });
    const accessEvents = harness.events.published.filter((event) =>
      ['SUBSCRIPTION', 'MEMBER'].includes(event.subject),
    );
    expect(accessEvents.length).toBeGreaterThan(0);
    for (const event of accessEvents) {
      expect(() =>
        parseEvent(envelopeOf(outboxItemFor(event, `S#${event.subscriptionId.value}`))),
      ).not.toThrow();
    }
  });
});
