/**
 * Client ID Metadata Documents (CIMD) support for the authorization proxy.
 *
 * Under CIMD the OAuth client_id IS an HTTPS URL that serves a JSON document
 * describing the client. Before any redirect, the proxy fetches and validates
 * that document (architecture-guide.md, section 13.3, item 3):
 *   - the client_id must be an HTTPS URL;
 *   - the URL must not resolve to a private or otherwise non-public address (anti-SSRF);
 *   - the document is capped in size and fetch time;
 *   - the client_id inside the document must be byte-identical to the URL;
 *   - the requested redirect_uri must be listed in the document, where loopback
 *     redirect URIs (RFC 8252) match with the port ignored.
 */

import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export const MAX_DOCUMENT_BYTES = 64 * 1024;
export const FETCH_TIMEOUT_MS = 5_000;

export interface ClientMetadataDocument {
  client_id: string;
  client_name?: string;
  client_uri?: string;
  redirect_uris: string[];
  logo_uri?: string;
}

export type CimdError =
  | { code: 'INVALID_CLIENT_ID_URL'; detail: string }
  | { code: 'PRIVATE_ADDRESS'; detail: string }
  | { code: 'FETCH_FAILED'; detail: string }
  | { code: 'DOCUMENT_TOO_LARGE'; detail: string }
  | { code: 'MALFORMED_DOCUMENT'; detail: string }
  | { code: 'CLIENT_ID_MISMATCH'; detail: string }
  | { code: 'REDIRECT_URI_NOT_REGISTERED'; detail: string };

export type CimdResult =
  | { ok: true; document: ClientMetadataDocument }
  | { ok: false; error: CimdError };

/** Validates the shape of a CIMD client_id: an absolute HTTPS URL. */
export function parseClientIdUrl(clientId: string): URL | null {
  let url: URL;
  try {
    url = new URL(clientId);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username !== '' || url.password !== '') return null;
  return url;
}

/** True when the literal IP is private, loopback, link-local or otherwise non-public. */
export function isPrivateIp(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const octets = address.split('.').map(Number);
    const [a = -1, b = -1] = octets;
    if (octets.length !== 4 || octets.some((o) => Number.isNaN(o) || o < 0 || o > 255)) return true;
    if (a === 0 || a === 10 || a === 127) return true; // this-network, private, loopback
    if (a === 169 && b === 254) return true; // link-local / IMDS
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast + reserved
    return false;
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    if (lower === '::' || lower === '::1') return true; // unspecified, loopback
    if (
      lower.startsWith('fe8') ||
      lower.startsWith('fe9') ||
      lower.startsWith('fea') ||
      lower.startsWith('feb')
    ) {
      return true; // link-local
    }
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local
    if (lower.startsWith('::ffff:')) return isPrivateIp(lower.slice('::ffff:'.length)); // v4-mapped
    return false;
  }
  return true; // not an IP literal at all: caller resolves via DNS first
}

/** Resolves the host and rejects anything that lands on a non-public address. */
async function assertPublicHost(url: URL): Promise<CimdError | null> {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return { code: 'PRIVATE_ADDRESS', detail: `Host ${host} is not public` };
  }
  if (isIP(host)) {
    return isPrivateIp(host)
      ? { code: 'PRIVATE_ADDRESS', detail: `IP ${host} is not public` }
      : null;
  }
  try {
    const results = await dnsLookup(host, { all: true });
    for (const { address } of results) {
      if (isPrivateIp(address)) {
        return {
          code: 'PRIVATE_ADDRESS',
          detail: `Host ${host} resolves to non-public address ${address}`,
        };
      }
    }
  } catch (error) {
    return { code: 'FETCH_FAILED', detail: `DNS resolution failed for ${host}: ${String(error)}` };
  }
  return null;
}

/** RFC 8252: loopback redirect URIs match regardless of port. Everything else matches exactly. */
export function redirectUriMatches(requested: string, registered: string): boolean {
  if (requested === registered) return true;
  let requestedUrl: URL;
  let registeredUrl: URL;
  try {
    requestedUrl = new URL(requested);
    registeredUrl = new URL(registered);
  } catch {
    return false;
  }
  const isLoopbackHost = (h: string): boolean =>
    h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1';
  if (!isLoopbackHost(requestedUrl.hostname) || !isLoopbackHost(registeredUrl.hostname)) {
    return false;
  }
  return (
    requestedUrl.protocol === registeredUrl.protocol &&
    requestedUrl.hostname === registeredUrl.hostname &&
    requestedUrl.pathname === registeredUrl.pathname &&
    requestedUrl.search === registeredUrl.search
  );
}

