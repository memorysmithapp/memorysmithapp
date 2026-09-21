/**
 * The custom message trigger of the user pool (architecture-guide.md, section
 * 8.5).
 *
 * Cognito calls it before it sends a message, with the attributes of the account
 * and a placeholder for the credential. It writes the subject and the body in
 * the language of the account (RN-ACC-017, RN-ACC-018) and reads nothing but the
 * event: the language is an attribute of the account, so no table is involved.
 */

import { composePoolMessage } from './pool-messages.js';

interface CustomMessageEvent {
  triggerSource: string;
  request: {
    userAttributes: Record<string, string>;
    codeParameter: string;
    usernameParameter?: string | null;
  };
  response: {
    emailSubject?: string | null;
    emailMessage?: string | null;
    smsMessage?: string | null;
  };
}

const setting = {
  environment: process.env['APP_ENVIRONMENT'] ?? 'production',
  site: process.env['SITE_ORIGIN'] ?? 'https://memorysmith.app',
};

export async function handler(event: CustomMessageEvent): Promise<CustomMessageEvent> {
  const message = composePoolMessage(event.triggerSource, event.request, setting);
  if (message) {
    event.response.emailSubject = message.subject;
    event.response.emailMessage = message.html;
  }
  return Promise.resolve(event);
}
