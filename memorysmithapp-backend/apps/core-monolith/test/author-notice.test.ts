/**
 * The notice an author is sent when the operator withdraws a model, through
 * SES or through the organization's relay (#396): the same message either way.
 */

import { describe, expect, it, vi } from 'vitest';
import { RelayAuthorNotifier, withdrawalNotice } from '../src/catalog.js';

const entry = {
  publicId: 'pub-1',
  name: 'Diário de obra',
  authorEmail: 'ana@acme.example',
} as never;

describe('the withdrawal notice through the relay', () => {
  it('hands the mail function the same message SES sends', async () => {
    const send = vi.fn(async () => ({}));
    await new RelayAuthorNotifier('mail-fn', { send } as never).withdrawn(entry, 'Spam');

    const [command] = send.mock.calls[0] as unknown as [
      { input: { FunctionName: string; Payload: Uint8Array } },
    ];
    expect(command.input.FunctionName).toBe('mail-fn');
    expect(JSON.parse(new TextDecoder().decode(command.input.Payload))).toEqual({
      mail: { to: 'ana@acme.example', ...withdrawalNotice({ name: 'Diário de obra' }, 'Spam') },
    });
  });

  it('keeps the withdrawal when the relay fails, and says which author was not told', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const send = vi.fn(async () => ({
      FunctionError: 'Unhandled',
      Payload: new TextEncoder().encode('{"errorMessage":"refused"}'),
    }));

    await expect(
      new RelayAuthorNotifier('mail-fn', { send } as never).withdrawn(entry, 'Spam'),
    ).resolves.toBeUndefined();
    expect(String(error.mock.calls[0]?.[0])).toContain('catalog-withdrawal-unsent');
    error.mockRestore();
  });
});
