import { describe, expect, it } from 'vitest';
import { cacheSecret, DEFAULT_SECRET_TTL_MS } from '../src/secrets.js';

describe('cacheSecret', () => {
  it('reads the secret once and serves the cached value within the TTL', async () => {
    let reads = 0;
    let clock = 1_000;
    const resolve = cacheSecret(
      async () => {
        reads += 1;
        return `value-${reads}`;
      },
      { now: () => clock },
    );

    expect(await resolve()).toBe('value-1');
    clock += DEFAULT_SECRET_TTL_MS - 1;
    expect(await resolve()).toBe('value-1');
    expect(reads).toBe(1);
  });

  it('reads again once the TTL has elapsed, picking up a rotated value', async () => {
    let reads = 0;
    let clock = 1_000;
    const resolve = cacheSecret(
      async () => {
        reads += 1;
        return `value-${reads}`;
      },
      { now: () => clock },
    );

    expect(await resolve()).toBe('value-1');
    clock += DEFAULT_SECRET_TTL_MS;
    expect(await resolve()).toBe('value-2');
    expect(reads).toBe(2);
  });

  it('shares a single read across callers that arrive while one is in flight', async () => {
    let reads = 0;
    let release: (value: string) => void = () => {};
    const resolve = cacheSecret(async () => {
      reads += 1;
      return new Promise<string>((resolvePromise) => {
        release = resolvePromise;
      });
    });

    const first = resolve();
    const second = resolve();
    release('shared');

    expect(await first).toBe('shared');
    expect(await second).toBe('shared');
    expect(reads).toBe(1);
  });

  it('does not cache a failure: the next caller retries', async () => {
    let reads = 0;
    const resolve = cacheSecret(async () => {
      reads += 1;
      if (reads === 1) throw new Error('AccessDeniedException');
      return 'recovered';
    });

    await expect(resolve()).rejects.toThrow('AccessDeniedException');
    expect(await resolve()).toBe('recovered');
    expect(reads).toBe(2);
  });
});
