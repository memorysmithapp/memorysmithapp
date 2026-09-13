import { describe, expect, it } from 'vitest';
import { UserId, type Result } from '@memorysmith/kernel';
import { ChooseLanguage } from '../src/application/account.js';
import { InMemoryAccountDirectory } from '../src/adapters/outbound/memory/InMemoryAccess.js';
import { Email } from '../src/domain/values.js';

function unwrap<T>(result: Result<T, { message: string }>): T {
  if (!result.ok) throw new Error(`Expected ok, got: ${result.error.message}`);
  return result.value;
}

const profile = {
  userId: unwrap(UserId.create('user-ana')),
  email: unwrap(Email.create('Ana@Example.com')),
  name: 'Ana',
  isPlatformAdmin: false,
};

describe('ChooseLanguage: the language of the account (RN-ACC-018)', () => {
  it('records the language the person chose, on the account the session belongs to', async () => {
    const directory = new InMemoryAccountDirectory();

    const chosen = await new ChooseLanguage(directory).execute({ profile, locale: 'en_US' });

    expect(chosen.ok).toBe(true);
    expect(directory.locales.get('ana@example.com')).toBe('en_US');
  });

  it('refuses a language the product does not write in, and records nothing', async () => {
    const directory = new InMemoryAccountDirectory();

    const refused = await new ChooseLanguage(directory).execute({ profile, locale: 'fr_FR' });

    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe('VALIDATION');
    expect(directory.locales.size).toBe(0);
  });
});
