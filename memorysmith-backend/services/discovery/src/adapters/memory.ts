/**
 * In-memory adapters of the projections. They are the reference implementation
 * of the behaviour the DynamoDB ones must match, and they are what the tests
 * of the rules run against.
 */

import {
  GRAPH_LIMITS,
  type PendingLink,
  type ProjectedNote,
  type ProjectedVersions,
  type FacetIndex,
  type FacetStats,
  type GraphNode,
  type LinkGraph,
  type LinkTarget,
  type ContentIndex,
  type IndexedNote,
  type NoteCatalog,
  type NoteRef,
  type ResolvedTarget,
  type NotebookGraph,
  type OutgoingTarget,
} from '../domain/ports.js';
import type { FacetSnapshot } from '../domain/FacetExtractor.js';
import { resolveTarget, notebookNames, type NotebookNames } from '../domain/LinkResolver.js';
import { facetDelta, valuesOf } from '../domain/FacetExtractor.js';
import type { StructureProjection, NotebookStructure } from '../application/projections.js';

/** The versions last projected, in memory, with the same conditional claim. */
export class InMemoryProjectedVersions implements ProjectedVersions {
  private readonly notes = new Map<string, ProjectedNote>();

  async claim(noteId: string, state: ProjectedNote): Promise<boolean> {
    const recorded = this.notes.get(noteId);
    if (recorded && recorded.version >= state.version) return false;
    this.notes.set(noteId, state);
    return true;
  }

  async current(noteId: string): Promise<ProjectedNote | null> {
    return this.notes.get(noteId) ?? null;
  }
}

interface Edge {
  readonly fromNoteId: string;
  readonly toNoteId: string;
}

interface Pending {
  readonly fromNoteId: string;
  readonly name: string;
}

/**
 * The reference implementation keeps what each note POINTS AT, and derives the
 * edges from the notebook as it stands.
 *
 * That is the shape resolution has since 0.6.0. It stopped being monotonic:
 * an edge that exists by alias disappears the day somebody writes a note
 * carrying that name (RN-DSC-053), in a note nobody touched. Materialising
 * the edges and patching them on every write means an invalidation path per
 * kind of change and a way to get each one wrong; deriving them means the
 * graph is always exactly what the notebook says, and the cost is a walk over
 * notes this adapter already holds in a Map.
 *
 * The DynamoDB adapter cannot do this — it may not read a notebook to answer one
 * backlink — so it materialises, and it is this class it has to agree with.
 */
export class InMemoryLinkGraph implements LinkGraph {
  private readonly notes = new Map<string, Map<string, NoteRef>>();
  private readonly outgoing = new Map<string, Map<string, LinkTarget[]>>();

  private notebook(notebookId: string): {
    notes: Map<string, NoteRef>;
    outgoing: Map<string, LinkTarget[]>;
  } {
    if (!this.notes.has(notebookId)) this.notes.set(notebookId, new Map());
    if (!this.outgoing.has(notebookId)) this.outgoing.set(notebookId, new Map());
    return {
      notes: this.notes.get(notebookId) as Map<string, NoteRef>,
      outgoing: this.outgoing.get(notebookId) as Map<string, LinkTarget[]>,
    };
  }

  /** What the notebook answers to right now: its names and then its aliases. */
  private names(notebookId: string): NotebookNames {
    return notebookNames([...this.notebook(notebookId).notes.values()]);
  }

  /** Every edge of the notebook, resolved against the notebook as it stands. */
  private resolved(notebookId: string): { edges: Edge[]; pending: Pending[] } {
    const state = this.notebook(notebookId);
    const names = this.names(notebookId);
    const edges: Edge[] = [];
    const pending: Pending[] = [];

    for (const [fromNoteId, links] of state.outgoing) {
      if (!state.notes.has(fromNoteId)) continue;
      for (const link of links) {
        const answer = resolveTarget(link.name, names);
        if (answer.kind === 'note') {
          // Every note whose name matches becomes an edge (RN-DSC-042): two
          // notes with one name are two edges, never the first one.
          for (const toNoteId of answer.noteIds) {
            if (toNoteId !== fromNoteId) edges.push({ fromNoteId, toNoteId });
          }
        } else if (answer.kind === 'pending') {
          // Not discarded: a link whose target does not exist YET is pending,
          // and it resolves on its own later (RN-DSC-004).
          pending.push({ fromNoteId, name: link.name });
        }
        // An attachment renders and is never an edge (RN-DSC-044).
      }
    }
    return { edges, pending };
  }

