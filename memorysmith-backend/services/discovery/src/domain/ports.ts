/**
 * Ports of the Discovery context (architecture-guide.md, section 11.4).
 *
 * The domain here knows Edge, Depth and Facet, and never knows AWS. Every
 * projection is DERIVED (PE5): deleting and rebuilding it from the notes is a
 * supported operation, and it is the recovery plan for all of them.
 */

import type { FacetKind, FacetSnapshot } from './FacetExtractor.js';

/**
 * A note as the projections address it: what it is called, and what else it
 * answers to. There is no slug: a link resolves against the name (RN-DSC-041)
 * and the aliases fill what no name matched (RN-DSC-052), so those two are
 * what a projection has to carry.
 */
export interface NoteRef {
  readonly noteId: string;
  /** The `name:` the note states; empty when it states none. */
  readonly name: string;
  /** The alternative spellings the frontmatter declares. */
  readonly aliases: readonly string[];
  readonly folderId: string;
}

export interface LinkTarget {
  /** The name the author addressed, literal and NFC (RN-DSC-043). */
  readonly name: string;
  readonly anchor: string | null;
}

export interface GraphNode {
  readonly note: NoteRef;
  readonly depth: number;
  readonly children: GraphNode[];
}

/**
 * What a link target names. `by` says which of the two answered, because the
 * two are not equally durable: an edge held by an alias is one somebody takes
 * back the day they write a note under that name (RN-DSC-053), and a reader
 * deciding where a link goes is entitled to know the answer is provisional.
 */
export interface ResolvedTarget {
  readonly target: string;
  readonly kind: 'note' | 'attachment' | 'pending';
  readonly by: 'name' | 'alias' | null;
  readonly notes: readonly NoteRef[];
}

/**
 * A link from a note to a name no note carries yet (RN-DSC-004). There is no
 * broken link beside it: deleting a note returns the links that pointed at it
 * to pending (RN-DSC-005).
 */
export interface PendingLink {
  readonly fromNote: NoteRef;
  readonly targetName: string;
}

/** Depth is capped at 3 and the traversal at 200 nodes (RN-DSC-007). */
export const GRAPH_LIMITS = { maxDepth: 3, maxNodes: 200, maxNotebookNodes: 2000 } as const;

/**
 * The whole link graph of one notebook, which is what the projection already is:
 * the notes it knows and the edges between them. It is a different question
 * from the dependency tree, which walks OUT from one note under a depth
 * ceiling; here there is no root and no depth, only the shape of the notebook.
 *
 * Edges are index pairs into `nodes` because a graph of any size repeats the
 * same identifiers on both ends, and an index costs two bytes where a ULID
 * costs twenty-six.
 */
export interface NotebookGraph {
  readonly nodes: NoteRef[];
  readonly edges: Array<[number, number]>;
  /** Links whose target does not exist yet, kept so the UI can show them. */
  readonly pending: Array<{ from: number; targetName: string }>;
  /**
   * Whether `maxNotebookNodes` cut the graph short. Never truncate in silence:
   * a partial graph that claims to be whole is worse than no graph.
   */
  readonly truncated: boolean;
}

/**
 * A node of the graph as the VIEW reads it: the note, plus the portrait the
 * facet projection already keeps of it. The portrait is what lets a reader
 * color the graph by an attribute the notebook itself declares, and it costs one
 * more prefix query in the SAME partition the graph already read.
 *
 * The backend still does not interpret the note (PP4): these values were
 * classified by SHAPE by the FacetExtractor, and which of them means anything
 * is a decision of whoever authored the notebook.
 */
export interface GraphNoteRef extends NoteRef {
  readonly facets: Record<string, string[]>;
}

export interface AnnotatedNotebookGraph {
  readonly nodes: GraphNoteRef[];
  readonly edges: Array<[number, number]>;
  /** Links whose target does not exist yet, kept so the UI can show them. */
  readonly pending: Array<{ from: number; targetName: string }>;
  /**
   * Whether `maxNotebookNodes` cut the graph short. Never truncate in silence:
   * a partial graph that claims to be whole is worse than no graph.
   */
  readonly truncated: boolean;
}

/**
 * What one link target a note writes resolves to, from the projection: the
 * notes it reaches and whether a name or an alias answered, or nothing when it
 * is pending (RN-AGT-034).
 */
