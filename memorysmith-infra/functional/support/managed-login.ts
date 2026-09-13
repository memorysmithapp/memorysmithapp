/**
 * Signing in on the managed login of Cognito, as a person does
 * (architecture-guide.md, section 8.3).
 *
 * The page asks for the e-mail and the password either on one screen or on
 * two, depending on how the pool is set up, and a case should not break when
 * that setting changes: both shapes are handled here, and nowhere else.
 */

import type { Page } from '@playwright/test';

export async function signInOnManagedLogin(
  page: Page,
  account: { readonly email: string; readonly password: string },
): Promise<void> {
  const username = page.locator('input[name="username"], input[type="email"]').first();
  await username.waitFor({ state: 'visible', timeout: 60_000 });
  await username.fill(account.email);

  const password = page.locator('input[name="password"], input[type="password"]').first();
  if (!(await password.isVisible())) {
    await page.locator('button[type="submit"]').first().click();
    await password.waitFor({ state: 'visible', timeout: 30_000 });
  }
  await password.fill(account.password);
  await page.locator('button[type="submit"]').first().click();
}
