/**
 * The three projections, fed by the same events (architecture-guide.md, 11).
 *
 * Discovery is never consulted by the core: it only ever receives what the
 * core publishes. That one-way direction is what makes all three rebuildable
 * from zero (PE5), and it is why this service keeps its own small projection
 * of the vault structure instead of asking the Knowledge context for it: the
 * chunk prefix needs the vault name, the folder path and the folder
 * description, and querying the core for them would invert the arrow.
 */

import { sha256Hex } from '@memorysmith/kernel';
import { extractLinks } from '../domain/LinkExtractor.js';
import { chunkNote, type ChunkContext } from '../domain/Chunker.js';
import { extractFacets } from '../domain/FacetExtractor.js';
import type {
  Embedder,
  EmbeddedChunk,
  FacetIndex,
  LinkGraph,
  NoteRef,
  VectorIndex,
} from '../domain/ports.js';

/** What the projector knows about the shape of a vault, from events. */
export interface VaultStructure {
  readonly vaultId: string;
  readonly vaultName: string;
  readonly folders: Map<
    string,
    { name: string; description: string; parentFolderId: string | null }
  >;
}

export interface StructureProjection {
  get(vaultId: string): Promise<VaultStructure | null>;
  upsertVault(vaultId: string, name: string): Promise<void>;
  upsertFolder(
    vaultId: string,
    folder: { folderId: string; name: string; description: string; parentFolderId: string | null },
  ): Promise<void>;
  removeFolders(vaultId: string, folderIds: string[]): Promise<void>;
}

/** Reads one revision of content, by the ref the event carried. */
export interface ContentReader {
  read(ref: { contentId: string; versionId: string }): Promise<string>;
}

export interface ProjectionDependencies {
  readonly graph: LinkGraph;
  readonly vectors: VectorIndex;
  readonly embedder: Embedder;
  readonly facets: FacetIndex;
  readonly structure: StructureProjection;
  readonly content: ContentReader;
}

export interface NoteEvent {
  readonly vaultId: string;
  readonly noteId: string;
  readonly folderId: string;
  readonly title: string;
  readonly slug: string;
  readonly contentRef: { contentId: string; versionId: string } | null;
}

function refOf(event: NoteEvent): NoteRef {
  return {
    noteId: event.noteId,
    title: event.title,
    slug: event.slug,
    folderId: event.folderId,
  };
}

function contextFor(structure: VaultStructure | null, event: NoteEvent): ChunkContext {
  const folder = structure?.folders.get(event.folderId);
  const path: string[] = [];
  let current = folder;
  let guard = 0;
  while (current && guard++ < 10) {
    path.unshift(current.name);
    current = current.parentFolderId ? structure?.folders.get(current.parentFolderId) : undefined;
  }
  return {
    vaultName: structure?.vaultName ?? '',
    folderPath: path,
    folderDescription: folder?.description ?? '',
    noteTitle: event.title,
  };
}

export class ProjectNote {
  constructor(private readonly deps: ProjectionDependencies) {}

  /**
   * Runs on NoteCreated and NoteUpdated. Also on NoteMoved, because the chunk
   * prefix carries the folder, so moving a note invalidates its vectors even
   * though its words did not change (RN-DSC-012).
   */
  async onWritten(event: NoteEvent): Promise<void> {
    const markdown = event.contentRef ? await this.deps.content.read(event.contentRef) : '';
    const note = refOf(event);

    // 1. Links. A target that does not exist yet becomes PENDING and resolves
    // on its own when the note is created (RN-DSC-004).
    await this.deps.graph.replaceOutgoing(
      event.vaultId,
      note,
      extractLinks(markdown).map((link) => ({ slug: link.slug, anchor: link.anchor })),
    );
    await this.deps.graph.resolvePending(event.vaultId, note);

    // 2. Vectors, re-embedding only the chunks whose hash changed.
    const structure = await this.deps.structure.get(event.vaultId);
    const chunks = chunkNote(markdown, contextFor(structure, event));
    const known = await this.deps.vectors.hashesOf(event.vaultId, event.noteId);
    const changed = chunks.filter((chunk) => known.get(chunk.index) !== hashOf(chunk.embedded));

    if (changed.length > 0) {
      const vectors = await this.deps.embedder.embed(changed.map((chunk) => chunk.embedded));
      const embedded: EmbeddedChunk[] = changed.map((chunk, position) => ({
        noteId: event.noteId,
        folderId: event.folderId,
        chunk,
        vector: vectors[position] ?? [],
        sha256: hashOf(chunk.embedded),
      }));
      await this.deps.vectors.upsert(event.vaultId, embedded);
    }

    // 3. Facets, from the frontmatter block and nothing else.
    await this.deps.facets.replaceFacets(event.vaultId, event.noteId, extractFacets(markdown));
  }

  /**
   * Deleting a note removes its edges, returns the backlinks that pointed at
   * it to pending (RN-DSC-005), drops its vectors immediately, including on a
   * soft delete (RN-DSC-013), and withdraws its facet portrait (RN-DSC-022).
   */
  async onDeleted(event: NoteEvent): Promise<void> {
    await this.deps.graph.removeNote(event.vaultId, event.noteId);
    await this.deps.vectors.removeByNote(event.vaultId, event.noteId);
    await this.deps.facets.replaceFacets(event.vaultId, event.noteId, null);
  }

  /** Restoring reindexes everything (RN-DSC-014). */
  async onRestored(event: NoteEvent): Promise<void> {
    await this.onWritten(event);
  }

  /**
   * A cross-vault move prunes the edges in the origin vault (RN-DSC-006) and
   * re-resolves the outgoing ones against the slugs of the destination.
   */
  async onMoved(event: NoteEvent & { fromVaultId: string }): Promise<void> {
    if (event.fromVaultId !== event.vaultId) {
      await this.deps.graph.removeNote(event.fromVaultId, event.noteId);
      await this.deps.vectors.removeByNote(event.fromVaultId, event.noteId);
      await this.deps.facets.replaceFacets(event.fromVaultId, event.noteId, null);
    }
    await this.onWritten(event);
  }
}

/** Keeps the structure projection in step with the tree events. */
export class ProjectStructure {
  constructor(private readonly structure: StructureProjection) {}

  async onVault(vaultId: string, name: string): Promise<void> {
    await this.structure.upsertVault(vaultId, name);
  }

  async onFolder(
    vaultId: string,
    folder: { folderId: string; name: string; description: string; parentFolderId: string | null },
  ): Promise<void> {
    await this.structure.upsertFolder(vaultId, folder);
  }

  async onFoldersRemoved(vaultId: string, folderIds: string[]): Promise<void> {
    await this.structure.removeFolders(vaultId, folderIds);
  }
}

function hashOf(text: string): string {
  return sha256Hex(text);
}
