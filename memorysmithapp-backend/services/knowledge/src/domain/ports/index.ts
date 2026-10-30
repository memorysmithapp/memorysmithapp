/**
 * Ports of the Knowledge context.
 *
 * None of them takes a subscriptionId as an argument: the subscription belongs
 * to the REPOSITORY, resolved per request from the token claim, and the
 * composition root instantiates repositories per request. There is no code
 * path that builds one without a subscription, and the compiler is what says
 * so (INV-01, PE2).
 */

import type {
  Authorship,
  ContentId,
  ContentRef,
  DomainError,
  DomainEvent,
  FileId,
  FolderId,
  Instant,
  NoteId,
  Position,
  Slug,
  NotebookId,
  ConcurrencyError,
  Result,
  TableId,
  DashboardId,
} from '@memorysmithapp/kernel';
import type { Notebook } from '../notebook/Notebook.js';
import type { Note } from '../note/Note.js';
import type { NotebookFile } from '../file/NotebookFile.js';
import type { Table } from '../table/Table.js';
import type { Row } from '../table/Row.js';
import type { Dashboard } from '../dashboard/Dashboard.js';
import type { ContentSlot } from '../content-slot/ContentSlot.js';
import type { Guidance } from '../content-slot/Guidance.js';
import type { Template } from '../content-slot/Template.js';
import type { NoteOrder } from '../services/NotePlacement.js';

export interface NotebookRepository {
  /**
   * `for: 'write'` reads the NEWEST state of the partition. A write is
   * validated against the aggregate it loads, and a replica that has not
   * caught up answers a notebook without the folder written a moment ago —
   * which refuses the write with a `404` naming that folder (#154). A read
   * that answers a person stays eventual, where it costs half and a fraction
   * of a second behind is what it is for.
   */
  findById(id: NotebookId, options?: { for: 'read' | 'write' }): Promise<Notebook | null>;
  /** Every notebook of the subscription, which is one partition of GSI1. */
  listAll(): Promise<Notebook[]>;
  /**
   * Resolves a slug to the notebook that holds it in this subscription, which is
   * how the guard of RN-KNW-032 is read before a write attempts it.
   */
  findBySlug(slug: Slug): Promise<Notebook | null>;
  save(notebook: Notebook): Promise<Result<void, ConcurrencyError>>;
}

/**
 * A note is found by its identifier, and by its name only inside ONE folder:
 * that is where a name is a key (RN-KNW-037). Across a notebook two notes may
 * carry one name, and what resolves a name there is Discovery, over its own
 * projection.
 *
 * `save` and `saveMoved` refuse, with a `ConcurrencyError` whose details carry
 * `code: 'ALREADY_EXISTS'`, a write that would leave two live notes of one name
 * in one folder (RN-KNW-042). That refusal is final and is never retried: a
 * lost optimistic lock may be tried again, a taken name is still taken.
 */
export interface NoteRepository {
  findById(notebook: NotebookId, id: NoteId): Promise<Note | null>;
  /**
   * The live note of this folder that carries this name, read consistently: it
   * is what a refusal names, and what a retry after a lost answer finds.
   */
  findByName(notebook: NotebookId, folder: FolderId, name: string): Promise<NoteId | null>;
  /** Notes of a folder, in the defined order, straight from GSI2. */
  listByFolder(notebook: NotebookId, folder: FolderId): Promise<Note[]>;
  listByNotebook(notebook: NotebookId): Promise<Note[]>;
  /** Just identity and order key, which is all a placement decision needs. */
  siblingOrder(notebook: NotebookId, folder: FolderId): Promise<NoteOrder[]>;
  save(note: Note): Promise<Result<void, ConcurrencyError>>;
  /**
   * The cross-notebook move, the only operation that writes into two notebook
   * partitions in one transaction (INV-04). It is its own method because
   * the item key itself changes, so it is a Delete plus a Put and not an
   * Update.
   */
  saveMoved(note: Note, from: { notebookId: NotebookId }): Promise<Result<void, ConcurrencyError>>;
}

/**
 * The two Content Slots that are not notes, each an aggregate of its own
 * (RN-KNW-044). They live in the partition of their notebook, so finding one
 * is a single read of a key the parent identifies, and saving one is a write
 * of one item plus its event: it never touches the `META` item, and therefore
 * never contends with a tree mutation (INV-10).
 *
 * There is one `save` and not two, because what differs between a Guidance and
 * a Template is the key, and the key is the adapter's business.
 */
export interface ContentSlotRepository {
  findGuidance(notebook: NotebookId): Promise<Guidance | null>;
  findTemplate(notebook: NotebookId, folder: FolderId): Promise<Template | null>;
  /** Every Template of a notebook, which is what an export reads. */
  listTemplates(notebook: NotebookId): Promise<Template[]>;
  save(slot: ContentSlot): Promise<Result<void, ConcurrencyError>>;
}