export interface OutgoingTarget {
  readonly target: string;
  /**
   * What the target reaches: a note, a FILE the notebook keeps, or nothing
   * yet. An attachment is never an edge (§5.1) and it is not nothing either,
   * and a reader that cannot tell those two apart tells an author their
   * picture does not exist (#166).
   */
  readonly kind: 'note' | 'attachment' | 'pending';
  readonly by: 'name' | 'alias' | null;
  readonly notes: readonly NoteRef[];
}

export interface LinkGraph {
  /** Every target this note writes, as the projection resolved it. */
  outgoingOf(notebookId: string, noteId: string): Promise<OutgoingTarget[]>;
  /** Replaces every outgoing edge of a note, resolving what it can. */
  replaceOutgoing(notebookId: string, note: NoteRef, links: LinkTarget[]): Promise<void>;
  /** Removes the note from the graph and returns its backlinks to pending. */
  removeNote(notebookId: string, noteId: string): Promise<void>;
  /**
   * Takes the note into the notebook and re-resolves what changed: the pending
   * links that were waiting for this name, and the edges somebody's alias was
   * holding for it, which move to the note that owns the name (RN-DSC-053).
   * Answers how many pending links stopped being pending.
   */
  resolvePending(notebookId: string, note: NoteRef): Promise<number>;
  /**
   * What one target resolves to in this notebook: every note whose name matches
   * it, or — when none does — every note carrying it as an alias, with which
   * of the two answered (RN-DSC-046).
   */
  resolveTarget(notebookId: string, target: string): Promise<ResolvedTarget>;
  /**
   * Every note of the notebook as this projection knows it: the name it
   * states and the spellings it declares, which is what a target is resolved
   * against (§5.2). A reading surface reads it to draw a link by WHAT IT
   * REACHES rather than by how many notes carry the name — an alias is read
   * by this context and by no other (rule 5, RN-DSC-046).
   */
  notesOf(notebookId: string): Promise<NoteRef[]>;
  /**
   * The names of the files the notebook keeps (#166). A target that matches
   * one is an attachment: it renders, it is no edge, and it is the other half
   * of what a reading surface has to know to draw a link.
   */
  attachmentsOf(notebookId: string): Promise<string[]>;
  /** The notebook keeps a file under this name, or stopped keeping one. */
  keepAttachment(notebookId: string, name: string): Promise<void>;
  forgetAttachment(notebookId: string, name: string): Promise<void>;
  dependencyTree(notebookId: string, rootNoteId: string, depth: number): Promise<GraphNode | null>;
  backlinks(notebookId: string, noteId: string): Promise<NoteRef[]>;
  /**
   * Everything the graph holds of a notebook, gone in one sweep. Deleting a
   * notebook takes every note of it, so turning the links between them into
   * pending as each one goes is work whose result is thrown away — and it wrote
   * a pending item for a note that was about to be removed, which is how a
   * deleted notebook left items behind for ever (RN-KNW-047, RN-DSC-013).
   */
  removeNotebook(notebookId: string): Promise<void>;
  pending(notebookId: string): Promise<PendingLink[]>;
  /** Every note and every edge of the notebook, for the graph view. */
  wholeGraph(notebookId: string): Promise<NotebookGraph>;
  orphans(notebookId: string, allNotes: NoteRef[]): Promise<NoteRef[]>;
}

/**
 * One search hit. `section` names the heading the match fell under, when the
 * match came from the body and a heading precedes it. The note travels as the
 * projections name it everywhere else, name included, which is the shape the
 * published search hit declares: a hit that carried the identifier alone left
 * an agent with a note it could not name.
 */
export interface ScoredNote {
  readonly note: NoteRef;
  readonly section: string | null;
  readonly excerpt: string;
  readonly score: number;
}

/**
 * The searchable portrait of one note: everything the query language needs to
 * decide, already normalized, so the scan never normalizes on the hot path.
 *
 * The body is kept twice, normalized for matching and original for the
 * excerpt, because showing the reader a lowercased and unaccented passage
 * would be showing them a note nobody wrote.
 */
