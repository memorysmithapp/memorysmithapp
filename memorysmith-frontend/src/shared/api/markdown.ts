// Markdown helpers used by the UI: frontmatter split, guidance heuristics and
// wikilink resolution. The backend never interprets note content (PP4); these
// helpers exist purely for presentation.

import { readDimensions } from './image-dimensions';

export interface SplitDocument {
  frontmatter: Record<string, string>;
  /**
   * Which of those keys the notebook wrote as a list, whether in a dash block or
   * inline. The values are flattened to one comma-separated string so the
   * table can print them, and that flattening is lossy: `tags: a, b` and a
   * two-item list read the same afterwards. The set keeps the difference,
   * because a list is drawn as chips and a sentence is not, and guessing from
   * the commas would turn a prose value that happens to have one into chips.
   */
  lists: Set<string>;
  body: string;
}

/**
 * A note is bytes the notebook wrote, and a notebook written on Windows, or in a
 * desktop editor, or pasted from anywhere, carries CRLF. Every reader in this
 * module starts here, because a carriage return left at the end of a line is
 * invisible in the source and fatal to a regex: `.` does not match one, so
 * `(.*)$` fails on exactly the lines that have a value.
 */
export function toUnixNewlines(raw: string): string {
  return raw.replace(/\r\n?/g, '\n');
}

/**
 * Strips one layer of matching quotes, as the facet projector does. The trim
 * comes first: an item of an inline list arrives with the space that followed
 * the comma, and a quote that is not at position zero is not stripped.
 */
