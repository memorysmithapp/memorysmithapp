// Markdown helpers used by the UI: frontmatter split, guidance heuristics and
// wikilink resolution. The backend never interprets note content (PP4); these
// helpers exist purely for presentation.

export interface SplitDocument {
  frontmatter: Record<string, string>;
  body: string;
}

/**
 * A note is bytes the vault wrote, and a vault written on Windows, or in
 * Obsidian, or pasted from anywhere, carries CRLF. Every reader in this module
 * starts here, because a carriage return left at the end of a line is
 * invisible in the source and fatal to a regex: `.` does not match one, so
 * `(.*)$` fails on exactly the lines that have a value.
 */
function toUnixNewlines(raw: string): string {
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
export function splitFrontmatter(input: string): SplitDocument {
  const raw = toUnixNewlines(input);
  if (!raw.startsWith('---')) return { frontmatter: {}, body: raw };
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return { frontmatter: {}, body: raw };
  const head = raw.slice(raw.indexOf('\n') + 1, end);
  const body = raw.slice(raw.indexOf('\n', end + 1) + 1);

  const frontmatter: Record<string, string> = {};
  let lastKey: string | null = null;
  for (const line of head.split('\n')) {
    const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (kv && kv[1]) {
      lastKey = kv[1];
      const value = (kv[2] ?? '').trim();
      // An inline list becomes the same comma-separated string a dash list
      // produces, so `tags: [a, b]` and a `tags:` block read alike from here.
      frontmatter[lastKey] =
        value.startsWith('[') && value.endsWith(']')
          ? value
              .slice(1, -1)
              .split(',')
              .map(unquote)
              .filter((item) => item.length > 0)
              .join(', ')
          : unquote(value);
    } else if (lastKey && /^\s+-\s+/.test(line)) {
      const item = unquote(line.replace(/^\s+-\s+/, ''));
      frontmatter[lastKey] = frontmatter[lastKey] ? `${frontmatter[lastKey]}, ${item}` : item;
    }
  }
  return { frontmatter, body };
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

const CALLOUT_ICONS: Record<string, string> = {
  abstract: '📌',
  summary: '📌',
  info: 'ℹ️',
  note: '📝',
  tip: '💡',
  important: '❗',
  warning: '⚠️',
  danger: '⚠️',
  quote: '💬',
  question: '❓',
  success: '✅',
};

// Obsidian-style callout markers ("> [!info] Title") are a vault convention,
// not universal Markdown. For display we swap the marker for an icon so the
// blockquote reads naturally; the stored content is never touched.
export function renderCallouts(body: string): string {
  return toUnixNewlines(body).replace(
    /^(>[ \t]*)\[!(\w+)\][+-]?[ \t]*(.*)$/gm,
    (_all, prefix: string, type: string, title: string) => {
      const icon = CALLOUT_ICONS[type.toLowerCase()] ?? '📎';
      const heading = title.trim();
      return heading ? `${prefix}${icon} **${heading}**` : `${prefix}${icon}`;
    },
  );
}

const WIKILINK = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;

// Replaces [[wikilinks]] with markdown links. Resolved targets point at the
// note route; unresolved ones become pending: links styled by the renderer.
export function resolveWikilinks(body: string, resolve: (slug: string) => string | null): string {
  return body.replace(WIKILINK, (_all, target: string, label?: string) => {
    const clean = target.split('#')[0]?.trim() ?? '';
    const text = (label ?? target).trim();
    const url = clean ? resolve(slugify(clean)) : null;
    return url ? `[${text}](${url})` : `[${text}](pending:${encodeURIComponent(clean)})`;
  });
}

/** The slug of a note, as the product derives it from the title. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
