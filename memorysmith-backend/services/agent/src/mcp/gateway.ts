/**
 * The ports svc-agent talks to. They are written in the vocabulary of the
 * PRODUCT, never of MCP: no tool name, no JSON-RPC, no protocol version
 * appears below (RN-AGT-008). Swapping protocol tomorrow is swapping the
 * adapter above these, and the domain does not notice.
 *
 * In the modular monolith the implementations call the use cases in process;
 * in the six-deployable shape they call the internal API over HTTP with IAM
 * auth. Either way this file is unchanged (architecture-guide.md, section 24).
 */

export interface AgentCaller {
  /** The human who authorized the connector; always present. */
  readonly userId: string;
  /** How to call that human, when the token says. Identity is not ours. */
  readonly email?: string | undefined;
  /** Fixed at consent and unchanged for the life of the token (RN-SUB-014). */
  readonly subscriptionId: string;
}

/**
 * The connector a session acts through, as the proxy recorded it when it handed
 * the token out: the client_id URL of its metadata document and its client_name.
 */
export interface ConnectorIdentity {
  readonly clientId: string;
  readonly clientName: string;
}

export interface NotebookListing {
  readonly notebookId: string;
  readonly name: string;
  readonly description: string;
  readonly noteCount: number;
}

/**
 * The name is the `name:` the frontmatter of the note states, and it is
 * `null` when the note has none a link could use (RN-KNW-036). It is reported rather than
 * shown as an empty string, which is what an agent needs in order to say so.
 */
/** One page of the index of a notebook (RN-AGT-031). */
export interface NotePage {
  readonly notes: NoteListing[];
  /** Pass it back as `cursor` for the next page; `null` when this was the last. */
  readonly nextCursor: string | null;
}

export interface NoteListing {
  readonly noteId: string;
  readonly name: string | null;
  readonly folderId: string;
  readonly position: string;
}

/**
 * A note the link graph names: what points at another note carries no place in
 * a folder, only where it lives. A note that states no name answers null here
 * too, as in a listing.
 */
export interface NoteReference {
  readonly noteId: string;
  readonly name: string | null;
  readonly folderId: string;
}

export interface NoteContent {
  readonly noteId: string;
  readonly name: string | null;
  /** Where the note lives and where it sits; a note rebuilt from history has neither. */
  readonly folderId?: string;
  readonly position?: string;
  /**
   * The names of the folders from the root down to the note's own
   * (RN-AGT-033): where the note is, never what identifies it.
   */
  readonly folder?: string[];
  readonly content: string;
  readonly revision: string;
  readonly updatedAt: string;
  /**
   * Every link target the content writes and what it reaches (RN-AGT-034),
   * beside the body and never inside it. Left out of a revision from the
   * past, because the link projection has no past.
   */
  readonly links?: NoteLink[];
}

/** A file of a notebook, as the connector answers it (#166). */
export interface NotebookFileRef {
  readonly fileId: string;
  readonly name: string;
  readonly description: string;
  readonly mimeType: string;
  readonly tags: string[];
  readonly path: string;
  readonly bytes: number;
}

export interface NoteLink {
  readonly target: string;
  /**
   * Which answered: the name of a note, a spelling one of them declares, a
   * **file the notebook keeps**, or nothing yet. A file is not an edge and it
   * is not nothing either, and telling an agent its picture does not exist is
   * how a notebook gets written twice (#166).
   */
  readonly resolvedBy: 'name' | 'alias' | 'attachment' | 'pending';
  readonly notes: Array<{ noteId: string; name: string | null; folder: string[] }>;
}

export interface SearchHit {
  readonly noteId: string;
  readonly name: string;
  readonly folderId: string;
  readonly section: string | null;
  readonly excerpt: string;
  readonly score: number;
}

export interface RelatedNode {
  readonly noteId: string;
  readonly name: string;
  readonly folderId: string;
  readonly depth: number;
  readonly children: RelatedNode[];
}

export interface HistoryEntry {
  readonly occurredAt: string;
  readonly type: string;
  readonly userId: string;
  readonly agentName: string | null;
  /** The client_id URL of the connector that wrote, beside its name. */
  readonly agentClientId: string | null;
  readonly revision: string | null;
}

export interface FolderListing {
  readonly folderId: string;
  readonly parentFolderId: string | null;
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  /** The order key among its siblings: content, and never decoration. */
  readonly position: string;
}

/** What a tool asks of the Access context. */
export interface AccessGateway {
  /** The connector behind this session, or null when none was recorded. */
  connector(caller: AgentCaller): Promise<ConnectorIdentity | null>;
}