function unquote(value: string): string {
  return value
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

/**
 * The frontmatter block, read the way the Discovery facet projector reads it
 * (FacetExtractor.ts). The two have to agree: the graph groups notes by what
 * the projector saw, and this table is where a reader checks it. An attribute
 * this parser drops is an attribute the graph offers and the note appears not
 * to have.
 */
/**
 * The four delimiters of the form that addresses a note (§5.3). A name
 * carrying one of them is no name: the note exists and renders, and no link
 * can reach it (RN-KNW-036).
 */
const UNADDRESSABLE = /[#[\]|]/;

/**
 * What the note WILL be called if this text is written, or null for no name.
 *
 * The server is the authority — it reads `name:` on every write, in the kernel
 * (RN-KNW-035) — and this predicts the same answer, because the editor has to
 * say what a write will do BEFORE it is confirmed (#169). It is the same rule,
 * in the same order: a single text value, NFC, trimmed, carrying none of the
 * four delimiters. There is no chain: nothing falls through to a heading.
 */
export function noteNameOf(raw: string): string | null {
  const { frontmatter, lists } = splitFrontmatter(raw);
  if (lists.has('name')) return null;
  const name = (frontmatter['name'] ?? '').normalize('NFC').trim();
  if (name.length === 0 || UNADDRESSABLE.test(name)) return null;
  return name;
}

/**
 * The same text with one more alias in its frontmatter (#169).
 *
 * It is what the editor offers whoever is renaming a note: an alias resolves
 * exactly what no name resolved (§5.2, step 8), so every `[[old name]]` keeps
 * arriving — and the day somebody writes a note actually named that, the name
 * takes those links back (RN-DSC-053).
 *
 * It edits the frontmatter OF THE NOTE BEING WRITTEN and nothing else. Nothing
 * here rewrites another note: the product does not edit prose somebody else
 * typed, which is the whole reason a rename costs what it costs.
 *
 * Three shapes, because `aliases:` can already be any of them: a list, which
 * gains a line; a single value, which becomes a list of two; and absent, which
 * is written as a list of one right after the block opens. A note with no
 * frontmatter at all gets one.
 */
export function withAlias(raw: string, alias: string): string {
  const text = toUnixNewlines(raw);
  const wanted = alias.normalize('NFC').trim();
  if (wanted.length === 0) return text;

  if (!text.startsWith('---')) return `---\naliases:\n  - ${wanted}\n---\n\n${text}`;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return `---\naliases:\n  - ${wanted}\n---\n\n${text}`;

  const head = text.slice(text.indexOf('\n') + 1, end);
  const rest = text.slice(end);
  const lines = head.split('\n');

  const at = lines.findIndex((line) => /^aliases\s*:/u.test(line));
  if (at === -1) {
    return `---\n${['aliases:', `  - ${wanted}`, ...lines].join('\n')}${rest}`;
  }

  const declared = (lines[at] ?? '').replace(/^aliases\s*:/u, '').trim();
  if (declared.length === 0) {
    // Already a list: the alias joins it, right under the key, so the note
    // reads the way its author left it.
    const next = [...lines];
    next.splice(at + 1, 0, `  - ${wanted}`);
    return `---\n${next.join('\n')}${rest}`;
  }

  // A single value written on the key line becomes a list of the two.
  const inline = declared.startsWith('[') ? null : declared;
  const next = [...lines];
  if (inline === null) {
    const inner = declared.slice(1, declared.lastIndexOf(']'));
    next[at] = `aliases: [${inner.trim().length > 0 ? `${inner}, ` : ''}${wanted}]`;
  } else {
    next.splice(at, 1, 'aliases:', `  - ${inline}`, `  - ${wanted}`);
  }
  return `---\n${next.join('\n')}${rest}`;
}

export function splitFrontmatter(input: string): SplitDocument {
  const raw = toUnixNewlines(input);
  const bare = { frontmatter: {}, lists: new Set<string>(), body: raw };
  if (!raw.startsWith('---')) return bare;
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return bare;
  const head = raw.slice(raw.indexOf('\n') + 1, end);
  const body = raw.slice(raw.indexOf('\n', end + 1) + 1);

  const frontmatter: Record<string, string> = {};
  const lists = new Set<string>();
  let lastKey: string | null = null;
  for (const line of head.split('\n')) {
    const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (kv && kv[1]) {
      lastKey = kv[1];
      const value = (kv[2] ?? '').trim();
      // An inline list becomes the same comma-separated string a dash list
      // produces, so `tags: [a, b]` and a `tags:` block read alike from here.
      const inlineList = value.startsWith('[') && value.endsWith(']');
      if (inlineList) lists.add(lastKey);
      frontmatter[lastKey] = inlineList
        ? value
            .slice(1, -1)
            .split(',')
            .map(unquote)
            .filter((item) => item.length > 0)
            .join(', ')
        : unquote(value);
    } else if (lastKey && /^\s+-\s+/.test(line)) {
      const item = unquote(line.replace(/^\s+-\s+/, ''));
      lists.add(lastKey);
      frontmatter[lastKey] = frontmatter[lastKey] ? `${frontmatter[lastKey]}, ${item}` : item;
    }
  }
  return { frontmatter, lists, body };
}

export function guidanceTitle(guidance: string, fallback: string): string {
  const match = /^#\s+(.+)$/m.exec(toUnixNewlines(guidance));
  return match?.[1]?.trim() ?? fallback;
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(
      /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
      (_a, target: string, label?: string) => label ?? target,
    );
}

export function guidanceDescription(guidance: string): string {
  const lines = toUnixNewlines(guidance).split('\n');
  for (const line of lines) {
    if (line.startsWith('> ') && !line.startsWith('> [!')) {
      return stripInlineMarkdown(line.replace(/^>\s*/, '').trim());
    }
  }
  for (const line of lines) {
    const text = line.trim();
    if (text && !text.startsWith('#') && !text.startsWith('>')) return stripInlineMarkdown(text);
  }
  return '';
}

/**
 * A wikilink, with the `!` in front of it when it is an embed (#174).
 *
 * The bang is captured and not assumed away, because it is what tells a
 * **link** from an **embed**, and the two reach different things: a link
 * addresses a note and nothing else (§5.2), while an embed may also name a
 * file the notebook keeps (§5.8). By the time this pass runs, the bang of a
 * note embed has been taken off by `demoteEmbeds` — an embed that could not be
 * expanded is a reference — so what still carries one is an embed of a file.
 */
const WIKILINK = /(!)?\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;

/**
 * Code, where notation is characters and nothing else.
 *
 * A fenced block parses nothing inside it and a code span is where an author
 * writes notation without invoking it — both stated by the profile, in the
 * `code-fenced` and `code-span` entries of the profile. The rewrites below
 * run over the raw text BEFORE the parser sees it, so they are the one place
 * in this interface that has to know that on its own: every other reading of
 * the notation is a remark plugin, working on a tree where a code node is
 * already a code node.
 *
 * The indented form is deliberately NOT here, and the reason is the cost of
 * being wrong. Telling four spaces of code from four spaces of a nested list
 * item needs the block context only a parser has; guessing it wrong turns a
 * real link into text, and the same guess in the link extractor would drop a
 * real edge. A wikilink written inside an indented code block is therefore
 * still read, in both readers, and that is declared rather than discovered
 * (`architecture-guide.md` §11.1).
 */
const CODE = /```[\s\S]*?(?:\n```|$)|`[^`\n]*`/g;

/** The half-open ranges of `body` that are code. */
export function codeRegions(body: string): Array<[number, number]> {
  return [...body.matchAll(CODE)].map((match) => [
    match.index ?? 0,
    (match.index ?? 0) + match[0].length,
  ]);
}

/** Whether an offset falls inside one of them. */
export function insideCode(regions: Array<[number, number]>, at: number): boolean {
  return regions.some(([start, end]) => at >= start && at < end);
}

/**
 * A GFM table, which is the third place an embed cannot expand (profile §7.3).
 *
 * A cell holds inlines and never blocks (§4.1), so an embed of a note in a
 * cell is drawn as a link, the same answer the one-level rule and the embed
 * ceiling already give. What made this its own case is that the expansion is
 * decided on the raw string, by cutting the body into runs around each
 * `![[…]]`, and a cut inside a table row does not merely fail to expand: it
 * ends the run mid-row, so the parser that reads it has an unterminated table
 * and the closing pipe becomes a paragraph of its own.
 *
 * Detected here rather than in a plugin for the reason the code regions
 * already are: the split happens before anything is parsed, so this is the one
 * place in the interface that has to recognise the block on its own.
 *
 * A table is a line containing a pipe, followed by a delimiter row of dashes,
 * and it runs to the first blank line. The outer pipes are optional, which is
 * why the delimiter row is what identifies the block. A shape this misses
 * costs nothing new — it is the behaviour of before — so the pattern is
 * deliberately the conservative one.
 */
const DELIMITER_ROW = /^ {0,3}\|?[ \t]*:?-{1,}:?[ \t]*(\|[ \t]*:?-{1,}:?[ \t]*)*\|?[ \t]*$/;

export function tableRegions(body: string): Array<[number, number]> {
  const regions: Array<[number, number]> = [];
  const code = codeRegions(body);
  const lines = body.split('\n');
  const offsets: number[] = [];

  let at = 0;
  for (const line of lines) {
    offsets.push(at);
    at += line.length + 1;
  }

  for (let index = 0; index + 1 < lines.length; index++) {
    const header = lines[index] ?? '';
    const delimiter = lines[index + 1] ?? '';
    if (!header.includes('|') || !delimiter.includes('|')) continue;
    if (!DELIMITER_ROW.test(delimiter)) continue;
    if (insideCode(code, offsets[index] ?? 0)) continue;

    let last = index + 1;
    while (last + 1 < lines.length && (lines[last + 1] ?? '').trim().length > 0) last++;

    regions.push([offsets[index] ?? 0, (offsets[last] ?? 0) + (lines[last] ?? '').length]);
    index = last;
  }
  return regions;
}

/** Whether an offset falls inside one of them. */
export function insideTable(regions: Array<[number, number]>, at: number): boolean {
  return regions.some(([start, end]) => at >= start && at < end);
}

/** Runs a rewrite over everything except code, which is copied through. */
export function outsideCode(body: string, rewrite: (text: string) => string): string {
  let out = '';
  let cursor = 0;
  for (const [start, end] of codeRegions(body)) {
    out += rewrite(body.slice(cursor, start)) + body.slice(start, end);
    cursor = end;
  }
  return out + rewrite(body.slice(cursor));
}

// Replaces [[wikilinks]] with markdown links. Resolved targets point at the
// note route; unresolved ones become pending: links styled by the renderer.
export function resolveWikilinks(
  body: string,
  resolve: (name: string) => string | null,
  /**
   * Whether the notebook keeps a FILE under that name (#166). The extension
   * of a name decides nothing, so what a target is cannot be read off it: it
   * is read off what the notebook holds, which is what the page loaded.
   */
  keeps: (name: string) => boolean = () => false,
): string {
  return outsideCode(body, (text) => resolveWikilinksIn(text, resolve, keeps));
}

/**
 * The target of a wikilink is a NAME, and it is literal: nothing in it is
 * decoded, no extension is removed and no path segment is discarded
 * (RN-DSC-043). It used to be slugified here, which is what made a link differ
 * from its note over an accent or a capital.
 */
function resolveWikilinksIn(
  body: string,
  resolve: (name: string) => string | null,
  keeps: (name: string) => boolean,
): string {
  return body.replace(WIKILINK, (_all, bang: string | undefined, target: string, label?: string) => {
    const clean = target.split('#')[0]?.trim().replace(/\\$/, '').trim() ?? '';
    const embed = bang !== undefined;
    const text = displayText(clean, label, target, (name) => embed && keeps(name));
    if (!clean) return `[${text}](pending:)`;
    // The pipe is read by WHAT THE TARGET IS: a note takes the alias, an
    // attachment takes the dimensions, and a target that resolves to neither
    // takes the alias — because reading it as a dimension would discard text
    // an author wrote (RN-DSC-049).
    //
    // **Only an embed reaches a file** (#174). A `[[name]]` is resolved against
    // the notes of the notebook and their aliases, and against nothing else:
    // §5.2 lists the whole of resolution and an attachment is in none of its
    // steps, so a name only a file carries is a pending link like any other.
    if (embed && keeps(clean)) {
      // The dimension travels with the address, because the name is already
      // percent-encoded and a bare `|` after it cannot be part of it (#173).
      // Dropping it here is what made `![[picture|120]]` render at full size:
      // the notation was read and then thrown away one line before it was used.
      const measured = label === undefined ? null : readDimensions(label);
      const sized = measured
        ? `|${measured.width}${measured.height === null ? '' : `x${measured.height}`}`
        : '';
      return `[${text}](attachment:${encodeURIComponent(clean)}${sized})`;
    }
    const url = resolve(clean.normalize('NFC'));
    return url ? `[${text}](${url})` : `[${text}](pending:${encodeURIComponent(clean)})`;
  });
}

/**
 * What the link shows. The pipe of an attachment carries dimensions and is
 * never rendered as text, so what is left to show is the name of the file.
 */
function displayText(
  clean: string,
  label: string | undefined,
  target: string,
  keeps: (name: string) => boolean,
): string {
  if (clean && keeps(clean)) return clean;
  return (label ?? target).trim();
}

/** The longest a heading key may be, which is what an anchor is matched on. */
const MAX_KEY_LENGTH = 80;

/**
 * The key a **heading** is matched by, which is how an anchor finds the
 * section it names inside a note.
 *
 * **It is not the key of a note, and there is no longer one of those.** A link
 * resolves against the name, literally and case-exact (RN-DSC-041), so the
 * slug this file used to compute — the second implementation of a rule the
 * kernel also implemented, and the one that drifted in #73 — is gone. What is
 * left is this: an anchor and a heading are two spellings of the same phrase,
 * written by the same person minutes apart, and folding case and punctuation
 * between them is what makes `#Artigo 75` find `## Artigo 75`.
 *
 * Nothing outside this comparison reads it, and nothing else in the interface
 * computes a key from a name: the address of a note is its identifier alone
 * (RN-DSC-045).
 */
