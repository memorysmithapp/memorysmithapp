/**
 * A leak into the clean room (architecture-guide.md, section 19).
 *
 * The executor is supposed to know only what the connector served it. A term it
 * uses that the server never sent — a business rule code, a principle of the
 * design, a path of this repository — could only have come from somewhere else,
 * and a run that carries one is discarded, not scored.
 */

import type { Transcript } from './transcript.js';

export const LEAK_PATTERNS: readonly { readonly label: string; readonly pattern: RegExp }[] = [
  { label: 'a business rule code', pattern: /\bRN-[A-Z]{3}-\d{3}\b/ },
  { label: 'a principle of the design', pattern: /\b(?:PP|PE)\d{1,2}\b/ },
  { label: 'Content Slot', pattern: /\bcontent slots?\b/i },
  { label: 'bounded context', pattern: /\bbounded contexts?\b/i },
  {
    label: 'a path of the repository',
    pattern:
      /memorysmith-(?:backend|frontend|infra)\b|architecture-guide|software-vision|development-process|agent-eval/i,
  },
];

/** The labels of every pattern the executor produced and the server never sent. */
export function leaksIn(transcript: Transcript): string[] {
  const served = transcript.toolResults.join('\n');
  const said = [
    ...transcript.texts.map((each) => each.text),
    ...transcript.toolUses.map((use) => JSON.stringify(use.input)),
  ].join('\n');
  return LEAK_PATTERNS.filter(({ pattern }) => pattern.test(said) && !pattern.test(served)).map(
    ({ label }) => label,
  );
}