  async replaceOutgoing(notebookId: string, note: NoteRef, links: LinkTarget[]): Promise<void> {
    const state = this.notebook(notebookId);
    state.notes.set(note.noteId, note);
    state.outgoing.set(note.noteId, [...links]);
  }

  async removeNote(notebookId: string, noteId: string): Promise<void> {
    const state = this.notebook(notebookId);
    state.notes.delete(noteId);
    state.outgoing.delete(noteId);
    // Nothing else to undo: the backlinks that pointed here are re-resolved
    // against a notebook that no longer carries this name, so they become
    // pending — or land on the alias that was waiting behind it (RN-DSC-005,
    // RN-DSC-053).
  }

  async removeNotebook(notebookId: string): Promise<void> {
    this.notes.delete(notebookId);
    this.outgoing.delete(notebookId);
  }

  async resolvePending(notebookId: string, note: NoteRef): Promise<number> {
    const before = this.resolved(notebookId).pending.length;
    this.notebook(notebookId).notes.set(note.noteId, note);
    return Math.max(0, before - this.resolved(notebookId).pending.length);
  }

  async outgoingOf(notebookId: string, noteId: string): Promise<OutgoingTarget[]> {
    const state = this.notebook(notebookId);
    if (!state.notes.has(noteId)) return [];
    const names = this.names(notebookId);
    const seen = new Set<string>();
    const targets: OutgoingTarget[] = [];
    for (const link of state.outgoing.get(noteId) ?? []) {
      if (seen.has(link.name)) continue;
      seen.add(link.name);
      const answer = resolveTarget(link.name, names);
      if (answer.kind === 'attachment') continue;
      targets.push({
        target: link.name,
        by: answer.kind === 'note' ? answer.by : null,
        notes: answer.noteIds
          .filter((id) => id !== noteId)
          .map((id) => state.notes.get(id))
          .filter((note): note is NoteRef => note !== undefined),
      });
    }
    return targets;
  }

  async resolveTarget(notebookId: string, target: string): Promise<ResolvedTarget> {
    const state = this.notebook(notebookId);
    const answer = resolveTarget(target, this.names(notebookId));
    return {
      target: answer.target,
      kind: answer.kind,
      by: answer.by,
      notes: answer.noteIds
        .map((noteId) => state.notes.get(noteId))
        .filter((note): note is NoteRef => note !== undefined),
    };
  }

  async dependencyTree(
    notebookId: string,
    rootNoteId: string,
    depth: number,
  ): Promise<GraphNode | null> {
    const state = this.notebook(notebookId);
    const root = state.notes.get(rootNoteId);
    if (!root) return null;

    const seen = new Set<string>([rootNoteId]);
    let budget = GRAPH_LIMITS.maxNodes;

    const edges = this.resolved(notebookId).edges;
    const walk = (note: NoteRef, level: number): GraphNode => {
      if (level >= depth || budget <= 0) return { note, depth: level, children: [] };
      const children: GraphNode[] = [];
      for (const edge of edges.filter((each) => each.fromNoteId === note.noteId)) {
        if (seen.has(edge.toNoteId) || budget <= 0) continue;
        const target = state.notes.get(edge.toNoteId);
        if (!target) continue;
        seen.add(edge.toNoteId);
        budget -= 1;
        children.push(walk(target, level + 1));
      }
      return { note, depth: level, children };
    };

    return walk(root, 0);
  }

  async backlinks(notebookId: string, noteId: string): Promise<NoteRef[]> {
    const state = this.notebook(notebookId);
    const seen = new Set<string>();
    return this.resolved(notebookId)
      .edges.filter((edge) => edge.toNoteId === noteId)
      .map((edge) => state.notes.get(edge.fromNoteId))
      .filter((note): note is NoteRef => note !== undefined)
      .filter((note) => (seen.has(note.noteId) ? false : seen.add(note.noteId) !== undefined));
  }