export function headingKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/(\d)[.,](\d)/g, '$1$2')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_KEY_LENGTH)
    .replace(/-+$/g, '');
}

/**
 * The hosts a note asks the reader's browser to talk to (profile §7.10,
 * RN-DSC-040).
 *
 * An image whose destination names a host is a **request to that host**, made
 * when the note is opened, by whoever opens it — and the trigger was written
 * by whoever wrote the note, which is the same sentence §7.9 uses about raw
 * HTML. What travels with it is the reader's address, their user-agent and the
 * moment they read it.
 *
 * The profile admits three answers and forbids only silence: never fetching,
 * fetching on the reader's action, or fetching and saying so. This product
 * gives the third, so this is the half that says so. It is the image of §3.14
 * and nothing else: a diagram and a formula render locally, and a link —
 * bracketed, bare or autolinked — is a navigation the person initiates rather
 * than a request the page makes.
 *
 * Code is excluded, because an image written inside a fence is an example of
 * the notation and fetches nothing.
 */
const IMAGE_DESTINATION = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;

export function remoteImageHosts(body: string): string[] {
  const regions = codeRegions(body);
  const hosts = new Set<string>();

  for (const match of body.matchAll(IMAGE_DESTINATION)) {
    if (insideCode(regions, match.index ?? 0)) continue;

    const destination = (match[1] ?? '').trim();
    // A path, a relative target or an anchor names no host and asks nobody
    // for anything. Only a scheme or a leading `//` reaches outside.
    const authority = /^[a-z][a-z0-9+.-]*:\/\//i.test(destination)
      ? destination.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
      : destination.startsWith('//')
        ? destination.slice(2)
        : '';
    if (authority === '') continue;

    // The authority, minus any credentials, port and path: what a person needs
    // in order to recognise who they just talked to.
    const host = (authority.split('/')[0] ?? '').split('@').pop() ?? '';
    const named = host.split(':')[0] ?? '';
    if (named !== '') hosts.add(named.toLowerCase());
  }
  return [...hosts];
}
