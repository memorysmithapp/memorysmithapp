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
 * A note is found by its identifier and by nothing else. There is no lookup by
 * name here, because a notebook holds no key: two notes may carry one name
 * (RN-KNW-037), and what resolves a name is Discovery, over its own
 * projection.
 */
export interface NoteRepository {
  findById(notebook: NotebookId, id: NoteId): Promise<Note | null>;
  /** Notes of a folder, in the defined order, straight from GSI2. */
  listByFolder(notebook: NotebookId, folder: FolderId): Promise<Note[]>;
  listByNotebook(notebook: NotebookId): Promise<Note[]>;
  /**
   * Every live note of these folders, read consistently and to the last page.
   * It is what a CASCADE deletes (RN-KNW-040), so it cannot miss a note
   * written a moment ago the way an index would.
   */
  listLiveInFolders(notebook: NotebookId, folders: readonly FolderId[]): Promise<Note[]>;
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

export interface EventPublisher {
  publish(events: DomainEvent[]): Promise<void>;
}

/** Re-exported so use cases import their ports from one place. */
export type { Position, NoteOrder };