/** Everything a tool can ask of the Knowledge context. */
export interface KnowledgeGateway {
  listNotebooks(caller: AgentCaller): Promise<NotebookListing[]>;
  createNotebook(
    caller: AgentCaller,
    input: { name: string; description: string },
  ): Promise<NotebookListing>;
  /** Definitive: the notebook leaves every listing and its content is purged. */
  deleteNotebook(caller: AgentCaller, notebookId: string): Promise<void>;
  /**
   * How many kept exports of that notebook the caller holds (RN-PRT-021). An
   * export survives the notebook it was made of, and whoever deletes a notebook
   * is told so where the deletion is confirmed: the connector is where a
   * notebook is deleted, so the answer of the tool is that confirmation.
   */
  keptExportsOf(caller: AgentCaller, notebookId: string): Promise<number>;
  /**
   * The revision the write is based on, null when the slot is still empty. It
   * answers the revision the write produced, which the next write names.
   */
  setGuidance(
    caller: AgentCaller,
    notebookId: string,
    content: string,
    baseRevision: string | null,
  ): Promise<string>;
  /** The notebook keeps everything it has; it simply stops saying how it wants to be written. */
  deleteGuidance(caller: AgentCaller, notebookId: string): Promise<void>;
  /** The guidance with its revision, which is what a write has to echo back. */
  guidance(
    caller: AgentCaller,
    notebookId: string,
  ): Promise<{ content: string; revision: string } | null>;
  /** Without an anchor the folder goes last among its siblings. */
  createFolder(
    caller: AgentCaller,
    input: {
      notebookId: string;
      name: string;
      description: string;
      parentFolderId?: string;
      afterFolderId?: string;
    },
  ): Promise<FolderListing>;
  /**
   * First among its siblings with no anchor, or right after one. Answers the
   * siblings in their new order.
   */
  reorderFolder(
    caller: AgentCaller,
    input: { notebookId: string; folderId: string; afterFolderId: string | null },
  ): Promise<FolderListing[]>;
  /** The policy is explicit or it is not: there is no implicit default. */
  deleteFolder(
    caller: AgentCaller,
    input: { notebookId: string; folderId: string; policy: string },
  ): Promise<{ removedFolderIds: string[] }>;
  /** Answers the revision the write produced, which the next write names. */
  setTemplate(
    caller: AgentCaller,
    input: { notebookId: string; folderId: string; content: string; baseRevision: string | null },
  ): Promise<string>;
  /** The folder stays and stops suggesting a layout for the notes kept there. */
  deleteTemplate(caller: AgentCaller, notebookId: string, folderId: string): Promise<void>;
  /** Issues the next number of a folder (RN-AGT-036). */
  nextNumber(caller: AgentCaller, notebookId: string, folderId: string): Promise<number>;
  deleteNote(caller: AgentCaller, notebookId: string, noteId: string): Promise<void>;
  /**
   * What a notebook keeps beside its notes (#166). The bytes travel inline,
   * base64: an agent that must perform an HTTP PUT of its own is an agent that
   * cannot keep a file at all.
   */
  keepFile(
    caller: AgentCaller,
    notebookId: string,
    file: {
      name: string;
      description: string;
      mimeType: string;
      tags: string[];
      path: string;
      contentBase64: string;
    },
  ): Promise<NotebookFileRef>;
  listFiles(caller: AgentCaller, notebookId: string): Promise<NotebookFileRef[]>;
  deleteFile(caller: AgentCaller, notebookId: string, fileId: string): Promise<void>;
  notebookContext(caller: AgentCaller, notebookId: string): Promise<string>;
  template(
    caller: AgentCaller,
    notebookId: string,
    folderId: string,
  ): Promise<{ content: string; folderName: string; revision: string } | null>;
  /** One page of the index, in the defined order (RN-AGT-031). */
  listNotes(
    caller: AgentCaller,
    input: { notebookId: string; folderId?: string; limit?: number; cursor?: string },
  ): Promise<NotePage>;
  readNote(caller: AgentCaller, notebookId: string, noteId: string): Promise<NoteContent>;
  /** Without an anchor the note goes last in its folder. */
  createNote(
    caller: AgentCaller,
    input: { notebookId: string; folderId: string; content: string; afterNoteId?: string },
  ): Promise<NoteContent>;
  updateNote(
    caller: AgentCaller,
    input: { notebookId: string; noteId: string; content: string; baseRevision: string },
  ): Promise<NoteContent>;
  /**
   * First in its folder with no anchor, or right after a note of it. Answers the
   * notes of the folder in their new order.
   */
  reorderNote(
    caller: AgentCaller,
    input: { notebookId: string; noteId: string; afterNoteId: string | null },
  ): Promise<NoteListing[]>;
  searchNotes(caller: AgentCaller, notebookId: string, query: string): Promise<SearchHit[]>;
}

export interface DiscoveryGateway {
  relatedNotes(
    caller: AgentCaller,
    input: { notebookId: string; noteId: string; depth?: number },
  ): Promise<RelatedNode>;
  backlinks(caller: AgentCaller, notebookId: string, noteId: string): Promise<NoteReference[]>;
}

export interface AuditGateway {
  noteHistory(caller: AgentCaller, notebookId: string, noteId: string): Promise<HistoryEntry[]>;
  revisionAt(
    caller: AgentCaller,
    input: { notebookId: string; noteId: string; asOf: string },
  ): Promise<NoteContent>;
}

/**
 * The error a gateway raises. The tool adapter turns it into an MCP error with
 * actionable text, and a missing-argument error carries the template along
 * when that is what the caller needs next (RN-AGT-003).
 */
export class GatewayError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}
