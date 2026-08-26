/**
 * Discovery reads. Everything here answers from a projection: no query walks
 * notes, and none of them reaches the Knowledge context (RN-DSC-017).
 */

import { DomainError, err, ok, slugify, type Result } from '@memorysmith/kernel';
import {
  GRAPH_LIMITS,
  type FacetIndex,
  type FacetStats,
  type GraphNode,
  type LinkGraph,
  type NoteCatalog,
  type NoteRef,
  type ScoredChunk,
  type VaultGraph,
  type VectorIndex,
  type Embedder,
  type BrokenLink,
} from '../domain/ports.js';

export interface QueryDependencies {
  readonly graph: LinkGraph;
  readonly vectors: VectorIndex;
  readonly embedder: Embedder;
  readonly facets: FacetIndex;
  readonly catalog: NoteCatalog;
}

export class RelatedNotes {
  constructor(private readonly deps: QueryDependencies) {}

  async execute(input: {
    vaultId: string;
    noteId: string;
    depth?: number | undefined;
  }): Promise<Result<GraphNode, DomainError>> {
    // Without a ceiling a dense vault returns the whole vault and drowns the
    // agent (RN-DSC-007).
    const depth = Math.min(Math.max(input.depth ?? 2, 1), GRAPH_LIMITS.maxDepth);
    const tree = await this.deps.graph.dependencyTree(input.vaultId, input.noteId, depth);
    return tree ? ok(tree) : err(DomainError.notFound('Note not found'));
  }
}

export class Backlinks {
  constructor(private readonly deps: QueryDependencies) {}

  async execute(input: {
    vaultId: string;
    noteId: string;
  }): Promise<Result<NoteRef[], DomainError>> {
    return ok(await this.deps.graph.backlinks(input.vaultId, input.noteId));
  }
}

export class VaultHealth {
  constructor(private readonly deps: QueryDependencies) {}

  async execute(input: {
    vaultId: string;
  }): Promise<Result<{ broken: BrokenLink[]; orphans: NoteRef[] }, DomainError>> {
    const notes = await this.deps.catalog.listNotes(input.vaultId);
    return ok({
      broken: await this.deps.graph.broken(input.vaultId),
      orphans: await this.deps.graph.orphans(input.vaultId, notes),
    });
  }
}

/**
 * The shape of the whole vault, which the graph view draws. It reads one
 * projection and nothing else: Discovery never asks Knowledge for a note
 * (RN-DSC-017), and the notes it names are the ones its own projection knows.
 */
export class VaultGraphQuery {
  constructor(private readonly deps: QueryDependencies) {}

  async execute(input: { vaultId: string }): Promise<Result<VaultGraph, DomainError>> {
    return ok(await this.deps.graph.wholeGraph(input.vaultId));
  }
}

export class SearchNotes {
  constructor(private readonly deps: QueryDependencies) {}

  /**
   * Lexical search runs over titles and folder names, which is the index the
   * product promises; semantic search goes through the vector index and always
   * cites the note and the section (RN-DSC-010).
   */
  async execute(input: {
    vaultId: string;
    query: string;
    mode: 'lexical' | 'semantic';
    k?: number | undefined;
    folderId?: string | undefined;
  }): Promise<Result<ScoredChunk[], DomainError>> {
    if (input.query.trim().length === 0) {
      return err(DomainError.validation('A search needs a query'));
    }

    if (input.mode === 'lexical') {
      const needle = slugify(input.query);
      const words = needle.split('-').filter((word) => word.length > 2);
      const notes = await this.deps.catalog.listNotes(input.vaultId);
      const hits = notes
        .map((note) => {
          const haystack = `${slugify(note.title)}-${slugify(note.folderName)}`;
          const matched = words.filter((word) => haystack.includes(word)).length;
          const exact = haystack.includes(needle) ? 1 : 0;
          return {
            noteId: note.noteId,
            section: null,
            excerpt: note.title,
            score: exact + matched / Math.max(words.length, 1),
          };
        })
        .filter((hit) => hit.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, input.k ?? 10);
      return ok(hits);
    }

    const [vector] = await this.deps.embedder.embed([input.query]);
    if (!vector) return err(DomainError.internal('The embedder returned nothing'));
    return ok(
      await this.deps.vectors.query(
        vector,
        { vaultId: input.vaultId, ...(input.folderId ? { folderId: input.folderId } : {}) },
        input.k ?? 10,
      ),
    );
  }
}

/** The curation panel: one Query over the counters, no note is touched. */
export class GetFacetStats {
  constructor(private readonly deps: QueryDependencies) {}

  async execute(input: { vaultId: string }): Promise<Result<FacetStats, DomainError>> {
    return ok(await this.deps.facets.vaultFacetStats(input.vaultId));
  }
}
