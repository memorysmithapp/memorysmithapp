/**
 * In-memory adapters of the projections. They are the reference implementation
 * of the behaviour the DynamoDB ones must match, and they are what the tests
 * of the rules run against.
 */

import {
  GRAPH_LIMITS,
  type BrokenLink,
  type FacetIndex,
  type FacetStats,
  type GraphNode,
  type LinkGraph,
  type LinkTarget,
  type ContentIndex,
  type IndexedNote,
  type NoteCatalog,
  type NoteRef,
  type VaultGraph,
} from '../domain/ports.js';
import type { FacetSnapshot } from '../domain/FacetExtractor.js';
import { facetDelta } from '../domain/FacetExtractor.js';
import type { StructureProjection, VaultStructure } from '../application/projections.js';

interface Edge {
  readonly fromNoteId: string;
  readonly toNoteId: string;
}

interface Pending {
  readonly fromNoteId: string;
  readonly slug: string;
}

export class InMemoryLinkGraph implements LinkGraph {
  private readonly notes = new Map<string, Map<string, NoteRef>>();
  private readonly edges = new Map<string, Edge[]>();
  private readonly pending = new Map<string, Pending[]>();

  private vault(vaultId: string): {
    notes: Map<string, NoteRef>;
    edges: Edge[];
    pending: Pending[];
  } {
    if (!this.notes.has(vaultId)) this.notes.set(vaultId, new Map());
    if (!this.edges.has(vaultId)) this.edges.set(vaultId, []);
    if (!this.pending.has(vaultId)) this.pending.set(vaultId, []);
    return {
      notes: this.notes.get(vaultId) as Map<string, NoteRef>,
      edges: this.edges.get(vaultId) as Edge[],
      pending: this.pending.get(vaultId) as Pending[],
    };
  }

  async replaceOutgoing(vaultId: string, note: NoteRef, links: LinkTarget[]): Promise<void> {
    const state = this.vault(vaultId);
    state.notes.set(note.noteId, note);

    this.edges.set(
      vaultId,
      state.edges.filter((edge) => edge.fromNoteId !== note.noteId),
    );
    this.pending.set(
      vaultId,
      state.pending.filter((each) => each.fromNoteId !== note.noteId),
    );

    const bySlug = new Map([...state.notes.values()].map((each) => [each.slug, each]));
    for (const link of links) {
      const target = bySlug.get(link.slug);
      if (target && target.noteId !== note.noteId) {
        (this.edges.get(vaultId) as Edge[]).push({
          fromNoteId: note.noteId,
          toNoteId: target.noteId,
        });
      } else if (!target) {
        // Not discarded: a link whose target does not exist YET is pending,
        // and it resolves on its own later (RN-DSC-004).
        (this.pending.get(vaultId) as Pending[]).push({ fromNoteId: note.noteId, slug: link.slug });
      }
    }
  }

  async removeNote(vaultId: string, noteId: string): Promise<void> {
    const state = this.vault(vaultId);
    const note = state.notes.get(noteId);
    state.notes.delete(noteId);

    // Backlinks that pointed at it go back to pending (RN-DSC-005).
    const orphanedBacklinks = state.edges.filter((edge) => edge.toNoteId === noteId);
    this.edges.set(
      vaultId,
      state.edges.filter((edge) => edge.fromNoteId !== noteId && edge.toNoteId !== noteId),
    );
    if (note) {
      for (const edge of orphanedBacklinks) {
        (this.pending.get(vaultId) as Pending[]).push({
          fromNoteId: edge.fromNoteId,
          slug: note.slug,
        });
      }
    }
    this.pending.set(
      vaultId,
      (this.pending.get(vaultId) as Pending[]).filter((each) => each.fromNoteId !== noteId),
    );
  }

  async resolvePending(vaultId: string, note: NoteRef): Promise<number> {
    const state = this.vault(vaultId);
    state.notes.set(note.noteId, note);
    const waiting = state.pending.filter((each) => each.slug === note.slug);
    if (waiting.length === 0) return 0;

    this.pending.set(
      vaultId,
      state.pending.filter((each) => each.slug !== note.slug),
    );
    for (const each of waiting) {
      if (each.fromNoteId === note.noteId) continue;
      (this.edges.get(vaultId) as Edge[]).push({
        fromNoteId: each.fromNoteId,
        toNoteId: note.noteId,
      });
    }
    return waiting.length;
  }

