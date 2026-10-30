/**
 * Whether the executor is waiting for the person, which is what hands its
 * message to the simulated user.
 *
 * A question mark is not the test, because a person is asked for something in
 * the imperative as often as in a question: "me confirme e diga se…", "paste
 * the examples here". The round used to end at the first message without one,
 * and two runs that proposed a notebook and waited for the answer were scored
 * as runs that wrote nothing (#312). A message waits when it asks, or when the
 * turn that wrote it wrote nothing, since an executor that has done the work
 * writes it before it says so; the cap of the case bounds the rest.
 */

import { WRITES } from './checks.js';
import type { Transcript } from './transcript.js';

export function waitsForPerson(text: string, transcript: Transcript, turn: number): boolean {
  if (text.includes('?')) return true;
  return !transcript.toolUses.some((use) => use.turn === turn && WRITES.has(use.tool));
}
