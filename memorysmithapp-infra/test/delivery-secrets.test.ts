/**
 * The secrets of an installation, carried from its variables into Secrets
 * Manager by `deliver` (#395): written once per value, so the version the
 * template pins moves only when the value does.
 */

import {
  CreateSecretCommand,
  GetSecretValueCommand,
  PutSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { describe, expect, it } from 'vitest';
import { ensureSecret } from '../commands/lib/delivery-secrets.js';

function secretsManager(initial?: { value: string; version: string }) {
  let stored = initial ?? null;
  const sent: string[] = [];
  let next = 1;
  const client = {
    send: async (command: unknown) => {
      sent.push((command as object).constructor.name);
      if (command instanceof GetSecretValueCommand) {
        if (!stored) throw Object.assign(new Error('none'), { name: 'ResourceNotFoundException' });
        return { SecretString: stored.value, VersionId: stored.version };
      }
      if (command instanceof PutSecretValueCommand || command instanceof CreateSecretCommand) {
        stored = { value: String(command.input.SecretString), version: `v${++next}` };
        return { VersionId: stored.version };
      }
      throw new Error('unexpected command');
    },
  };
  return { client, sent, stored: () => stored };
}

describe('a secret of the delivery', () => {
  it('is created the first time, and its version handed back', async () => {
    const manager = secretsManager();
    expect(await ensureSecret(manager.client as never, 'idp', 's3cret')).toBe('v2');
    expect(manager.sent).toEqual(['GetSecretValueCommand', 'CreateSecretCommand']);
  });

  it('keeps its version when the delivery brings the same value', async () => {
    const manager = secretsManager({ value: 's3cret', version: 'v1' });
    expect(await ensureSecret(manager.client as never, 'idp', 's3cret')).toBe('v1');
    expect(manager.sent).toEqual(['GetSecretValueCommand']);
  });

  it('takes a new version when the value changes', async () => {
    const manager = secretsManager({ value: 'old', version: 'v1' });
    expect(await ensureSecret(manager.client as never, 'idp', 'new')).toBe('v2');
    expect(manager.stored()?.value).toBe('new');
  });

  it('stands on what an earlier delivery wrote when the variable is not set, and says when there is none', async () => {
    expect(
      await ensureSecret(secretsManager({ value: 'x', version: 'v1' }).client as never, 'idp', ''),
    ).toBe('v1');
    expect(await ensureSecret(secretsManager().client as never, 'idp', undefined)).toBeNull();
  });
});
