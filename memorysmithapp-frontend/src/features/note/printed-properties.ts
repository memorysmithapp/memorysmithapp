import type { NotebookProperties } from '@memorysmithapp/contracts';

/** Two keys are the same key whatever the case, after NFC, as the notebook's attributes compare. */
function sameKey(left: string, right: string): boolean {
  return left.normalize('NFC').toLowerCase() === right.normalize('NFC').toLowerCase();
}

/**
 * What a printed note shows of its properties, as its notebook's style says
 * (#530, RN-KNW-096): where they go, which of them and in which order, and the
 * heading over them.
 *
 * `entries` are the note's properties in the order the reading surface draws
 * them, the name left out, since the name is the note's title. With no keys
 * chosen they are all shown; with keys, only those, in the order the keys are
 * written, and a key the note lacks is simply absent.
 */
export function printedProperties(
  entries: ReadonlyArray<readonly [string, string]>,
  setting: NotebookProperties,
): {
  place: 'start' | 'end' | 'none';
  shown: ReadonlyArray<readonly [string, string]>;
  heading: string | null;
} {
  const print = setting.print;
  if (print === 'none') return { place: 'none', shown: [], heading: null };
  const shown = print.keys
    ? print.keys.flatMap((key) => entries.filter(([each]) => sameKey(each, key)).slice(0, 1))
    : entries;
  return { place: print.place, shown, heading: print.title };
}

/** The keys typed, a comma between two of them: none typed prints every key. */
export function keysOf(text: string): string[] | null {
  const keys = text
    .split(',')
    .map((key) => key.trim())
    .filter((key) => key.length > 0);
  return keys.length > 0 ? keys : null;
}
