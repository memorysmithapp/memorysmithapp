/**
 * Ports of the Knowledge context (architecture-guide.md, section 7.1).
 *
 * None of them takes a subscriptionId as an argument: the subscription belongs
 * to the REPOSITORY, resolved per request from the token claim, and the
 * composition root instantiates repositories per request. There is no code
 * path that builds one without a subscription, and the compiler is what says
 * so (PE2, section 8.2).
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
} from '@memorysmith/kernel';
import type { Notebook } from '../notebook/Notebook.js';
import type { Note } from '../note/Note.js';
import type { NotebookFile } from '../file/NotebookFile.js';
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
   * partitions in one transaction (section 9.2). It is its own method because
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
 * never contends with a tree mutation (section 10.2).
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
 * The content port. There is no `purge` here, and the absence is deliberate:
 * no domain use case may destroy a revision, because if it could, deleting a
 * note would quietly break the historical reconstruction that section 12.3
 * promises. Nothing else destroys one either: there is no administrative path
 * to it anywhere in the product (RN-AUD-006, and RN-AUD-007, removed).
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
 * It is not part of any note transaction and never touches `META` (section
 * 10.2): two agents asking one folder at once are served one after the other,
 * and neither is cancelled. Issuing a number is not an audited event: the
 * number enters the record when a note names itself with it, and that write is.
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
 * declared under (#166, RN-KNW-050).
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
 * a port of its own (rule 8).
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

export interface EventPublisher {
  publish(events: DomainEvent[]): Promise<void>;
}

/** Re-exported so use cases import their ports from one place. */
export type { Position, NoteOrder };
