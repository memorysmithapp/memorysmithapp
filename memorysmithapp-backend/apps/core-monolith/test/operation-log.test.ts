/**
 * The log of the core API, read the way an operator reads it (#269): one line
 * per request, every key of it inside the allow-list, and not one byte of what
 * a person wrote — no notebook name, no folder name, no note name, no body, no
 * path.
 *
 * The lines are the ones the real app writes through the real middleware,
 * captured as Powertools prints them, so a handler that started logging a new
 * key, or a value that slipped content in, fails here.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { captureLines, type Line } from '@memorysmithapp/observability/testing';
import { CORRELATION_HEADER, LOG_LINE_FIELDS } from '@memorysmithapp/observability';
import { buildTestApp, CONNECTOR_CLIENT_ID, SIGNED_WITH_IAM } from './wiring.js';

type App = ReturnType<typeof buildTestApp>;
let harness: App;
let subscriptionId: string;
let capture: ReturnType<typeof captureLines>;

const OWNER = 'token-owner';
const CLAUDE = {
  clientId: 'https://claude.ai/oauth/mcp-oauth-client-metadata',
  clientName: 'Claude',
};

/** What a person typed, which no line may carry. */
const WRITTEN = [
  'Contratação Direta 2.0',
  'Pareceres do jurídico',
  'Licitações de 2026',
  'Fundamento revisto em segredo',
];

async function call(
  path: string,
  init: { method?: string; body?: unknown; token?: string; headers?: Record<string, string> } = {},
): Promise<Response> {
  return harness.app.request(path, {
    method: init.method ?? 'GET',
    headers: {
      authorization: `Bearer ${init.token ?? OWNER}`,
      'content-type': 'application/json',
      ...init.headers,
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

beforeEach(async () => {
  capture = captureLines();
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
    token: 'platform-token',
    body: { status: 'active' },
  });
  harness.verifier.issue(OWNER, {
    sub: 'user-owner',
    email: 'owner@example.com',
    subscription_id: subscriptionId,
    subscription_status: 'active',
  });
  // What the arrangement wrote is not what a case reads.
  capture.lines.length = 0;
});

afterEach(() => capture.restore());

/** A token of the connector proxy, bound to Claude as the proxy binds it at /token. */
async function agentToken(): Promise<string> {
  const token = harness.verifier.issue('proxy-1', {
    sub: 'user-owner',
    email: 'owner@example.com',
    subscription_id: subscriptionId,
    subscription_status: 'active',
    client_id: CONNECTOR_CLIENT_ID,
    token_use: 'access',
    jti: 'jti-1',
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  const bound = await harness.app.request('/access/connector-bindings', {
    method: 'POST',
    headers: { 'content-type': 'application/json', [SIGNED_WITH_IAM]: 'true' },
    body: JSON.stringify({
      grant: 'authorization_code',
      accessToken: token,
      connector: CLAUDE,
      refreshTokenHash: 'e'.repeat(64),
    }),
  });
  expect(bound.status).toBe(204);
  return token;
}

function outsideTheAllowList(lines: Line[]): string[] {
  return [...new Set(lines.flatMap((line) => Object.keys(line)))].filter(
    (key) => !LOG_LINE_FIELDS.has(key),
  );
}

describe('the log of the core API', () => {
  it('writes one line per request, from the allow-list, and nothing anybody wrote', async () => {
    const notebook = (await (
      await call('/knowledge/notebooks', {
        method: 'POST',
        body: { name: WRITTEN[1], description: WRITTEN[2] },
      })
    ).json()) as { notebookId: string };
    const folder = (await (
      await call(`/knowledge/notebooks/${notebook.notebookId}/folders`, {
        method: 'POST',
        body: { name: WRITTEN[2], description: WRITTEN[1] },
      })
    ).json()) as { folderId: string };
    const note = await call(`/knowledge/notebooks/${notebook.notebookId}/notes`, {
      method: 'POST',
      body: {
        folderId: folder.folderId,
        content: `---\nname: ${WRITTEN[0]}\n---\n\n${WRITTEN[3]}`,
      },
    });
    expect(note.status).toBe(201);
    // The same name again is a conflict, and a search carries its text in the query.
    await call(`/knowledge/notebooks/${notebook.notebookId}/notes`, {
      method: 'POST',
      body: { folderId: folder.folderId, content: `---\nname: ${WRITTEN[0]}\n---\n` },
    });
    await call(`/discovery/notebooks/${notebook.notebookId}/search`, {
      method: 'POST',
      body: { query: WRITTEN[3] },
    });
    await call(`/knowledge/notebooks/${notebook.notebookId}/notes/01JBQ2X0000000000000000099`);

    const lines = capture.lines;
    expect(lines).toHaveLength(6);
    expect(outsideTheAllowList(lines)).toEqual([]);
    const written = JSON.stringify(lines);
    for (const text of WRITTEN) expect(written).not.toContain(text);
    expect(written).not.toContain(notebook.notebookId);

    expect(lines.map((line) => [line['operation'], line['outcome']])).toEqual([
      ['POST /knowledge/notebooks', 'ok'],
      ['POST /knowledge/notebooks/:v/folders', 'ok'],
      ['POST /knowledge/notebooks/:v/notes', 'ok'],
      ['POST /knowledge/notebooks/:v/notes', 'conflict'],
      ['POST /discovery/notebooks/:v/search', 'ok'],
      ['GET /knowledge/notebooks/:v/notes/:n', 'refused'],
    ]);
    for (const line of lines) {
      expect(line).toMatchObject({
        level: 'INFO',
        message: 'operation',
        subscriptionId,
        userId: 'user-owner',
        channel: 'web',
      });
      expect(line['agentClient']).toBeUndefined();
      expect(typeof line['durationMs']).toBe('number');
      expect(typeof line['correlationId']).toBe('string');
    }
  });

  it('says a request came through a connector, which one, and under the id the connector handed', async () => {
    const token = await agentToken();
    capture.lines.length = 0;

    const response = await call('/knowledge/notebooks', {
      method: 'POST',
      token,
      body: { name: WRITTEN[1], description: WRITTEN[2] },
      headers: { [CORRELATION_HEADER]: 'mcp-call-0000001' },
    });

    expect(response.status).toBe(201);
    expect(response.headers.get(CORRELATION_HEADER)).toBe('mcp-call-0000001');
    expect(capture.lines).toEqual([
      expect.objectContaining({
        operation: 'POST /knowledge/notebooks',
        outcome: 'ok',
        status: 201,
        correlationId: 'mcp-call-0000001',
        subscriptionId,
        userId: 'user-owner',
        channel: 'mcp',
        agentClient: 'Claude',
      }),
    ]);
    expect(JSON.stringify(capture.lines)).not.toContain(WRITTEN[1]);
  });

  it('writes a refused session too, with no identity it could not establish', async () => {
    const response = await call('/knowledge/notebooks', { token: 'nobody' });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect(capture.lines).toEqual([
      expect.objectContaining({
        operation: expect.any(String),
        outcome: 'refused',
        status: response.status,
      }),
    ]);
    expect(capture.lines[0]!['userId']).toBeUndefined();
  });
});
