/**
 * The organization's relay, over SMTP (#396).
 *
 * Only over TLS: implicit on 465, and STARTTLS required on any other port, so
 * a relay that offers no TLS is refused rather than spoken to in clear. The
 * password is read when the first message leaves and kept for the life of the
 * function, never put in its environment.
 */

import { createTransport, type Transporter } from 'nodemailer';

export interface RelaySetting {
  readonly host: string;
  readonly port: number;
  /** Absent for a relay that takes mail from inside its network without a login. */
  readonly user?: string;
  readonly password: () => Promise<string | undefined>;
  /** The address the relay accepts as the sender. */
  readonly sender: string;
}

export interface OutgoingMail {
  readonly to: string;
  readonly subject: string;
  readonly html?: string;
  readonly text?: string;
}

/** What nodemailer is told, from what the installation declared. */
export async function transportOptions(setting: RelaySetting) {
  const implicit = setting.port === 465;
  const password = setting.user ? await setting.password() : undefined;
  if (setting.user && !password) {
    throw new Error(`The relay ${setting.host} names a user, and its password was not found`);
  }
  return {
    host: setting.host,
    port: setting.port,
    secure: implicit,
    requireTLS: !implicit,
    ...(setting.user ? { auth: { user: setting.user, pass: password ?? '' } } : {}),
    // A trigger of the pool has seconds, not minutes: a relay that does not
    // answer is a failure to report, not a wait.
    connectionTimeout: 4_000,
    greetingTimeout: 3_000,
    socketTimeout: 6_000,
  };
}

export class SmtpMailer {
  private transport: Transporter | null = null;

  constructor(private readonly setting: RelaySetting) {}

  async send(mail: OutgoingMail): Promise<void> {
    this.transport ??= createTransport(await transportOptions(this.setting));
    try {
      await this.transport.sendMail({
        from: `MemorySmith <${this.setting.sender}>`,
        to: mail.to,
        subject: mail.subject,
        ...(mail.html ? { html: mail.html } : {}),
        ...(mail.text ? { text: mail.text } : {}),
      });
    } catch (error) {
      // The host and what it answered, never the credentials.
      const answer = (error as { response?: string; message?: string }) ?? {};
      throw new Error(
        `The relay ${this.setting.host}:${this.setting.port} refused the message: ${answer.response ?? answer.message ?? String(error)}`,
        { cause: error },
      );
    }
  }
}
