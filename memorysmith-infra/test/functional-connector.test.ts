/**
 * What the functional suite presents to the connector before a browser is
 * involved (architecture-guide.md, section 13.3): the document that names it,
 * the proof of its code, and the two requests of the flow.
 */

import { describe, expect, it } from 'vitest';
import {
  authorizeUrl,
  challengeOf,
  clientMetadata,
  pkce,
  tokenRequest,
} from '../functional/support/connector-client.js';

describe('the client the suite is to the connector', () => {
  it('names itself by the URL it is published at, and redirects to the loopback', () => {
    expect(clientMetadata('https://stg.memorysmith.app')).toEqual({
      client_id: 'https://stg.memorysmith.app/functional/client-metadata.json',
      client_name: 'MemorySmith functional suite',
      redirect_uris: ['http://127.0.0.1/callback'],
    });
  });

  it('proves its code with S256, as RFC 7636 computes it', () => {
    expect(challengeOf('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
    const generated = pkce();
    expect(generated.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generated.challenge).toBe(challengeOf(generated.verifier));
  });

  it('asks the connector for a code with every parameter it requires', () => {
    const url = new URL(
      authorizeUrl({
        mcp: 'https://mcp.stg.memorysmith.app',
        clientId: 'https://stg.memorysmith.app/functional/client-metadata.json',
        redirectUri: 'http://127.0.0.1:53123/callback',
        challenge: 'challenge',
        state: 'state',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://mcp.stg.memorysmith.app/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'https://stg.memorysmith.app/functional/client-metadata.json',
      redirect_uri: 'http://127.0.0.1:53123/callback',
      code_challenge: 'challenge',
      code_challenge_method: 'S256',
      state: 'state',
      scope: 'openid email profile',
    });
  });

  it('redeems the code with its verifier, under the same client', () => {
    expect(
      Object.fromEntries(
        tokenRequest({
          code: 'sealed',
          verifier: 'verifier',
          clientId: 'https://stg.memorysmith.app/functional/client-metadata.json',
          redirectUri: 'http://127.0.0.1:53123/callback',
        }),
      ),
    ).toEqual({
      grant_type: 'authorization_code',
      code: 'sealed',
      code_verifier: 'verifier',
      client_id: 'https://stg.memorysmith.app/functional/client-metadata.json',
      redirect_uri: 'http://127.0.0.1:53123/callback',
    });
  });
});
