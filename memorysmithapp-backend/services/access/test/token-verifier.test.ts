/**
 * The bearer token of the API, against a user pool whose tokens carry claims
 * the product does not read. Cognito adds `acr` and `amr` to every token from
 * November 2026 on, additively, and a session must open the same way with them.
 */

import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { CognitoTokenVerifier } from '../src/adapters/inbound/http/authentication.js';

/**
 * A user pool of our own, for a test: a key pair, its JWKS served on a port
 * of this machine, and tokens signed with it under that issuer.
 */
async function localIssuer() {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  const server = createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(
      request.url?.endsWith('/.well-known/jwks.json') ? JSON.stringify({ keys: [jwk] }) : '{}',
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}/us-east-1_pool`;
  const sign = (claims: Record<string, unknown>) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(issuer)
      .setSubject('a1b2c3d4-5678-90ab-cdef-EXAMPLE11111')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);
  return {
    issuer,
    sign,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

describe('the access token of the API', () => {
  let pool: Awaited<ReturnType<typeof localIssuer>>;
  beforeAll(async () => {
    pool = await localIssuer();
  });
  afterAll(() => pool.close());

  const claims = {
    token_use: 'access',
    client_id: 'web',
    email: 'jane@example.org',
    subscription_id: '01JBQ2X00000000000000000S1',
    subscription_status: 'active',
    'cognito:groups': ['owners'],
  };

  it('reads the same claims whether or not the token carries acr and amr', async () => {
    const verifier = new CognitoTokenVerifier(pool.issuer, 'web');
    const today = await verifier.verify(await pool.sign(claims));
    for (const added of [
      { acr: 'urn:cognito:loa:1', amr: ['pwd'] },
      { acr: 'urn:cognito:loa:4', amr: ['pwd', 'otp', 'mfa'] },
    ]) {
      const tomorrow = await verifier.verify(await pool.sign({ ...claims, ...added }));
      expect(tomorrow).not.toBeNull();
      expect({ ...tomorrow, jti: undefined, exp: undefined }).toEqual({
        ...today,
        jti: undefined,
        exp: undefined,
      });
    }
  });

  it('still refuses a token of another app client', async () => {
    const verifier = new CognitoTokenVerifier(pool.issuer, 'web');
    expect(
      await verifier.verify(await pool.sign({ ...claims, client_id: 'x', amr: ['pwd'] })),
    ).toBeNull();
  });
});
