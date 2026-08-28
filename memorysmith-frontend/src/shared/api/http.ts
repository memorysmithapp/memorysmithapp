// The HTTP client. Every call to the backend goes through here, and this is
// the only place that knows about bearer tokens and status codes.
//
// NO REQUEST EVER CARRIES A subscriptionId. It comes from the token, always
// (RN-SUB-002), which is why nothing below takes one.

import { apiErrorFrom, ApiError } from './error-mapper';
import { readTokens, refresh, type AuthConfig } from '../auth/oauth';

export interface HttpConfig {
  readonly origin: string;
  readonly auth: AuthConfig;
}

let config: HttpConfig | null = null;

export function configureHttp(next: HttpConfig): void {
  config = next;
}

export function apiOrigin(): string | null {
  return config?.origin ?? null;
}

async function bearer(): Promise<string | null> {
  const tokens = readTokens();
  if (!tokens) return null;
  // A minute of margin, so a request never leaves with a token that expires
  // while it is in flight.
  if (tokens.expiresAt - Date.now() > 60_000) return tokens.accessToken;
  if (!config) return tokens.accessToken;
  return (await refresh(config.auth))?.accessToken ?? null;
}

export async function request<T>(
  path: string,
  init: { method?: string; body?: unknown; accept?: 'json' | 'text' } = {},
): Promise<T> {
  if (!config) throw new ApiError('INTERNAL', 'The API client was not configured', 0);

  const token = await bearer();
  if (!token) throw new ApiError('UNAUTHENTICATED', 'Sign in to continue', 401);

  let response: Response;
  try {
    response = await fetch(`${config.origin}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
  } catch {
    // A failed fetch is the network, not the API: saying so is the difference
    // between "we are down" and "you are offline".
    throw new ApiError('OFFLINE', 'The application could not reach the server', 0);
  }

  if (response.status === 204) return undefined as T;

  if (init.accept === 'text') {
    const text = await response.text();
    if (!response.ok) throw apiErrorFrom(response.status, safeJson(text));
    return text as T;
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw apiErrorFrom(response.status, payload);
  return payload as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
