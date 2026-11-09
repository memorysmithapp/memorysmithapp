/**
 * The secrets a delivery of an installation carries from its variables into
 * Secrets Manager, so that no template and no file of the repository holds
 * them (#395, #396).
 *
 * A secret is written only when its value changed, so a delivery that brings
 * the same value leaves the version where it was: the template pins that
 * version, and a new one would be a change to deploy every time.
 */

import {
  CreateSecretCommand,
  GetSecretValueCommand,
  PutSecretValueCommand,
  type SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';

type Client = Pick<SecretsManagerClient, 'send'>;

const missing = (error: unknown): boolean =>
  (error as { name?: string })?.name === 'ResourceNotFoundException';

/**
 * The version of the secret that holds `value`, writing it when it differs or
 * does not exist. With no value, the one an earlier delivery wrote stands, and
 * null says there is none.
 */
export async function ensureSecret(
  client: Client,
  name: string,
  value: string | undefined,
  tags: Record<string, string> = {},
): Promise<string | null> {
  const given = value?.trim() ? value : undefined;
  let current: { value: string; version: string } | null = null;
  try {
    const found = await client.send(new GetSecretValueCommand({ SecretId: name }));
    current = { value: found.SecretString ?? '', version: found.VersionId ?? '' };
  } catch (error) {
    if (!missing(error)) throw error;
  }

  if (given === undefined) return current?.version || null;
  if (current && current.value === given) return current.version;

  if (current) {
    const put = await client.send(
      new PutSecretValueCommand({ SecretId: name, SecretString: given }),
    );
    return put.VersionId ?? null;
  }
  const created = await client.send(
    new CreateSecretCommand({
      Name: name,
      SecretString: given,
      Description: 'Written by deliver from a variable of the installation; never edit it by hand.',
      Tags: Object.entries(tags).map(([Key, Value]) => ({ Key, Value })),
    }),
  );
  return created.VersionId ?? null;
}