/**
 * The content port. There is no `purge` here, and the absence is deliberate: no
 * domain use case may destroy a revision, because if it could, deleting a note
 * would quietly break the historical reconstruction the trail promises. Only
 * the purge destroys one, and only as part of a deletion (INV-08): there is no
 * administrative path to it anywhere in the product (RN-AUD-007, removed).
 */
export interface ContentStore {
  /** A new slot with its first revision. */
  create(markdown: string): Promise<ContentRef>;
  /** A new revision of the same slot. */
  overwrite(slot: ContentId, markdown: string): Promise<ContentRef>;
  /** The exact revision the ref points at. */
  read(ref: ContentRef): Promise<string>;
}

/**
 * The numbers a folder issues (RN-KNW-043): whole, increasing, from 1, one per
 * request, never issued twice and never reused. The product knows the number
 * and nothing else — no name is checked against it, and a prefix or a padding
 * is a convention of the notebook (PP4).
 *
 * It is not part of any note transaction and never touches `META` (INV-10): two
 * agents asking one folder at once are served one after the other, and neither
 * is cancelled. Issuing a number is not an audited event: the number enters the
 * record when a note names itself with it, and that write is.
 */
export interface FolderNumbers {
  /** Issues the next number of the folder, in one atomic step. */
  next(notebook: NotebookId, folder: FolderId, by: Authorship): Promise<number>;
  /** The last number each folder of the notebook issued, for the folders that issued any. */
  lastIssued(notebook: NotebookId): Promise<Map<string, number>>;
  /**
   * Brings the counter of a folder up to `lastNumber`, and never down: what an
   * import restores, so a notebook brought back never issues a number its
   * notes already carry (RN-PRT-016).
   */
  restore(
    notebook: NotebookId,
    folder: FolderId,
    lastNumber: number,
    by: Authorship,
  ): Promise<void>;
}

/**
 * Which types a notebook accepts, and whether bytes support the one they were
 * declared under (#166, RN-KNW-075).
 *
 * It is a PORT and not a table in here, for the reason the reserved vocabulary
 * is injected rather than transcribed: the list is a decision of the product,
 * it is published in the contracts both ends read, and the domain of a context
 * imports the kernel and nothing else. The composition root is the one layer
 * allowed to know it.
 */
export interface FileTypes {
  /** The whole list, for a refusal that names what is accepted. */
  readonly accepted: readonly string[];
  /** The type as this catalogue names it, or `null` when it is not on the list. */
  canonical(mimeType: string): string | null;
  /** Whether these bytes can be what they say they are. */
  supports(mimeType: string, bytes: Uint8Array): boolean;
  /**
   * Whether a browser **shows** this type on its own, which is what decides
   * whether the file may be served `inline` (#171). It comes through the port
   * for the reason the rest of the catalogue does: the list belongs to the
   * contracts the product publishes, and `application/` reads it through a
   * port rather than importing it.
   */
  opens(mimeType: string): boolean;
}

/** A link a browser follows on its own, which is what an `<img>` needs. */
export interface SignedFile {
  readonly url: string;
  readonly expiresAt: Instant;
}

/**
 * The bytes of a file (#166). Separate from `ContentStore` on purpose: that
 * one speaks Markdown and this one speaks bytes, and a port that did both
 * would have to say `string | Uint8Array` everywhere and be told apart by a
 * flag.
 *
 * There is no `purge` here either, for the reason the content port has none:
 * destroying a revision belongs to one principal and reaches the store through
 * a port of its own (INV-08).
 */
/**
 * How the object store is asked to serve the bytes (#171). `inline` is a file
 * a browser shows where it was opened; `attachment` is one it saves under the
 * name it was given. The policy of which is which belongs to the application
 * and not here: this port signs what it was told to sign.
 */
export type FileDisposition = 'inline' | 'attachment';

export interface FileStore {
  put(bytes: Uint8Array, mimeType: string): Promise<ContentRef>;
  read(ref: ContentRef): Promise<Uint8Array>;
  /**
   * The first bytes of a whole an upload in parts assembled (RN-PRT-027), which
   * is all the check of a type reads; `null` when nothing is there. The key is
   * one of the subscription's own uploads and nothing else.
   */
  peekAssembled(key: string, versionId: string, bytes: number): Promise<Uint8Array | null>;
  /**
   * Makes a file out of that whole, if and only if its bytes hash to `sha256`:
   * reading it hashes it, and a copy inside the store writes it where a file
   * lives, so the bytes never pass through the function a second time. It
   * answers `mismatch` rather than keeping what merely looks like the file.
   */
  adoptAssembled(input: {
    key: string;
    versionId: string;
    mimeType: string;
    sha256: string;
  }): Promise<ContentRef | 'mismatch' | null>;
  signedUrl(
    ref: ContentRef,
    downloadName: string,
    mimeType: string,
    disposition: FileDisposition,
  ): Promise<SignedFile>;
}

