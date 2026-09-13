/**
 * The messages the user pool sends, written by the product (RN-ACC-017,
 * RN-ACC-018; architecture-guide.md, section 8.5).
 *
 * Cognito hands the trigger a placeholder for the credential and never the
 * credential itself, and replaces it after the message leaves here. So nothing
 * of the person is in these strings but the language of their account.
 *
 * What the layout guarantees, because the invitation of 0.5.x could cost a
 * person their account with a full stop:
 *  - the credential stands alone on its own line, centred, larger and in a
 *    monospaced face, and nothing follows it, punctuation included;
 *  - each message says how long its credential lasts, and where to use it;
 *  - the address is called an e-mail, because it is what the person signs in
 *    with, and not a username they would go looking for.
 *
 * Cognito sends one body, this HTML, and no text alternative. E-mail clients
 * load no webfont, so each face is a stack that degrades on purpose, and the
 * brand book has no monospaced face, so the credential gets the system's.
 */

import { AccountLocale, type AccountLocaleName } from '../../domain/values.js';

type Kind = 'invitation' | 'password-reset' | 'confirmation';

/**
 * The trigger sources the product writes. A sign-in code (`Authentication`) is
 * left to the template of the pool: no sign-in of this product sends one.
 */
const KINDS: Readonly<Record<string, Kind>> = {
  CustomMessage_AdminCreateUser: 'invitation',
  CustomMessage_ForgotPassword: 'password-reset',
  CustomMessage_SignUp: 'confirmation',
  CustomMessage_ResendCode: 'confirmation',
  CustomMessage_UpdateUserAttribute: 'confirmation',
  CustomMessage_VerifyUserAttribute: 'confirmation',
};

export interface PoolMessageRequest {
  readonly userAttributes: Readonly<Record<string, string>>;
  /** The placeholder Cognito replaces with the code or the temporary password. */
  readonly codeParameter: string;
  /** The placeholder of the username, present on an invitation. */
  readonly usernameParameter?: string | null;
}

export interface PoolMessageSetting {
  /** The environment that sends it; outside production the subject says which. */
  readonly environment: string;
  /** The site of the environment, where the person signs in, e.g. https://memorysmith.app */
  readonly site: string;
}

export interface PoolMessage {
  readonly subject: string;
  readonly html: string;
}

interface Wording {
  readonly subject: string;
  readonly heading: string;
  readonly intro: string;
  readonly credentialLabel: string;
  readonly validity: string;
  readonly ignore: string;
  /** Only an invitation hands over an account, and so only it names the e-mail and a door. */
  readonly invitation: {
    readonly emailLabel: string;
    readonly next: string;
    readonly action: string;
  } | null;
}

function wording(locale: AccountLocaleName, kind: Kind, host: string): Wording {
  if (locale === 'en_US') {
    switch (kind) {
      case 'invitation':
        return {
          subject: 'Your MemorySmith account',
          heading: 'Your account is ready',
          intro:
            'An account on MemorySmith was created for this e-mail. MemorySmith keeps knowledge notebooks in Markdown and serves them to AI tools.',
          credentialLabel: 'Temporary password',
          validity: 'The temporary password is valid for 7 days, and it works once.',
          ignore:
            'If you were not expecting this message, ignore it: without that first sign-in, the account does nothing.',
          invitation: {
            emailLabel: 'E-mail',
            next: `Sign in at ${host} with this e-mail and the temporary password. The first sign-in asks for a password of your own.`,
            action: 'Sign in',
          },
        };
      case 'password-reset':
        return {
          subject: 'Your MemorySmith code to set a new password',
          heading: 'Set a new password',
          intro: `Someone asked to set a new password for the MemorySmith account of this e-mail. Type the code below on the sign-in page of ${host}.`,
          credentialLabel: 'Code',
          validity: 'The code is valid for 1 hour.',
          ignore:
            'If it was not you, ignore this message: without the code, your password stays as it is.',
          invitation: null,
        };
      case 'confirmation':
        return {
          subject: 'Your MemorySmith confirmation code',
          heading: 'Confirm your e-mail',
          intro: 'Type the code below to confirm this e-mail on your MemorySmith account.',
          credentialLabel: 'Code',
          validity: 'The code is valid for 24 hours.',
          ignore:
            'If you did not ask for it, ignore this message: without the code, nothing changes.',
          invitation: null,
        };
    }
  }
  switch (kind) {
    case 'invitation':
      return {
        subject: 'Sua conta no MemorySmith',
        heading: 'Sua conta está pronta',
        intro:
          'Uma conta no MemorySmith foi criada para este e-mail. O MemorySmith guarda cadernos de conhecimento em Markdown e os entrega a ferramentas de IA.',
        credentialLabel: 'Senha provisória',
        validity: 'A senha provisória vale por 7 dias e funciona uma vez.',
        ignore:
          'Se você não esperava esta mensagem, ignore-a: sem esse primeiro acesso, a conta não faz nada.',
        invitation: {
          emailLabel: 'E-mail',
          next: `Entre em ${host} com este e-mail e a senha provisória. No primeiro acesso você escolhe uma senha sua.`,
          action: 'Entrar',
        },
      };
    case 'password-reset':
      return {
        subject: 'Seu código do MemorySmith para definir uma nova senha',
        heading: 'Definir uma nova senha',
        intro: `Alguém pediu para definir uma nova senha na conta do MemorySmith deste e-mail. Digite o código abaixo na página de entrada de ${host}.`,
        credentialLabel: 'Código',
        validity: 'O código vale por 1 hora.',
        ignore: 'Se não foi você, ignore esta mensagem: sem o código, sua senha continua a mesma.',
        invitation: null,
      };
    case 'confirmation':
      return {
        subject: 'Seu código de confirmação do MemorySmith',
        heading: 'Confirme seu e-mail',
        intro: 'Digite o código abaixo para confirmar este e-mail na sua conta do MemorySmith.',
        credentialLabel: 'Código',
        validity: 'O código vale por 24 horas.',
        ignore: 'Se você não pediu, ignore esta mensagem: sem o código, nada muda.',
        invitation: null,
      };
  }
}

