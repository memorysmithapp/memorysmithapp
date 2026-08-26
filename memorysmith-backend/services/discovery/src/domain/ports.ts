/**
 * Ports of the Discovery context (architecture-guide.md, section 11.4).
 *
 * The domain here knows Chunk, Edge and Depth, and never knows Bedrock. All
 * three projections are DERIVED (PE5): deleting and rebuilding them from the
 * notes is a supported operation, and it is the recovery plan for all three.
 */

import type { Chunk } from './Chunker.js';
import type { FacetKind, FacetSnapshot } from './FacetExtractor.js';

export interface NoteRef {
  readonly noteId: string;
  readonly title: string;
  readonly slug: string;
  readonly folderId: string;
}

export interface LinkTarget {
  readonly slug: string;
  readonly anchor: string | null;
}

export interface GraphNode {
  readonly note: NoteRef;
  readonly depth: number;
  readonly children: GraphNode[];
}

export interface BrokenLink {
  readonly fromNote: NoteRef;
  readonly targetSlug: string;
}

/** Depth is capped at 3 and the traversal at 200 nodes (RN-DSC-007). */
export const GRAPH_LIMITS = { maxDepth: 3, maxNodes: 200 } as const;

export interface LinkGraph {
  /** Replaces every outgoing edge of a note, resolving what it can. */
  replaceOutgoing(vaultId: string, note: NoteRef, links: LinkTarget[]): Promise<void>;
  /** Removes the note from the graph and returns its backlinks to pending. */
  removeNote(vaultId: string, noteId: string): Promise<void>;
  /** Resolves the pending links that were waiting for this slug to exist. */
  resolvePending(vaultId: string, note: NoteRef): Promise<number>;
  dependencyTree(vaultId: string, rootNoteId: string, depth: number): Promise<GraphNode | null>;
  backlinks(vaultId: string, noteId: string): Promise<NoteRef[]>;
  broken(vaultId: string): Promise<BrokenLink[]>;
  orphans(vaultId: string, allNotes: NoteRef[]): Promise<NoteRef[]>;
}

export interface EmbeddedChunk {
  readonly noteId: string;
  readonly folderId: string;
  readonly chunk: Chunk;
  readonly vector: number[];
  readonly sha256: string;
}

export interface ScoredChunk {
  readonly noteId: string;
  readonly section: string | null;
  readonly excerpt: string;
  readonly score: number;
}

export interface IndexFilter {
  readonly vaultId: string;
  readonly folderId?: string | undefined;
}

/** One index PER SUBSCRIPTION, never a shared index filtered by metadata. */
export interface VectorIndex {
  upsert(vaultId: string, chunks: EmbeddedChunk[]): Promise<void>;
  removeByNote(vaultId: string, noteId: string): Promise<void>;
  query(vector: number[], filter: IndexFilter, k: number): Promise<ScoredChunk[]>;
  /** Hashes of what is indexed, so only changed chunks are re-embedded. */
  hashesOf(vaultId: string, noteId: string): Promise<Map<number, string>>;
}

export interface Embedder {
  embed(texts: string[]): Promise<number[][]>;
}

export interface FacetStats {
  readonly facets: Array<{
    facet: string;
    kind: FacetKind;
    values: Array<{ value: string; count: number }>;
    discarded: boolean;
  }>;
  readonly noteCount: number;
}

export interface FacetIndex {
  /** null means the note was deleted and its portrait must be withdrawn. */
  replaceFacets(vaultId: string, noteId: string, facets: FacetSnapshot | null): Promise<void>;
  vaultFacetStats(vaultId: string): Promise<FacetStats>;
}

/** Lexical search lives here too: title and folder, no index of its own. */
export interface NoteCatalog {
  listNotes(vaultId: string): Promise<Array<NoteRef & { folderName: string }>>;
}
