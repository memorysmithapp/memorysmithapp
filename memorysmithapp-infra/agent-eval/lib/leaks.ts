/**
 * A leak into the clean room.
 *
 * The executor is supposed to know only what the connector served it. A term it
 * uses that the server never sent — a business rule code, a principle of the
 * design, a path of this repository — could only have come from somewhere else,
 * and a run that carries one is discarded, not scored.
 *
 * An e-mail address is one too. Claude Code hands a session the address of the
 * account it is signed in with (#313), so an executor that writes one the
 * server never served learned it from the room. Only the addresses reserved for
 * examples, `example.com` and the like, are free to invent.
 */

import type { Transcript } from './transcript.js';

export const LEAK_PATTERNS: readonly { readonly label: string; readonly pattern: RegExp }[] = [
  { label: 'a business rule code', pattern: /\bRN-[A-Z]{3}-\d{3}\b/ },
  { label: 'a principle of the design', pattern: /\b(?:PP|PE)\d{1,2}\b/ },
  { label: 'an invariant or a decision of the design', pattern: /\b(?:INV|ADR)-\d{2,3}\b/ },
  { label: 'Content Slot', pattern: /\bcontent slots?\b/i },
  { label: 'bounded context', pattern: /\bbounded contexts?\b/i },
  {
    label: 'a path of the repository',
    pattern:
      /memorysmith(?:app)?-(?:backend|frontend|infra)\b|docs\/(?:PRD|ARCHITECTURE|SDLC)\.md|agent-eval/i,
  },
];

const ADDRESS = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
/** The domains RFC 2606 keeps for examples, which nobody receives mail at. */
const EXAMPLE_DOMAIN = /(?:^|\.)(?:example\.(?:com|net|org)|example|test|invalid|localhost)$/i;

/** The addresses the executor wrote that the server never sent and no example uses. */
function addressesNeverServed(said: string, served: string): string[] {
  const known = new Set((served.match(ADDRESS) ?? []).map((address) => address.toLowerCase()));
  return [
    ...new Set(
      (said.match(ADDRESS) ?? [])
        .map((address) => address.toLowerCase())
        .filter((address) => !known.has(address))
        .filter((address) => !EXAMPLE_DOMAIN.test(address.split('@')[1] ?? '')),
    ),
  ];
}

/** The labels of every pattern the executor produced and the server never sent. */
export function leaksIn(transcript: Transcript): string[] {
  const served = transcript.toolResults.join('\n');
  const said = [
    ...transcript.texts.map((each) => each.text),
    ...transcript.toolUses.map((use) => JSON.stringify(use.input)),
  ].join('\n');
  const terms = LEAK_PATTERNS.filter(
    ({ pattern }) => pattern.test(said) && !pattern.test(served),
  ).map(({ label }) => label);
  // The label names no address: a scorecard is posted on an issue.
  return addressesNeverServed(said, served).length > 0 ? [...terms, 'an e-mail address'] : terms;
}
