/**
 * The name of a note (MemorySmith Markdown Specification §5.3). This is the
 * third sanctioned reader of content, and the one Knowledge needs
 * synchronously on the write, because a listing cannot wait for a projection
 * to know what a note is called (architecture-guide.md §11).
 *
 * It is a pure function of the kernel, used by Knowledge when a note is
 * written and by Discovery when a link is resolved, so the two can never
 * disagree about what a note is called (RN-KNW-035).
 *
 * What it reads is one reserved key of the frontmatter and nothing else: no
 * heading, no first line, no file name, and never a notebook convention or a
 * vocabulary this backend holds a list of (PP4). A heading is only content.
 */

import { frontmatterOf } from './frontmatter.js';

/**
 * The four delimiters of the form that addresses a note. A name carrying one
 * of them is no name: the note exists, it renders, it links outward and it is
 * searchable, and no link can name it (§5.3, RN-KNW-036).
 *
 * A `/` is deliberately not among them. `Reunião 03/09/2026` is an ordinary
 * name, because folders play no part in identity.
 */
const UNADDRESSABLE = /[#[\]|]/;

/**
 * The frontmatter key that names a note (§6.5). It is here because this is
 * where it is read, and it is exported because the facet extractor has to know
 * which key it must never turn into an attribute (RN-DSC-050).
 */
export const NAME_KEY = 'name';

/**
 * The name of a note, or `null` when it has none.
 *
 * It is `name:` of the frontmatter, when that is a single text value of any
 * length, trimmed and normalised to NFC. Its length is not capped: the
 * 40-character ceiling of §6.3 is where a value stops being a category, and a
 * name is never a category.
 *
 * **There is no chain.** A `name:` that is absent, empty or of any other shape
 * — a list, a nested block — means the note has no name, and nothing falls
 * through to a heading (RN-KNW-039). A name carrying one of the four
 * delimiters is no name either (RN-KNW-036). None of it is ever an error: this
 * product never validates content (§6.5).
 *
 * NFC is not a fold: `Ação` exists as two byte sequences that render
 * identically and are typed by different editors, and normalising is what
 * keeps them one note instead of two. Nothing else is folded — comparison is
 * case-exact (§5.3).
 */
export function noteName(body: string): string | null {
  const entry = frontmatterOf(body)[NAME_KEY];
  if (!entry || entry.written !== 'scalar') return null;
  const name = (entry.values[0] ?? '').normalize('NFC').trim();
  if (name.length === 0 || UNADDRESSABLE.test(name)) return null;
  return name;
}
