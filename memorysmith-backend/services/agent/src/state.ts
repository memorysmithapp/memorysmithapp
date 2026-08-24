/**
 * HMAC-signed state used to correlate the client leg and the Cognito leg of the
 * authorization flow (architecture-guide.md, section 13.3, item 3).
 *
 * The proxy is stateless: everything needed to finish the flow after Cognito
 * redirects back travels inside the state parameter itself, signed so it cannot
 * be forged, and stamped so it expires.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface ProxyState {
  /** CIMD client_id (the HTTPS URL identifying the connector). */
  clientId: string;
  /** The redirect_uri requested by the client, already validated against its CIMD document. */
  redirectUri: string;
  /** The state value the client originally sent, echoed back on the final redirect. */
  clientState?: string;
  /** Unix epoch milliseconds when this state was minted. */
  issuedAt: number;
}

const STATE_TTL_MS = 10 * 60 * 1000;

const base64url = (buffer: Buffer): string => buffer.toString('base64url');

function sign(payload: string, secret: string): string {
  return base64url(createHmac('sha256', secret).update(payload).digest());
}

export function encodeState(state: ProxyState, secret: string): string {
  const payload = base64url(Buffer.from(JSON.stringify(state), 'utf8'));
  return `${payload}.${sign(payload, secret)}`;
}

export function decodeState(
  encoded: string,
  secret: string,
  now: number = Date.now(),
): ProxyState | null {
  const separator = encoded.lastIndexOf('.');
  if (separator <= 0) return null;
  const payload = encoded.slice(0, separator);
  const signature = encoded.slice(separator + 1);
  const expected = sign(payload, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const state = parsed as Record<string, unknown>;
  if (typeof state['clientId'] !== 'string' || typeof state['redirectUri'] !== 'string') return null;
  if (typeof state['issuedAt'] !== 'number') return null;
  if (now - state['issuedAt'] > STATE_TTL_MS) return null;
  return {
    clientId: state['clientId'],
    redirectUri: state['redirectUri'],
    clientState: typeof state['clientState'] === 'string' ? state['clientState'] : undefined,
    issuedAt: state['issuedAt'],
  };
}
