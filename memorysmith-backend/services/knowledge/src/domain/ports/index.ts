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
  DomainEvent,
  FolderId,
  NoteId,
  Position,
  Slug,
  NotebookId,
  ConcurrencyError,
  Result,
} from '@memorysmith/kernel';
import type { Notebook } from '../notebook/Notebook.js';
import type { Note } from '../note/Note.js';
import type { ContentSlot } from '../content-slot/ContentSlot.js';
import type { Guidance } from '../content-slot/Guidance.js';
import type { Template } from '../content-slot/Template.js';
import type { NoteOrder } from '../services/NotePlacement.js';

export interface NotebookRepository {
  findById(id: NotebookId): Promise<Notebook | null>;
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

export interface EventPublisher {
  publish(events: DomainEvent[]): Promise<void>;
}

/** Re-exported so use cases import their ports from one place. */
export type { Position, NoteOrder };
