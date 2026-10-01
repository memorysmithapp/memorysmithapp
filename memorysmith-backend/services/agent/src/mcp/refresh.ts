/**
 * How a person refreshes the list of tools their client holds (RN-AGT-047).
 *
 * A client keeps the list it read — names, descriptions, arguments — and asks
 * for it again only when the person says so; neither client announces that the
 * list is old. What a tool ANSWERS is always current, so the way out is said by
 * the server, in `whoami` and in every refusal a stale list causes, and never
 * left to an agent describing a menu from memory: both clients had moved their
 * screens by 0.6.1, and a step that names a screen that is gone sends the
 * person nowhere.
 *
 * The step is chosen by the connector the proxy recorded for the token. The
 * labels are the ones of the Portuguese interface of each client, the one they
 * were read in; the agent speaks to the person in the person's language.
 */

import type { ConnectorIdentity } from './gateway.js';

export type ClientKind = 'claude' | 'chatgpt' | 'other';

const CLAUDE = /(^|\.)(claude\.ai|claude\.com|anthropic\.com)$/;
const CHATGPT = /(^|\.)(chatgpt\.com|openai\.com)$/;

function hostOf(clientId: string): string {
  try {
    return new URL(clientId).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/** Which client a connector is, read off its identifier and then its name. */
export function clientKind(connector: ConnectorIdentity | null): ClientKind {
  if (!connector) return 'other';
  const host = hostOf(connector.clientId);
  if (CLAUDE.test(host)) return 'claude';
  if (CHATGPT.test(host)) return 'chatgpt';
  if (/\bclaude\b/i.test(connector.clientName)) return 'claude';
  if (/\b(chatgpt|openai)\b/i.test(connector.clientName)) return 'chatgpt';
  return 'other';
}

const STEPS: Readonly<Record<Exclude<ClientKind, 'other'>, string>> = {
  claude:
    'In Claude: open the MemorySmith connector, and in the `⋯` menu beside the button that ' +
    'connects it choose the item that refreshes the list of tools (*Atualizar lista de ' +
    'ferramentas* in Portuguese).',
  chatgpt:
    'In ChatGPT: open **Plugins → MemorySmith.app**, and in its section press the button that ' +
    'refreshes the tools (*Atualizar ferramentas* in Portuguese).',
};

/**
 * The step of this client, or of both when the connector is not one of them.
 * The refreshed list reaches a new conversation, not the one already open.
 */
export function refreshSteps(connector: ConnectorIdentity | null): string[] {
  const kind = clientKind(connector);
  const steps = kind === 'other' ? [STEPS.claude, STEPS.chatgpt] : [STEPS[kind]];
  return [...steps, 'The refreshed list reaches a new conversation, not the one already open.'];
}
