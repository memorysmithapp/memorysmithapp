/**
 * LinkExtractor: the first of the two sanctioned readers of content (INV-05). It
 * reads ONLY the notation the specification declares - no field name, no notebook
 * convention - because what a convention means belongs to the guidance, never to
 * the backend (PP4).
 *
 * **A target is a name, and the two forms reach it differently.** A wikilink
 * target is LITERAL: nothing in it is decoded, no extension is removed and no
 * path segment is discarded, because a name is what the author typed
 * (RN-DSC-043). The three tolerances - discarding the path, dropping a
 * trailing `.md`, percent-decoding - belong to the Markdown form alone, and
 * their order is fixed by the specification: split at the first unencoded `#`,
 * then discard the path, then drop the extension, then decode.
 *
 * Decoding earlier would undo the escaping it exists for: `C%23%20basics`
 * would become `C# basics` and split at a `#` its author encoded precisely so
 * it would not be a delimiter, and `and%2For` would lose its first half to the
 * path rule. Delimiters first, decode after, compare last.
 *
 * What this reader does NOT do is resolve. It says what a note points at; what
 * a note answers to is its name and its aliases, and putting the two
 * together is `resolveTargets` (LinkResolver.ts).
 */

import { codeRanges, textReferences } from '@memorysmithapp/kernel';

export interface ExtractedLink {
  /** The name the author addressed, literal and normalised to NFC. */
  readonly name: string;
  /** The anchor, kept for display and dropped from resolution (RN-DSC-002). */
  readonly anchor: string | null;
  /** What the author actually typed, for the health report. */
  readonly raw: string;
  /**
   * Whether it was written as an **embed** (#174).
   *
   * The graph does not tell the two forms apart and must not: an embed and a
   * link to one target are one edge, not two (§5.4, RN-DSC-029). What the flag
   * decides is **what a target may reach**: a file of the notebook is named by
   * `![[…]]` and by nothing else (§5.8), so a plain `[[…]]` of that name
   * resolves against the notes alone, and is pending when none answers.
   *
   * A target written both ways in one note is embedded: the two occurrences
   * collapse into one entry, and the one that reaches further is the truth
   * about the note.
   */
  readonly embed: boolean;
}

/**
 * The wikilink, in the three shapes it is written in. The alias after the pipe
 * is display and never changes the target, and the target of a link written
 * inside a table cell arrives with the escaped pipe its author had to write
 * there.
 */
const WIKILINK = /(!)?\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;
/**
 * A link, and NOT an image: the `!` in front is the whole difference between
 * the two forms, and reading it as a link made an image a note. A relative
 * `![Curve](./curve.png)` became a pending link called `curve-png` - the graph
 * announcing a note somebody was about to write, from a picture (RN-DSC-038).
 *
 * The embed is untouched by this. `![[note]]` is read by WIKILINK above, which
 * does not care what precedes it, and it has to keep producing exactly the
 * edge `[[note]]` produces (RN-DSC-029). The two forms never meet: this one
 * requires a `](`, and the embed has no parenthesis at all.
 */
const MARKDOWN_LINK = /(?<!!)\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** Step 2: the first `#` that is not itself percent-encoded. */
function splitAnchor(target: string): { path: string; anchor: string | null } {
  const at = target.indexOf('#');
  if (at === -1) return { path: target, anchor: null };
  return { path: target.slice(0, at), anchor: target.slice(at + 1) };
}

/**
 * An escape that is not one is left exactly as written and is never an error:
 * the `%` of `[Half](50%)` opens nothing, and `decodeURIComponent` throwing on
 * it must not cost the note its link.
 */
function percentDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * A name is compared after NFC and folded in no other way (RN-DSC-041), and
 * `raw` is what the author typed — the health report shows a target as it was
 * written, not as it was read.
 */
function asName(
  value: string,
  anchor: string | null,
  raw: string,
  embed = false,
): ExtractedLink | null {
  const name = value.trim().normalize('NFC');
  if (name.length === 0) return null;
  return { name, anchor: anchor === null ? null : anchor.trim().normalize('NFC'), raw, embed };
}

/** The wikilink form: the target is what was typed, and nothing touches it. */
function fromWikilink(target: string, embed: boolean): ExtractedLink | null {
  // Inside a table cell the pipe of an alias is escaped, so a target arriving
  // from there ends at the backslash its author had to write.
  const written = target.replace(/\\$/, '');
  const { path, anchor } = splitAnchor(written);
  // A target that writes a parameter names no note yet (§7.14): no edge and
  // not pending, until a notebook created from the model fills it in.
  if (textReferences(path).length > 0) return null;
  return asName(path, anchor, target, embed);
}

