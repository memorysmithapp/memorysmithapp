/**
 * From a token of the connector proxy to a stored Authorship, through the real
 * app of the core (RN-AGT-001).
 *
 * Every write made through the connector since 0.2.0 was recorded as the
 * person's alone, and nothing noticed, because nothing tested the whole chain:
 * the agent tests stubbed the caller, and the audit tests built an authorship
 * by hand. This one starts where the proxy leaves off — a token Cognito issued
 * to the proxy's app client, and the binding the proxy posts at /token — and
 * ends in the audit trail.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { UNIDENTIFIED_CONNECTOR } from '@memorysmith/svc-access/application/connectors';
import { buildTestApp, CONNECTOR_CLIENT_ID, SIGNED_WITH_IAM } from './wiring.js';

type App = ReturnType<typeof buildTestApp>;
let harness: App;
let subscriptionId: string;

const OWNER = 'token-owner';
const CLAUDE = {
  clientId: 'https://claude.ai/oauth/mcp-oauth-client-metadata',
  clientName: 'Claude',
};
const REFRESH_HASH = 'e'.repeat(64);
const EXPIRES = Math.floor(Date.now() / 1000) + 3600;

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

/** A token of the connector proxy, as Cognito issues one: its own jti, no connector. */
function proxyToken(token: string, jti: string): string {
  return harness.verifier.issue(token, {
    sub: 'user-owner',
    email: 'owner@example.com',
    subscription_id: subscriptionId,
    subscription_status: 'active',
    client_id: CONNECTOR_CLIENT_ID,
    token_use: 'access',
    jti,
    exp: EXPIRES,
  });
}

/** What the proxy posts at /token: signed with IAM, and the token in the body. */
async function bind(body: unknown, signedWithIam = true): Promise<Response> {
  return harness.app.request('/access/connector-bindings', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(signedWithIam ? { [SIGNED_WITH_IAM]: 'true' } : {}),
    },
    body: JSON.stringify(body),
  });
}

/** Feeds the audit trail with what the writes published, as the bus would. */
async function drainAudit(): Promise<void> {
  await harness.auditConsumer.consume(
    harness.events.published.map((event) => ({
      eventId: event.eventId,
      type: event.type,
      occurredAt: event.occurredAt.toISOString(),
      subscriptionId: event.subscriptionId.value,
      subject: event.subject,
      subjectId: event.subjectId,
      authorship: event.authorship.toJSON(),
      contentRef: event.contentRef ? event.contentRef.toJSON() : null,
      payload: event.payload,
    })),
  );
  harness.events.published.length = 0;
}

type Agent = { clientId: string; clientName: string } | null;

async function historyOf(noteId: string): Promise<Array<{ userId: string; agent: Agent }>> {
  await drainAudit();
  const history = (await (await call(`/audit/notes/${noteId}/history`)).json()) as {
    entries: Array<{ type: string; authorship: { userId: string; agent: Agent } }>;
  };
  return history.entries.map((entry) => ({
    userId: entry.authorship.userId,
    agent: entry.authorship.agent,
  }));
}

/** A notebook and a folder, written by the person through the interface. */
async function place(): Promise<{ notebookId: string; folderId: string }> {
  const notebook = (await (
    await call('/knowledge/notebooks', {
      method: 'POST',
      body: { name: 'Achados', description: 'Achados de auditoria' },
    })
  ).json()) as { notebookId: string };
  const folder = (await (
    await call(`/knowledge/notebooks/${notebook.notebookId}/folders`, {
      method: 'POST',
      body: { name: '2026', description: 'Os achados deste exercicio.' },
    })
  ).json()) as { folderId: string };
  return { notebookId: notebook.notebookId, folderId: folder.folderId };
}

function createNote(
  where: { notebookId: string; folderId: string },
  token: string,
  name = 'Achado 12',
): Promise<Response> {
  return call(`/knowledge/notebooks/${where.notebookId}/notes`, {
    method: 'POST',
    token,
    body: { folderId: where.folderId, content: `---\nname: ${name}\n---\n\nFundamento.` },
  });
}

