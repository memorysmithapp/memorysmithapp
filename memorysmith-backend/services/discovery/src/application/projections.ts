/**
 * The projections, fed by the same events (architecture-guide.md, 11).
 *
 * Discovery is never consulted by the core: it only ever receives what the
 * core publishes. That one-way direction is what makes every projection
 * rebuildable from zero (PE5), and it is why this service keeps its own small
 * projection of the notebook structure instead of asking the Knowledge context
 * for it: the searchable portrait of a note carries the name of its folder, and
 * querying the core for the folder tree would invert the arrow.
 */

import { bodyWithoutFrontmatter, noteName } from '@memorysmith/kernel';

import { extractLinks } from '../domain/LinkExtractor.js';
import { extractFacets } from '../domain/FacetExtractor.js';
import { extractFrontmatterAliases } from '../domain/Aliases.js';
import { normalize } from '../domain/SearchQuery.js';
import type {
  ContentIndex,
  FacetIndex,
  LinkGraph,
  NoteRef,
  ProjectedNote,
  ProjectedVersions,
} from '../domain/ports.js';

/**
 * The frontmatter is the facet projector's business (RN-DSC-018) and has no
 * place in the searchable body: leaving it in would make every note match its
 * own metadata, and `maturity` would be findable as prose. Where the block
 * ends is the kernel's answer, which is the one reader of it in this
 * repository and the one the name of a note is read through.
 */
const stripFrontmatter = bodyWithoutFrontmatter;

/** Headings, which are universal Markdown syntax and so fair game (PP4). */
function headingsOf(markdown: string): string[] {
  const headings: string[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const match = /^#{1,6}\s+(.*)$/.exec(line);
    if (match) headings.push((match[1] ?? '').trim());
  }
  return headings;
}

/** What the projector knows about the shape of a notebook, from events. */
export interface NotebookStructure {
  readonly notebookId: string;
  readonly notebookName: string;
  readonly folders: Map<
    string,
    { name: string; description: string; parentFolderId: string | null }
  >;
}

export interface StructureProjection {
  get(notebookId: string): Promise<NotebookStructure | null>;
  upsertNotebook(notebookId: string, name: string): Promise<void>;
  upsertFolder(
    notebookId: string,
    folder: { folderId: string; name: string; description: string; parentFolderId: string | null },
  ): Promise<void>;
  removeFolders(notebookId: string, folderIds: string[]): Promise<void>;
  /** The notebook is gone: its whole portrait goes with it (RN-DSC-013). */
  removeNotebook(notebookId: string): Promise<void>;
}

/** Reads one revision of content, by the ref the event carried. */
export interface ContentReader {
  read(ref: { contentId: string; versionId: string }): Promise<string>;
}

export interface ProjectionDependencies {
  readonly graph: LinkGraph;
  readonly facets: FacetIndex;
  readonly index: ContentIndex;
  readonly structure: StructureProjection;
  readonly content: ContentReader;
  /** What was last projected of each note, and at which version (#141). */
  readonly versions: ProjectedVersions;
}

/**
 * The version a purge is recorded at: above any version a note can reach, so
 * nothing about a purged note is ever projected again.
 */
const PURGED = Number.MAX_SAFE_INTEGER;

/**
 * What a note event carries. It does NOT carry a name: the name is read from
 * the content, by the same function Knowledge derives it with, so the two
 * cannot disagree about what a note is called (RN-KNW-035). An event that
 * arrives without a content reference — a deletion — is answering about a note
 * that no longer takes part in the graph anyway.
 */
export interface NoteEvent {
  readonly notebookId: string;
  readonly noteId: string;
  readonly folderId: string;
  readonly contentRef: { contentId: string; versionId: string } | null;
  /**
   * The version of the note the write produced (#141). Absent only on an event
   * written before versions existed, which is projected as it comes.
   */
  readonly version?: number | undefined;
}

/**
 * The note as the projections address it: what it is called and what else it
 * answers to. A link resolves against the first (RN-DSC-041) and the second
 * fills what no name matched (RN-DSC-052), which is why a note points with
 * its body and answers with both.
 */
function refOf(event: NoteEvent, name: string, aliases: readonly string[]): NoteRef {
  return {
    noteId: event.noteId,
    name,
    aliases: [...aliases],
    folderId: event.folderId,
  };
}

