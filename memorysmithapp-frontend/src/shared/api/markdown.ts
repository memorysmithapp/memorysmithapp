// Markdown helpers used by the UI: frontmatter split, guidance heuristics and
// the code a section is cut around. The note itself is drawn by
// @memorysmithapp/markdown-renderer (#291). The backend never interprets note content (PP4); these
// helpers exist purely for presentation.

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
