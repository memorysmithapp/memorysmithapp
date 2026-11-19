import type { GraphActivityDto } from '../../shared/api/backend';

/**
 * What an agent's activity draws on the notebook's graph (#495), kept apart
 * from the page so each rule is read, and tested, without a canvas.
 *
 * The form says what happened, the colour says who: a read is one thin
 * outline opening from a note, a write a double outline pulsing on it with
 * strokes running along its links. Nothing is ever filled, so no mark of an
 * assistant reads as a node, least of all as an attribute's disc.
 */

/** The attribute colours of the graph, which the assistants share (#495). */
export const PALETTE_SLOTS = [0, 1, 2] as const;

/** An assistant: the connector and the person it acts for. */
export interface Assistant {
  readonly key: string;
  readonly name: string;
  readonly slot: number;
}

/** A mark on the drawing, on one node, from `start` for `duration` milliseconds. */
export interface Mark {
  readonly kind: 'read' | 'write';
  readonly nodeId: string;
  readonly slot: number;
  start: number;
  readonly duration: number;
  /** A change of the frontmatter written under the note, "status: aberta → concluída". */
  readonly caption?: string;
}

/** What one entry asks of the drawing, the notice and the log. */
export interface Plan {
  readonly kind: 'read' | 'write';
  /** Notes lit, in order: one, a folder's, a search's, or every note in a wave. */
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
  | { readonly kind: 'table' }
  | { readonly kind: 'dashboard' }
  | { readonly kind: 'file' }
  | { readonly kind: 'notebook' };

/** What the graph knows to place an entry: its notes, their folders and what each declares. */
export interface GraphContext {
  readonly notes: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly folderId: string;
    readonly facets: Readonly<Record<string, readonly string[]>>;
  }>;
  readonly folderName: (folderId: string) => string | null;
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
  const one = (id: string | undefined): Plan => ({
    kind,
    notes: id && byId.has(id) ? [id] : [],
    values: [],
    target:
      id && byId.has(id)
        ? { kind: 'note', name: byId.get(id)?.name ?? null }
        : tool === 'create_note'
          ? { kind: 'newNote' }
          : { kind: 'note', name: null },
    wave: false,
  });

  if (entry.noteId && (kind === 'write' || READS_A_NOTE.has(tool))) return one(entry.noteId);
  if (entry.folderId && READS_A_FOLDER.has(tool)) {
    return {
      kind,
      notes: graph.notes.filter((note) => note.folderId === entry.folderId).map((note) => note.id),
      values: [],
      target: { kind: 'folder', name: graph.folderName(entry.folderId) ?? '' },
      wave: false,
    };
  }
  if (tool === 'search_notes' && entry.query) {
    const terms = attributeTerms(entry.query);
    if (terms.length > 0) {
      const carries = (note: GraphContext['notes'][number]) =>
        terms.every((term) =>
          (note.facets[term.facet] ?? []).some(
            (value) =>
              value.normalize('NFC').toLowerCase() === term.value.normalize('NFC').toLowerCase(),
          ),
        );
      return {
        kind,
        notes: graph.notes.filter(carries).map((note) => note.id),
        values: terms.map((term) => `${term.facet}:${term.value}`),
        target: { kind: 'search', query: entry.query },
        wave: false,
      };
    }
    return {
      kind,
      notes: graph.notes.map((note) => note.id),
      values: [],
      target: { kind: 'search', query: entry.query },
      wave: true,
    };
  }
  if (READS_THE_NOTEBOOK.has(tool)) {
    return {
      kind,
      notes: graph.notes.map((note) => note.id),
      values: [],
      target: { kind: 'context' },
      wave: true,
    };
  }
  // Tables, dashboards and files are not nodes: the log alone says them.
  const target: Target = /table|rows/.test(tool)
    ? { kind: 'table' }
    : /dashboard/.test(tool)
      ? { kind: 'dashboard' }
      : /file|upload/.test(tool)
        ? { kind: 'file' }
        : entry.noteId
          ? one(entry.noteId).target
          : { kind: 'notebook' };
  return { kind, notes: [], values: [], target, wave: false };
}

/**
 * The colour an assistant takes (#495): one of the attribute colours that no
 * switched-on attribute and no other active assistant holds, the first free;
 * with none free, one of them at random, the same as some attribute's. The
 * note blue, always drawn, is never an assistant's.
 */
export function slotFor(taken: Iterable<number>, random: () => number = Math.random): number {
  const used = new Set(taken);
  const free = PALETTE_SLOTS.find((slot) => !used.has(slot));
  if (free !== undefined) return free;
  return PALETTE_SLOTS[Math.floor(random() * PALETTE_SLOTS.length)] ?? 0;
}

/** Who an entry is, as the notice and the log name it: "Claude · Heitor". */
export function assistantOf(entry: GraphActivityDto): { key: string; name: string } | null {
  if (!entry.who) return null;
  const { userId, client, person } = entry.who;
  return { key: `${userId}|${client}`, name: person ? `${client} · ${person}` : client };
}

/**
 * The change a projection says a write made to the frontmatter, one line per
 * property: "status: aberta → concluída", "tags: + urgente", "prazo: − 2026-11".
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
  const lines = [...by].map(([facet, { from, to }]) =>
    from.length && to.length
      ? `${facet}: ${from.join(', ')} → ${to.join(', ')}`
      : to.length
        ? `${facet}: + ${to.join(', ')}`
        : `${facet}: − ${from.join(', ')}`,
  );
  return lines.length > 0 ? lines.join(' · ') : undefined;
}