export class ProjectNote {
  constructor(private readonly deps: ProjectionDependencies) {}

  /**
   * The one door of a note event: a write, a move, a deletion or a purge,
   * projected only when it is newer than what was projected (#141).
   *
   * 1. The claim is one conditional write. An event whose version is not newer
   *    changes nothing, which also makes a redelivered event a no-op.
   * 2. The projection is several writes, and a newer event of the same note
   *    may be projecting at the same time. So once this one is done it reads
   *    the claim back, and when a newer state was claimed meanwhile it projects
   *    THAT state and looks again. Whichever projector finishes last leaves the
   *    projections on the newest note, whatever order the writes landed in.
   */
  async project(
    event: NoteEvent & {
      kind: 'written' | 'moved' | 'deleted' | 'purged';
      fromNotebookId?: string;
    },
  ): Promise<void> {
    if (event.version === undefined && event.kind !== 'purged') {
      await this.apply(event);
      return;
    }
    const state: ProjectedNote = {
      version: event.kind === 'purged' ? PURGED : (event.version as number),
      notebookId: event.notebookId,
      folderId: event.folderId,
      contentRef: event.contentRef,
      gone: event.kind === 'deleted' || event.kind === 'purged',
    };
    if (!(await this.deps.versions.claim(event.noteId, state))) return;
    await this.apply(event);

    let projected = state.version;
    for (let round = 0; round < 5; round++) {
      const newest = await this.deps.versions.current(event.noteId);
      if (!newest || newest.version <= projected) return;
      projected = newest.version;
      await this.apply({
        kind: newest.gone ? 'deleted' : 'written',
        notebookId: newest.notebookId,
        noteId: event.noteId,
        folderId: newest.folderId,
        contentRef: newest.contentRef,
      });
    }
  }

  private async apply(
    event: NoteEvent & {
      kind: 'written' | 'moved' | 'deleted' | 'purged';
      fromNotebookId?: string;
    },
  ): Promise<void> {
    switch (event.kind) {
      case 'written':
        return this.onWritten(event);
      case 'moved':
        return this.onMoved({ ...event, fromNotebookId: event.fromNotebookId ?? event.notebookId });
      default:
        return this.onDeleted(event);
    }
  }

  /**
   * Runs on NoteCreated and NoteUpdated, and on NoteMoved, because a note that
   * changes folder changes the portrait the notebook shows of it (RN-DSC-012).
   */
  async onWritten(event: NoteEvent): Promise<void> {
    const markdown = event.contentRef ? await this.deps.content.read(event.contentRef) : '';
    const name = noteName(markdown) ?? '';
    const note = refOf(event, name, extractFrontmatterAliases(markdown));

    // 1. Links. A target that does not exist yet becomes PENDING and resolves
    // on its own when the note is created (RN-DSC-004).
    await this.deps.graph.replaceOutgoing(
      event.notebookId,
      note,
      extractLinks(markdown).map((link) => ({ name: link.name, anchor: link.anchor })),
    );
    await this.deps.graph.resolvePending(event.notebookId, note);

    // 2. Facets, from the frontmatter block and nothing else.
    const facets = extractFacets(markdown);
    await this.deps.facets.replaceFacets(event.notebookId, event.noteId, facets);

    // 3. The searchable portrait, normalized once here so no search ever
    // normalizes on the hot path.
    const structure = await this.deps.structure.get(event.notebookId);
    const body = stripFrontmatter(markdown);
    await this.deps.index.replaceNote(event.notebookId, {
      noteId: event.noteId,
      name: normalize(name),
      folderId: event.folderId,
      folderName: normalize(structure?.folders.get(event.folderId)?.name ?? ''),
      sections: headingsOf(body).map(normalize),
      normalized: normalize(body),
      original: body,
      facets: Object.fromEntries(
        Object.entries(facets ?? {}).map(([name, facet]) => [
          normalize(name),
          facet.values.map(normalize),
        ]),
      ),
      // The reserved `aliases`, indexed as other spellings of the name
      // (RN-DSC-032). It is the one reserved key with an effect of its own:
      // the other three are named so every notebook spells them alike, and this
      // one changes what the search finds.
      aliases: (facets?.['aliases']?.values ?? []).map(normalize),
      facetKinds: Object.fromEntries(
        Object.entries(facets ?? {}).map(([name, facet]) => [normalize(name), facet.kind]),
      ),
    });
  }

