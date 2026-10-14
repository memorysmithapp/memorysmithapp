import { describe, expect, it } from 'vitest';
import {
  decodeState,
  encodeState,
  sealCode,
  unsealCode,
  type ProxyState,
  type SealedCode,
} from '../src/state.js';

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

  it('carries the client_name of the metadata document when there is one', () => {
    const named = { ...sample, clientName: 'Example Client' };
    const encoded = encodeState(named, SECRET);
    expect(decodeState(encoded, SECRET, sample.issuedAt + 1000)?.clientName).toBe('Example Client');
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

/**
 * The code a client redeems at /token holds the connector validated at
 * /authorize, so the connector a token is bound to is the one that was checked,
 * and not whichever client_id the token request names.
 */
describe('sealed code', () => {
  const code: SealedCode = {
    code: 'cognito-code',
    clientId: 'https://client.example.com/m.json',
    clientName: 'Example Client',
    issuedAt: 1_700_000_000_000,
  };

  it('round-trips with the connector it was validated for', () => {
    expect(unsealCode(sealCode(code, SECRET), SECRET, code.issuedAt + 1000)).toEqual(code);
  });

  it('expires with the code Cognito issued, after five minutes', () => {
    const sealed = sealCode(code, SECRET);
    expect(unsealCode(sealed, SECRET, code.issuedAt + 4 * 60 * 1000)).not.toBeNull();
    expect(unsealCode(sealed, SECRET, code.issuedAt + 6 * 60 * 1000)).toBeNull();
  });

  it('rejects a code rewritten for another client', () => {
    const [, signature] = sealCode(code, SECRET).split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...code, kind: 'code', clientId: 'https://impostor.example.com/m.json' }),
      'utf8',
    ).toString('base64url');
    expect(unsealCode(`${forged}.${signature}`, SECRET, code.issuedAt + 1000)).toBeNull();
  });

  it('is never accepted as a state, nor a state as a code', () => {
    expect(decodeState(sealCode(code, SECRET), SECRET, code.issuedAt + 1000)).toBeNull();
    expect(unsealCode(encodeState(sample, SECRET), SECRET, sample.issuedAt + 1000)).toBeNull();
  });
});
