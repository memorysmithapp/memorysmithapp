/**
 * The bearer token of the connector, against a user pool whose tokens carry
 * claims the connector does not read. Cognito adds `acr` and `amr` to every
 * token from November 2026 on, additively, and a verifier that refused an
 * unknown claim, or read `amr` as a string, would refuse every agent then.
 */

import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { verifyAccessToken } from '../src/auth.js';
import type { AgentConfig } from '../src/config.js';

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

describe('the access token of the connector', () => {
  let pool: Awaited<ReturnType<typeof localIssuer>>;
  let config: AgentConfig;
  beforeAll(async () => {
    pool = await localIssuer();
    config = { cognitoIssuer: pool.issuer, proxyClientId: 'proxy' } as AgentConfig;
  });
  afterAll(() => pool.close());

  const claims = {
    token_use: 'access',
    client_id: 'proxy',
    scope: 'openid profile',
    username: 'jane.doe',
    subscription_id: '01JBQ2X00000000000000000S1',
    subscription_status: 'active',
  };

  it('verifies a token as Cognito issues it today', async () => {
    const verified = await verifyAccessToken(await pool.sign(claims), config);
    expect(verified?.subscriptionId).toBe('01JBQ2X00000000000000000S1');
  });

  it('verifies a token that carries acr and amr, single factor and multi-factor', async () => {
    for (const added of [
      { acr: 'urn:cognito:loa:1', amr: ['pwd'] },
      { acr: 'urn:cognito:loa:4', amr: ['pwd', 'otp', 'mfa'] },
    ]) {
      const verified = await verifyAccessToken(await pool.sign({ ...claims, ...added }), config);
      expect(verified).toMatchObject({
        sub: 'a1b2c3d4-5678-90ab-cdef-EXAMPLE11111',
        clientId: 'proxy',
        username: 'jane.doe',
        subscriptionId: '01JBQ2X00000000000000000S1',
        subscriptionStatus: 'active',
        scope: 'openid profile',
      });
      expect(verified?.payload['amr']).toEqual(added.amr);
    }
  });

  it('still refuses a token of another client', async () => {
    expect(
      await verifyAccessToken(
        await pool.sign({ ...claims, client_id: 'other', amr: ['pwd'] }),
        config,
      ),
    ).toBeNull();
  });
});
