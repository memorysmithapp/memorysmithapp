/**
 * Clicking a task box, on the reading surface.
 *
 * The toggle is POSITIONAL over the original text, never a re-serialisation.
 * Exactly one character between brackets changes, and everything else in the
 * document reaches the server as the author wrote it: frontmatter, spacing,
 * line breaks and the rest of the item line included. That is a requirement,
 * not elegance: `splitFrontmatter` is lossy by design, because it flattens
 * lists for display, and rebuilding the document from it would hand the vault
 * a file nobody typed.
 */

/** A task item, as GFM defines it, at the start of a list item. */
const TASK = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+\[([ xX])\]/gm;

/**
 * Blanks out fenced blocks while keeping every offset intact. A task item
 * inside a fence is an example, not a box, and counting it would shift the
 * index and toggle a different item: the worst possible defect here, because
 * it is silent and lands in the wrong place.
 */
function maskFences(text: string): string {
  return text.replace(
    /(^|\n)(```|~~~)[\s\S]*?(\n\2|$)/g,
    (block, lead: string) => lead + ' '.repeat(block.length - lead.length),
  );
}

/** Offset of the `[` of every real task box, in document order. */
export function taskBoxes(text: string): number[] {
  const masked = maskFences(text);
  const found: number[] = [];
  for (const match of masked.matchAll(TASK)) {
    const at = match.index ?? 0;
    found.push(at + match[0].length - 3);
  }
  return found;
}

/** How many task items start before this offset: the ordinal of that item. */
export function ordinalAt(text: string, offset: number): number {
  return taskBoxes(text).filter((box) => box < offset).length;
}

/**
 * Flips the n-th task box. Returns null when there is no such item, which is
 * what a stale render looks like, and null is the honest answer: writing the
 * wrong box would be worse than not writing.
 */
export function toggleTaskAt(raw: string, ordinal: number): string | null {
  const boxes = taskBoxes(raw);
  const at = boxes[ordinal];
  if (at === undefined) return null;

  // `[x]` lowercase on the way in. GFM reads both cases, and picking one keeps
  // the diff of a revision about what changed, not about how it was typed.
  const current = raw[at + 1];
  const next = current === ' ' ? 'x' : ' ';
  return `${raw.slice(0, at + 1)}${next}${raw.slice(at + 2)}`;
}

/** Whether the n-th box is checked, for the optimistic state on the screen. */
export function taskCheckedAt(raw: string, ordinal: number): boolean {
  const at = taskBoxes(raw)[ordinal];
  return at !== undefined && raw[at + 1] !== ' ';
}
