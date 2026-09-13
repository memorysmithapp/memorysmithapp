/**
 * The account of the person signed in (software-vision.md, section 5.4).
 */

import { type DomainError, ok, type Result } from '@memorysmith/kernel';
import { AccountLocale } from '../domain/values.js';
import type { AccountDirectory, UserProfile } from '../domain/ports/index.js';

/**
 * Records the language the person chose, which every message the product sends
 * this account is written in from then on (RN-ACC-018). It is the person's own
 * act, on their own account, so it needs no subscription and no role: a platform
 * session chooses a language like any other.
 */
export class ChooseLanguage {
  constructor(private readonly directory: AccountDirectory) {}

  async execute(input: {
    profile: UserProfile;
    locale: string;
  }): Promise<Result<void, DomainError>> {
    const locale = AccountLocale.create(input.locale);
    if (!locale.ok) return locale;
    await this.directory.setLocale(input.profile.email, locale.value);
    return ok();
  }
}
