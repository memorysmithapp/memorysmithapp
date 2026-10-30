/**
 * The ports svc-agent talks to. They are written in the vocabulary of the
 * PRODUCT, never of MCP: no tool name, no JSON-RPC, no protocol version
 * appears below. Swapping protocol tomorrow is swapping the
 * adapter above these, and the domain does not notice.
 *
 * In the modular monolith the implementations call the use cases in process;
 * in the six-deployable shape they call the internal API over HTTP with IAM
 * auth. Either way this file is unchanged (ADR-005).
 */

import type {
  ImportTableRequest,
  NotebookTableDto,
  RowsWrittenDto,
  TableImportDto,
  TableAlteredDto,
  TablePageDto,
  TableQueryRequest,
} from '@memorysmithapp/contracts';
import type {
  DeclareModelRequest,
  ModelListDto,
  ModelVersionDto,
  ModelVersionViewDto,
  PublicModelDto,
  PublicVersionViewDto,
  NotebookModelDto,
} from '@memorysmithapp/contracts';
import type {
  BeginUploadRequest,
  FinishedUploadDto,
  NoteOrder,
  PreviewDto,
  RequestFileRequest,
  TransferDto,
  UploadStatusDto,
} from '@memorysmithapp/contracts';

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
  /**
   * Whether the notebook is of the subscription of this connection or shared
   * with its person from another one (RN-AGT-046). A shared one names its
   * owner and the access the share grants, its profile (RN-ACC-032), and an
   * increase the owner offered that waits for this person (RN-ACC-033).
   */
  readonly ownership: 'own' | 'shared';
  readonly owner?: string;
  readonly access?: ShareAccessName;
  readonly pendingAccess?: ShareAccessName | null;
}

/** The access a share grants, as the connector names it. */
export type ShareAccessName = 'reader' | 'content-editor' | 'notebook-editor';

/**
 * The context a note is written against (RN-KNW-061): the Guidance, the
 * Template of its folder and the structure of the notebook, each by its
 * revision, as the reads answer them.
 */
export interface NoteContextRevisions {
  readonly guidance: string | null;
  readonly template: string | null;
  readonly structure: string;
}