  async pending(notebookId: string): Promise<PendingLink[]> {
    const state = this.notebook(notebookId);
    return this.resolved(notebookId)
      .pending.map((each) => {
        const from = state.notes.get(each.fromNoteId);
        return from ? { fromNote: from, targetName: each.name } : null;
      })
      .filter((link): link is PendingLink => link !== null);
  }

  async orphans(notebookId: string, allNotes: NoteRef[]): Promise<NoteRef[]> {
    const linked = new Set(
      this.resolved(notebookId).edges.flatMap((edge) => [edge.fromNoteId, edge.toNoteId]),
    );
    return allNotes.filter((note) => !linked.has(note.noteId));
  }

  async wholeGraph(notebookId: string): Promise<NotebookGraph> {
    const state = this.notebook(notebookId);
    const resolved = this.resolved(notebookId);
    const all = [...state.notes.values()];
    const truncated = all.length > GRAPH_LIMITS.maxNotebookNodes;
    const nodes = truncated ? all.slice(0, GRAPH_LIMITS.maxNotebookNodes) : all;
    const indexOf = new Map(nodes.map((note, index) => [note.noteId, index]));

    const edges: Array<[number, number]> = [];
    for (const edge of resolved.edges) {
      const from = indexOf.get(edge.fromNoteId);
      const to = indexOf.get(edge.toNoteId);
      if (from !== undefined && to !== undefined) edges.push([from, to]);
    }

    const pending: Array<{ from: number; targetName: string }> = [];
    for (const link of resolved.pending) {
      const from = indexOf.get(link.fromNoteId);
      if (from !== undefined) pending.push({ from, targetName: link.name });
    }

    return { nodes, edges, pending, truncated };
  }
}

/** The cardinality ceiling that detects free text (RN-DSC-024). */
const MAX_DISTINCT_VALUES = 40;

export class InMemoryFacetIndex implements FacetIndex {
  private readonly portraits = new Map<string, Map<string, FacetSnapshot>>();
  private readonly counters = new Map<string, Map<string, number>>();
  private readonly kinds = new Map<string, Map<string, string>>();
  private readonly discarded = new Map<string, Set<string>>();

  private notebook(notebookId: string): void {
    if (!this.portraits.has(notebookId)) this.portraits.set(notebookId, new Map());
    if (!this.counters.has(notebookId)) this.counters.set(notebookId, new Map());
    if (!this.kinds.has(notebookId)) this.kinds.set(notebookId, new Map());
    if (!this.discarded.has(notebookId)) this.discarded.set(notebookId, new Set());
  }

  async replaceFacets(
    notebookId: string,
    noteId: string,
    facets: FacetSnapshot | null,
  ): Promise<void> {
    this.notebook(notebookId);
    const portraits = this.portraits.get(notebookId) as Map<string, FacetSnapshot>;
    const counters = this.counters.get(notebookId) as Map<string, number>;
    const kinds = this.kinds.get(notebookId) as Map<string, string>;
    const discarded = this.discarded.get(notebookId) as Set<string>;

    // The old value is not in the event: it is in the portrait, which is why
    // the portrait per note exists (section 11.3).
    const before = portraits.get(noteId) ?? null;
    for (const change of facetDelta(before, facets)) {
      if (discarded.has(change.facet)) continue;
      const key = `${change.facet}#${change.value}`;
      const next = (counters.get(key) ?? 0) + change.delta;
      if (next <= 0) counters.delete(key);
      else counters.set(key, next);
      kinds.set(change.facet, change.kind);

      const distinct = [...counters.keys()].filter((each) =>
        each.startsWith(`${change.facet}#`),
      ).length;
      if (distinct > MAX_DISTINCT_VALUES) {
        // An attribute whose value is unique per note denounces itself by
        // cardinality: no exclusion list is maintained anywhere.
        discarded.add(change.facet);
        for (const each of [...counters.keys()]) {
          if (each.startsWith(`${change.facet}#`)) counters.delete(each);
        }
      }
    }

    if (facets === null) portraits.delete(noteId);
    else portraits.set(noteId, facets);
  }

  async notebookNoteFacets(notebookId: string): Promise<Map<string, Record<string, string[]>>> {
    this.notebook(notebookId);
    const portraits = this.portraits.get(notebookId) as Map<string, FacetSnapshot>;
    return new Map([...portraits].map(([noteId, snapshot]) => [noteId, valuesOf(snapshot)]));
  }