beforeEach(async () => {
  harness = buildTestApp();
  harness.verifier.issue(OWNER, { sub: 'user-owner', email: 'owner@example.com' });

  const created = await call('/access/subscriptions', { method: 'POST', body: {} });
  subscriptionId = ((await created.json()) as { subscriptionId: string }).subscriptionId;

  harness.verifier.issue('platform-token', {
    sub: 'platform-admin',
    email: 'admin@memorysmith.app',
    groups: ['platform-admin'],
  });
  await call(`/access/platform/subscriptions/${subscriptionId}/approve`, {
    method: 'POST',
    body: { status: 'active' },
    token: 'platform-token',
  });
  // The person, through the interface: the app client of the SPA.
  harness.verifier.issue(OWNER, {
    sub: 'user-owner',
    email: 'owner@example.com',
    subscription_id: subscriptionId,
    subscription_status: 'active',
    client_id: 'memorysmith-web',
    token_use: 'access',
    jti: 'web-jti',
    exp: EXPIRES,
  });
});

describe('a write through the connector records the person and the connector', () => {
  it('on a note created, updated and deleted through a bound token', async () => {
    const where = await place();
    const token = proxyToken('proxy-1', 'jti-1');
    const bound = await bind({
      grant: 'authorization_code',
      accessToken: token,
      connector: CLAUDE,
      refreshTokenHash: REFRESH_HASH,
    });
    expect(bound.status).toBe(204);

    const created = (await (await createNote(where, token)).json()) as { noteId: string };
    const read = (await (
      await call(`/knowledge/notebooks/${where.notebookId}/notes/${created.noteId}`, { token })
    ).json()) as { revision: { versionId: string } };
    const updated = await call(`/knowledge/notebooks/${where.notebookId}/notes/${created.noteId}`, {
      method: 'PUT',
      token,
      body: {
        content: '---\nname: Achado 12\n---\n\nFundamento revisto.',
        baseRevision: read.revision.versionId,
      },
    });
    expect(updated.status).toBe(200);
    const deleted = await call(`/knowledge/notebooks/${where.notebookId}/notes/${created.noteId}`, {
      method: 'DELETE',
      token,
    });
    expect(deleted.status).toBe(204);

    const history = await historyOf(created.noteId);
    expect(history).toHaveLength(3);
    for (const entry of history) expect(entry).toEqual({ userId: 'user-owner', agent: CLAUDE });
  });

  it('in the listing of the notes, beside the person', async () => {
    const where = await place();
    const token = proxyToken('proxy-1', 'jti-1');
    await bind({
      grant: 'authorization_code',
      accessToken: token,
      connector: CLAUDE,
      refreshTokenHash: null,
    });
    await createNote(where, token);

    const notes = (await (
      await call(`/knowledge/notebooks/${where.notebookId}/notes`, { token })
    ).json()) as Array<{ updatedBy: { userId: string; agent: Agent } }>;
    expect(notes[0]?.updatedBy).toMatchObject({ userId: 'user-owner', agent: CLAUDE });
  });

  it('after a refresh, as the connector of the refresh token that renewed it', async () => {
    const where = await place();
    await bind({
      grant: 'authorization_code',
      accessToken: proxyToken('proxy-1', 'jti-1'),
      connector: CLAUDE,
      refreshTokenHash: REFRESH_HASH,
    });

    const renewed = proxyToken('proxy-2', 'jti-2');
    const rebound = await bind({
      grant: 'refresh_token',
      accessToken: renewed,
      refreshTokenHash: REFRESH_HASH,
      rotatedRefreshTokenHash: null,
    });
    expect(rebound.status).toBe(204);

    const created = (await (await createNote(where, renewed)).json()) as { noteId: string };
    expect(await historyOf(created.noteId)).toEqual([{ userId: 'user-owner', agent: CLAUDE }]);
  });
});

describe('a write through the interface records the person alone', () => {
  it('with no agent', async () => {
    const where = await place();
    const created = (await (await createNote(where, OWNER)).json()) as { noteId: string };
    expect(await historyOf(created.noteId)).toEqual([{ userId: 'user-owner', agent: null }]);
  });
});

