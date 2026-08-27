/**
 * The projections, fed by the same events (architecture-guide.md, 11).
 *
 * Discovery is never consulted by the core: it only ever receives what the
 * core publishes. That one-way direction is what makes every projection
 * rebuildable from zero (PE5), and it is why this service keeps its own small
 * projection of the vault structure instead of asking the Knowledge context
 * for it: the vault context is answered from here, and querying the core for
 * the folder tree would invert the arrow.
 */

import { extractLinks } from '../domain/LinkExtractor.js';
import { extractFacets } from '../domain/FacetExtractor.js';
import type { FacetIndex, LinkGraph, NoteRef } from '../domain/ports.js';

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

export class ProjectNote {
  constructor(private readonly deps: ProjectionDependencies) {}

  /**
   * Runs on NoteCreated and NoteUpdated, and on NoteMoved, because a note that
   * changes folder changes the portrait the vault shows of it (RN-DSC-012).
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

    // 2. Facets, from the frontmatter block and nothing else.
    await this.deps.facets.replaceFacets(event.vaultId, event.noteId, extractFacets(markdown));
  }

  /**
   * Deleting a note removes its edges, returns the backlinks that pointed at
   * it to pending (RN-DSC-005), including on a soft delete (RN-DSC-013), and
   * withdraws its facet portrait (RN-DSC-022).
   */
  async onDeleted(event: NoteEvent): Promise<void> {
    await this.deps.graph.removeNote(event.vaultId, event.noteId);
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
