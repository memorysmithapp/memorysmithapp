/**
 * FacetExtractor: the second sanctioned reader of content
 * (architecture-guide.md, section 11.3). It reads ONLY the frontmatter block
 * and classifies each key-value pair BY THE SHAPE OF THE VALUE.
 *
 * There is no list of keys in the code and no per-vault configuration: the
 * vocabulary belongs to the guidance, and `maturity` and `reviewed`, the two
 * facets the product declares, are to this extractor attributes like any other
 * (RN-DSC-019, RN-DSC-020).
 *
 * Free text is discarded. An attribute that reveals itself as free text
 * through use is dropped by the cardinality ceiling (RN-DSC-024), which is why
 * `title` and `source` never become statistics without anyone maintaining an
 * exclusion list.
 */

export type FacetKind = 'date' | 'boolean' | 'enum' | 'list';

export interface FacetValue {
  readonly facet: string;
  readonly kind: FacetKind;
  /** One value for a scalar; several for a list, as `tags` usually is. */
  readonly values: string[];
}

export type FacetSnapshot = Record<string, FacetValue>;

/** Above this many characters a value is prose, not a category. */
const MAX_ENUM_LENGTH = 40;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?/;

export function extractFrontmatter(markdown: string): string | null {
  if (!markdown.startsWith('---')) return null;
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  return match?.[1] ?? null;
}

/**
 * A deliberately small YAML reader: scalars, inline lists and dash lists, and
 * nothing else. Anything more would be interpreting the vault, which is not
 * the backend's business.
 */
function parseFrontmatter(block: string): Record<string, string[]> {
  const entries: Record<string, string[]> = {};
  const lines = block.split(/\r?\n/);
  let currentKey: string | null = null;

  for (const line of lines) {
    if (/^\s*#/.test(line) || line.trim().length === 0) continue;

    const listItem = /^\s*-\s+(.*)$/.exec(line);
    if (listItem && currentKey) {
      entries[currentKey] = [...(entries[currentKey] ?? []), unquote(listItem[1] ?? '')];
      continue;
    }

    const pair = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (!pair) continue;
    const key = (pair[1] ?? '').trim();
    const raw = (pair[2] ?? '').trim();
    currentKey = key;

    if (raw.length === 0) {
      entries[key] = [];
    } else if (raw.startsWith('[') && raw.endsWith(']')) {
      entries[key] = raw
        .slice(1, -1)
        .split(',')
        .map((each) => unquote(each.trim()))
        .filter((each) => each.length > 0);
    } else {
      entries[key] = [unquote(raw)];
    }
  }
  return entries;
}

function unquote(value: string): string {
  return value.replace(/^["']|["']$/g, '').trim();
}

function kindOf(values: string[]): FacetKind | null {
  if (values.length === 0) return null;
  if (values.length > 1) {
    return values.every((value) => value.length <= MAX_ENUM_LENGTH) ? 'list' : null;
  }
  const [value] = values as [string];
  if (value.length === 0) return null;
  if (/^(true|false|yes|no)$/i.test(value)) return 'boolean';
  if (ISO_DATE.test(value)) return 'date';
  // A short value is enumerable; a long one is prose and is discarded.
  return value.length <= MAX_ENUM_LENGTH ? 'enum' : null;
}

function canonical(kind: FacetKind, value: string): string {
  if (kind === 'boolean') return /^(true|yes)$/i.test(value) ? 'true' : 'false';
  if (kind === 'date') return (ISO_DATE.exec(value)?.[0] ?? value).slice(0, 10);
  return value;
}

/** The portrait of one note: what it says about itself, in aggregable form. */
export function extractFacets(markdown: string): FacetSnapshot {
  const block = extractFrontmatter(markdown);
  if (!block) return {};

  const snapshot: FacetSnapshot = {};
  for (const [facet, values] of Object.entries(parseFrontmatter(block))) {
    const kind = kindOf(values);
    if (!kind) continue; // free text and empties are described, not counted
    snapshot[facet] = {
      facet,
      kind,
      values: values.map((value) => canonical(kind, value)),
    };
  }
  return snapshot;
}

/**
 * The delta between the previous portrait and the new one. The old value is
 * NOT in the event, which is exactly why the portrait per note exists
 * (section 11.3): update and deletion have to decrement what was there.
 */
export function facetDelta(
  before: FacetSnapshot | null,
  after: FacetSnapshot | null,
): Array<{ facet: string; value: string; delta: number; kind: FacetKind }> {
  const changes = new Map<
    string,
    { facet: string; value: string; delta: number; kind: FacetKind }
  >();

  const apply = (snapshot: FacetSnapshot | null, sign: number): void => {
    for (const entry of Object.values(snapshot ?? {})) {
      for (const value of entry.values) {
        const key = `${entry.facet}#${value}`;
        const current = changes.get(key);
        changes.set(key, {
          facet: entry.facet,
          value,
          kind: entry.kind,
          delta: (current?.delta ?? 0) + sign,
        });
      }
    }
  };

  apply(before, -1);
  apply(after, 1);
  return [...changes.values()].filter((change) => change.delta !== 0);
}
