/**
 * Transclusion: `![[note]]` and `![[note#section]]`, expanded for reading.
 *
 * The expansion belongs to the reading surface, not to the backend. It is the
 * same class of work the wikilink resolution already does here: interpreting
 * universal syntax to display it, with the core never reading a byte of
 * content (PP4). Nothing changes in storage, in the write contract, in what
 * the tools return or in what the export writes.
 *
 * ONE LEVEL, AND ONLY ONE. An embed found inside transcluded content is drawn
 * as a link to its target, which is what keeps a pair of notes that embed each
 * other from hanging the page.
 */

import { slugify } from './markdown';

/** Same shape the Discovery extractor matches, plus the leading `!`. */
const EMBED = /!\[\[([^\]|#]+?)(?:#([^\]|]+?))?(?:\|[^\]]*?)?\]\]/g;

export type BodySegment =
  { kind: 'text'; text: string } | { kind: 'embed'; target: string; anchor: string | null };

/**
 * How many embeds one page expands. Past it the rest stay as links: the cost
 * of a page has to stay predictable, and a note with forty embeds is a note
 * that wanted a different structure.
 */
export const EMBED_LIMIT = 10;

/**
 * Splits a body into what to render inline and what to transclude. Embeds past
 * the ceiling are demoted to plain wikilinks instead of being dropped, because
 * losing the reference would be worse than not expanding it.
 */
export function splitEmbeds(body: string, limit = EMBED_LIMIT): BodySegment[] {
  const segments: BodySegment[] = [];
  let cursor = 0;
  let expanded = 0;

  for (const match of body.matchAll(EMBED)) {
    const at = match.index ?? 0;
    const target = (match[1] ?? '').trim();
    if (!target) continue;

    if (expanded >= limit) break;

    const before = body.slice(cursor, at);
    if (before.length > 0) segments.push({ kind: 'text', text: before });
    segments.push({ kind: 'embed', target, anchor: match[2]?.trim() ?? null });
    cursor = at + match[0].length;
    expanded += 1;
  }

  const rest = body.slice(cursor);
  if (rest.length > 0) segments.push({ kind: 'text', text: demoteEmbeds(rest) });
  return segments;
}

/** `![[x]]` becomes `[[x]]`: a reference instead of an expansion. */
export function demoteEmbeds(body: string): string {
  return body.replace(EMBED, (all) => all.slice(1));
}

const HEADING = /^(#{1,6})\s+(.+?)\s*$/;

/**
 * The section of a document, cut syntactically: from the heading whose slug
 * matches the anchor to the next heading of equal or higher level. No vault
 * convention takes part in this, which is what keeps it on the right side of
 * PP4.
 */
export function sectionOf(markdown: string, anchor: string): string | null {
  const wanted = slugify(anchor);
  const lines = markdown.split('\n');
  let start = -1;
  let level = 0;

  for (let index = 0; index < lines.length; index++) {
    const heading = HEADING.exec(lines[index] ?? '');
    if (!heading) continue;

    if (start === -1) {
      if (slugify(heading[2] ?? '') === wanted) {
        start = index;
        level = (heading[1] ?? '').length;
      }
      continue;
    }
    if ((heading[1] ?? '').length <= level) {
      return lines.slice(start, index).join('\n').trimEnd();
    }
  }

  return start === -1 ? null : lines.slice(start).join('\n').trimEnd();
}