function parseDocument(raw: string, clientId: string): CimdResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      error: { code: 'MALFORMED_DOCUMENT', detail: 'Document is not valid JSON' },
    };
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return {
      ok: false,
      error: { code: 'MALFORMED_DOCUMENT', detail: 'Document is not a JSON object' },
    };
  }
  const doc = parsed as Record<string, unknown>;
  if (typeof doc['client_id'] !== 'string') {
    return {
      ok: false,
      error: { code: 'MALFORMED_DOCUMENT', detail: 'Document is missing client_id' },
    };
  }
  if (doc['client_id'] !== clientId) {
    return {
      ok: false,
      error: {
        code: 'CLIENT_ID_MISMATCH',
        detail: 'client_id inside the document differs from the document URL',
      },
    };
  }
  if (
    !Array.isArray(doc['redirect_uris']) ||
    doc['redirect_uris'].some((u) => typeof u !== 'string')
  ) {
    return {
      ok: false,
      error: { code: 'MALFORMED_DOCUMENT', detail: 'redirect_uris must be an array of strings' },
    };
  }
  return {
    ok: true,
    document: {
      client_id: doc['client_id'],
      client_name: typeof doc['client_name'] === 'string' ? doc['client_name'] : undefined,
      client_uri: typeof doc['client_uri'] === 'string' ? doc['client_uri'] : undefined,
      redirect_uris: doc['redirect_uris'] as string[],
      logo_uri: typeof doc['logo_uri'] === 'string' ? doc['logo_uri'] : undefined,
    },
  };
}

export interface FetchClientMetadataOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
  /** Skip DNS resolution (used by unit tests that stub fetch). */
  skipDnsCheck?: boolean;
}

/**
 * Fetches and validates the client metadata document for a CIMD client_id,
 * then checks that the requested redirect_uri is registered in it.
 */
export async function resolveClientMetadata(
  clientId: string,
  requestedRedirectUri: string,
  options: FetchClientMetadataOptions = {},
): Promise<CimdResult> {
  const {
    fetchImpl = fetch,
    timeoutMs = FETCH_TIMEOUT_MS,
    maxBytes = MAX_DOCUMENT_BYTES,
  } = options;

  const url = parseClientIdUrl(clientId);
  if (!url) {
    return {
      ok: false,
      error: { code: 'INVALID_CLIENT_ID_URL', detail: 'client_id must be an absolute HTTPS URL' },
    };
  }
  if (!options.skipDnsCheck) {
    const addressError = await assertPublicHost(url);
    if (addressError) return { ok: false, error: addressError };
  }

  let response: Response;
  try {
    response = await fetchImpl(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: 'application/json' },
    });
  } catch (error) {
    return {
      ok: false,
      error: { code: 'FETCH_FAILED', detail: `Failed to fetch client metadata: ${String(error)}` },
    };
  }
  if (!response.ok) {
    return {
      ok: false,
      error: { code: 'FETCH_FAILED', detail: `Client metadata endpoint answered ${response.status}` },
    };
  }

  const declaredLength = Number(response.headers.get('content-length') ?? '0');
  if (declaredLength > maxBytes) {
    return {
      ok: false,
      error: { code: 'DOCUMENT_TOO_LARGE', detail: `Document exceeds ${maxBytes} bytes` },
    };
  }
  const raw = await response.text();
  if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
    return {
      ok: false,
      error: { code: 'DOCUMENT_TOO_LARGE', detail: `Document exceeds ${maxBytes} bytes` },
    };
  }

  const result = parseDocument(raw, clientId);
  if (!result.ok) return result;

  const registered = result.document.redirect_uris.some((candidate) =>
    redirectUriMatches(requestedRedirectUri, candidate),
  );
  if (!registered) {
    return {
      ok: false,
      error: {
        code: 'REDIRECT_URI_NOT_REGISTERED',
        detail: 'redirect_uri is not listed in the client metadata document',
      },
    };
  }
  return result;
}