/** The Markdown form: the three tolerances, in the order the specification fixes. */
function fromMarkdownLink(target: string): ExtractedLink | null {
  const trimmed = target.trim();
  if (trimmed.length === 0) return null;
  // Step 1: a scheme or a host means the world and never the notebook
  // (RN-DSC-003).
  if (HAS_SCHEME.test(trimmed) || trimmed.startsWith('//')) return null;

  const { path, anchor } = splitAnchor(trimmed);
  const basename = path.split('/').pop() ?? path;
  const withoutExtension = basename.replace(/\.mdx?$/i, '');
  return asName(
    percentDecode(withoutExtension),
    anchor === null ? null : percentDecode(anchor),
    target,
  );
}

/**
 * Every link written in the body of a note, deduplicated by target.
 *
 * Several links to one target are one edge, and an embed and a plain link to
 * the same target are one edge too: the graph does not distinguish
 * transclusion from reference, not even by counting (§5.4).
 */
export function extractLinks(markdown: string): ExtractedLink[] {
  const body = stripCodeBlocks(markdown);
  const found = new Map<string, ExtractedLink>();
  const add = (link: ExtractedLink | null): void => {
    if (!link) return;
    const held = found.get(link.name);
    if (!held) {
      found.set(link.name, link);
      return;
    }
    // One entry per target, and it remembers that the note embedded it
    // somewhere: the edge is the same either way, what the target reaches is
    // not (#174).
    if (link.embed && !held.embed) found.set(link.name, { ...held, embed: true });
  };

  for (const match of body.matchAll(WIKILINK))
    add(fromWikilink(match[2] ?? '', match[1] !== undefined));
  for (const match of body.matchAll(MARKDOWN_LINK)) add(fromMarkdownLink(match[1] ?? ''));

  // A definition on its own is not a link: it renders nothing where it stands
  // and it is a destination waiting to be used. What produces the edge is the
  // reference that names it, in any of its three forms.
  const defined = definitions(body);
  if (defined.size > 0) {
    for (const match of body.matchAll(REFERENCE)) {
      const label = (match[2] ?? '').trim() || (match[1] ?? '');
      const destination = defined.get(labelKey(label));
      if (destination) add(fromMarkdownLink(destination));
    }
    for (const match of body.matchAll(SHORTCUT)) {
      const destination = defined.get(labelKey(match[2] ?? ''));
      if (destination) add(fromMarkdownLink(destination));
    }
  }
  return [...found.values()];
}

/**
 * Everything a note names, each with the form it was named in (#305): its
 * links and embeds, and the files it draws as images by path. This is what a
 * projection keeps of a note; the two readers above are what it is made of.
 */
export function extractReferences(
  markdown: string,
): Array<{ name: string; anchor: string | null; form: 'link' | 'embed' | 'image' }> {
  return [
    ...extractLinks(markdown).map((link) => ({
      name: link.name,
      anchor: link.anchor,
      form: link.embed ? ('embed' as const) : ('link' as const),
    })),
    ...extractImages(markdown).map((image) => ({
      name: image.name,
      anchor: null,
      form: 'image' as const,
    })),
  ];
}

/**
 * An image, in its inline form: the description, which may carry the
 * dimensions after a pipe, and a destination written bare or between angle
 * brackets, the second being how a name with a space is written.
 */