  async removeNotebook(notebookId: string): Promise<void> {
    this.portraits.delete(notebookId);
    this.counters.delete(notebookId);
    this.kinds.delete(notebookId);
    this.discarded.delete(notebookId);
  }

  async notebookFacetStats(notebookId: string): Promise<FacetStats> {
    this.notebook(notebookId);
    const counters = this.counters.get(notebookId) as Map<string, number>;
    const kinds = this.kinds.get(notebookId) as Map<string, string>;
    const discarded = this.discarded.get(notebookId) as Set<string>;

    const grouped = new Map<string, Array<{ value: string; count: number }>>();
    for (const [key, count] of counters) {
      const [facet, ...rest] = key.split('#');
      if (!facet) continue;
      const values = grouped.get(facet) ?? [];
      values.push({ value: rest.join('#'), count });
      grouped.set(facet, values);
    }

    return {
      noteCount: (this.portraits.get(notebookId) as Map<string, FacetSnapshot>).size,
      facets: [
        ...[...grouped.entries()].map(([facet, values]) => ({
          facet,
          kind: (kinds.get(facet) ?? 'enum') as FacetStats['facets'][number]['kind'],
          values: values.sort((left, right) => right.count - left.count),
          discarded: false,
        })),
        ...[...discarded].map((facet) => ({
          facet,
          kind: (kinds.get(facet) ?? 'enum') as FacetStats['facets'][number]['kind'],
          values: [],
          discarded: true,
        })),
      ],
    };
  }
}

export class InMemoryStructureProjection implements StructureProjection {
  private readonly notebooks = new Map<string, NotebookStructure>();

  async get(notebookId: string): Promise<NotebookStructure | null> {
    return this.notebooks.get(notebookId) ?? null;
  }

  async upsertNotebook(notebookId: string, name: string): Promise<void> {
    const current = this.notebooks.get(notebookId);
    this.notebooks.set(notebookId, {
      notebookId,
      notebookName: name,
      folders: current?.folders ?? new Map(),
    });
  }

  async upsertFolder(
    notebookId: string,
    folder: { folderId: string; name: string; description: string; parentFolderId: string | null },
  ): Promise<void> {
    await this.upsertNotebook(notebookId, this.notebooks.get(notebookId)?.notebookName ?? '');
    this.notebooks.get(notebookId)?.folders.set(folder.folderId, {
      name: folder.name,
      description: folder.description,
      parentFolderId: folder.parentFolderId,
    });
  }

  async removeFolders(notebookId: string, folderIds: string[]): Promise<void> {
    for (const folderId of folderIds) this.notebooks.get(notebookId)?.folders.delete(folderId);
  }

  async removeNotebook(notebookId: string): Promise<void> {
    this.notebooks.delete(notebookId);
  }
}

/** The note catalogue the health and lexical search read from. */
export class InMemoryNoteCatalog implements NoteCatalog {
  private readonly byNotebook = new Map<string, Array<NoteRef & { folderName: string }>>();

  set(notebookId: string, notes: Array<NoteRef & { folderName: string }>): void {
    this.byNotebook.set(notebookId, notes);
  }

  async listNotes(notebookId: string): Promise<Array<NoteRef & { folderName: string }>> {
    return this.byNotebook.get(notebookId) ?? [];
  }
}

/**
 * The content index in memory. The DynamoDB adapter answers the same port by
 * walking every page of a Query; here the whole notebook is already one array,
 * which is exactly the behaviour the paged version has to reproduce.
 */
export class InMemoryContentIndex implements ContentIndex {
  private readonly byNotebook = new Map<string, Map<string, IndexedNote>>();

  async replaceNote(notebookId: string, note: IndexedNote): Promise<void> {
    const notebook = this.byNotebook.get(notebookId) ?? new Map<string, IndexedNote>();
    notebook.set(note.noteId, note);
    this.byNotebook.set(notebookId, notebook);
  }

  async removeNote(notebookId: string, noteId: string): Promise<void> {
    this.byNotebook.get(notebookId)?.delete(noteId);
  }

  async removeNotebook(notebookId: string): Promise<void> {
    this.byNotebook.delete(notebookId);
  }

  async scanNotebook(notebookId: string): Promise<IndexedNote[]> {
    return [...(this.byNotebook.get(notebookId)?.values() ?? [])];
  }
}