describe('a token of the proxy with no binding', () => {
  it('is refused on every write, with a message to reconnect, and stores nothing', async () => {
    const where = await place();
    const token = proxyToken('proxy-unbound', 'jti-unbound');

    const note = await createNote(where, token);
    expect(note.status).toBe(412);
    expect(((await note.json()) as { message: string }).message).toBe(UNIDENTIFIED_CONNECTOR);

    const notebook = await call('/knowledge/notebooks', {
      method: 'POST',
      token,
      body: { name: 'Outro', description: 'Nao deve existir' },
    });
    expect(notebook.status).toBe(412);
    const imported = await call('/portability/imports/apply', {
      method: 'POST',
      token,
      body: { uploadKey: 'anything', name: 'Importado' },
    });
    expect(imported.status).toBe(412);

    const notes = (await (
      await call(`/knowledge/notebooks/${where.notebookId}/notes`)
    ).json()) as unknown[];
    const notebooks = (await (await call('/knowledge/notebooks')).json()) as unknown[];
    expect(notes).toEqual([]);
    expect(notebooks).toHaveLength(1);
  });

  it('still reads', async () => {
    const where = await place();
    const token = proxyToken('proxy-unbound', 'jti-unbound');

    expect((await call('/knowledge/notebooks', { token })).status).toBe(200);
    expect((await call(`/knowledge/notebooks/${where.notebookId}/context`, { token })).status).toBe(
      200,
    );
    const search = await call(`/discovery/notebooks/${where.notebookId}/search`, {
      method: 'POST',
      token,
      body: { query: 'Fundamento' },
    });
    expect(search.status).toBe(200);
  });
});

describe('the binding route', () => {
  it('answers nobody but the proxy', async () => {
    const where = await place();
    const token = proxyToken('proxy-1', 'jti-1');

    const unsigned = await bind(
      {
        grant: 'authorization_code',
        accessToken: token,
        connector: CLAUDE,
        refreshTokenHash: null,
      },
      false,
    );

    expect(unsigned.status).toBe(404);
    expect((await createNote(where, token)).status).toBe(412);
  });

  it('refuses to bind a token of the interface', async () => {
    const refused = await bind({
      grant: 'authorization_code',
      accessToken: OWNER,
      connector: CLAUDE,
      refreshTokenHash: null,
    });
    expect(refused.status).toBe(400);
  });

  it('binds a token once, and the first connector stays', async () => {
    const where = await place();
    const token = proxyToken('proxy-1', 'jti-1');
    await bind({
      grant: 'authorization_code',
      accessToken: token,
      connector: CLAUDE,
      refreshTokenHash: null,
    });

    const again = await bind({
      grant: 'authorization_code',
      accessToken: token,
      connector: { clientId: 'https://impostor.example.com/metadata.json', clientName: 'Impostor' },
      refreshTokenHash: null,
    });
    expect(again.status).toBe(409);

    const created = (await (await createNote(where, token)).json()) as { noteId: string };
    expect(await historyOf(created.noteId)).toEqual([{ userId: 'user-owner', agent: CLAUDE }]);
  });

  it('binds nothing to a refresh token no connector was bound to', async () => {
    const renewed = proxyToken('proxy-2', 'jti-2');
    const rebound = await bind({
      grant: 'refresh_token',
      accessToken: renewed,
      refreshTokenHash: REFRESH_HASH,
      rotatedRefreshTokenHash: null,
    });
    expect(rebound.status).toBe(404);
  });
});

describe('the connector of a session', () => {
  it('is the bound one, and there is none for the interface or an unbound token', async () => {
    const token = proxyToken('proxy-1', 'jti-1');
    await bind({
      grant: 'authorization_code',
      accessToken: token,
      connector: CLAUDE,
      refreshTokenHash: null,
    });

    const bound = await call('/access/connector', { token });
    expect(bound.status).toBe(200);
    expect(await bound.json()).toEqual(CLAUDE);
    expect((await call('/access/connector')).status).toBe(404);
    expect(
      (await call('/access/connector', { token: proxyToken('proxy-unbound', 'jti-9') })).status,
    ).toBe(404);
  });
});