/**
 * The files of a notebook (#166, RN-KNW-048).
 *
 * `save` guards the name: a notebook holds one file of each name
 * (RN-KNW-049), and the guard is an item written under a condition and not a
 * read followed by a write, because two uploads of one name arriving together
 * would both find the name free.
 */
export interface FileRepository {
  findById(notebook: NotebookId, file: FileId): Promise<NotebookFile | null>;
  findByName(notebook: NotebookId, name: string): Promise<NotebookFile | null>;
  /** Every live file of the notebook, in the order they were kept. */
  list(notebook: NotebookId): Promise<NotebookFile[]>;
  save(file: NotebookFile): Promise<Result<void, DomainError>>;
}

/** One row written by one operation (#366): kept, replaced or deleted. */
export type RowWrite =
  | { readonly kind: 'insert'; readonly row: Row }
  | { readonly kind: 'replace'; readonly row: Row; readonly expectedVersion: number }
  | { readonly kind: 'delete'; readonly rowId: string; readonly expectedVersion: number };

/** What the relay counted of a table: rows and bytes (ADR-010). */
export interface TableUsage {
  readonly rows: number;
  readonly bytes: number;
}

/**
 * The Tables of a notebook and their rows (#366, RN-KNW-066).
 *
 * `save` guards the name, as the file repository does. `writeRows` is one
 * transaction holding the rows, the events, and a check that the table is
 * still at the version the rows were validated against, so a schema changed
 * meanwhile refuses the write instead of letting a row that no longer fits in.
 * An alteration that rewrites the rows first `lock`s the table, so no row is
 * written while its rows are read and rewritten, and `replaceRows` then moves
 * the table to a new generation of rows, written beside the old one: a reader
 * sees one generation or the other, never both. A lock lapses on its own, so
 * an alteration that died midway leaves the table writable again.
 */
export interface TableRepository {
  findById(notebook: NotebookId, table: TableId): Promise<Table | null>;
  findByName(notebook: NotebookId, name: string): Promise<Table | null>;
  list(notebook: NotebookId): Promise<Table[]>;
  usage(table: Table): Promise<TableUsage>;
  save(table: Table): Promise<Result<void, DomainError>>;
  /** Every row of the table's generation, in the order they were inserted. */
  rows(table: Table): Promise<Row[]>;
  findRows(table: Table, rowIds: readonly string[]): Promise<Row[]>;
  writeRows(
    table: Table,
    writes: readonly RowWrite[],
    events: readonly DomainEvent[],
  ): Promise<Result<void, DomainError>>;
  /** The table, locked against row writes; refused when it changed or is locked. */
  lock(table: Table): Promise<Result<Table, DomainError>>;
  unlock(table: Table): Promise<void>;
  /**
   * Writes `rows` as the generation `next` names, then saves `next`, which
   * unlocks it, then removes every other generation. `next` was planned from
   * the locked table, so a change made meanwhile refuses the move.
   */
  replaceRows(next: Table, rows: readonly Row[]): Promise<Result<void, DomainError>>;
}

/**
 * The Dashboards of a notebook (#368), each one item beside the guard of its
 * name. `save` writes a dashboard as created or changed, and removes it, its
 * name with it, once it is deleted: a dashboard holds no data to purge.
 */
export interface DashboardRepository {
  findById(notebook: NotebookId, dashboard: DashboardId): Promise<Dashboard | null>;
  findByName(notebook: NotebookId, name: string): Promise<Dashboard | null>;
  list(notebook: NotebookId): Promise<Dashboard[]>;
  save(dashboard: Dashboard): Promise<Result<void, DomainError>>;
}

/** A cell of a sheet as a file holds it: text, a number, true or false, a date as ISO, or nothing. */
export type SheetCell = string | number | boolean | null;

/** One sheet of a spreadsheet, or the one sheet of a CSV: its header and its rows. */
export interface Sheet {
  readonly name: string;
  readonly header: readonly string[];
  readonly rows: ReadonlyArray<readonly SheetCell[]>;
}

/**
 * Reads the rows of a CSV or an Excel file a notebook keeps (#366). It is a
 * port because reading a spreadsheet takes a library, and the domain of a
 * context imports the kernel and nothing else.
 */
export interface SheetReader {
  /** The types it reads, which a refusal names. */
  readonly accepted: readonly string[];
  read(bytes: Uint8Array, mimeType: string): Promise<Result<Sheet[], DomainError>>;
}

export interface EventPublisher {
  publish(events: DomainEvent[]): Promise<void>;
}

/** Re-exported so use cases import their ports from one place. */
export type { Position, NoteOrder };
