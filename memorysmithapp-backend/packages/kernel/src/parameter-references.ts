/**
 * Parameter references (MemorySmith Markdown Specification §7.14): `{{name}}`,
 * where a value goes in a note of a model, filled in when a notebook is created
 * from it.
 *
 * This is the reader of that notation, and the only one (INV-05). Discovery
 * asks it which wikilinks name no note yet and which attributes nobody has
 * given a value; Portability asks it where each value goes, and what a model
 * writes that it never declared. It reads the notation and nothing else: what
 * a parameter is — its type, whether it is required, its default — is declared
 * by the model, outside its notes, and is no business of this file.
 *
 * Where it is read is where the specification says text is: a paragraph, a
 * heading, a list item, a table cell, a callout, the text of a link, the target
 * and the alias of a wikilink, and a value of the frontmatter. Never inside
 * code — a span, a fenced block, an indented block, a `mermaid` diagram —, in
 * mathematics, in the destination of a link or an image, in an autolink or a
 * bare address, in a link reference definition, or in raw HTML.
 */

import { frontmatterBlock } from './frontmatter.js';
import { codeRanges } from './markdown-code.js';

/** A name: a letter or `_`, then letters, combining marks, digits, `_` and `-`. */
const NAME = /^[\p{L}_][\p{L}\p{M}\p{N}_-]*$/u;
const NAME_CHARACTER = /[\p{L}\p{M}\p{N}_-]/u;

/** Where a reference stands, which decides how a value is written there. */
export type ReferencePlace =
  /** The whole of a value of the frontmatter, quoted or not. */
  | 'frontmatter-value'
  /** Inside a text value of the frontmatter, among other characters. */
  | 'frontmatter-text'
  /** The target of a wikilink, which names a note once filled in. */
  | 'wikilink-target'
  /** Anywhere else text is read. */
  | 'text';

export interface ParameterReference {
  /** The name, normalised to NFC, which is what two spellings are compared by. */
  readonly name: string;
  /** Where `{{` stands in the document. */
  readonly start: number;
  /** Just after `}}`. */
  readonly end: number;
  readonly place: ReferencePlace;
  /**
   * For a whole value of the frontmatter: the range of the value as written,
   * quotes included, which a typed value replaces whole.
   */
  readonly value?: { readonly start: number; readonly end: number };
}

/** Whether `name` is a name a reference can carry. */
export function isParameterName(name: string): boolean {
  return NAME.test(name);
}

/**
 * The references a run of plain text writes, honouring only the escapes: a
 * name of a notebook or a folder, a description, or a stretch of a note that
 * the caller already knows is text.
 */
export function textReferences(
  text: string,
  offset = 0,
  place: ReferencePlace = 'text',
): ParameterReference[] {
  const found: ParameterReference[] = [];
  for (let at = text.indexOf('{{'); at !== -1; at = text.indexOf('{{', at + 1)) {
    if (escaped(text, at)) continue;
    let cursor = at + 2;
    while (cursor < text.length && NAME_CHARACTER.test(text[cursor] ?? '')) cursor += 1;
    const name = text.slice(at + 2, cursor);
    if (!isParameterName(name)) continue;
    if (text[cursor] !== '}' || text[cursor + 1] !== '}') continue;
    found.push({
      name: name.normalize('NFC'),
      start: offset + at,
      end: offset + cursor + 2,
      place,
    });
    at = cursor + 1;
  }
  return found;
}

/** Whether the character at `index` is escaped by an odd run of backslashes before it. */
function escaped(text: string, index: number): boolean {
  let backslashes = 0;
  for (let at = index - 1; at >= 0 && text[at] === '\\'; at -= 1) backslashes += 1;
  return backslashes % 2 === 1;
}

/** Every reference of a note, its frontmatter first, in the order they are written. */
export function parameterReferences(markdown: string): ParameterReference[] {
  const block = frontmatterBlock(markdown);
  if (block === null) return bodyReferences(markdown, 0);
  const blockStart = markdown.indexOf('\n') + 1;
  const bodyStart = markdown.indexOf('---', blockStart + block.length) + 3;
  return [
    ...frontmatterReferences(block, blockStart),
    ...bodyReferences(markdown.slice(bodyStart), bodyStart),
  ];
}

/** The distinct names a note references, in the order each first appears. */
export function parameterNames(markdown: string): string[] {
  return [...new Set(parameterReferences(markdown).map((reference) => reference.name))];
}

/**
 * The references of the frontmatter, line by line, in the values of the YAML
 * subset (§6.2): a value that is a reference and nothing else is a whole value,
 * quoted or not, and a reference among other characters is text inside it.
 */
function frontmatterReferences(block: string, offset: number): ParameterReference[] {
  const found: ParameterReference[] = [];
  let at = offset;
  for (const line of block.split('\n')) {
    const value = /^(\s*-\s+|[A-Za-z0-9_-]+\s*:\s*)(.*?)\s*\r?$/.exec(line);
    if (value && !/^\s*#/.test(line)) {
      const valueStart = at + (value[1] ?? '').length;
      const written = value[2] ?? '';
      const items = written.startsWith('[') && written.endsWith(']') ? listItems(written) : null;
      for (const [start, text] of items ?? [[0, written] as const]) {
        found.push(...valueReferences(text, valueStart + start));
      }
    }
    at += line.length + 1;
  }
  return found;
}

