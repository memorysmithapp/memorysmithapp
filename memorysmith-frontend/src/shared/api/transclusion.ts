/**
 * The part of a note an address names, `#Section` or `#^block`, which the
 * preview of a part cuts (#260). An embed is expanded where the note is drawn,
 * by @memorysmithapp/markdown-renderer (#291), and never here.
 */

import { headingKey } from './markdown';

const HEADING = /^(#{1,6})\s+(.+?)\s*$/;

/**
 * The block a `^identifier` names, or null when nothing names it (profile
 * §7.7).
 *
 * A block is what the parser would call one: a run of lines up to a blank
 * line. The identifier sits at the END of it, and the marker is left in the
 * text on purpose — `remarkBlockIds` takes it off the page, and cutting it
 * here would mean this function decides what the reader shows.
 *
 * An identifier that names nothing answers null, and the caller renders it the
 * way it renders a pending link. It is never an error: a notebook is read most
 * while it is being written.
 */
export function blockOf(markdown: string, identifier: string): string | null {
  const marker = new RegExp(`[ \\t]\\^${escapeRegExp(identifier)}[ \\t]*$`);
  const lines = markdown.split('\n');

  for (let index = 0; index < lines.length; index++) {
    if (!marker.test(lines[index] ?? '')) continue;
    // Walk back to the top of the block: the first line after a blank one.
    let start = index;
    while (start > 0 && (lines[start - 1] ?? '').trim().length > 0) start--;
    return lines
      .slice(start, index + 1)
      .join('\n')
      .trimEnd();
  }
  return null;
}

/** An anchor written `^id` addresses a block; anything else, a section. */
export function isBlockAnchor(anchor: string): boolean {
  return anchor.startsWith('^');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The section of a document, cut syntactically: from the heading whose slug
 * matches the anchor to the next heading of equal or higher level. No notebook
 * convention takes part in this, which is what keeps it on the right side of
 * PP4.
 */
export function sectionOf(markdown: string, anchor: string): string | null {
  const wanted = headingKey(anchor);
  const lines = markdown.split('\n');
  let start = -1;
  let level = 0;

  for (let index = 0; index < lines.length; index++) {
    const heading = HEADING.exec(lines[index] ?? '');
    if (!heading) continue;

    if (start === -1) {
      if (headingKey(heading[2] ?? '') === wanted) {
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
