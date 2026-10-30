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

import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { UserId } from '@memorysmithapp/kernel';
import { Email } from '@memorysmithapp/svc-access/domain/values';
import { outboxItemFor } from '@memorysmithapp/svc-access/adapters/items';
import { envelopeOf } from '@memorysmithapp/svc-knowledge/adapters/relay';
import { parseEvent } from '@memorysmithapp/contracts';
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

async function share(email = GRANTEE.email, profile?: string): Promise<Response> {
  return call(OWNER.token, `/access/notebooks/${notebookId}/shares`, {
    method: 'POST',
    // Without a profile, as a client from before the profiles asks: a reader.
    body: profile ? { email, profile } : { email, access: 'read' },
  });
}

async function changeProfile(profile: string): Promise<Response> {
  return call(OWNER.token, `/access/notebooks/${notebookId}/shares/${GRANTEE.sub}/profile`, {
    method: 'PUT',
    body: { profile },
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
        profile: 'reader',
        pendingProfile: null,
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

  it('refuses a profile it does not know', async () => {
    const refused = await call(OWNER.token, `/access/notebooks/${notebookId}/shares`, {
      method: 'POST',
      body: { email: GRANTEE.email, profile: 'owner' },
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
    // Moving a note to another folder is a write like any other (RN-KNW-057).
    const move = await call(
      GRANTEE.token,
      `/knowledge/notebooks/${notebookId}/notes/${noteId}/move`,
      { method: 'POST', body: { toFolderId: folderId } },
    );
    expect(move.status).toBe(403);
    expect((await json<{ message: string }>(move)).message).toContain(OWNER.email);

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

describe('the profiles of a share (#347)', () => {
  async function noteOf(): Promise<string> {
    const notes = await json<{ notes: Array<{ noteId: string }> } | Array<{ noteId: string }>>(
      await call(OWNER.token, `/knowledge/notebooks/${notebookId}/notes`),
    );
    return (Array.isArray(notes) ? notes : notes.notes)[0]!.noteId;
  }

  async function createNote(name: string): Promise<Response> {
    return call(GRANTEE.token, `/knowledge/notebooks/${notebookId}/notes`, {
      method: 'POST',
      body: { folderId, content: `---\nname: ${name}\n---\n\n# ${name}\n` },
    });
  }

  async function createFolder(name: string): Promise<Response> {
    return call(GRANTEE.token, `/knowledge/notebooks/${notebookId}/folders`, {
      method: 'POST',
      body: { name, description: 'Uma pasta.' },
    });
  }

  it('lets a content editor work with the notes, and nothing of the structure', async () => {
    expect((await share(GRANTEE.email, 'content-editor')).status).toBe(204);
    await accept();

    const detail = await json<{ permissions: Record<string, boolean> }>(
      await call(GRANTEE.token, `/knowledge/notebooks/${notebookId}`),
    );
    expect(detail.permissions).toEqual({ writeContent: true, maintain: false, administer: false });

    expect((await createNote('Lei 8.666')).status).toBe(201);
    const noteId = await noteOf();
    const edited = await call(GRANTEE.token, `/knowledge/notebooks/${notebookId}/notes/${noteId}`, {
      method: 'GET',
    });
    expect(edited.status).toBe(200);

    const folder = await createFolder('Minhas');
    expect(folder.status).toBe(403);
    const refusal = await json<{ message: string; details?: Record<string, unknown> }>(folder);
    expect(refusal.message).toContain(OWNER.email);
    expect(refusal.message).toContain('folders, Guidance or Templates');

    const guidance = await call(GRANTEE.token, `/knowledge/notebooks/${notebookId}/guidance`, {
      method: 'PUT',
      body: { content: '# Outra orientação' },
    });
    expect(guidance.status).toBe(403);
    expect(
      (await call(GRANTEE.token, `/knowledge/notebooks/${notebookId}`, { method: 'DELETE' }))
        .status,
    ).toBe(403);
    // Sharing stays the owner's: the grantee's own session holds no such notebook.
    expect(
      (
        await call(GRANTEE.token, `/access/notebooks/${notebookId}/shares`, {
          method: 'POST',
          body: { email: 'third@example.com', profile: 'reader' },
        })
      ).status,
    ).toBe(404);
  });

  it('lets a notebook editor maintain the structure, and never administer', async () => {
    expect((await share(GRANTEE.email, 'notebook-editor')).status).toBe(204);
    await accept();

    expect((await createFolder('Decretos')).status).toBe(201);
    expect((await createNote('Decreto 1')).status).toBe(201);
    expect(
      (await call(GRANTEE.token, `/knowledge/notebooks/${notebookId}`, { method: 'DELETE' }))
        .status,
    ).toBe(403);
    expect(
      (
        await call(GRANTEE.token, `/knowledge/notebooks/${notebookId}`, {
          method: 'PATCH',
          body: { name: 'Outro nome' },
        })
      ).status,
    ).toBe(403);
  });

  it('grants an increase only once the grantee accepts it again', async () => {
    await share();
    await accept();
    expect((await changeProfile('content-editor')).status).toBe(204);

    // Until the renewed acceptance, the accepted reader is what applies.
    expect((await createNote('Antes do aceite')).status).toBe(403);
    const waiting = await json<Array<{ profile: string; pendingProfile: string | null }>>(
      await call(GRANTEE.token, '/access/shared'),
    );
    expect(waiting).toEqual([
      expect.objectContaining({ profile: 'reader', pendingProfile: 'content-editor' }),
    ]);
    const notices = await json<{ notifications: Array<{ kind: string }> }>(
      await call(GRANTEE.token, '/access/notifications'),
    );
    expect(notices.notifications.map((notice) => notice.kind)).toEqual(['increase']);
    const owners = await json<Array<{ profile: string; pendingProfile: string | null }>>(
      await call(OWNER.token, `/access/notebooks/${notebookId}/shares`),
    );
    expect(owners).toEqual([
      expect.objectContaining({ profile: 'reader', pendingProfile: 'content-editor' }),
    ]);

    expect(
      (
        await call(GRANTEE.token, `/access/shared/${notebookId}/increase/accept`, {
          method: 'POST',
        })
      ).status,
    ).toBe(204);
    expect((await createNote('Depois do aceite')).status).toBe(201);
    expect(harness.events.ofType('NotebookShareProfileChanged')).toHaveLength(1);
    expect(harness.events.ofType('NotebookShareIncreaseAccepted')).toHaveLength(1);
  });

  it('keeps the accepted profile when an increase is rejected', async () => {
    await share(GRANTEE.email, 'content-editor');
    await accept();
    await changeProfile('notebook-editor');
    expect(
      (
        await call(GRANTEE.token, `/access/shared/${notebookId}/increase/reject`, {
          method: 'POST',
        })
      ).status,
    ).toBe(204);
    expect((await createFolder('Recusada')).status).toBe(403);
    expect((await createNote('Ainda posso')).status).toBe(201);
  });

  it('applies a reduction from the next request, asking nobody', async () => {
    await share(GRANTEE.email, 'notebook-editor');
    await accept();
    expect((await createFolder('Antes')).status).toBe(201);
    expect((await changeProfile('reader')).status).toBe(204);
    expect((await createFolder('Depois')).status).toBe(403);
    expect((await createNote('Depois')).status).toBe(403);
  });

  it('reaches no other notebook of the owner, whatever the profile', async () => {
    await share(GRANTEE.email, 'notebook-editor');
    await accept();
    const other = (
      await json<{ notebookId: string; folderId?: string }>(
        await call(OWNER.token, '/knowledge/notebooks', {
          method: 'POST',
          body: { name: 'Privado', description: 'Só do dono' },
        }),
      )
    ).notebookId;
    const otherFolder = (
      await json<{ folderId: string }>(
        await call(OWNER.token, `/knowledge/notebooks/${other}/folders`, {
          method: 'POST',
          body: { name: 'Privada', description: 'Só do dono.' },
        }),
      )
    ).folderId;
    // A move out of the shared notebook into one that is not shared is not a door.
    const noteId = await noteOf();
    const move = await call(
      GRANTEE.token,
      `/knowledge/notebooks/${notebookId}/notes/${noteId}/move`,
      { method: 'POST', body: { toNotebookId: other, toFolderId: otherFolder } },
    );
    expect(move.status).toBe(404);
    expect((await call(GRANTEE.token, `/knowledge/notebooks/${other}`)).status).toBe(404);
  });

  it('lets a content editor keep a file in parts, refusing the next step once reduced', async () => {
    await share(GRANTEE.email, 'content-editor');
    await accept();
    const whole = Buffer.alloc(3000);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(whole);
    for (let index = 8; index < whole.length; index += 1) whole[index] = (index * 31) % 251;
    const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
    const begin = (name: string) =>
      call(GRANTEE.token, '/portability/uploads', {
        method: 'POST',
        body: {
          notebookId,
          name,
          mimeType: 'image/png',
          purpose: 'A photo for the notebook',
          size: whole.length,
          sha256: sha(whole),
          transport: 'inline',
          partSize: 2048,
        },
      });
    const sendAll = async (transferId: string) => {
      for (const [part, bytes] of [whole.subarray(0, 2048), whole.subarray(2048)].entries()) {
        const sent = await call(
          GRANTEE.token,
          `/portability/uploads/${transferId}/parts/${part + 1}`,
          {
            method: 'PUT',
            body: { sha256: sha(bytes), contentBase64: Buffer.from(bytes).toString('base64') },
          },
        );
        expect(sent.status).toBe(200);
      }
    };

    const started = await begin('foto do grantee');
    expect(started.status).toBe(201);
    const { transfer } = (await started.json()) as { transfer: { transferId: string } };
    await sendAll(transfer.transferId);
    const finished = await call(
      GRANTEE.token,
      `/portability/uploads/${transfer.transferId}/finish`,
      {
        method: 'POST',
      },
    );
    expect(finished.status).toBe(200);
    // The file is the owner's notebook's, kept where its owner reads it.
    const files = (await (
      await call(OWNER.token, `/knowledge/notebooks/${notebookId}/files`)
    ).json()) as { files: Array<{ name: string }> };
    expect(files.files.map((file) => file.name)).toEqual(['foto do grantee']);

    // Reduced between two steps, the next one is refused.
    const second = await begin('outra foto');
    const { transfer: next } = (await second.json()) as { transfer: { transferId: string } };
    await sendAll(next.transferId);
    await changeProfile('reader');
    const refused = await call(GRANTEE.token, `/portability/uploads/${next.transferId}/finish`, {
      method: 'POST',
    });
    expect(refused.status).toBe(403);
    expect((await begin('mais uma')).status).toBe(403);
  });
});

describe('the tables and dashboards of a shared notebook (#366, #368)', () => {
  const tables = () => `/knowledge/notebooks/${notebookId}/tables`;
  const SCHEMA = { type: 'object', properties: { valor: { type: 'number' } } };

  async function seed(): Promise<void> {
    await call(OWNER.token, tables(), { method: 'POST', body: { name: 'gastos', schema: SCHEMA } });
    await call(OWNER.token, `${tables()}/gastos/rows`, {
      method: 'POST',
      body: { rows: [{ valor: 10 }] },
    });
    await call(OWNER.token, `/knowledge/notebooks/${notebookId}/dashboards`, {
      method: 'POST',
      body: {
        name: 'Total',
        definition: {
          components: [{ type: 'kpi', source: { table: 'gastos', measure: 'sum(valor)' } }],
        },
      },
    });
  }

  it('reach a reader to read, and to write nothing', async () => {
    await seed();
    await share(GRANTEE.email, 'reader');
    await accept();
    const read = await call(GRANTEE.token, `${tables()}/gastos/query`, {
      method: 'POST',
      body: {},
    });
    expect(read.status).toBe(200);
    expect((await json<{ total: number }>(read)).total).toBe(1);
    const drawn = await call(
      GRANTEE.token,
      `/knowledge/notebooks/${notebookId}/dashboards/Total/data`,
      {
        method: 'POST',
        body: {},
      },
    );
    expect(drawn.status).toBe(200);
    expect(
      (
        await call(GRANTEE.token, `${tables()}/gastos/rows`, {
          method: 'POST',
          body: { rows: [{ valor: 1 }] },
        })
      ).status,
    ).toBe(403);
    expect((await call(GRANTEE.token, `${tables()}/gastos`, { method: 'DELETE' })).status).toBe(
      403,
    );
  });

  it('let a content editor write rows, and leave the structure to a notebook editor', async () => {
    await seed();
    await share(GRANTEE.email, 'content-editor');
    await accept();
    expect(
      (
        await call(GRANTEE.token, `${tables()}/gastos/rows`, {
          method: 'POST',
          body: { rows: [{ valor: 1 }] },
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await call(GRANTEE.token, tables(), {
          method: 'POST',
          body: { name: 'outra', schema: SCHEMA },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call(GRANTEE.token, `/knowledge/notebooks/${notebookId}/dashboards/Total`, {
          method: 'DELETE',
        })
      ).status,
    ).toBe(403);
  });
});
