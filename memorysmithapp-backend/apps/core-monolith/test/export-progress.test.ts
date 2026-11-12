/**
 * An export moves its bar as it reads (#453): the source of an export tells
 * each body it read, and the run writes how far it got on the transfer before
 * the archive is ready. It never did, so the record said 0 of N until the end.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from './wiring.js';

type App = ReturnType<typeof buildTestApp>;
let harness: App;
let notebookId: string;

const OWNER = 'token-owner';
const NOTES = 30;

async function call(token: string, path: string, init: { method?: string; body?: unknown } = {}) {
  return harness.app.request(path, {
    method: init.method ?? 'GET',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

beforeEach(async () => {
  harness = buildTestApp();
  harness.verifier.issue(OWNER, { sub: 'user-owner', email: 'owner@example.com' });
  const created = await call(OWNER, '/access/subscriptions', { method: 'POST', body: {} });
  const { subscriptionId } = await json<{ subscriptionId: string }>(created);
  harness.verifier.issue('platform-token', {
    sub: 'platform-admin',
    email: 'admin@memorysmith.app',
    groups: ['platform-admin'],
  });
  await call('platform-token', `/access/platform/subscriptions/${subscriptionId}/approve`, {
    method: 'POST',
    body: { status: 'active' },
  });
  harness.verifier.issue(OWNER, {
    sub: 'user-owner',
    email: 'owner@example.com',
    subscription_id: subscriptionId,
    subscription_status: 'active',
  });
  notebookId = (
    await json<{ notebookId: string }>(
      await call(OWNER, '/knowledge/notebooks', {
        method: 'POST',
        body: { name: 'Leituras', description: 'Many notes' },
      }),
    )
  ).notebookId;
  const { folderId } = await json<{ folderId: string }>(
    await call(OWNER, `/knowledge/notebooks/${notebookId}/folders`, {
      method: 'POST',
      body: { name: 'Notas', description: 'Each one.' },
    }),
  );
  for (let at = 1; at <= NOTES; at += 1) {
    await call(OWNER, `/knowledge/notebooks/${notebookId}/notes`, {
      method: 'POST',
      body: { folderId, content: `---\nname: Nota ${at}\n---\n\nTexto ${at}.\n` },
    });
  }
});

describe('an export of a notebook (#453)', () => {
  it('writes how far it got before it is ready', async () => {
    const written: Array<{ done?: number; total?: number; status?: string }> = [];
    const patch = harness.transfers.patch.bind(harness.transfers);
    harness.transfers.patch = async (userId, transferId, change) => {
      written.push(change as { done?: number; total?: number; status?: string });
      return patch(userId, transferId, change);
    };

    const started = await call(OWNER, `/portability/notebooks/${notebookId}/export`, {
      method: 'POST',
      body: {},
    });
    expect(started.status).toBe(202);

    const before = written.filter((change) => change.status === undefined);
    expect(before.some((change) => (change.done ?? 0) > 0 && (change.done ?? 0) < NOTES)).toBe(
      true,
    );
    expect(before.every((change) => change.total === NOTES)).toBe(true);
    expect(written.at(-1)).toEqual(expect.objectContaining({ status: 'ready', done: NOTES }));
  });
});