  /**
   * Deleting a note removes its edges, returns the backlinks that pointed at
   * it to pending (RN-DSC-005), the moment it is deleted (RN-DSC-013), and
   * withdraws its facet portrait (RN-DSC-022).
   */
  async onDeleted(event: NoteEvent): Promise<void> {
    await this.deps.graph.removeNote(event.notebookId, event.noteId);
    await this.deps.facets.replaceFacets(event.notebookId, event.noteId, null);
    await this.deps.index.removeNote(event.notebookId, event.noteId);
  }

  /**
   * Every note of these folders leaves the projections, because a note whose
   * folder was removed is invalid (RN-KNW-046) and what leaves the listing
   * leaves the search (RN-DSC-013).
   *
   * Which notes those are is read from the index itself: Discovery is never
   * consulted by the core and never consults it, so the portrait it keeps is
   * the only place it can ask. The folders of the event are removed from the
   * structure by `ProjectStructure`; this is about the notes under them.
   */
  async onFoldersRemoved(notebookId: string, folderIds: readonly string[]): Promise<void> {
    const removed = new Set(folderIds);
    const indexed = await this.deps.index.scanNotebook(notebookId);
    for (const note of indexed) {
      if (!removed.has(note.folderId)) continue;
      await this.onDeleted({
        notebookId,
        noteId: note.noteId,
        folderId: note.folderId,
        contentRef: null,
      });
    }
  }

  /**
   * The notebook is gone, and so is every note it held: each projection wipes
   * what it holds of that notebook in one sweep.
   *
   * It used to walk the notes one by one and delete each as if it were a
   * deletion of its own, which left the notebook's partition dirty in two ways
   * at once. Every deletion returned the links pointing at that note to
   * pending, so a link between two notes of the notebook WROTE a pending item
   * the moment the first one went — and the source of that link was removed
   * right after, leaving an item nothing would ever read or collect. And the
   * work was pointless either way: nothing under a deleted notebook is coming
   * back to be re-resolved (RN-KNW-047, RN-DSC-013).
   */
  async onNotebookDeleted(notebookId: string): Promise<void> {
    await this.deps.graph.removeNotebook(notebookId);
    await this.deps.facets.removeNotebook(notebookId);
    await this.deps.index.removeNotebook(notebookId);
  }

  /**
   * A cross-notebook move prunes the edges in the origin notebook (RN-DSC-006) and
   * re-resolves the outgoing ones against the slugs of the destination.
   */
  async onMoved(event: NoteEvent & { fromNotebookId: string }): Promise<void> {
    if (event.fromNotebookId !== event.notebookId) {
      await this.deps.graph.removeNote(event.fromNotebookId, event.noteId);
      await this.deps.facets.replaceFacets(event.fromNotebookId, event.noteId, null);
      await this.deps.index.removeNote(event.fromNotebookId, event.noteId);
    }
    await this.onWritten(event);
  }
}

/** Keeps the structure projection in step with the tree events. */
/**
 * What a notebook keeps beside its notes (#166).
 *
 * It is not indexed and it makes no edge: what the graph has to learn is that
 * the NAME answers, so a note referencing a file stops being told that its
 * picture does not exist, and so a reading surface can draw it.
 */
export class ProjectFiles {
  constructor(private readonly graph: LinkGraph) {}

  async onKept(notebookId: string, name: string): Promise<void> {
    await this.graph.keepAttachment(notebookId, name);
  }

  async onDeleted(notebookId: string, name: string): Promise<void> {
    await this.graph.forgetAttachment(notebookId, name);
  }
}

export class ProjectStructure {
  constructor(private readonly structure: StructureProjection) {}

  async onNotebook(notebookId: string, name: string): Promise<void> {
    await this.structure.upsertNotebook(notebookId, name);
  }

  async onFolder(
    notebookId: string,
    folder: { folderId: string; name: string; description: string; parentFolderId: string | null },
  ): Promise<void> {
    await this.structure.upsertFolder(notebookId, folder);
  }

  async onFoldersRemoved(notebookId: string, folderIds: string[]): Promise<void> {
    await this.structure.removeFolders(notebookId, folderIds);
  }

  async onNotebookDeleted(notebookId: string): Promise<void> {
    await this.structure.removeNotebook(notebookId);
  }
}
