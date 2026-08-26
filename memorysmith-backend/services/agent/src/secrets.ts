/**
 * Port for reading a secret at runtime, plus the caching decorator every
 * adapter is expected to wear.
 *
 * The state HMAC key is never injected as an environment variable: a Lambda
 * environment variable is stored in plaintext on the function configuration and
 * in the CloudFormation template, so anyone able to describe either can read
 * it. The function is given only the secret's identifier and reads the value
 * itself (architecture-guide.md, section 13.3).
 *
 * This file deliberately knows nothing about AWS. The Secrets Manager adapter
 * lives in secrets.aws.ts, so the HTTP surface can be tested without the SDK.
 */

/** Resolves the current value of a secret. */
export type SecretResolver = () => Promise<string>;

export interface CacheOptions {
  /** How long a resolved value stays fresh. Defaults to five minutes. */
  ttlMs?: number;
  /** Clock seam for tests. */
  now?: () => number;
}

export const DEFAULT_SECRET_TTL_MS = 5 * 60 * 1000;

/**
 * Wraps a fetcher so the value is read once per TTL instead of once per request.
 *
 * A Lambda execution environment is reused across invocations, so this cache
 * lives as long as the container. Concurrent callers that arrive during an
 * in-flight read share it rather than issuing parallel calls, and a failed read
 * is never cached: the next caller retries.
 */
export function cacheSecret(
  fetchSecret: SecretResolver,
  options: CacheOptions = {},
): SecretResolver {
  const ttlMs = options.ttlMs ?? DEFAULT_SECRET_TTL_MS;
  const now = options.now ?? Date.now;

  let value: string | undefined;
  let expiresAt = 0;
  let inFlight: Promise<string> | undefined;

  return async (): Promise<string> => {
    if (value !== undefined && now() < expiresAt) return value;
    if (inFlight) return inFlight;

    inFlight = fetchSecret()
      .then((resolved) => {
        value = resolved;
        expiresAt = now() + ttlMs;
        return resolved;
      })
      .finally(() => {
        inFlight = undefined;
      });

    return inFlight;
  };
}
