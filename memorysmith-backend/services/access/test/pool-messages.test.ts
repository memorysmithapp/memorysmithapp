/**
 * The messages the user pool sends (RN-ACC-017, RN-ACC-018). What these cases
 * protect is what a person reads before they ever see the product: the
 * credential standing alone, how long it lasts, where to use it, and the
 * language of their account.
 */

import { describe, expect, it } from 'vitest';
import { composePoolMessage } from '../src/adapters/inbound/pool-messages.js';

const PRODUCTION = { environment: 'production', site: 'https://memorysmith.app' };
const STAGING = { environment: 'staging', site: 'https://stg.memorysmith.app' };

const request = (locale?: string) => ({
  userAttributes: { email: 'ana@example.com', ...(locale === undefined ? {} : { locale }) },
  codeParameter: '{####}',
  usernameParameter: '{username}',
});

const WRITTEN = [
  'CustomMessage_AdminCreateUser',
  'CustomMessage_ForgotPassword',
  'CustomMessage_SignUp',
  'CustomMessage_ResendCode',
  'CustomMessage_UpdateUserAttribute',
  'CustomMessage_VerifyUserAttribute',
];

const compose = (source: string, locale: string | undefined, setting = PRODUCTION) => {
  const message = composePoolMessage(source, request(locale), setting);
  if (!message) throw new Error(`${source} composed no message`);
  return message;
};

describe('the messages the pool sends', () => {
  it('carry the credential exactly once, alone in its cell, with nothing after it', () => {
    for (const source of WRITTEN) {
      for (const locale of ['pt_BR', 'en_US']) {
        const { html } = compose(source, locale);
        expect(html.split('{####}')).toHaveLength(2);
        expect(html).toMatch(/letter-spacing:1px;color:#0E1526;">\{####\}<\/td>/);
      }
    }
  });

  it('hand over an account with the e-mail it signs in with, called an e-mail', () => {
    const invitation = compose('CustomMessage_AdminCreateUser', 'en_US');
    expect(invitation.subject).toBe('Your MemorySmith account');
    expect(invitation.html).toMatch(/letter-spacing:1px;color:#0E1526;">\{username\}<\/td>/);
    expect(invitation.html).toContain('>E-mail</td>');
    expect(invitation.html.replace('{username}', '')).not.toMatch(/username/i);
    expect(invitation.html).toContain('href="https://memorysmith.app"');
  });

  it('say how long each credential lasts', () => {
    expect(compose('CustomMessage_AdminCreateUser', 'en_US').html).toContain('valid for 7 days');
    expect(compose('CustomMessage_ForgotPassword', 'en_US').html).toContain('valid for 1 hour');
    expect(compose('CustomMessage_SignUp', 'en_US').html).toContain('valid for 24 hours');
    expect(compose('CustomMessage_AdminCreateUser', 'pt_BR').html).toContain('vale por 7 dias');
    expect(compose('CustomMessage_ForgotPassword', 'pt_BR').html).toContain('vale por 1 hora');
    expect(compose('CustomMessage_SignUp', 'pt_BR').html).toContain('vale por 24 horas');
  });

  it('are written in the language of the account, and in pt_BR for an account with none', () => {
    expect(compose('CustomMessage_ForgotPassword', 'en_US').html).toContain('<html lang="en-US">');
    expect(compose('CustomMessage_ForgotPassword', 'pt_BR').html).toContain('<html lang="pt-BR">');
    expect(compose('CustomMessage_ForgotPassword', undefined).subject).toBe(
      'Seu código do MemorySmith para definir uma nova senha',
    );
    expect(compose('CustomMessage_ForgotPassword', 'fr_FR').html).toContain('<html lang="pt-BR">');
  });

  it('send the person to the site of the environment, with its signature, and say which environment outside production', () => {
    const invitation = compose('CustomMessage_AdminCreateUser', 'pt_BR', STAGING);
    expect(invitation.subject).toBe('[staging] Sua conta no MemorySmith');
    expect(invitation.html).toContain('Entre em stg.memorysmith.app');
    expect(invitation.html).toContain('href="https://stg.memorysmith.app"');
    expect(invitation.html).toContain('src="https://stg.memorysmith.app/email/lockup.png"');
    expect(compose('CustomMessage_AdminCreateUser', 'pt_BR').subject).toBe(
      'Sua conta no MemorySmith',
    );
  });

  it('leave the code of a sign-in to the template of the pool', () => {
    expect(
      composePoolMessage('CustomMessage_Authentication', request('en_US'), PRODUCTION),
    ).toBeNull();
  });

  it('stay under the 20,000 characters Cognito accepts', () => {
    for (const source of WRITTEN) {
      for (const locale of ['pt_BR', 'en_US']) {
        expect(compose(source, locale, STAGING).html.length).toBeLessThan(20_000);
      }
    }
  });
});
