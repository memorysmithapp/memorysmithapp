/**
 * The two HTTP seams of the connector's identity (RN-AGT-001, RN-AGT-013):
 * how the proxy writes the binding, and how the tools read back the connector
 * of a session and the agent of a write.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CONNECTOR_BINDING_PATH,
  HttpConnectorBinder,
  refreshTokenHash,
  type OutgoingRequest,
} from '../src/connector-binding.js';
import { HttpAccessGateway, HttpAuditGateway } from '../src/adapters/http-gateways.js';
import type { AgentCaller } from '../src/mcp/gateway.js';

const CONNECTOR = {
  clientId: 'https://claude.ai/oauth/mcp-oauth-client-metadata',
  clientName: 'Claude',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the proxy records a binding through a signed request', () => {
  function binderSending(status: number) {
    const signed: OutgoingRequest[] = [];
    const sent: Array<{ url: string; init: RequestInit }> = [];
    const binder = new HttpConnectorBinder(
      'https://api.example.com',
      async (request) => {
        signed.push(request);
        return { ...request.headers, authorization: 'AWS4-HMAC-SHA256 signed' };
      },
      (async (url: string | URL | Request, init?: RequestInit) => {
        sent.push({ url: String(url), init: init ?? {} });
        return new Response(null, { status });
      }) as typeof fetch,
    );
    return { binder, signed, sent };
  }

  it('signs what it sends, and sends the hash of the refresh token and never the token', async () => {
    const { binder, signed, sent } = binderSending(204);

    await binder.bind({
      accessToken: 'access.jwt',
      connector: CONNECTOR,
      refreshToken: 'refresh-1',
    });

    expect(sent[0]?.url).toBe(`https://api.example.com${CONNECTOR_BINDING_PATH}`);
    expect(sent[0]?.init.headers).toMatchObject({ authorization: 'AWS4-HMAC-SHA256 signed' });
    expect(signed[0]?.body).toBe(sent[0]?.init.body);
    expect(JSON.parse(String(sent[0]?.init.body))).toEqual({
      grant: 'authorization_code',
      accessToken: 'access.jwt',
      connector: CONNECTOR,
      refreshTokenHash: refreshTokenHash('refresh-1'),
    });
    expect(String(sent[0]?.init.body)).not.toContain('refresh-1');
  });

  it('renews through the hash of the refresh token presented, and of the rotated one', async () => {
    const { binder, sent } = binderSending(204);

    await binder.rebind({
      accessToken: 'access-2.jwt',
      refreshToken: 'refresh-1',
      rotatedRefreshToken: 'refresh-2',
    });

    expect(JSON.parse(String(sent[0]?.init.body))).toEqual({
      grant: 'refresh_token',
      accessToken: 'access-2.jwt',
      refreshTokenHash: refreshTokenHash('refresh-1'),
      rotatedRefreshTokenHash: refreshTokenHash('refresh-2'),
    });
  });

  it('fails when Access refuses the binding, so the token endpoint can say so', async () => {
    const { binder } = binderSending(404);
    await expect(
      binder.bind({ accessToken: 'access.jwt', connector: CONNECTOR, refreshToken: null }),
    ).rejects.toThrow('404');
  });
});

describe('the tools read the connector of a session and the agent of a write', () => {
  const caller = {
    userId: 'user-1',
    subscriptionId: '01JBQ2X0000000000000000000',
    bearerToken: 'access.jwt',
  } as AgentCaller;

  function apiAnswering(status: number, body: unknown) {
    const fetchMock = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('names the connector Access recorded for the token, asking with that token', async () => {
    const fetchMock = apiAnswering(200, CONNECTOR);

    const found = await new HttpAccessGateway('https://api.example.com').connector(caller);

    expect(found).toEqual(CONNECTOR);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://api.example.com/access/connector');
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      authorization: 'Bearer access.jwt',
    });
  });

  it('answers no connector when none was recorded', async () => {
    apiAnswering(404, { code: 'NOT_FOUND', message: 'This session is not bound to a connector' });
    expect(await new HttpAccessGateway('https://api.example.com').connector(caller)).toBeNull();
  });

  it('reports the client_id of the connector beside its name in a note history', async () => {
    apiAnswering(200, {
      entries: [
        {
          occurredAt: '2026-09-13T12:00:00.000Z',
          type: 'NoteCreated',
          authorship: { userId: 'user-1', agent: CONNECTOR },
          contentRef: { versionId: 'v1' },
        },
        {
          occurredAt: '2026-09-13T12:05:00.000Z',
          type: 'NoteUpdated',
          authorship: { userId: 'user-1', agent: null },
          contentRef: { versionId: 'v2' },
        },
      ],
    });

    const history = await new HttpAuditGateway('https://api.example.com').noteHistory(
      caller,
      'notebook',
      'note',
    );

    expect(history.map((entry) => [entry.agentName, entry.agentClientId])).toEqual([
      ['Claude', CONNECTOR.clientId],
      [null, null],
    ]);
  });
});
