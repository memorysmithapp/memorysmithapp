/**
 * Bearer-token verification for the MCP resource server.
 *
 * The proxy never issues tokens: every JWT reaching /mcp was minted by Cognito
 * (architecture-guide.md, section 13.3, item 4), so verification is plain
 * JWKS-based validation against the Cognito issuer.
 */

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { AgentConfig } from './config.js';

export interface VerifiedAgentToken {
  sub: string;
  clientId: string;
  username?: string;
  subscriptionId?: string;
  subscriptionStatus?: string;
  scope?: string;
  payload: JWTPayload;
}

type Jwks = ReturnType<typeof createRemoteJWKSet>;
let cachedJwks: { issuer: string; jwks: Jwks } | undefined;

function jwksFor(issuer: string): Jwks {
  if (!cachedJwks || cachedJwks.issuer !== issuer) {
    cachedJwks = {
      issuer,
      jwks: createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`)),
    };
  }
  return cachedJwks.jwks;
}

export async function verifyAccessToken(
  token: string,
  config: AgentConfig,
): Promise<VerifiedAgentToken | null> {
  try {
    const { payload } = await jwtVerify(token, jwksFor(config.cognitoIssuer), {
      issuer: config.cognitoIssuer,
    });
    if (payload['token_use'] !== 'access') return null;
    if (payload['client_id'] !== config.proxyClientId) return null;
    if (typeof payload.sub !== 'string') return null;
    return {
      sub: payload.sub,
      clientId: String(payload['client_id']),
      username: typeof payload['username'] === 'string' ? payload['username'] : undefined,
      subscriptionId:
        typeof payload['subscription_id'] === 'string' ? payload['subscription_id'] : undefined,
      subscriptionStatus:
        typeof payload['subscription_status'] === 'string'
          ? payload['subscription_status']
          : undefined,
      scope: typeof payload['scope'] === 'string' ? payload['scope'] : undefined,
      payload,
    };
  } catch {
    return null;
  }
}
