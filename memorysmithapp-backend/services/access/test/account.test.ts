import { describe, expect, it } from 'vitest';
import { UserId, type Result } from '@memorysmithapp/kernel';
import { ChangePassword, ChooseLanguage } from '../src/application/account.js';
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

describe('ChangePassword: the session it was changed from stays open (RN-ACC-023, #331)', () => {
  it('hands back this session signed in again, since ending the others ends its refresh too', async () => {
    const directory = new InMemoryAccountDirectory();
    directory.passwords.set('ana@example.com', 'the old one');

    const changed = unwrap(
      await new ChangePassword(directory).execute({
        profile,
        current: 'the old one',
        next: 'the new one',
      }),
    );

    expect(changed.session?.refreshToken).toBeTruthy();
    expect(directory.passwords.get('ana@example.com')).toBe('the new one');
  });

  it('refuses a wrong current password and hands back no session', async () => {
    const directory = new InMemoryAccountDirectory();
    directory.passwords.set('ana@example.com', 'the old one');

    const refused = await new ChangePassword(directory).execute({
      profile,
      current: 'a guess',
      next: 'the new one',
    });

    expect(refused.ok).toBe(false);
    expect(directory.passwords.get('ana@example.com')).toBe('the old one');
  });
});
