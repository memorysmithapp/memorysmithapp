// Markdown helpers used by the UI: frontmatter split, guidance heuristics and
// wikilink resolution. The backend never interprets note content (PP4); these
// helpers exist purely for presentation.

export interface SplitDocument {
  frontmatter: Record<string, string>;
  body: string;
}

export function splitFrontmatter(raw: string): SplitDocument {
  if (!raw.startsWith('---')) return { frontmatter: {}, body: raw };
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return { frontmatter: {}, body: raw };
  const head = raw.slice(raw.indexOf('\n') + 1, end);
  const body = raw.slice(raw.indexOf('\n', end + 1) + 1);

  const frontmatter: Record<string, string> = {};
  let lastKey: string | null = null;
  for (const line of head.split('\n')) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (kv && kv[1]) {
      lastKey = kv[1];
      frontmatter[lastKey] = (kv[2] ?? '').replace(/^"|"$/g, '');
    } else if (lastKey && /^\s+-\s+/.test(line)) {
      const item = line.replace(/^\s+-\s+/, '');
      frontmatter[lastKey] = frontmatter[lastKey] ? `${frontmatter[lastKey]}, ${item}` : item;
    }
  }
  return { frontmatter, body };
}

export function guidanceTitle(guidance: string, fallback: string): string {
  const match = /^#\s+(.+)$/m.exec(guidance);
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
  const lines = guidance.split('\n');
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
  return body
    .replace(/\r\n?/g, '\n')
    .replace(
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
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