/** A write whose declared context had changed: what changed, and what is current. */
export interface ContextChanged {
  readonly changed: readonly string[];
  readonly current: NoteContextRevisions;
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

/**
 * What a notebook left pending, and what looks broken in it (#217): the answer
 * of `check_notebook`, the sweep an agent runs before it says it is done.
 */
export interface NotebookCheck {
  /** Every name linked to that no note carries yet, with the notes that link to it. */
  readonly pending: ReadonlyArray<{
    readonly target: string;
    readonly from: readonly NoteReference[];
    /**
     * What the link most likely meant, when it almost reaches a note or a file
     * the notebook has: then it looks broken, and the link is what to fix.
     * Null for a link left on purpose, to a note not written yet.
     */
    readonly likelyMeant: {
      readonly name: string;
      readonly kind: 'note' | 'file';
      readonly noteId: string | null;
    } | null;
  }>;
  /** Notes nothing links to. */
  readonly orphans: readonly NoteReference[];
  /**
   * The files the notebook keeps that no note names (RN-DSC-064): some kept on
   * purpose, and the agent says which to the person.
   */
  readonly unshownFiles: readonly string[];
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
  /** On the answer of a write only: the context it declared had changed (RN-KNW-061). */
  readonly contextChanged?: ContextChanged;
  /**
   * Every link target the content writes and what it reaches (RN-AGT-034),
   * beside the body and never inside it. Left out of a revision from the
   * past, because the link projection has no past.
   */
  readonly links?: NoteLink[];
}

/**
 * A note as a move leaves it (RN-AGT-049): where it now lives and where it
 * sits there, and the revision it carried, which the move did not change. The
 * body is left out: a move writes none, and the agent already holds it.
 */
export interface MovedNote {
  readonly noteId: string;
  readonly name: string | null;
  readonly folderId: string;
  readonly folder?: string[];
  readonly position: string;
  readonly revision: string;
  readonly updatedAt: string;
  /** The context of the destination it declared had changed (RN-KNW-061). */
  readonly contextChanged?: ContextChanged;
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
  /** What was kept, so an agent can compare it with the file it was given (RN-AGT-053). */
  readonly sha256: string;
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
  /**
   * The line its author left about the change (RN-AUD-012), or null when the
   * write carried none. What a person writes in the interface and what an
   * agent sends with `update_note` are the same field, so the history reads
   * the same way whoever wrote it.
   */
  readonly message: string | null;
  /**
   * The edit session of the interface the write belonged to (RN-AUD-013), or
   * null for a write made outside one, which is every write of an agent.
   */
  readonly session: string | null;
}

export interface FolderListing {
  readonly folderId: string;
  readonly parentFolderId: string | null;
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  /** The order key among its siblings: content, and never decoration. */
  readonly position: string;
  /** How it orders its notes: by hand, or by name (RN-KNW-056). */
  readonly noteOrder: NoteOrder;
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
      noteOrder?: NoteOrder;
    },
  ): Promise<FolderListing>;
  /** How a folder orders its notes (RN-KNW-056). Answers the folder as it now is. */
  setNoteOrder(
    caller: AgentCaller,
    input: { notebookId: string; folderId: string; noteOrder: NoteOrder },
  ): Promise<FolderListing>;
  /**
   * Renames, redescribes or moves a folder under another parent, in one write
   * that changes only what is given (RN-AGT-051). Answers the folder as it now is.
   */
  updateFolder(
    caller: AgentCaller,
    input: {
      notebookId: string;
      folderId: string;
      name?: string;
      description?: string;
      parentFolderId?: string | null;
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
  /**
   * An upload in parts (#240, RN-PRT-027): the file declared with the size and
   * the hash of the whole, sent in parts by URL or inline, and kept only when
   * the whole hashes to what was declared. It is a transfer of the person, so
   * it reaches Portability rather than Knowledge, and Transfers shows it.
   */
  beginFileUpload(caller: AgentCaller, input: BeginUploadRequest): Promise<UploadStatusDto>;
  fileUploadStatus(caller: AgentCaller, uploadId: string): Promise<UploadStatusDto>;
  sendFilePart(
    caller: AgentCaller,
    uploadId: string,
    part: number,
    input: { sha256: string; contentBase64: string },
  ): Promise<UploadStatusDto>;
  finishFileUpload(caller: AgentCaller, uploadId: string): Promise<FinishedUploadDto>;
  listFileUploads(caller: AgentCaller, notebookId: string | null): Promise<TransferDto[]>;
  /**
   * Asks the person for a file instead of sending it (#253, RN-PRT-030), from
   * nothing or from an upload the agent could not finish, which it replaces.
   */
  requestFile(caller: AgentCaller, input: RequestFileRequest): Promise<TransferDto>;
  /**
   * Throws an open upload away, its parts and the room it reserved, or
   * dismisses a request (RN-PRT-028, RN-PRT-030).
   */
  discardFileUpload(caller: AgentCaller, uploadId: string): Promise<void>;
  /**
   * Starts drawing a note, or a draft, whole or one part, as the person sees
   * it (#260, RN-PRT-032): a job of Portability, which answers an identifier
   * at once, and the image once the renderer drew it.
   */
  startPreview(
    caller: AgentCaller,
    input: {
      notebookId: string;
      noteId?: string;
      content?: string;
      folderId?: string;
      part?: string;
    },
  ): Promise<{ previewId: string }>;
  getPreview(caller: AgentCaller, previewId: string): Promise<PreviewDto>;
  deleteFile(caller: AgentCaller, notebookId: string, fileId: string): Promise<void>;
  /**
   * The Tables of a notebook and their rows (#366), named by their name or
   * their identifier. Every write answers what it wrote, by row.
   */
  listTables(caller: AgentCaller, notebookId: string): Promise<NotebookTableDto[]>;
  createTable(
    caller: AgentCaller,
    notebookId: string,
    input: {
      name: string;
      description: string;
      schema: Record<string, unknown>;
      key: string[] | null;
    },
  ): Promise<NotebookTableDto>;
  alterTable(
    caller: AgentCaller,
    notebookId: string,
    table: string,
    changes: unknown[],
  ): Promise<TableAlteredDto>;
  deleteTable(caller: AgentCaller, notebookId: string, table: string): Promise<{ rows: number }>;
  queryTable(
    caller: AgentCaller,
    notebookId: string,
    table: string,
    query: Partial<TableQueryRequest>,
  ): Promise<TablePageDto>;
  insertRows(
    caller: AgentCaller,
    notebookId: string,
    table: string,
    input: { rows: unknown[]; mode: 'insert' | 'upsert' },
  ): Promise<RowsWrittenDto>;
  updateRows(
    caller: AgentCaller,
    notebookId: string,
    table: string,
    updates: unknown[],
  ): Promise<RowsWrittenDto>;
  deleteRows(
    caller: AgentCaller,
    notebookId: string,
    table: string,
    targets: unknown[],
  ): Promise<RowsWrittenDto>;
  /** Rows from a CSV or an Excel file the notebook keeps, or the schema it suggests. */
  importTable(
    caller: AgentCaller,
    notebookId: string,
    input: Partial<ImportTableRequest> & { file: string },
  ): Promise<TableImportDto>;
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
  /**
   * Every note of the notebook, the most recently written first, by name: what
   * the sweep reads the notices of (RN-AGT-052).
   */
  recentNotes(
    caller: AgentCaller,
    notebookId: string,
  ): Promise<
    Array<{
      noteId: string;
      name: string | null;
      updatedAt: string;
      /** What had changed of the context the live revision declared (RN-KNW-062). */
      staleContext?: readonly string[];
    }>
  >;
  /**
   * The revisions of the notebook's part of a note's context: its Guidance and
   * its structure. The Template's is answered by `template`.
   */
  contextRevisions(
    caller: AgentCaller,
    notebookId: string,
  ): Promise<{ guidance: string | null; structure: string }>;
  /** Without an anchor the note goes last in its folder. */
  createNote(
    caller: AgentCaller,
    input: {
      notebookId: string;
      folderId: string;
      content: string;
      afterNoteId?: string;
      context?: NoteContextRevisions;
    },
  ): Promise<NoteContent>;
  updateNote(
    caller: AgentCaller,
    input: {
      notebookId: string;
      noteId: string;
      content: string;
      baseRevision: string;
      message?: string | null;
      context?: NoteContextRevisions;
    },
  ): Promise<NoteContent>;
  /**
   * First in its folder with no anchor, or right after a note of it. Answers the
   * notes of the folder in their new order.
   */
  reorderNote(
    caller: AgentCaller,
    input: { notebookId: string; noteId: string; afterNoteId: string | null },
  ): Promise<NoteListing[]>;
  /**
   * To another folder of its notebook, keeping its identifier and with it its
   * history (RN-KNW-057, RN-AGT-049): last there with no anchor, or right after
   * a note of that folder.
   */
  moveNote(
    caller: AgentCaller,
    input: {
      notebookId: string;
      noteId: string;
      folderId: string;
      afterNoteId?: string;
      context?: NoteContextRevisions;
    },
  ): Promise<MovedNote>;
  searchNotes(caller: AgentCaller, notebookId: string, query: string): Promise<SearchHit[]>;
  // ---- Notebook models (#353, #354, #359) ---------------------------------
  declareModel(
    caller: AgentCaller,
    notebookId: string,
    declaration: DeclareModelRequest,
  ): Promise<NotebookModelDto>;
  model(caller: AgentCaller, notebookId: string): Promise<NotebookModelDto>;
  listModels(caller: AgentCaller): Promise<ModelListDto['models']>;
  createModelVersion(
    caller: AgentCaller,
    notebookId: string,
    changelog: string,
    tables?: ReadonlyArray<{ name: string; rows: boolean }>,
  ): Promise<ModelVersionDto>;
  modelVersion(
    caller: AgentCaller,
    notebookId: string,
    number: number,
  ): Promise<ModelVersionViewDto>;
  deleteModelVersion(caller: AgentCaller, notebookId: string, number: number): Promise<void>;
  createFromModel(
    caller: AgentCaller,
    input: {
      notebookId: string;
      version: number;
      name: string;
      values: Record<string, unknown>;
    },
  ): Promise<TransferDto>;
  transfer(caller: AgentCaller, transferId: string): Promise<TransferDto>;
  // ---- The community catalog (#360) ---------------------------------------
  publishModel(
    caller: AgentCaller,
    notebookId: string,
    input: { language: string; acceptLicence: boolean },
  ): Promise<PublicModelDto>;
  withdrawModel(caller: AgentCaller, notebookId: string): Promise<void>;
  searchCommunity(
    caller: AgentCaller,
    query: { text: string; language: string | null },
  ): Promise<PublicModelDto[]>;
  communityModel(caller: AgentCaller, publicId: string): Promise<PublicModelDto>;
  communityVersion(
    caller: AgentCaller,
    publicId: string,
    number: number,
  ): Promise<PublicVersionViewDto>;
  createFromCommunity(
    caller: AgentCaller,
    input: { publicId: string; version: number; name: string; values: Record<string, unknown> },
  ): Promise<TransferDto>;
}

export interface DiscoveryGateway {
  relatedNotes(
    caller: AgentCaller,
    input: { notebookId: string; noteId: string; depth?: number },
  ): Promise<RelatedNode>;
  backlinks(caller: AgentCaller, notebookId: string, noteId: string): Promise<NoteReference[]>;
  checkNotebook(caller: AgentCaller, notebookId: string): Promise<NotebookCheck>;
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
 * actionable text, and a missing-argument error carries what the caller
 * needs next (RN-AGT-003).
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
