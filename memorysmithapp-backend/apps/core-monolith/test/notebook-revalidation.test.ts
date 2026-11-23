/**
 * The reads an open notebook repeats every half minute answer `304` with no
 * body when nothing changed (#547), and are authorized every time all the same.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from './wiring.js';

type App = ReturnType<typeof buildTestApp>;
let harness: App;
const TOKEN = 'token-owner';

beforeEach(async () => {
  harness = buildTestApp();
  harness.verifier.issue(TOKEN, { sub: 'user-owner', email: 'owner@example.com' });
  const created = await harness.app.request('/access/subscriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  const { subscriptionId } = (await created.json()) as { subscriptionId: string };
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
  harness.verifier.issue(TOKEN, {
    sub: 'user-owner',
    email: 'owner@example.com',
    subscription_id: subscriptionId,
    subscription_status: 'active',
  });
});

function call(
  path: string,
  init: { method?: string; body?: unknown; token?: string; tag?: string } = {},
): Promise<Response> {
  return harness.app.request(path, {
    method: init.method ?? 'GET',
    headers: {
      authorization: `Bearer ${init.token ?? TOKEN}`,
      'content-type': 'application/json',
      ...(init.tag ? { 'if-none-match': init.tag } : {}),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

async function seedNotebook(): Promise<string> {
  const created = await call('/knowledge/notebooks', {
    method: 'POST',
    body: { name: 'Desenvolvimento com IA', description: 'Notas de trabalho' },
  });
  return ((await created.json()) as { notebookId: string }).notebookId;
}

describe('the reads an open notebook repeats (#547)', () => {
  it('answer 304 with no body when nothing changed, on each of the four', async () => {
    const notebookId = await seedNotebook();
    for (const path of [
      `/knowledge/notebooks/${notebookId}`,
      `/knowledge/notebooks/${notebookId}/notes`,
      `/knowledge/notebooks/${notebookId}/files`,
      `/discovery/notebooks/${notebookId}/names`,
    ]) {
      const first = await call(path);
      expect(first.status, path).toBe(200);
      const tag = first.headers.get('etag');
      expect(tag, path).toBeTruthy();
      expect(first.headers.get('cache-control')).toBe('private, no-cache');
      expect(first.headers.get('vary')).toBe('Authorization');

      const again = await call(path, { tag: tag! });
      expect(again.status, path).toBe(304);
      expect(await again.text()).toBe('');
      expect(again.headers.get('x-memorysmith-version')).toBeTruthy();
    }
  });

  it('answer the body again once the notebook changed', async () => {
    const notebookId = await seedNotebook();
    const path = `/knowledge/notebooks/${notebookId}`;
    const tag = (await call(path)).headers.get('etag')!;

    const added = await call(`${path}/folders`, {
      method: 'POST',
      body: { name: 'Decisões', description: 'Uma decisão por nota.' },
    });
    expect(added.status).toBe(201);

    const after = await call(path, { tag });
    expect(after.status).toBe(200);
    expect(after.headers.get('etag')).not.toBe(tag);
  });

  it('never answer 304 to a session that may not read the notebook', async () => {
    const notebookId = await seedNotebook();
    const path = `/knowledge/notebooks/${notebookId}`;
    const tag = (await call(path)).headers.get('etag')!;

    harness.verifier.issue('stranger', { sub: 'user-stranger', email: 'stranger@example.com' });
    const refused = await call(path, { token: 'stranger', tag });
    expect(refused.status).not.toBe(304);
    expect(refused.status).not.toBe(200);
  });

  it('leave every other read as it was', async () => {
    const listed = await call('/knowledge/notebooks');
    expect(listed.headers.get('etag')).toBeNull();
  });
});
