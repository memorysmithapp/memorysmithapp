/**
 * HMAC-signed values the proxy hands to a client and reads back
 * (architecture-guide.md, section 13.3, items 3 and 4).
 *
 * The proxy is stateless: everything needed to finish a leg travels inside what
 * the client carries, signed so it cannot be forged, and stamped so it expires.
 * There are two of them, told apart by a kind inside the signature, so neither
 * can be presented as the other:
 *
 *  - the STATE correlates the client leg and the Cognito leg of the
 *    authorization, and carries the connector validated at /authorize;
 *  - the CODE the client receives on its redirect is not Cognito's but a sealed
 *    one, holding Cognito's code together with the connector it was validated
 *    for. It is what keeps a client from validating one identity at /authorize
 *    and claiming another at /token.
 *
 * Signed, not encrypted. Whoever reads a sealed code learns a Cognito code that
 * is useless without the PKCE verifier, and a token obtained from Cognito
 * directly, around the proxy, was bound to no connector and cannot write.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface ProxyState {
  /** CIMD client_id (the HTTPS URL identifying the connector). */
  clientId: string;
  /** The client_name of its metadata document, when the document declares one. */
  clientName?: string;
  /** The redirect_uri requested by the client, already validated against its CIMD document. */
  redirectUri: string;
  /** The state value the client originally sent, echoed back on the final redirect. */
  clientState?: string;
  /** Unix epoch milliseconds when this state was minted. */
  issuedAt: number;
}

export interface SealedCode {
  /** The authorization code Cognito issued to the proxy. */
  code: string;
  /** The CIMD client_id validated at /authorize, the only client that may redeem it. */
  clientId: string;
  clientName?: string;
  /** Unix epoch milliseconds when this code was sealed. */
  issuedAt: number;
}

const STATE_TTL_MS = 10 * 60 * 1000;
/** Cognito's authorization code lives five minutes, and the sealed one no longer. */
const CODE_TTL_MS = 5 * 60 * 1000;

type Kind = 'state' | 'code';

const base64url = (buffer: Buffer): string => buffer.toString('base64url');

function sign(payload: string, secret: string): string {
  return base64url(createHmac('sha256', secret).update(payload).digest());
}

function seal(kind: Kind, value: object, secret: string): string {
  const payload = base64url(Buffer.from(JSON.stringify({ ...value, kind }), 'utf8'));
  return `${payload}.${sign(payload, secret)}`;
}

/** The signed fields, when the signature holds and the kind is the one expected. */
function open(kind: Kind, encoded: string, secret: string): Record<string, unknown> | null {
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
  const fields = parsed as Record<string, unknown>;
  return fields['kind'] === kind ? fields : null;
}

const optionalText = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

export function encodeState(state: ProxyState, secret: string): string {
  return seal('state', state, secret);
}

export function decodeState(
  encoded: string,
  secret: string,
  now: number = Date.now(),
): ProxyState | null {
  const state = open('state', encoded, secret);
  if (!state) return null;
  if (typeof state['clientId'] !== 'string' || typeof state['redirectUri'] !== 'string')
    return null;
  if (typeof state['issuedAt'] !== 'number') return null;
  if (now - state['issuedAt'] > STATE_TTL_MS) return null;
  const clientName = optionalText(state['clientName']);
  const clientState = optionalText(state['clientState']);
  return {
    clientId: state['clientId'],
    ...(clientName === undefined ? {} : { clientName }),
    redirectUri: state['redirectUri'],
    clientState,
    issuedAt: state['issuedAt'],
  };
}

export function sealCode(code: SealedCode, secret: string): string {
  return seal('code', code, secret);
}

export function unsealCode(
  encoded: string,
  secret: string,
  now: number = Date.now(),
): SealedCode | null {
  const code = open('code', encoded, secret);
  if (!code) return null;
  if (typeof code['code'] !== 'string' || typeof code['clientId'] !== 'string') return null;
  if (typeof code['issuedAt'] !== 'number') return null;
  if (now - code['issuedAt'] > CODE_TTL_MS) return null;
  const clientName = optionalText(code['clientName']);
  return {
    code: code['code'],
    clientId: code['clientId'],
    ...(clientName === undefined ? {} : { clientName }),
    issuedAt: code['issuedAt'],
  };
}
