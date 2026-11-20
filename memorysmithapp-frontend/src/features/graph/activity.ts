import type { GraphActivityDto } from '../../shared/api/backend';

/**
 * What an agent's activity draws on the notebook's graph (#495), kept apart
 * from the page so each rule is read, and tested, without a canvas.
 *
 * The form says what happened: a read is one thin outline opening from a node,
 * a write a double outline pulsing on it with strokes running along its links.
 * Every mark is orange, whoever the assistant (#502); the notice alone says
 * who. Nothing is ever filled, so no mark of an assistant reads as a node.
 */

/** An assistant: the connector and the person it acts for. */
export interface Assistant {
  readonly key: string;
  readonly name: string;
}

/** A mark on the drawing, on one node, from `start` for `duration` milliseconds. */
export interface Mark {
  readonly kind: 'read' | 'write';
  readonly nodeId: string;
  start: number;
  readonly duration: number;
  /** A change of the frontmatter written under the note, one line per property (#501). */
  readonly caption?: string;
}

/** What one entry asks of the drawing and the notice. */
export interface Plan {
  readonly kind: 'read' | 'write';
  /** Nodes lit, in order: notes, a folder, a table, a dashboard, a file. */
  readonly notes: readonly string[];
  /** Value nodes lit too, as `attribute:value`, when the attribute is on. */
  readonly values: readonly string[];
  /** How the entry is said: a note, a folder, a search, the context. */
  readonly target: Target;
  /** Whether the notes light one after the other, from the centre out. */
  readonly wave: boolean;
}

export type Target =
  | { readonly kind: 'note'; readonly name: string | null }
  | { readonly kind: 'newNote' }
  | { readonly kind: 'folder'; readonly name: string }
  | { readonly kind: 'search'; readonly query: string }
  | { readonly kind: 'context' }
  | { readonly kind: 'table'; readonly name?: string }
  | { readonly kind: 'dashboard'; readonly name?: string }
  | { readonly kind: 'file'; readonly name?: string }
  | { readonly kind: 'notebook' };

/** The kinds of node that are not notes nor attribute values (#502). */
export type ResourceKind = 'folder' | 'file' | 'table' | 'dashboard';

/**
 * The identifier a resource is drawn under. A value node is `attribute:value`
 * and an attribute's name never holds a `/`, so the two never meet.
 */
export function resourceNodeId(kind: ResourceKind, id: string): string {
  return `${kind}/${id}`;
}

/** What the graph knows to place an entry: its notes, their folders, what each declares, and the rest the notebook keeps. */
export interface GraphContext {
  readonly notes: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly folderId: string;
    readonly facets: Readonly<Record<string, readonly string[]>>;
  }>;
  readonly folderName: (folderId: string) => string | null;
  readonly tables?: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly dashboards?: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    /** The identifiers of the tables its components draw from. */
    readonly tables: readonly string[];
  }>;
  readonly files?: ReadonlyArray<{ readonly id: string; readonly name: string }>;
}

const READS_A_NOTE = new Set([
  'read_note',
  'note_history',
  'backlinks',
  'related_notes',
  'preview_note',
  'get_preview',
]);
const READS_A_FOLDER = new Set(['list_notes', 'get_template']);
const READS_THE_NOTEBOOK = new Set([
  'get_notebook_context',
  'get_guidance',
  'check_notebook',
  'search_notes',
]);

/** A name compared as the product compares names: NFC, case folded. */
const folded = (value: string) => value.normalize('NFC').toLowerCase();

/** The one of `items` an argument names, by identifier or by name. */
function named<T extends { readonly id: string; readonly name: string }>(
  items: readonly T[] | undefined,
  given: string | undefined,
): T | undefined {
  if (!given || !items) return undefined;
  const upper = given.toUpperCase();
  return (
    items.find((item) => item.id.toUpperCase() === upper) ??
    items.find((item) => folded(item.name) === folded(given))
  );
}

/**
 * The attribute terms of a search, `status:aberta` or `tags:"em dia"`, as the
 * query reader of search writes them; the words around them are text.
 */
export function attributeTerms(query: string): Array<{ facet: string; value: string }> {
  const terms: Array<{ facet: string; value: string }> = [];
  for (const match of query.matchAll(/(?:^|\s)-?([\p{L}\p{N}_-]+):(?:"([^"]+)"|(\S+))/gu)) {
    if (match[0].trimStart().startsWith('-')) continue;
    const facet = match[1] ?? '';
    const value = match[2] ?? match[3] ?? '';
    if (facet && value) terms.push({ facet, value });
  }
  return terms;
}