/** The palette of the brand book: Papel behind, Tinta for text, Azul cofre for the door. */
const PAPEL = '#EDEFEC';
const TINTA = '#0E1526';
const AZUL_COFRE = '#0F56D7';
const CARD = '#FFFFFF';

const DISPLAY = "'Space Grotesk', 'Segoe UI', Arial, sans-serif";
const TEXT = "Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

function escape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const row = (content: string, style: string): string =>
  `<tr><td style="${style}">${content}</td></tr>`;

/**
 * A value that stands alone: nothing shares its cell and nothing follows it,
 * and the space around it is padding, so it survives a client that collapses
 * whitespace.
 */
const standingAlone = (placeholder: string, size: number): string =>
  `<tr><td style="padding:8px 32px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 16px;background:${PAPEL};border-radius:8px;font-family:${MONO};font-size:${size}px;line-height:1.4;letter-spacing:1px;color:${TINTA};">${placeholder}</td></tr></table></td></tr>`;

const label = (text: string): string =>
  row(
    escape(text),
    `padding:24px 32px 0;font-family:${DISPLAY};font-size:13px;font-weight:500;color:${TINTA};`,
  );

function html(
  locale: AccountLocaleName,
  words: Wording,
  request: PoolMessageRequest,
  site: string,
): string {
  const paragraph = (text: string, top = 16): string =>
    row(
      escape(text),
      `padding:${top}px 32px 0;font-family:${TEXT};font-size:15px;line-height:1.6;color:${TINTA};`,
    );

  const rows = [
    row(
      `<img src="${escape(`${site}/email/lockup.png`)}" width="190" height="32" alt="MemorySmith.app" style="display:block;border:0;">`,
      'padding:32px 32px 8px;',
    ),
    row(
      escape(words.heading),
      `padding:16px 32px 0;font-family:${DISPLAY};font-size:22px;font-weight:700;color:${TINTA};`,
    ),
    paragraph(words.intro, 12),
    ...(words.invitation
      ? [label(words.invitation.emailLabel), standingAlone(request.usernameParameter ?? '', 17)]
      : []),
    label(words.credentialLabel),
    standingAlone(request.codeParameter, 26),
    paragraph(words.validity, 20),
    ...(words.invitation
      ? [
          paragraph(words.invitation.next),
          row(
            `<a href="${escape(site)}" style="display:inline-block;padding:12px 24px;background:${AZUL_COFRE};color:${CARD};font-family:${DISPLAY};font-size:15px;font-weight:500;text-decoration:none;border-radius:8px;">${escape(words.invitation.action)}</a>`,
            'padding:24px 32px 0;',
          ),
        ]
      : []),
    row(
      escape(words.ignore),
      `padding:28px 32px 32px;font-family:${TEXT};font-size:13px;line-height:1.6;color:${TINTA};`,
    ),
  ];

  const language = locale === 'pt_BR' ? 'pt-BR' : 'en-US';
  return [
    `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escape(words.subject)}</title></head>`,
    `<body style="margin:0;padding:0;background:${PAPEL};">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPEL};"><tr><td align="center" style="padding:32px 16px;">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${CARD};border-radius:12px;">`,
    ...rows,
    '</table></td></tr></table></body></html>',
  ].join('');
}

/**
 * The message Cognito sends for a trigger source, in the language of the
 * account, or null for a source the pool's own template answers.
 */
export function composePoolMessage(
  triggerSource: string,
  request: PoolMessageRequest,
  setting: PoolMessageSetting,
): PoolMessage | null {
  const kind = KINDS[triggerSource];
  if (!kind) return null;

  const chosen = AccountLocale.create(request.userAttributes['locale'] ?? '');
  const locale = (chosen.ok ? chosen.value : AccountLocale.DEFAULT).name;
  const words = wording(locale, kind, new URL(setting.site).host);
  const prefix = setting.environment === 'production' ? '' : `[${setting.environment}] `;

  return {
    subject: `${prefix}${words.subject}`,
    html: html(locale, words, request, setting.site),
  };
}
