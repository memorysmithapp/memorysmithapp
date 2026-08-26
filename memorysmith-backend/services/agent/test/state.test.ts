import { describe, expect, it } from 'vitest';
import { decodeState, encodeState, type ProxyState } from '../src/state.js';

const SECRET = 'test-secret';

const sample: ProxyState = {
  clientId: 'https://client.example.com/m.json',
  redirectUri: 'https://app.example.com/cb',
  clientState: 'abc123',
  issuedAt: 1_700_000_000_000,
};

describe('proxy state round-trip', () => {
  it('encodes and decodes losslessly', () => {
    const encoded = encodeState(sample, SECRET);
    expect(decodeState(encoded, SECRET, sample.issuedAt + 1000)).toEqual(sample);
  });

  it('preserves an absent clientState', () => {
    const { clientState: _omitted, ...rest } = sample;
    const encoded = encodeState(rest as ProxyState, SECRET);
    const decoded = decodeState(encoded, SECRET, sample.issuedAt + 1000);
    expect(decoded?.clientState).toBeUndefined();
  });

  it('rejects a tampered payload', () => {
    const encoded = encodeState(sample, SECRET);
    const [payload, signature] = encoded.split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...sample, redirectUri: 'https://evil.example.com/cb' }),
      'utf8',
    ).toString('base64url');
    expect(decodeState(`${forged}.${signature}`, SECRET, sample.issuedAt + 1000)).toBeNull();
    expect(payload).not.toBe(forged);
  });

  it('rejects a wrong secret', () => {
    const encoded = encodeState(sample, SECRET);
    expect(decodeState(encoded, 'other-secret', sample.issuedAt + 1000)).toBeNull();
  });

  it('rejects an expired state', () => {
    const encoded = encodeState(sample, SECRET);
    expect(decodeState(encoded, SECRET, sample.issuedAt + 11 * 60 * 1000)).toBeNull();
  });

  it('rejects garbage', () => {
    expect(decodeState('garbage', SECRET)).toBeNull();
    expect(decodeState('a.b', SECRET)).toBeNull();
    expect(decodeState('', SECRET)).toBeNull();
  });
});