/** What an entry of a read or a write lights, and how it is said; null for nothing to say. */
export function planOf(entry: GraphActivityDto, graph: GraphContext): Plan | null {
  if (entry.kind === 'projected' || !entry.tool) return null;
  const tool = entry.tool;
  const kind = entry.kind;
  const byId = new Map(graph.notes.map((note) => [note.id, note]));
  const plan = (notes: readonly string[], target: Target, wave = false): Plan => ({
    kind,
    notes,
    values: [],
    target,
    wave,
  });
  const one = (id: string | undefined): Plan =>
    plan(
      id && byId.has(id) ? [id] : [],
      id && byId.has(id)
        ? { kind: 'note', name: byId.get(id)?.name ?? null }
        : tool === 'create_note'
          ? { kind: 'newNote' }
          : { kind: 'note', name: null },
    );

  if (entry.noteId && (kind === 'write' || READS_A_NOTE.has(tool))) return one(entry.noteId);
  if (entry.folderId && READS_A_FOLDER.has(tool)) {
    // The folder itself lights first, then its notes (#502).
    return plan(
      [
        resourceNodeId('folder', entry.folderId),
        ...graph.notes.filter((note) => note.folderId === entry.folderId).map((note) => note.id),
      ],
      { kind: 'folder', name: graph.folderName(entry.folderId) ?? '' },
    );
  }
  if (tool === 'search_notes' && entry.query) {
    const terms = attributeTerms(entry.query);
    if (terms.length > 0) {
      const carries = (note: GraphContext['notes'][number]) =>
        terms.every((term) =>
          (note.facets[term.facet] ?? []).some((value) => folded(value) === folded(term.value)),
        );
      return {
        kind,
        notes: graph.notes.filter(carries).map((note) => note.id),
        values: terms.map((term) => `${term.facet}:${term.value}`),
        target: { kind: 'search', query: entry.query },
        wave: false,
      };
    }
    return plan(
      graph.notes.map((note) => note.id),
      { kind: 'search', query: entry.query },
      true,
    );
  }
  if (READS_THE_NOTEBOOK.has(tool)) {
    return plan(
      graph.notes.map((note) => note.id),
      { kind: 'context' },
      true,
    );
  }

  // A dashboard, then the tables it draws from: reading one reads them.
  if (/dashboard/.test(tool)) {
    const dashboard = named(graph.dashboards, entry.dashboard);
    if (dashboard) {
      return plan(
        [
          resourceNodeId('dashboard', dashboard.id),
          ...(kind === 'read' ? dashboard.tables.map((id) => resourceNodeId('table', id)) : []),
        ],
        { kind: 'dashboard', name: dashboard.name },
      );
    }
    return plan(
      tool === 'list_dashboards'
        ? (graph.dashboards ?? []).map((each) => resourceNodeId('dashboard', each.id))
        : [],
      { kind: 'dashboard' },
    );
  }
  if (/table|rows/.test(tool)) {
    const table = named(graph.tables, entry.table);
    if (table)
      return plan([resourceNodeId('table', table.id)], { kind: 'table', name: table.name });
    return plan(
      tool === 'list_tables'
        ? (graph.tables ?? []).map((each) => resourceNodeId('table', each.id))
        : [],
      { kind: 'table' },
    );
  }
  if (/file|upload/.test(tool)) {
    const file = named(graph.files, entry.fileId);
    if (file) return plan([resourceNodeId('file', file.id)], { kind: 'file', name: file.name });
    return plan(
      tool === 'list_files'
        ? (graph.files ?? []).map((each) => resourceNodeId('file', each.id))
        : [],
      { kind: 'file' },
    );
  }
  return plan([], entry.noteId ? one(entry.noteId).target : { kind: 'notebook' });
}

/** Who an entry is, as the notice names it: "Claude · Heitor". */
export function assistantOf(entry: GraphActivityDto): { key: string; name: string } | null {
  if (!entry.who) return null;
  const { userId, client, person } = entry.who;
  return { key: `${userId}|${client}`, name: person ? `${client} · ${person}` : client };
}

/** How many properties a caption says, and how many values of each, before `+N` (#501). */
const CAPTION_PROPERTIES = 2;
const CAPTION_VALUES = 3;
/** How many characters a line of a caption holds before it ends in `…` (#501). */
export const CAPTION_WIDTH = 32;

function bounded(line: string): string {
  const chars = [...line];
  return chars.length <= CAPTION_WIDTH ? line : `${chars.slice(0, CAPTION_WIDTH - 1).join('')}…`;
}

function valuesOf(values: readonly string[]): string {
  const said = values.slice(0, CAPTION_VALUES).join(', ');
  return values.length > CAPTION_VALUES ? `${said} +${values.length - CAPTION_VALUES}` : said;
}

/**
 * The change a projection says a write made to the frontmatter, one line per
 * property: "status: aberta → concluída", "tags: + urgente", "prazo: − 2026-11".
 * It says two properties at most, then `+N`, three values of a property at
 * most, then `+N`, and a line too wide ends in `…` (#501): a caption wider
 * than the drawing around it is no longer read.
 */
export function captionOf(entry: GraphActivityDto): string | undefined {
  const by = new Map<string, { from: string[]; to: string[] }>();
  for (const { facet, value } of entry.removed ?? []) {
    const change = by.get(facet) ?? { from: [], to: [] };
    change.from.push(value);
    by.set(facet, change);
  }
  for (const { facet, value } of entry.added ?? []) {
    const change = by.get(facet) ?? { from: [], to: [] };
    change.to.push(value);
    by.set(facet, change);
  }
  const changes = [...by];
  const lines = changes
    .slice(0, CAPTION_PROPERTIES)
    .map(([facet, { from, to }]) =>
      bounded(
        from.length && to.length
          ? `${facet}: ${valuesOf(from)} → ${valuesOf(to)}`
          : to.length
            ? `${facet}: + ${valuesOf(to)}`
            : `${facet}: − ${valuesOf(from)}`,
      ),
    );
  if (changes.length > CAPTION_PROPERTIES) lines.push(`+${changes.length - CAPTION_PROPERTIES}`);
  return lines.length > 0 ? lines.join('\n') : undefined;
}
