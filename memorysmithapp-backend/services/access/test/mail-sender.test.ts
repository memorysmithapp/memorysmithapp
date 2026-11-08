/**
 * The messages of an installation that sends through the organization's relay
 * (#396): the same message the pool writes for SES, with the credential the
 * pool encrypted written in, and a relay spoken to only over TLS.
 */

import { describe, expect, it, vi } from 'vitest';

const sent: unknown[] = [];
vi.mock('nodemailer', () => ({
  createTransport: (options: unknown) => ({
    options,
    sendMail: async (mail: { to: string }) => {
      if (mail.to === 'refused@acme.example') {
        throw Object.assign(new Error('Mailbox unavailable'), {
          response: '550 5.1.1 Mailbox unavailable',
        });
      }
      sent.push(mail);
    },
  }),
}));

const { poolMail } = await import('../src/adapters/inbound/mail-sender.js');
const { SmtpMailer, transportOptions } =
  await import('../src/adapters/outbound/smtp/SmtpMailer.js');

const where = { environment: 'production', site: 'https://notes.acme.example' };

describe("the pool's messages, through the relay", () => {
  it('writes the code into the message of its kind, in the language of the account', () => {
    const mail = poolMail(
      {
        triggerSource: 'CustomEmailSender_ForgotPassword',
        request: { userAttributes: { email: 'ana@acme.example', locale: 'pt_BR' } },
      },
      '493021',
      where,
    );
    expect(mail?.to).toBe('ana@acme.example');
    expect(mail?.html).toContain('493021');
    expect(mail?.subject).toBe(
      poolMail(
        {
          triggerSource: 'CustomEmailSender_ForgotPassword',
          request: { userAttributes: { email: 'x@acme.example', locale: 'pt_BR' } },
        },
        '1',
        where,
      )?.subject,
    );
  });

  it('names the address on an invitation, which is what the person types to sign in', () => {
    const mail = poolMail(
      {
        triggerSource: 'CustomEmailSender_AdminCreateUser',
        userName: '0f6a1b2c-0000-4000-8000-000000000000',
        request: { userAttributes: { email: 'ana@acme.example' } },
      },
      'Tmp<Pass>&1',
      where,
    );
    expect(mail?.html).toContain('ana@acme.example');
    expect(mail?.html).not.toContain('0f6a1b2c-0000');
  });

  it('sends nothing for a message the product does not write', () => {
    expect(
      poolMail(
        {
          triggerSource: 'CustomEmailSender_AccountTakeOverNotification',
          request: { userAttributes: { email: 'ana@acme.example' } },
        },
        'x',
        where,
      ),
    ).toBeNull();
  });
});

describe('the relay', () => {
  const relay = { host: 'smtp.acme.example', sender: 'no-reply@acme.example' };

  it('is spoken to over STARTTLS, required, on 587, and over implicit TLS on 465', async () => {
    expect(
      await transportOptions({ ...relay, port: 587, password: async () => undefined }),
    ).toMatchObject({ secure: false, requireTLS: true });
    expect(
      await transportOptions({ ...relay, port: 465, password: async () => undefined }),
    ).toMatchObject({ secure: true, requireTLS: false });
  });

  it('logs in with the password of its secret, and refuses a user whose password is missing', async () => {
    expect(
      await transportOptions({ ...relay, port: 587, user: 'mailer', password: async () => 'pw' }),
    ).toMatchObject({ auth: { user: 'mailer', pass: 'pw' } });
    await expect(
      transportOptions({ ...relay, port: 587, user: 'mailer', password: async () => undefined }),
    ).rejects.toThrow('password was not found');
  });

  it('sends from the address the relay accepts, and says where a refusal came from, never the password', async () => {
    const mailer = new SmtpMailer({
      ...relay,
      port: 587,
      user: 'mailer',
      password: async () => 's3cret',
    });

    await mailer.send({ to: 'ana@acme.example', subject: 'Hi', text: 'Hello' });
    expect(sent.at(-1)).toMatchObject({
      from: 'MemorySmith <no-reply@acme.example>',
      to: 'ana@acme.example',
    });

    const refused = mailer.send({ to: 'refused@acme.example', subject: 'Hi', text: 'Hello' });
    await expect(refused).rejects.toThrow('smtp.acme.example:587 refused the message: 550 5.1.1');
    await expect(refused).rejects.not.toThrow('s3cret');
  });
});
