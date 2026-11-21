/**
 * The session is renewed once at a time, and ended only when the provider
 * says it is gone (#525, RN-SUB-022).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readTokens, RefreshUnavailable, type AuthConfig } from './oauth';
import { renew, setPauseForTests } from './renewal';

const config: AuthConfig = {
  domain: 'https://auth.example.test',
  clientId: 'client',
  redirectUri: 'https://app.example.test/auth/callback',
  scopes: 'openid email profile',
  lang: 'en',
  identityProvider: null,
};

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  } as Storage;
}

function held(expiresIn: number): void {
  localStorage.setItem(
    'memorysmith.tokens',
    JSON.stringify({
      accessToken: 'access-1',
      idToken: 'id-1',
      refreshToken: 'refresh-30-days',
      expiresAt: Date.now() + expiresIn,
    }),
  );
}

const renewed = (): Response =>
  ({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ access_token: 'access-2', id_token: 'id-2', expires_in: 3600 }),
  }) as Response;

const failing = (status: number, error = 'server_error'): Response =>
  ({ ok: false, status, json: () => Promise.resolve({ error }) }) as Response;

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  setPauseForTests(() => Promise.resolve());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('renewing the session (#525)', () => {
  it('runs one refresh for every request that asks at once', async () => {
    held(10_000);
    const fetchMock = vi.fn().mockResolvedValue(renewed());
    vi.stubGlobal('fetch', fetchMock);

    const answers = await Promise.all([1, 2, 3, 4].map(() => renew(config, 60_000)));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(answers.map((tokens) => tokens?.accessToken)).toEqual([
      'access-2',
      'access-2',
      'access-2',
      'access-2',
    ]);
  });

  it('asks nothing when another tab already renewed', async () => {
    held(50 * 60_000);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect((await renew(config, 60_000))?.accessToken).toBe('access-1');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('tries again when the provider fails for a moment, and keeps the session', async () => {
    held(10_000);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(failing(503))
      .mockRejectedValueOnce(new TypeError('network'))
      .mockResolvedValueOnce(renewed());
    vi.stubGlobal('fetch', fetchMock);

    expect((await renew(config, 60_000))?.accessToken).toBe('access-2');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('says the provider is unavailable after the last try, and ends nothing', async () => {
    held(10_000);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(failing(500)));

    await expect(renew(config, 60_000)).rejects.toBeInstanceOf(RefreshUnavailable);
    expect(readTokens()?.refreshToken).toBe('refresh-30-days');
  });

  it('answers a gone session only when the provider says invalid_grant', async () => {
    held(10_000);
    const fetchMock = vi.fn().mockResolvedValue(failing(400, 'invalid_grant'));
    vi.stubGlobal('fetch', fetchMock);

    expect(await renew(config, 60_000)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reads a 400 that is not invalid_grant as a passing failure', async () => {
    held(10_000);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(failing(400, 'invalid_request')));

    await expect(renew(config, 60_000)).rejects.toBeInstanceOf(RefreshUnavailable);
  });
});
