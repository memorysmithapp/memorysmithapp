/**
 * HTTP surface of svc-agent for the CIMD spike (architecture-guide.md, 13.3):
 *
 *   GET  /.well-known/oauth-protected-resource      item 1 (also with /mcp suffix)
 *   GET  /.well-known/oauth-authorization-server    items 2 and 5
 *   GET  /authorize                                 item 3 (CIMD validation + Cognito leg)
 *   GET  /callback                                  item 3 (Cognito returns, client leg resumes)
 *   POST /token                                     item 4 (pass-through, JWT unaltered)
 *   POST /mcp                                       401 discovery + authenticated MCP round-trip
 */

import { Hono } from 'hono';
import { type AgentConfig } from './config.js';
import { resolveClientMetadata } from './cimd.js';
import { decodeState, encodeState } from './state.js';
import { authorizationServerMetadata, protectedResourceMetadata } from './oauth.js';
import type { SecretResolver } from './secrets.js';
import { verifyAccessToken } from './auth.js';
import { handleMcpRequest } from './mcp.js';
import type { McpToolAdapter } from './mcp/tools.js';

/**
 * Builds the HTTP surface.
 *
 * The state HMAC key arrives as a resolver rather than a value: it is read from
 * Secrets Manager at request time, so it never sits in the function's
 * environment. Both parameters are required, and the Lambda entrypoint is the
 * only place that wires the real adapter.
 */
export function createApp(
  config: AgentConfig,
  resolveStateSecret: SecretResolver,
  tools: McpToolAdapter,
): Hono {
  const app = new Hono();
  const challenge = `Bearer resource_metadata="${config.publicOrigin}/.well-known/oauth-protected-resource"`;

  // ---- Discovery (items 1 and 2) -------------------------------------------

  const prm = (c: { json: (o: Record<string, unknown>) => Response }) =>
    c.json(protectedResourceMetadata(config));
  app.get('/.well-known/oauth-protected-resource', (c) => prm(c));
  app.get('/.well-known/oauth-protected-resource/mcp', (c) => prm(c));
  app.get('/.well-known/oauth-authorization-server', (c) =>
    c.json(authorizationServerMetadata(config)),
  );

  // ---- Authorization endpoint (item 3) -------------------------------------

  app.get('/authorize', async (c) => {
    const q = c.req.query();
    const clientId = q['client_id'];
    const redirectUri = q['redirect_uri'];
    const codeChallenge = q['code_challenge'];

    if (q['response_type'] !== 'code') {
      return c.json({ error: 'unsupported_response_type' }, 400);
    }
    if (!clientId || !redirectUri) {
      return c.json(
        { error: 'invalid_request', error_description: 'client_id and redirect_uri are required' },
        400,
      );
    }
    if (!codeChallenge || (q['code_challenge_method'] ?? 'S256') !== 'S256') {
      return c.json(
        { error: 'invalid_request', error_description: 'PKCE with S256 is required' },
        400,
      );
    }

    const metadata = await resolveClientMetadata(clientId, redirectUri);
    if (!metadata.ok) {
      return c.json(
        {
          error: 'invalid_client',
          error_description: `${metadata.error.code}: ${metadata.error.detail}`,
        },
        400,
      );
    }

    const state = encodeState(
      {
        clientId,
        redirectUri,
        clientState: q['state'],
        issuedAt: Date.now(),
      },
      await resolveStateSecret(),
    );

    const upstream = new URL(`${config.cognitoDomain}/oauth2/authorize`);
    upstream.searchParams.set('response_type', 'code');
    upstream.searchParams.set('client_id', config.proxyClientId);
    upstream.searchParams.set('redirect_uri', `${config.publicOrigin}/callback`);
    upstream.searchParams.set('scope', 'openid email profile');
    upstream.searchParams.set('state', state);
    upstream.searchParams.set('code_challenge', codeChallenge);
    upstream.searchParams.set('code_challenge_method', 'S256');
    return c.redirect(upstream.toString(), 302);
  });

  // ---- Callback from Cognito (item 3, second leg) --------------------------

  app.get('/callback', async (c) => {
    const q = c.req.query();
    const encoded = q['state'];
    if (!encoded)
      return c.json({ error: 'invalid_request', error_description: 'Missing state' }, 400);
    const state = decodeState(encoded, await resolveStateSecret());
    if (!state)
      return c.json(
        { error: 'invalid_request', error_description: 'Invalid or expired state' },
        400,
      );

    const target = new URL(state.redirectUri);
    if (q['error']) {
      target.searchParams.set('error', q['error']);
      if (q['error_description'])
        target.searchParams.set('error_description', q['error_description']);
    } else if (q['code']) {
      target.searchParams.set('code', q['code']);
      target.searchParams.set('iss', config.publicOrigin);
    } else {
      return c.json({ error: 'invalid_request', error_description: 'Missing code' }, 400);
    }
    if (state.clientState !== undefined) target.searchParams.set('state', state.clientState);
    return c.redirect(target.toString(), 302);
  });

  // ---- Token endpoint (item 4): pass-through, JWT unaltered ----------------

  app.post('/token', async (c) => {
    const form = await c.req.parseBody();
    const grantType = form['grant_type'];
    const upstream = new URLSearchParams();

    if (grantType === 'authorization_code') {
      if (typeof form['code'] !== 'string' || typeof form['code_verifier'] !== 'string') {
        return c.json(
          { error: 'invalid_request', error_description: 'code and code_verifier are required' },
          400,
        );
      }
      upstream.set('grant_type', 'authorization_code');
      upstream.set('client_id', config.proxyClientId);
      upstream.set('redirect_uri', `${config.publicOrigin}/callback`);
      upstream.set('code', form['code']);
      upstream.set('code_verifier', form['code_verifier']);
    } else if (grantType === 'refresh_token') {
      if (typeof form['refresh_token'] !== 'string') {
        return c.json(
          { error: 'invalid_request', error_description: 'refresh_token is required' },
          400,
        );
      }
      upstream.set('grant_type', 'refresh_token');
      upstream.set('client_id', config.proxyClientId);
      upstream.set('refresh_token', form['refresh_token']);
    } else {
      return c.json({ error: 'unsupported_grant_type' }, 400);
    }

    const response = await fetch(`${config.cognitoDomain}/oauth2/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: upstream.toString(),
    });
    const body = await response.text();
    return c.newResponse(body, response.status as 200, {
      'content-type': response.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-store',
    });
  });

  // ---- MCP endpoint (Streamable HTTP, stateless) ---------------------------

  const unauthorized = () =>
    new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json', 'www-authenticate': challenge },
    });

  app.on(['GET', 'POST', 'DELETE'], '/mcp', async (c) => {
    const authorization = c.req.header('authorization');
    if (!authorization?.startsWith('Bearer ')) return unauthorized();
    const bearerToken = authorization.slice('Bearer '.length);
    const token = await verifyAccessToken(bearerToken, config);
    if (!token) return unauthorized();

    if (c.req.method !== 'POST') {
      // Stateless transport: no server-initiated stream, no session to delete.
      return c.newResponse(null, 405, { allow: 'POST' });
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } },
        400,
      );
    }
    const response = await handleMcpRequest(body, token, tools, bearerToken);
    if (response === null) return c.newResponse(null, 202);
    return c.json(response);
  });

  app.get('/healthz', (c) => c.json({ ok: true }));
  return app;
}
