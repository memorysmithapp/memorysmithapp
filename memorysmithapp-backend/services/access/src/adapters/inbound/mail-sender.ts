/**
 * Every message of an installation that sends through the organization's
 * relay (`MAIL=smtp`, #396): the pool's, as its custom email sender trigger,
 * and the product's, invoked by the core with `{ mail }`.
 *
 * The pool hands the code or the temporary password encrypted under a key of
 * the installation, and only this function decrypts it, just before it writes
 * it into the same message the custom message trigger writes for SES, in the
 * language of the account (RN-ACC-042, RN-ACC-018).
 */

import { buildClient, CommitmentPolicy, KmsKeyringNode } from '@aws-crypto/client-node';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { observe } from '@memorysmithapp/observability';
import { SmtpMailer, type OutgoingMail } from '../outbound/smtp/SmtpMailer.js';
import { composePoolMessage } from './pool-messages.js';

export interface PoolSenderEvent {
  triggerSource: string;
  userName?: string;
  request: {
    /** The code or the temporary password, encrypted by the AWS Encryption SDK. */
    code?: string | null;
    userAttributes: Record<string, string>;
  };
}

export interface ProductMailEvent {
  mail: { to: string; subject: string; text: string };
}

const setting = {
  environment: process.env['APP_ENVIRONMENT'] ?? 'production',
  site: process.env['SITE_ORIGIN'] ?? 'https://memorysmith.app',
};

let password: Promise<string | undefined> | null = null;
const mailer = new SmtpMailer({
  host: process.env['SMTP_HOST'] ?? '',
  port: Number(process.env['SMTP_PORT'] ?? '587'),
  ...(process.env['SMTP_USER'] ? { user: process.env['SMTP_USER'] } : {}),
  password: () =>
    (password ??= new SecretsManagerClient({})
      .send(new GetSecretValueCommand({ SecretId: process.env['SMTP_SECRET_ID'] ?? '' }))
      .then((found) => found.SecretString)),
  sender: process.env['SENDER_ADDRESS'] ?? '',
});

const { decrypt } = buildClient(CommitmentPolicy.REQUIRE_ENCRYPT_ALLOW_DECRYPT);

async function decrypted(code: string): Promise<string> {
  const keyring = new KmsKeyringNode({ keyIds: [process.env['KEY_ARN'] ?? ''] });
  const { plaintext } = await decrypt(keyring, Buffer.from(code, 'base64'));
  return plaintext.toString('utf8');
}

/**
 * The message of the pool for this event, with the credential written in, or
 * null for one the product does not send.
 */
export function poolMail(
  event: PoolSenderEvent,
  credential: string,
  where: { environment: string; site: string },
): OutgoingMail | null {
  const to = event.request.userAttributes['email'];
  if (!to) return null;
  const message = composePoolMessage(
    event.triggerSource,
    {
      userAttributes: event.request.userAttributes,
      codeParameter: credential,
      // What the person types to sign in is the address, not the identifier.
      usernameParameter: to,
    },
    where,
  );
  return message ? { to, subject: message.subject, html: message.html } : null;
}

/** One line per message, named by what asked for it; never its address or its code. */
export function handler(event: PoolSenderEvent | ProductMailEvent): Promise<void> {
  const operation = 'mail' in event ? 'ProductMail' : event.triggerSource;
  return observe({ operation }, () => deliver(event));
}

async function deliver(event: PoolSenderEvent | ProductMailEvent): Promise<void> {
  if ('mail' in event) {
    await mailer.send(event.mail);
    return;
  }
  if (!event.request.code) return;
  const mail = poolMail(event, await decrypted(event.request.code), setting);
  if (mail) await mailer.send(mail);
}
