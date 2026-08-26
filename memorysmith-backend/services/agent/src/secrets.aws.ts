/**
 * Secrets Manager adapter for the SecretResolver port.
 *
 * This is the only file in svc-agent that imports the AWS SDK, and nothing on
 * the HTTP surface imports this file: the Lambda entrypoint wires it in.
 */

import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { cacheSecret, type CacheOptions, type SecretResolver } from './secrets.js';

export interface SecretsManagerResolverOptions extends CacheOptions {
  /** Injectable for tests; defaults to a client on the function's own region. */
  client?: SecretsManagerClient;
}

/**
 * Reads `secretId` from Secrets Manager, cached for the configured TTL.
 *
 * Only the SecretString form is accepted. A binary secret here would mean the
 * secret was provisioned by something other than our CDK stack, and silently
 * coercing those bytes into an HMAC key would fail later, in signature
 * verification, far from the cause.
 */
export function secretsManagerResolver(
  secretId: string,
  options: SecretsManagerResolverOptions = {},
): SecretResolver {
  const client = options.client ?? new SecretsManagerClient({});

  return cacheSecret(async () => {
    const response = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
    if (typeof response.SecretString !== 'string' || response.SecretString === '') {
      throw new Error(`Secret ${secretId} has no SecretString value`);
    }
    return response.SecretString;
  }, options);
}
