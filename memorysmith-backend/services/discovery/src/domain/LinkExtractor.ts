/**
 * LinkExtractor: the first of the two sanctioned readers of content
 * (architecture-guide.md, section 11.1). It reads ONLY universal Markdown
 * syntax - no field name, no vault convention - because what a convention
 * means belongs to the guidance, never to the backend (PP4).
 *
 * One resolution rule for both link forms: the target is reduced to the
 * basename without extension, normalized to a Slug, and resolved WITHIN THE
 * VAULT.
 */

import { slugify } from '@memorysmith/kernel';

export interface ExtractedLink {
  /** The normalized target, which is what resolution matches on. */
  readonly slug: string;
  /** The anchor, kept for display and dropped from resolution (RN-DSC-002). */
  readonly anchor: string | null;
  /** What the author actually typed, for the health report. */
  readonly raw: string;
}

const WIKILINK = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;
const MARKDOWN_LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function normalize(target: string): ExtractedLink | null {
  const trimmed = target.trim();
  if (trimmed.length === 0) return null;
  // A link with a scheme or a host is external and never becomes an edge
  // (RN-DSC-003).
  if (HAS_SCHEME.test(trimmed) || trimmed.startsWith('//')) return null;

  const [pathPart, anchorPart] = trimmed.split('#', 2);
  if (!pathPart) return null;

  // Path segments are DELIBERATELY ignored (RN-DSC-001): the edge is between
  // notes, not between folders, and honouring the path would break the link
  // the moment the note changed folder, which is what the product exists to
  // prevent.
  const basename = pathPart.split('/').pop() ?? pathPart;
  const withoutExtension = basename.replace(/\.mdx?$/i, '');
  const slug = slugify(withoutExtension);
  if (slug.length === 0) return null;

  return { slug, anchor: anchorPart ? slugify(anchorPart) || anchorPart : null, raw: trimmed };
}

/** Every link written in the body of a note, deduplicated by target. */
export function extractLinks(markdown: string): ExtractedLink[] {
  const body = stripCodeBlocks(markdown);
  const found = new Map<string, ExtractedLink>();

  for (const match of body.matchAll(WIKILINK)) {
    const link = normalize(match[1] ?? '');
    if (link && !found.has(link.slug)) found.set(link.slug, link);
  }
  for (const match of body.matchAll(MARKDOWN_LINK)) {
    const link = normalize(match[1] ?? '');
    if (link && !found.has(link.slug)) found.set(link.slug, link);
  }
  return [...found.values()];
}

/** A link inside a fenced block is an example, not a reference. */
function stripCodeBlocks(markdown: string): string {
  return markdown.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
}