export interface IndexedNote {
  readonly noteId: string;
  readonly name: string;
  readonly folderId: string;
  readonly folderName: string;
  readonly sections: string[];
  readonly normalized: string;
  readonly original: string;
  readonly facets: Record<string, string[]>;
  /**
   * The other spellings of the name, from the reserved `aliases` key
   * (RN-DSC-032). Optional because an index written before this existed
   * answers without it, and a search must not stop working while the
   * projection is being rebuilt.
   */
  readonly aliases?: string[];
  /** The kind of each facet, so a date can be matched by prefix. */
  readonly facetKinds?: Record<string, string>;
}

/**
 * The content index, one per subscription like every other projection.
 *
 * `scanNotebook` MUST walk every page. The search that this one replaced answered
 * from the first megabyte and silently ignored the rest, which is the failure
 * mode this port exists to make impossible to repeat: a partial scan that
 * claims to be whole is worse than no search.
 */
export interface ContentIndex {
  replaceNote(notebookId: string, note: IndexedNote): Promise<void>;
  removeNote(notebookId: string, noteId: string): Promise<void>;
  /** Every portrait of the notebook, gone in one sweep (RN-KNW-047). */
  removeNotebook(notebookId: string): Promise<void>;
  /** When a meter is given, the scan adds to it what it read. */
  scanNotebook(notebookId: string, meter?: ScanMeter): Promise<IndexedNote[]>;
}

/**
 * What one scan of a notebook read (RN-DSC-027). There is no ceiling of notes
 * any more, so the cost of a search grows with the notebook, and this is what
 * says when it becomes a real reason to change how the search is built.
 */
export interface ScanMeter {
  /** Items of the index read, heads and parts. */
  items: number;
  /** Approximate bytes read. */
  bytes: number;
  /** Read capacity units consumed, as DynamoDB reports them. */
  readUnits: number;
}

/** One line per search, written where the logs of an environment are read. */
export interface SearchMeasure {
  readonly notebookId: string;
  readonly notesRead: number;
  readonly itemsRead: number;
  readonly bytesRead: number;
  readonly readUnits: number;
  readonly durationMs: number;
  readonly hits: number;
}

export interface SearchLog {
  record(measure: SearchMeasure): void;
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
  replaceFacets(notebookId: string, noteId: string, facets: FacetSnapshot | null): Promise<void>;
  notebookFacetStats(notebookId: string): Promise<FacetStats>;
  /**
   * The portrait of every note of the notebook, keyed by note. The statistics
   * above answer "how many notes say X"; this answers "what does THIS note
   * say", which is the question the graph view asks in order to color a node.
   */
  notebookNoteFacets(notebookId: string): Promise<Map<string, Record<string, string[]>>>;
  /**
   * Every portrait, every counter and every definition of the notebook, gone in
   * one sweep. A counter of a notebook that no longer exists is not worth
   * decrementing note by note (RN-KNW-047).
   */
  removeNotebook(notebookId: string): Promise<void>;
}

/**
 * What the projections last projected of one note, and at which version
 * (#141). The bus promises delivery and not order, and the queue delivers a
 * failed message again minutes later, so an older event of a note can arrive
 * after a newer one. The version the event carries is what decides, and this
 * is where the decision is kept.
 *
 * It keeps the whole state and not only the number, because two projections of
 * one note may run at once and interleave their writes: whichever finishes
 * last reads this back and, when a newer state was claimed meanwhile, projects
 * that state, so the projections converge on the newest note whatever the
 * order the writes landed in.
 */
export interface ProjectedNote {
  readonly version: number;
  readonly notebookId: string;
  readonly folderId: string;
  readonly contentRef: { contentId: string; versionId: string } | null;
  /** Deleted or purged: the note takes part in nothing any more. */
  readonly gone: boolean;
}

export interface ProjectedVersions {
  /**
   * Records `state` when its version is newer than the one recorded, and
   * answers whether it did. An event whose version is not newer changes
   * nothing, which is also what makes the same event delivered twice a no-op.
   */
  claim(noteId: string, state: ProjectedNote): Promise<boolean>;
  current(noteId: string): Promise<ProjectedNote | null>;
}

/** Lexical search lives here too: name and folder, no index of its own. */
export interface NoteCatalog {
  listNotes(notebookId: string): Promise<Array<NoteRef & { folderName: string }>>;
}
