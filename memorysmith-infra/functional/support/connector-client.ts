/**
 * The functional suite as a client of the connector (architecture-guide.md,
 * section 13.3).
 *
 * The connector accepts a client by the URL of a Client ID Metadata Document
 * whose `client_id` is that very URL. A document cannot name a commit it is
 * part of, so it is not read from the repository: a run publishes it on the
 * site of the environment it tests, at a path that is the same on every run.
 * The client redirects to the loopback, whose port the connector ignores, so a
 * run listens on any free port.
 *
 * The proof that the code a client redeems is the one it asked for is PKCE
 * with S256 (RFC 7636), which the connector requires of every client.
 */

import { createHash, randomBytes } from 'node:crypto';

export const CLIENT_METADATA_KEY = 'functional/client-metadata.json';
export const LOOPBACK_REDIRECT = 'http://127.0.0.1/callback';

export interface ClientMetadata {
  readonly client_id: string;
  readonly client_name: string;
  readonly redirect_uris: readonly string[];
}

/**
 * Who connects: where its document is published on the site, and the name the
 * connector records beside every write it makes. Each caller of the flow is a
 * client of its own, because the name is what `whoami` shows the agent.
 */
export interface ConnectorClient {
  readonly key: string;
  readonly name: string;
}

export const FUNCTIONAL_CLIENT: ConnectorClient = {
  key: CLIENT_METADATA_KEY,
  name: 'MemorySmith functional suite',
};

export function clientMetadata(
  site: string,
  client: ConnectorClient = FUNCTIONAL_CLIENT,
): ClientMetadata {
  return {
    client_id: `${site}/${client.key}`,
    client_name: client.name,
    redirect_uris: [LOOPBACK_REDIRECT],
  };
}

export interface Pkce {
  readonly verifier: string;
  readonly challenge: string;
}

export function challengeOf(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function pkce(): Pkce {
  const verifier = randomBytes(32).toString('base64url');
  return { verifier, challenge: challengeOf(verifier) };
}

export function authorizeUrl(input: {
  readonly mcp: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly challenge: string;
  readonly state: string;
}): string {
  const url = new URL('/authorize', input.mcp);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    code_challenge: input.challenge,
    code_challenge_method: 'S256',
    state: input.state,
    scope: 'openid email profile',
  }).toString();
  return url.toString();
}

/** The body of the exchange of a code, form-encoded as the token endpoint reads it. */
export function tokenRequest(input: {
  readonly code: string;
  readonly verifier: string;
  readonly clientId: string;
  readonly redirectUri: string;
}): URLSearchParams {
  return new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    code_verifier: input.verifier,
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
  });
}