/** The items of an inline list, each with where it starts inside the list. */
function listItems(list: string): Array<readonly [number, string]> {
  const items: Array<readonly [number, string]> = [];
  let start = 1;
  for (const part of list.slice(1, -1).split(',')) {
    const lead = part.length - part.trimStart().length;
    items.push([start + lead, part.trim()]);
    start += part.length + 1;
  }
  return items;
}

/** The references of one value, as written, starting at `offset`. */
function valueReferences(written: string, offset: number): ParameterReference[] {
  const quoted = /^(["'])(.*)\1$/.exec(written);
  const inner = quoted ? (quoted[2] ?? '') : written;
  const innerStart = offset + (quoted ? 1 : 0);
  const references = textReferences(inner, innerStart, 'frontmatter-text');
  const only = references[0];
  if (references.length === 1 && only && only.end - only.start === inner.length) {
    return [
      {
        ...only,
        place: 'frontmatter-value',
        value: { start: offset, end: offset + written.length },
      },
    ];
  }
  return references;
}

/** The references of the body, outside every range where text is not read. */
function bodyReferences(body: string, offset: number): ParameterReference[] {
  const closed = [...codeRanges(body), ...indentedCodeRanges(body), ...notTextRanges(body)].sort(
    (a, b) => a[0] - b[0],
  );
  const inside = (index: number): boolean =>
    closed.some(([start, end]) => index >= start && index < end);
  const targets = wikilinkTargets(body);
  return textReferences(body)
    .filter((reference) => !inside(reference.start) && !inside(reference.end - 1))
    .map((reference) => ({
      ...reference,
      start: reference.start + offset,
      end: reference.end + offset,
      place: targets.some(([start, end]) => reference.start >= start && reference.end <= end)
        ? ('wikilink-target' as const)
        : ('text' as const),
    }));
}

/**
 * Indented code (§3.6): a line of four spaces or a tab of indentation that
 * opens after a blank line, or the document's start, outside a list item, and
 * the lines that follow it at that indentation. The reader of links leaves
 * this form out on purpose; a reference inside it is never filled in, so here
 * it is read, as the specification draws it.
 */
function indentedCodeRanges(body: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let at = 0;
  let previousBlank = true;
  let inList = false;
  let inBlock = false;
  for (const line of body.split('\n')) {
    const blank = line.trim().length === 0;
    const indented = /^( {4}|\t)/.test(line);
    if (!blank && !indented) inList = /^\s{0,3}(?:[-*+]|\d{1,9}[.)])\s/.test(line);
    if (indented && !blank && (inBlock || (previousBlank && !inList))) {
      ranges.push([at, at + line.length]);
      inBlock = true;
    } else if (!blank) {
      inBlock = false;
    }
    previousBlank = blank;
    at += line.length + 1;
  }
  return ranges;
}

/**
 * Mathematics, destinations, autolinks, bare addresses, link reference
 * definitions and raw HTML: what is resolved before the text around it, and
 * whose inside is never read as text (§3.10).
 */
function notTextRanges(body: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const add = (pattern: RegExp, group = 0): void => {
    for (const match of body.matchAll(pattern)) {
      const index = match.index ?? 0;
      const text = match[group] ?? '';
      const start = group === 0 ? index : index + match[0].indexOf(text);
      ranges.push([start, start + text.length]);
    }
  };
  // A block of mathematics, between lines of `$$`, and inline mathematics.
  add(/^[ \t]*\$\$[\s\S]*?^[ \t]*\$\$[ \t]*$/gm);
  add(/(?<![\\$])\$(?=\S)[^$\n]*?\S\$(?![$\d])/g);
  // The destination of a link or an image.
  add(/\]\(([^)\n]*)\)/g, 1);
  // A link reference definition, the whole line.
  add(/^ {0,3}\[(?!\^)[^\]\n]+\]:.*$/gm);
  // Autolinks and inline HTML tags.
  add(/<[A-Za-z][A-Za-z0-9+.-]*:[^>\s]*>/g);
  add(/<\/?[A-Za-z][^<>\n]*>/g);
  // A bare address, as GFM links it.
  add(/(?:https?:\/\/|www\.)[^\s<]+/g);
  // A block of raw HTML: a line that opens with a tag of a block, to the next
  // blank line, as CommonMark reads one (§3.10).
  add(
    /^ {0,3}<\/?(?:address|article|aside|blockquote|details|dialog|div|dl|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|summary|table|tbody|td|tfoot|th|thead|tr|ul|script|style)\b[\s\S]*?(?=\n[ \t]*\n|(?![\s\S]))/gim,
  );
  return ranges;
}

/** The ranges of the targets of the wikilinks of the body, without the alias or the anchor. */
function wikilinkTargets(body: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (const match of body.matchAll(/!?\[\[([^\]|#\n]*)/g)) {
    const start = (match.index ?? 0) + match[0].length - (match[1] ?? '').length;
    ranges.push([start, start + (match[1] ?? '').length]);
  }
  return ranges;
}
