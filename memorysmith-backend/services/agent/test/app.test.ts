import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import type { AgentConfig } from '../src/config.js';
import type { ConnectorBinder } from '../src/connector-binding.js';
import { McpToolAdapter } from '../src/mcp/tools.js';
import { encodeState } from '../src/state.js';

const config: AgentConfig = {
  publicOrigin: 'https://mcp.memorysmith.app',
  cognitoIssuer: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TEST',
  cognitoDomain: 'https://memorysmith-auth.auth.us-east-1.amazoncognito.com',
  proxyClientId: 'proxy-client-id',
  stateSecretId: 'arn:aws:secretsmanager:us-east-1:000000000000:secret:test',
};

const SECRET = 'test-secret';
const resolveStateSecret = async (): Promise<string> => SECRET;

/** The gateways are never reached here: these cases stop at the OAuth edge. */
const tools = new McpToolAdapter({
  access: {} as never,
  knowledge: {} as never,
  discovery: {} as never,
  audit: {} as never,
});

/** Records what the token endpoint asked Access to bind, and binds nothing. */
function recordingBinder() {
  const calls: Array<{ kind: 'bind' | 'rebind'; input: unknown }> = [];
  const binder: ConnectorBinder = {
    bind: async (input) => {
      calls.push({ kind: 'bind', input });
    },
    rebind: async (input) => {
      calls.push({ kind: 'rebind', input });
    },
  };
  return { calls, binder };
}

const app = createApp(config, resolveStateSecret, tools, recordingBinder().binder);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('discovery (items 1 and 2 of 13.3)', () => {
  it('answers 401 with the resource_metadata challenge on an unauthenticated /mcp call', async () => {
    const response = await app.request('/mcp', { method: 'POST' });
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe(
      'Bearer resource_metadata="https://mcp.memorysmith.app/.well-known/oauth-protected-resource"',
    );
  });

  it('serves Protected Resource Metadata pointing at the proxy as authorization server', async () => {
    const response = await app.request('/.well-known/oauth-protected-resource');
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body['resource']).toBe('https://mcp.memorysmith.app/mcp');
    expect(body['authorization_servers']).toEqual(['https://mcp.memorysmith.app']);
  });

  it('serves the same PRM under the path-inserted well-known used by MCP clients', async () => {
    const response = await app.request('/.well-known/oauth-protected-resource/mcp');
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body['resource']).toBe('https://mcp.memorysmith.app/mcp');
  });

  it('serves RFC 8414 metadata advertising CIMD, PKCE S256 and no registration endpoint', async () => {
    const response = await app.request('/.well-known/oauth-authorization-server');
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body['issuer']).toBe('https://mcp.memorysmith.app');
    expect(body['client_id_metadata_document_supported']).toBe(true);
    expect(body['code_challenge_methods_supported']).toEqual(['S256']);
    expect(body['token_endpoint_auth_methods_supported']).toEqual(['none']);
    expect(body['authorization_endpoint']).toBe('https://mcp.memorysmith.app/authorize');
    expect(body['token_endpoint']).toBe('https://mcp.memorysmith.app/token');
    expect(body).not.toHaveProperty('registration_endpoint');
  });
});

describe('authorize (item 3 of 13.3)', () => {
  it('refuses a request without PKCE', async () => {
    const response = await app.request(
      '/authorize?response_type=code&client_id=https://c.example.com/m.json&redirect_uri=https://a.example.com/cb',
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body['error']).toBe('invalid_request');
  });

  it('refuses a non-code response_type', async () => {
    const response = await app.request('/authorize?response_type=token');
    expect(response.status).toBe(400);
  });

  it('refuses a client_id that is not an HTTPS URL without redirecting', async () => {
    const response = await app.request(
      '/authorize?response_type=code&client_id=plain-id&redirect_uri=https://a.example.com/cb&code_challenge=x&code_challenge_method=S256',
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body['error']).toBe('invalid_client');
  });
});

describe('token (item 4 of 13.3)', () => {
  it('refuses unsupported grant types', async () => {
    const response = await app.request('/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body['error']).toBe('unsupported_grant_type');
  });

  it('requires code and code_verifier for authorization_code', async () => {
    const response = await app.request('/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=authorization_code',
    });
    expect(response.status).toBe(400);
  });
});

describe('callback (item 3, second leg)', () => {
  it('refuses a callback with a forged state', async () => {
    const response = await app.request('/callback?code=abc&state=forged.state');
    expect(response.status).toBe(400);
  });
});

/**
 * The connector and the token are seen together in exactly one place, and this
 * is it (RN-AGT-001). Cognito issues every token to the proxy's app client, so a
 * token that reached the core without a binding would have been recorded as the
 * person's alone, which is what every write through the connector used to be.
 */
