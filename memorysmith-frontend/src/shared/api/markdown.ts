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

export function guidanceDescription(guidance: string): string {
  const lines = guidance.split('\n');
  for (const line of lines) {
    if (line.startsWith('> ') && !line.startsWith('> [!')) {
      return line.replace(/^>\s*/, '').trim();
    }
  }
  for (const line of lines) {
    const text = line.trim();
    if (text && !text.startsWith('#') && !text.startsWith('>')) return text;
  }
  return '';
}

const WIKILINK = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;

// Replaces [[wikilinks]] with markdown links. Resolved targets point at the
// note route; unresolved ones become pending: links styled by the renderer.
export function resolveWikilinks(body: string, resolve: (slug: string) => string | null): string {
  return body.replace(WIKILINK, (_all, target: string, label?: string) => {
    const clean = target.split('#')[0]?.trim() ?? '';
    const text = (label ?? target).trim();
    const url = clean ? resolve(slugifyTarget(clean)) : null;
    return url ? `[${text}](${url})` : `[${text}](pending:${encodeURIComponent(clean)})`;
  });
}

function slugifyTarget(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