const IMAGE =
  /!\[(?:[^\]\\\n]|\\.)*\]\(\s*(<[^>\n]*>|[^)\s]+)(?:\s+(?:"[^"\n]*"|'[^'\n]*'))?\s*\)/g;
/** `![alt][label]` and the collapsed `![label][]`. */
const REFERENCE_IMAGE = /!\[([^\]\n]*)\]\[([^\]\n]*)\]/g;
/** `![label]` on its own, an image only when the label is defined. */
const SHORTCUT_IMAGE = /!\[([^\]\n]+)\](?![[(:])/g;

/**
 * The files a note draws as IMAGES BY PATH, one entry per name (RN-DSC-065).
 *
 * An image is not a link and never an edge (RN-DSC-038), which is why these
 * are not among what `extractLinks` answers. But an image whose destination
 * names no host is the file the notebook keeps under the last segment of that
 * path (§5.8): `![Curva|50%](../assets/curva.png)` draws `curva.png`, and the
 * page has drawn it so since renderer 0.8.0. A reader that skipped it told an
 * agent the file was shown by no note while a note was showing it.
 *
 * The name is read as the renderer reads it (`keptImageName`): the query and
 * the fragment dropped, `/` and `\` both separating, percent-decoded where an
 * escape is one, NFC, and nothing removed — an extension is part of the name
 * of a file, which is the opposite of what the link form does with `.md`. A
 * destination with a scheme or a host is the world (RN-DSC-003).
 */
export function extractImages(markdown: string): ExtractedLink[] {
  const body = stripCodeBlocks(markdown);
  const found = new Map<string, ExtractedLink>();
  const add = (destination: string): void => {
    const name = keptImageName(destination);
    if (name !== null && !found.has(name)) {
      found.set(name, { name, anchor: null, raw: destination, embed: true });
    }
  };

  for (const match of body.matchAll(IMAGE)) add(unbracketed(match[1] ?? ''));

  const defined = definitions(body);
  if (defined.size > 0) {
    for (const match of body.matchAll(REFERENCE_IMAGE)) {
      const label = (match[2] ?? '').trim() || (match[1] ?? '');
      const destination = defined.get(labelKey(label));
      if (destination) add(destination);
    }
    for (const match of body.matchAll(SHORTCUT_IMAGE)) {
      const destination = defined.get(labelKey(match[1] ?? ''));
      if (destination) add(destination);
    }
  }
  return [...found.values()];
}

/** A destination written between angle brackets, without them. */
function unbracketed(destination: string): string {
  return destination.startsWith('<') && destination.endsWith('>')
    ? destination.slice(1, -1)
    : destination;
}

/**
 * The name of the kept file a destination names, or `null` when it names a
 * host, has a scheme, or ends in no name at all.
 */
function keptImageName(destination: string): string | null {
  const trimmed = destination.trim();
  if (trimmed === '' || HAS_SCHEME.test(trimmed) || trimmed.startsWith('//')) return null;
  const path = trimmed.split(/[?#]/, 1)[0] ?? '';
  const segments = path.replace(/%5c/gi, '\\').split(/[/\\]/);
  const name = leniently(segments[segments.length - 1] ?? '')
    .trim()
    .normalize('NFC');
  return name.length > 0 ? name : null;
}

/** Every escape that is one decoded, and the rest left as written. */
function leniently(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text.replace(/(?:%[0-9a-f]{2})+/gi, (run) => percentDecode(run));
  }
}

/**
 * The reference form of a link, which is the same link written apart from its
 * destination. The three forms are equivalent once resolved, and the
 * destination decides the edge exactly as it does inline, so reading only the
 * inline one meant a note that keeps its addresses at the bottom - which is
 * how a long note stays readable - produced no edges at all.
 *
 * A label that begins with `^` is a footnote and not a label (§3.8, §7.12).
 * `[^1]: Wikipedia. *Rational…*` has the shape of a definition, and read as
 * one its first word became a destination — so `[^1]` in the text, a
 * shortcut reference in shape, made every footnote a pending link named after
 * the first word of its source (#190). Nothing is defined under such a label,
 * so no reference to one resolves, in any of the three forms.
 */
const DEFINITION = /^ {0,3}\[(?!\^)([^\]\n]+)\]:[ \t]*<?([^\s>]+)>?/gm;
/** `[text][label]` and the collapsed `[label][]`, and again never an image. */
const REFERENCE = /(?<!!)\[([^\]\n]*)\]\[([^\]\n]*)\]/g;
/**
 * `[label]` ON ITS OWN, which is a link only when the label is defined.
 *
 * "On its own" is what the three exclusions in front are for: a `[` before it
 * makes it a wikilink, a `!` makes it the label of an image, and a `]` makes
 * it the second half of a reference — which the pattern above already read,
 * and which would otherwise smuggle an image back in through `![alt][label]`.
 */
const SHORTCUT = /(^|[^[!\]])\[([^\]\n]+)\](?![[(:])/g;

/** The destinations declared at the bottom of the note, by normalised label. */
function definitions(body: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const match of body.matchAll(DEFINITION)) {
    map.set(labelKey(match[1] ?? ''), match[2] ?? '');
  }
  return map;
}

/** A label matches case-insensitively and whatever its internal spacing. */
function labelKey(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * A link inside code is an example, not a reference: a fenced block parses
 * nothing inside it and a code span is where an author writes the notation
 * without invoking it (`code-fenced` and `code-span`).
 *
 * Code is recognised by the rules the specification states, and never by a
 * pattern of backticks. A pattern that paired any two runs of three backticks
 * read a code span SHOWING three backticks as the opening of a fence, so every
 * fence after it was read out of phase: the links inside them became edges and
 * the links written between them disappeared (#266). The second is the worse
 * mistake, and it was the one the pattern made.
 *
 * What is stripped keeps its line breaks, so a definition at the start of the
 * line after a block still starts a line.
 *
 * The INDENTED form is deliberately absent, and it is a declared limitation
 * rather than an oversight (INV-05). Telling four spaces of code from four
 * spaces of a nested list item needs the block context only a parser has, and
 * this reader has none by design (PP4). Of the two ways to be wrong, reading a
 * link that was an example costs a spurious pending link, and skipping a nested
 * list item costs a real edge — the graph lying about what the notebook says,
 * which is what the product exists to prevent. So the cheaper mistake is the
 * one that stays.
 */
function stripCodeBlocks(markdown: string): string {
  let out = '';
  let cursor = 0;
  for (const [start, end] of codeRanges(markdown)) {
    out += markdown.slice(cursor, start) + markdown.slice(start, end).replace(/[^\n]/g, '');
    cursor = end;
  }
  return out + markdown.slice(cursor);
}
