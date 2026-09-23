/**
 * What fills the space of a subscription, end to end over HTTP (#197,
 * RN-SUB-024).
 *
 * The counters are what the relay would have made of every event the harness
 * recorded, through the same arithmetic; what is proved here is the route: that
 * its total is the one the session says, that the totals are the subscription's
 * whoever asks, and that the lines per notebook are the requester's.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { sessionSchema, subscriptionUsageSchema } from '@memorysmith/contracts';
import { Authorship, createEvent, Role, SubscriptionId, UserId } from '@memorysmith/kernel';
import { Email, StorageQuota } from '@memorysmith/svc-access/domain/values';
import { buildTestApp } from './wiring.js';

type App = ReturnType<typeof buildTestApp>;
let harness: App;
let subscriptionId = '';

const OWNER = 'token-owner';
const MEMBER = 'token-member';
const STRANGER = 'token-stranger';

/** A PNG of one pixel: the signature is what the check reads, not the picture. */
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]).toString('base64');

beforeEach(async () => {
  harness = buildTestApp();
  harness.verifier.issue(OWNER, { sub: 'user-owner', email: 'owner@example.com' });
  const created = await harness.app.request('/access/subscriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${OWNER}`, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  subscriptionId = ((await created.json()) as { subscriptionId: string }).subscriptionId;

  harness.verifier.issue('platform-token', {
    sub: 'platform-admin',
    email: 'admin@memorysmith.app',
    groups: ['platform-admin'],
  });
  await harness.app.request(`/access/platform/subscriptions/${subscriptionId}/approve`, {
    method: 'POST',
    headers: { authorization: 'Bearer platform-token', 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'active' }),
  });
  const claims = { subscription_id: subscriptionId, subscription_status: 'active' };
  harness.verifier.issue(OWNER, { sub: 'user-owner', email: 'owner@example.com', ...claims });
  harness.verifier.issue(MEMBER, { sub: 'user-member', email: 'member@example.com', ...claims });
  harness.verifier.issue(STRANGER, {
    sub: 'user-stranger',
    email: 'stranger@example.com',
    ...claims,
  });

  // A member of the subscription, the way the only door that makes one leaves
  // it: an EDITOR (RN-ACC-002).
  const stored = harness.accessDb.subscriptions.get(`S#${subscriptionId}`);
  if (!stored) throw new Error('The subscription was not created');
  const member = UserId.create('user-member');
  const email = Email.create('member@example.com');
  if (!member.ok || !email.ok) throw new Error('Unreachable');
  const added = stored.subscription.addMember(
    member.value,
    email.value,
    Role.EDITOR,
    null,
    Authorship.byHuman(member.value),
  );
  if (!added.ok) throw new Error(added.error.message);
});