  async dependencyTree(
    vaultId: string,
    rootNoteId: string,
    depth: number,
  ): Promise<GraphNode | null> {
    const state = this.vault(vaultId);
    const root = state.notes.get(rootNoteId);
    if (!root) return null;

    const seen = new Set<string>([rootNoteId]);
    let budget = GRAPH_LIMITS.maxNodes;

    const walk = (note: NoteRef, level: number): GraphNode => {
      if (level >= depth || budget <= 0) return { note, depth: level, children: [] };
      const children: GraphNode[] = [];
      for (const edge of state.edges.filter((each) => each.fromNoteId === note.noteId)) {
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

  async backlinks(vaultId: string, noteId: string): Promise<NoteRef[]> {
    const state = this.vault(vaultId);
    return state.edges
      .filter((edge) => edge.toNoteId === noteId)
      .map((edge) => state.notes.get(edge.fromNoteId))
      .filter((note): note is NoteRef => note !== undefined);
  }

  async broken(vaultId: string): Promise<BrokenLink[]> {
    const state = this.vault(vaultId);
    return state.pending
      .map((each) => {
        const from = state.notes.get(each.fromNoteId);
        return from ? { fromNote: from, targetSlug: each.slug } : null;
      })
      .filter((link): link is BrokenLink => link !== null);
  }

  async orphans(vaultId: string, allNotes: NoteRef[]): Promise<NoteRef[]> {
    const state = this.vault(vaultId);
    const linked = new Set(state.edges.flatMap((edge) => [edge.fromNoteId, edge.toNoteId]));
    return allNotes.filter((note) => !linked.has(note.noteId));
  }

  async wholeGraph(vaultId: string): Promise<VaultGraph> {
    const state = this.vault(vaultId);
    const all = [...state.notes.values()];
    const truncated = all.length > GRAPH_LIMITS.maxVaultNodes;
    const nodes = truncated ? all.slice(0, GRAPH_LIMITS.maxVaultNodes) : all;
    const indexOf = new Map(nodes.map((note, index) => [note.noteId, index]));

    const edges: Array<[number, number]> = [];
    for (const edge of state.edges) {
      const from = indexOf.get(edge.fromNoteId);
      const to = indexOf.get(edge.toNoteId);
      if (from !== undefined && to !== undefined) edges.push([from, to]);
    }

    const pending: Array<{ from: number; targetSlug: string }> = [];
    for (const link of state.pending) {
      const from = indexOf.get(link.fromNoteId);
      if (from !== undefined) pending.push({ from, targetSlug: link.slug });
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

  private vault(vaultId: string): void {
    if (!this.portraits.has(vaultId)) this.portraits.set(vaultId, new Map());
    if (!this.counters.has(vaultId)) this.counters.set(vaultId, new Map());
    if (!this.kinds.has(vaultId)) this.kinds.set(vaultId, new Map());
    if (!this.discarded.has(vaultId)) this.discarded.set(vaultId, new Set());
  }

  async replaceFacets(
    vaultId: string,
    noteId: string,
    facets: FacetSnapshot | null,
  ): Promise<void> {
    this.vault(vaultId);
    const portraits = this.portraits.get(vaultId) as Map<string, FacetSnapshot>;
    const counters = this.counters.get(vaultId) as Map<string, number>;
    const kinds = this.kinds.get(vaultId) as Map<string, string>;
    const discarded = this.discarded.get(vaultId) as Set<string>;

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

  async vaultFacetStats(vaultId: string): Promise<FacetStats> {
    this.vault(vaultId);
    const counters = this.counters.get(vaultId) as Map<string, number>;
    const kinds = this.kinds.get(vaultId) as Map<string, string>;
    const discarded = this.discarded.get(vaultId) as Set<string>;

    const grouped = new Map<string, Array<{ value: string; count: number }>>();
    for (const [key, count] of counters) {
      const [facet, ...rest] = key.split('#');
      if (!facet) continue;
      const values = grouped.get(facet) ?? [];
      values.push({ value: rest.join('#'), count });
      grouped.set(facet, values);
    }

    return {
      noteCount: (this.portraits.get(vaultId) as Map<string, FacetSnapshot>).size,
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
  private readonly vaults = new Map<string, VaultStructure>();

  async get(vaultId: string): Promise<VaultStructure | null> {
    return this.vaults.get(vaultId) ?? null;
  }

  async upsertVault(vaultId: string, name: string): Promise<void> {
    const current = this.vaults.get(vaultId);
    this.vaults.set(vaultId, {
      vaultId,
      vaultName: name,
      folders: current?.folders ?? new Map(),
    });
  }

  async upsertFolder(
    vaultId: string,
    folder: { folderId: string; name: string; description: string; parentFolderId: string | null },
  ): Promise<void> {
    await this.upsertVault(vaultId, this.vaults.get(vaultId)?.vaultName ?? '');
    this.vaults.get(vaultId)?.folders.set(folder.folderId, {
      name: folder.name,
      description: folder.description,
      parentFolderId: folder.parentFolderId,
    });
  }

  async removeFolders(vaultId: string, folderIds: string[]): Promise<void> {
    for (const folderId of folderIds) this.vaults.get(vaultId)?.folders.delete(folderId);
  }
}

/** The note catalogue the health and lexical search read from. */
export class InMemoryNoteCatalog implements NoteCatalog {
  private readonly byVault = new Map<string, Array<NoteRef & { folderName: string }>>();

  set(vaultId: string, notes: Array<NoteRef & { folderName: string }>): void {
    this.byVault.set(vaultId, notes);
  }

  async listNotes(vaultId: string): Promise<Array<NoteRef & { folderName: string }>> {
    return this.byVault.get(vaultId) ?? [];
  }
}

/**
 * The content index in memory. The DynamoDB adapter answers the same port by
 * walking every page of a Query; here the whole vault is already one array,
 * which is exactly the behaviour the paged version has to reproduce.
 */
export class InMemoryContentIndex implements ContentIndex {
  private readonly byVault = new Map<string, Map<string, IndexedNote>>();

  async replaceNote(vaultId: string, note: IndexedNote): Promise<void> {
    const vault = this.byVault.get(vaultId) ?? new Map<string, IndexedNote>();
    vault.set(note.noteId, note);
    this.byVault.set(vaultId, vault);
  }

  async removeNote(vaultId: string, noteId: string): Promise<void> {
    this.byVault.get(vaultId)?.delete(noteId);
  }

  async scanVault(vaultId: string): Promise<IndexedNote[]> {
    return [...(this.byVault.get(vaultId)?.values() ?? [])];
  }
}