describe('the connector is bound to the token it was issued (item 4 of 13.3)', () => {
  const CLIENT = 'https://client.example.com/metadata.json';
  const REDIRECT = 'https://client.example.com/callback';
  /** What Cognito answers a code, exactly as the client has to receive it. */
  const ISSUED =
    '{"access_token":"access.jwt","id_token":"id.jwt","refresh_token":"refresh-1","expires_in":3600,"token_type":"Bearer"}';

  async function sealedCodeFor(target: ReturnType<typeof createApp>): Promise<string> {
    const state = encodeState(
      {
        clientId: CLIENT,
        clientName: 'Example Client',
        redirectUri: REDIRECT,
        clientState: 'xyz',
        issuedAt: Date.now(),
      },
      SECRET,
    );
    const response = await target.request(
      `/callback?code=cognito-code&state=${encodeURIComponent(state)}`,
    );
    expect(response.status).toBe(302);
    return new URL(response.headers.get('location') ?? '').searchParams.get('code') ?? '';
  }

  function tokenRequest(fields: Record<string, string>): RequestInit {
    return {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields).toString(),
    };
  }

  function cognitoAnswering(body: string, status = 200) {
    const fetchMock = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response(body, { status, headers: { 'content-type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('hands the client a sealed code instead of the one Cognito issued', async () => {
    const code = await sealedCodeFor(app);
    expect(code).not.toBe('');
    expect(code).not.toBe('cognito-code');
  });

  it('refuses a token request whose client_id differs from the one validated at /authorize', async () => {
    const { calls, binder } = recordingBinder();
    const target = createApp(config, resolveStateSecret, tools, binder);
    const fetchMock = cognitoAnswering(ISSUED);
    const code = await sealedCodeFor(target);

    const response = await target.request(
      '/token',
      tokenRequest({
        grant_type: 'authorization_code',
        code,
        code_verifier: 'verifier',
        client_id: 'https://impostor.example.com/metadata.json',
      }),
    );

    expect(response.status).toBe(400);
    expect(((await response.json()) as Record<string, unknown>)['error']).toBe('invalid_grant');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  it('refuses a code the proxy did not seal, such as the one Cognito issued', async () => {
    const fetchMock = cognitoAnswering(ISSUED);
    const response = await app.request(
      '/token',
      tokenRequest({
        grant_type: 'authorization_code',
        code: 'cognito-code',
        code_verifier: 'verifier',
        client_id: CLIENT,
      }),
    );
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("exchanges the sealed code, binds the connector and answers Cognito's response byte for byte", async () => {
    const { calls, binder } = recordingBinder();
    const target = createApp(config, resolveStateSecret, tools, binder);
    const fetchMock = cognitoAnswering(ISSUED);
    const code = await sealedCodeFor(target);

    const response = await target.request(
      '/token',
      tokenRequest({
        grant_type: 'authorization_code',
        code,
        code_verifier: 'verifier',
        client_id: CLIENT,
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(ISSUED);
    const upstream = new URLSearchParams(String(fetchMock.mock.calls[0]?.[1]?.body ?? ''));
    expect(upstream.get('code')).toBe('cognito-code');
    expect(upstream.get('client_id')).toBe(config.proxyClientId);
    expect(calls).toEqual([
      {
        kind: 'bind',
        input: {
          accessToken: 'access.jwt',
          connector: { clientId: CLIENT, clientName: 'Example Client' },
          refreshToken: 'refresh-1',
        },
      },
    ]);
  });

  it('binds a refreshed token through the refresh token that renewed it', async () => {
    const { calls, binder } = recordingBinder();
    const target = createApp(config, resolveStateSecret, tools, binder);
    const renewed = '{"access_token":"access-2.jwt","id_token":"id.jwt","expires_in":3600}';
    cognitoAnswering(renewed);

    const response = await target.request(
      '/token',
      tokenRequest({ grant_type: 'refresh_token', refresh_token: 'refresh-1', client_id: CLIENT }),
    );

    expect(await response.text()).toBe(renewed);
    expect(calls).toEqual([
      {
        kind: 'rebind',
        input: {
          accessToken: 'access-2.jwt',
          refreshToken: 'refresh-1',
          rotatedRefreshToken: null,
        },
      },
    ]);
  });

  it('carries the connector forward to a rotated refresh token', async () => {
    const { calls, binder } = recordingBinder();
    const target = createApp(config, resolveStateSecret, tools, binder);
    cognitoAnswering('{"access_token":"access-2.jwt","refresh_token":"refresh-2"}');

    await target.request(
      '/token',
      tokenRequest({ grant_type: 'refresh_token', refresh_token: 'refresh-1', client_id: CLIENT }),
    );

    expect(calls).toEqual([
      {
        kind: 'rebind',
        input: {
          accessToken: 'access-2.jwt',
          refreshToken: 'refresh-1',
          rotatedRefreshToken: 'refresh-2',
        },
      },
    ]);
  });

  it('still hands the token over when the binding fails, and the token then cannot write', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failing: ConnectorBinder = {
      bind: async () => {
        throw new Error('Access is unreachable');
      },
      rebind: async () => undefined,
    };
    const target = createApp(config, resolveStateSecret, tools, failing);
    cognitoAnswering(ISSUED);
    const code = await sealedCodeFor(target);

    const response = await target.request(
      '/token',
      tokenRequest({
        grant_type: 'authorization_code',
        code,
        code_verifier: 'verifier',
        client_id: CLIENT,
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(ISSUED);
  });

  it('binds nothing when Cognito refuses the exchange', async () => {
    const { calls, binder } = recordingBinder();
    const target = createApp(config, resolveStateSecret, tools, binder);
    const refusal = '{"error":"invalid_grant"}';
    cognitoAnswering(refusal, 400);

    const response = await target.request(
      '/token',
      tokenRequest({ grant_type: 'refresh_token', refresh_token: 'refresh-1', client_id: CLIENT }),
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toBe(refusal);
    expect(calls).toEqual([]);
  });
});