async function call(
  path: string,
  init: { method?: string; body?: unknown; token?: string } = {},
): Promise<Response> {
  return harness.app.request(path, {
    method: init.method ?? 'GET',
    headers: {
      authorization: `Bearer ${init.token ?? OWNER}`,
      'content-type': 'application/json',
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

async function usage(token = OWNER) {
  const response = await call('/access/usage', { token });
  expect(response.status).toBe(200);
  return subscriptionUsageSchema.parse(await response.json());
}

/** Two notebooks, one holding a folder, a note, a file and a Guidance. */
async function seed(): Promise<{ full: string; empty: string }> {
  const full = (
    (await (
      await call('/knowledge/notebooks', {
        method: 'POST',
        body: { name: 'Normas', description: 'Texto normativo' },
      })
    ).json()) as { notebookId: string }
  ).notebookId;
  const empty = (
    (await (
      await call('/knowledge/notebooks', {
        method: 'POST',
        body: { name: 'Rascunhos', description: 'Nada ainda' },
      })
    ).json()) as { notebookId: string }
  ).notebookId;

  const folder = (await (
    await call(`/knowledge/notebooks/${full}/folders`, {
      method: 'POST',
      body: { name: 'Leis', description: 'Uma lei por nota.' },
    })
  ).json()) as { folderId: string };
  const note = await call(`/knowledge/notebooks/${full}/notes`, {
    method: 'POST',
    body: { folderId: folder.folderId, content: '---\nname: Lei 14.133\n---\n\nA regra geral.\n' },
  });
  expect(note.status).toBe(201);
  const file = await call(`/knowledge/notebooks/${full}/files`, {
    method: 'POST',
    body: { name: 'esquema', mimeType: 'image/png', contentBase64: PNG },
  });
  expect(file.status).toBe(201);
  const guidance = await call(`/knowledge/notebooks/${full}/guidance`, {
    method: 'PUT',
    body: { content: '# Como escrever\n\nUma norma por nota.\n' },
  });
  expect(guidance.status).toBeLessThan(300);

  // The relay has caught up: the total the session reads moved by every event.
  harness.storage.record(harness.events.published);
  return { full, empty };
}

describe('GET /access/usage', () => {
  it('says what fills the space, and its total is the one the session says', async () => {
    const { full, empty } = await seed();

    const answer = await usage();
    const session = sessionSchema.parse(await (await call('/access/session')).json());

    expect(answer.usedBytes).toBe(session.usedBytes);
    expect(answer.quotaBytes).toBe(StorageQuota.DEFAULT.bytes);
    const { notes, files, exports, others } = answer.byType;
    expect(notes.bytes + files.bytes + exports.bytes + others.bytes).toBe(answer.usedBytes);
    expect(notes.count).toBe(1);
    expect(files.count).toBe(1);
    expect(others.count).toBe(1);
    expect(answer.counts).toEqual({ notebooks: 2, folders: 1, revisions: 2 });

    // Largest first, under the name each notebook carries now.
    expect(answer.notebooks.map((line) => line.notebookId)).toEqual([full, empty]);
    expect(answer.notebooks[0]).toMatchObject({
      name: 'Normas',
      bytes: answer.usedBytes,
      notes: 1,
      folders: 1,
      files: 1,
      exports: 0,
    });
    expect(answer.notebooks[1]).toMatchObject({ name: 'Rascunhos', bytes: 0, notes: 0 });
  });

  it('lists to a member the notebook a ceiling limits, and the same totals', async () => {
    const { full } = await seed();
    const limited = await call(`/knowledge/notebooks/${full}/limits/user-member`, {
      method: 'PUT',
      body: { limit: 'VIEWER' },
    });
    expect(limited.status).toBeLessThan(300);

    const owner = await usage(OWNER);
    const member = await usage(MEMBER);

    // A ceiling lowers a role and never hides a notebook (RN-ACC-012).
    expect(member.notebooks.map((line) => line.notebookId)).toEqual(
      owner.notebooks.map((line) => line.notebookId),
    );
    expect(member.usedBytes).toBe(owner.usedBytes);
    expect(member.byType).toEqual(owner.byType);
  });

  it('lists no notebook to a requester who reads none, and still answers the totals', async () => {
    await seed();

    const owner = await usage(OWNER);
    const stranger = await usage(STRANGER);

    // Every notebook would answer 404 to this requester (rule 9).
    expect(stranger.notebooks).toEqual([]);
    expect(stranger.byType).toEqual(owner.byType);
    expect(stranger.counts).toEqual(owner.counts);
  });

  it('answers the same way when the quota is already exceeded', async () => {
    await seed();
    harness.storage.usedBytes = StorageQuota.DEFAULT.bytes + 4096;

    const answer = await usage();

    expect(answer.usedBytes).toBeGreaterThan(answer.quotaBytes);
    expect(answer.quotaBytes).toBe(StorageQuota.DEFAULT.bytes);
  });

  it('keeps a deleted notebook listed until its purge ends', async () => {
    const { full } = await seed();
    expect((await call(`/knowledge/notebooks/${full}`, { method: 'DELETE' })).status).toBe(204);

    // Its bytes are still counted, so the line that holds them is still there.
    const waiting = await usage();
    expect(waiting.notebooks.map((line) => line.notebookId)).toContain(full);

    // The purge ends: what the worker would have recorded reaches the counters.
    const subscription = SubscriptionId.fromClaim(subscriptionId);
    if (!subscription.ok) throw new Error('Unreachable');
    harness.relayed.push(
      createEvent({
        type: 'NotebookPurged',
        subscriptionId: subscription.value,
        subject: 'NOTEBOOK',
        subjectId: full,
        authorship: Authorship.byHuman(ownerId()),
        payload: { notebookId: full, folderCount: 1 },
      }),
    );

    const purged = await usage();
    expect(purged.notebooks.map((line) => line.notebookId)).not.toContain(full);
    expect(purged.counts.notebooks).toBe(1);
  });

  it('answers nothing to a session that carries no subscription', async () => {
    // A platform session reaches no subscription (RN-SUB-016), and it is told
    // so the way every Access route that needs one tells it: as not found.
    const response = await call('/access/usage', { token: 'platform-token' });
    expect(response.status).toBe(404);
  });
});

function ownerId(): UserId {
  const id = UserId.create('user-owner');
  if (!id.ok) throw new Error('Unreachable');
  return id.value;
}
