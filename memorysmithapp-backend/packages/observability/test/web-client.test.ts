/** The browser a load of the web app came from, as a family (#526). */

import { describe, expect, it } from 'vitest';
import { sanitize } from '../src/fields.js';
import { webClientOf } from '../src/web-client.js';

describe('the browser of a load of the web app (#526)', () => {
  it.each([
    [
      'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
      'samsung-android',
    ],
    [
      'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      'chrome-android',
    ],
    [
      'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36',
      'embedded-android',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
      'safari-ios',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
      'embedded-ios',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
      'edge-desktop',
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      'safari-desktop',
    ],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0', 'firefox-desktop'],
  ])('names %s as %s', (userAgent, family) => {
    expect(webClientOf(userAgent)).toBe(family);
  });

  it('says it does not know when there is no user agent', () => {
    expect(webClientOf(undefined)).toBe('unknown');
  });
});

describe('the family on the line of an operation (#526)', () => {
  it('is written, and a user agent handed in its place is not', () => {
    const base = { operation: 'GET /access/session', outcome: 'ok', durationMs: 1 } as const;
    expect(sanitize({ ...base, webClient: 'samsung-android' })['webClient']).toBe(
      'samsung-android',
    );
    expect(
      sanitize({ ...base, webClient: 'Mozilla/5.0 (Linux; Android 14; SM-S918B)' })['webClient'],
    ).toBeUndefined();
  });
});
