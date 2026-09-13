/**
 * HTTP surface of svc-agent for the CIMD spike (architecture-guide.md, 13.3):
 *
 *   GET  /.well-known/oauth-protected-resource      item 1 (also with /mcp suffix)
 *   GET  /.well-known/oauth-authorization-server    items 2 and 5
 *   GET  /authorize                                 item 3 (CIMD validation + Cognito leg)
 *   GET  /callback                                  item 3 (Cognito returns, client leg resumes)
 *   POST /token                                     item 4 (JWT unaltered, connector bound to it)
 *   POST /mcp                                       401 discovery + authenticated MCP round-trip
 */

import { Hono } from 'hono';
import { type AgentConfig } from './config.js';
import { resolveClientMetadata } from './cimd.js';
import { decodeState, encodeState, sealCode, unsealCode } from './state.js';
import { authorizationServerMetadata, protectedResourceMetadata } from './oauth.js';
import type { SecretResolver } from './secrets.js';
import { verifyAccessToken } from './auth.js';
import { handleMcpRequest } from './mcp.js';
import type { McpToolAdapter } from './mcp/tools.js';
import type { ConnectorBinder } from './connector-binding.js';
import type { Deployment } from '@memorysmith/contracts';
import { PRODUCTION_DEFAULT } from './mcp/environment.js';

/** The longest connector name an authorship keeps. */
const CLIENT_NAME_LIMIT = 200;

interface IssuedTokens {
  readonly accessToken: string;
  readonly refreshToken: string | null;
}

/** The tokens of a successful Cognito answer, read and never rewritten. */
function issuedTokens(body: string): IssuedTokens | null {
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    if (typeof parsed['access_token'] !== 'string') return null;
    return {
      accessToken: parsed['access_token'],
      refreshToken: typeof parsed['refresh_token'] === 'string' ? parsed['refresh_token'] : null,
    };
  } catch {
    return null;
  }
}

/**
 * Builds the HTTP surface.
 *
 * The state HMAC key arrives as a resolver rather than a value: it is read from
 * Secrets Manager at request time, so it never sits in the function's
 * environment. Every parameter is required, and the Lambda entrypoint is the
 * only place that wires the real adapters.
 */
export function createApp(
  config: AgentConfig,
  resolveStateSecret: SecretResolver,
  tools: McpToolAdapter,
  binder: ConnectorBinder,
  deployment: Deployment = PRODUCTION_DEFAULT,
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

    const clientName = metadata.document.client_name;
    const state = encodeState(
      {
        clientId,
        // Kept to the end of the flow, where it names the connector the token
        // is bound to. The document is not fetched again at /token.
        ...(clientName ? { clientName } : {}),
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
    const secret = await resolveStateSecret();
    const state = decodeState(encoded, secret);
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
      // Not Cognito's code but a sealed one, holding it together with the
      // connector validated at /authorize: that connector, and no other client,
      // is who /token binds the token to.
      target.searchParams.set(
        'code',
        sealCode(
          {
            code: q['code'],
            clientId: state.clientId,
            ...(state.clientName ? { clientName: state.clientName } : {}),
            issuedAt: Date.now(),
          },
          secret,
        ),
      );
      target.searchParams.set('iss', config.publicOrigin);
    } else {
      return c.json({ error: 'invalid_request', error_description: 'Missing code' }, 400);
    }
    if (state.clientState !== undefined) target.searchParams.set('state', state.clientState);
    return c.redirect(target.toString(), 302);
  });

  // ---- Token endpoint (item 4): the JWT unaltered, the connector bound ------

  /**
   * The one place the connector and the token are ever seen together. Cognito
   * issues every token to the proxy's app client and lets nothing add the
   * connector to it, so the proxy records the pair through Access before the
   * client holds the token, and the core reads it on every write (RN-AGT-001).
   *
   * The Cognito response is returned byte for byte, whatever happens to the
   * binding. A token whose binding failed still reads; every write through it is
   * refused until the connector reconnects, which is the price of never
   * recording a write as the person's alone.
   */
  app.post('/token', async (c) => {
    const form = await c.req.parseBody();
    const grantType = form['grant_type'];
    const upstream = new URLSearchParams();
    let bindTo: (tokens: IssuedTokens) => Promise<void>;

    if (grantType === 'authorization_code') {
      if (typeof form['code'] !== 'string' || typeof form['code_verifier'] !== 'string') {
        return c.json(
          { error: 'invalid_request', error_description: 'code and code_verifier are required' },
          400,
        );
      }
      const sealed = unsealCode(form['code'], await resolveStateSecret());
      if (!sealed) {
        return c.json(
          { error: 'invalid_grant', error_description: 'Invalid or expired code' },
          400,
        );
      }
      // A client that validated one identity at /authorize cannot claim another here.
      if (form['client_id'] !== sealed.clientId) {
        return c.json(
          { error: 'invalid_grant', error_description: 'The code was issued to another client' },
          400,
        );
      }
      upstream.set('grant_type', 'authorization_code');
      upstream.set('client_id', config.proxyClientId);
      upstream.set('redirect_uri', `${config.publicOrigin}/callback`);
      upstream.set('code', sealed.code);
      upstream.set('code_verifier', form['code_verifier']);
      bindTo = (tokens) =>
        binder.bind({
          accessToken: tokens.accessToken,
          connector: {
            clientId: sealed.clientId,
            clientName: (sealed.clientName || sealed.clientId).slice(0, CLIENT_NAME_LIMIT),
          },
          refreshToken: tokens.refreshToken,
        });
    } else if (grantType === 'refresh_token') {
      const presented = form['refresh_token'];
      if (typeof presented !== 'string') {
        return c.json(
          { error: 'invalid_request', error_description: 'refresh_token is required' },
          400,
        );
      }
      upstream.set('grant_type', 'refresh_token');
      upstream.set('client_id', config.proxyClientId);
      upstream.set('refresh_token', presented);
      bindTo = (tokens) =>
        binder.rebind({
          accessToken: tokens.accessToken,
          refreshToken: presented,
          rotatedRefreshToken:
            tokens.refreshToken && tokens.refreshToken !== presented ? tokens.refreshToken : null,
        });
    } else {
      return c.json({ error: 'unsupported_grant_type' }, 400);
    }

    const response = await fetch(`${config.cognitoDomain}/oauth2/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: upstream.toString(),
    });
    const body = await response.text();
    const tokens = response.ok ? issuedTokens(body) : null;
    if (tokens) {
      await bindTo(tokens).catch((error: unknown) => {
        console.error(
          JSON.stringify({
            message: 'The connector could not be bound to the token it was issued',
            grantType,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      });
    }
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
    const response = await handleMcpRequest(body, token, tools, bearerToken, deployment);
    if (response === null) return c.newResponse(null, 202);
    return c.json(response);
  });

  app.get('/healthz', (c) => c.json({ ok: true }));
  return app;
}
