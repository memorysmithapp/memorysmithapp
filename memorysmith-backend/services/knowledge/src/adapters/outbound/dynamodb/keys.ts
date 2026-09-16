/**
 * Key builders for mv-knowledge (architecture-guide.md, section 9.3).
 *
 * EVERY key starts with the subscription, and the builder accepts only a
 * SubscriptionId value object, which can only be produced from a verified
 * token claim. That is what turns "we always scope by subscription" from a
 * code-review rule into a compiler rule (PE2, section 8.2).
 *
 * The lexicographic order of the sort keys is CHOSEN, not accidental:
 * FSTAT#, FTPL#, GUIDANCE and LIMIT# fall between FOLDER# and META, so the
 * whole aggregate, the counters, the two kinds of Content Slot AND the role
 * ceilings come back in a single Query over a single partition. EVENT# sorts
 * before that range; NOTE#, SEEN# and SLUG# sort after it.
 */

import {
  sha256Hex,
  type FolderId,
  type NoteId,
  type Position,
  type SubscriptionId,
  type NotebookId,
} from '@memorysmith/kernel';

/** The sort key of the notebook item itself. */
export const META = 'META';
/** Lower bound of the single-Query range that loads the whole aggregate. */
export const AGGREGATE_RANGE_START = 'FOLDER#';
/** Upper bound: META itself, inclusive. */
export const AGGREGATE_RANGE_END = META;

export class KnowledgeKeys {
  constructor(private readonly subscriptionId: SubscriptionId) {}

  /** Every item of a notebook lives in this one partition. */
  notebook(notebookId: NotebookId): string {
    return `S#${this.subscriptionId.value}#NOTEBOOK#${notebookId.value}`;
  }

  folder(folderId: FolderId): string {
    return `FOLDER#${folderId.value}`;
  }

  /** Note counter of one folder, maintained by the outbox relay. */
  folderStat(folderId: FolderId): string {
    return `FSTAT#${folderId.value}`;
  }

  /** Note counter of the whole notebook, projected into GSI1 as NBSTAT#. */
  notebookStat(): string {
    return 'FSTAT';
  }

  /**
   * The Template of a folder, one item and therefore at most one Template
   * (RN-KNW-044). It deliberately does NOT start with `FOLDER#`: the tree
   * loader reads every key that does as a folder, and this is not one. It
   * still falls inside the aggregate range, so the tree learns which folders
   * carry a Template without a second query.
   */
  template(folderId: FolderId): string {
    return `FTPL#${folderId.value}`;
  }

  /** The Guidance of the notebook: one notebook, one key, at most one item. */
  guidance(): string {
    return 'GUIDANCE';
  }

  limit(userId: string): string {
    return `LIMIT#${userId}`;
  }

  note(noteId: NoteId): string {
    return `NOTE#${noteId.value}`;
  }

  /**
   * The name a live note of a folder holds (RN-KNW-037, RN-KNW-042). The key
   * carries the HASH of the name and not the name: a name has no length limit
   * (RN-KNW-035) and a sort key holds 1,024 bytes. It sorts after `META`, so
   * the Query that loads the tree never reads it.
   */
  noteNameGuard(folderId: FolderId, name: string): string {
    return `NAME#${folderId.value}#${sha256Hex(name)}`;
  }

  /** I1 in the database: unique among siblings (RN-KNW-002). */
  folderSlugGuard(parentFolderId: FolderId | null, slug: string): string {
    return `SLUG#${parentFolderId?.value ?? 'ROOT'}#${slug}`;
  }

  /** Outbox item; the ULID orders publication by generation time. */
  event(eventId: string): string {
    return `EVENT#${eventId}`;
  }

  /** Dedup marker that makes a counter update exactly-once (section 10.3). */
  seen(eventId: string): string {
    return `SEEN#${eventId}`;
  }

  // ---- GSI1: notebooks of the subscription, already carrying the count --------

  /**
   * One partition per subscription, which is what listing notebooks asks for now
   * that nothing sits between the subscription and the notebook. It doubles as
   * the table partition of the slug guard below: same string, different table
   * attribute, and both start with the subscription (rule 1).
   */
  subscriptionNotebooks(): string {
    return `S#${this.subscriptionId.value}#NOTEBOOKS`;
  }

  gsi1Notebook(notebookId: NotebookId): string {
    return `NOTEBOOK#${notebookId.value}`;
  }

  gsi1NotebookStat(notebookId: NotebookId): string {
    return `NBSTAT#${notebookId.value}`;
  }

  /**
   * The Guidance item, projected into GSI1 so that LISTING the notebooks
   * answers which of them have one. The listing reads one partition of the
   * index and never loads a notebook, so without this entry the flag would be
   * a guess.
   */
  gsi1NotebookGuidance(notebookId: NotebookId): string {
    return `NBGUID#${notebookId.value}`;
  }

  /**
   * Stored bytes of the whole subscription, maintained by the outbox relay
   * (RN-SUB-021). It lives in the subscription's partition and not in a
   * notebook's, because a plan limits the subscription, and a notebook waiting
   * for the purge is still holding what it holds.
   */
  storageUsage(): string {
    return 'USAGE';
  }

  /**
   * Unique WITHIN THE SUBSCRIPTION (RN-KNW-032). It lives in the notebooks
   * partition of the TABLE, not in GSI1, because a transaction cannot condition
   * on an index: the guard has to be an item the write can lock against.
   */
  notebookSlugGuard(slug: string): string {
    return `NBSLUG#${slug}`;
  }

  // ---- GSI2: notes of a folder, in the defined order -----------------------

  folderPartition(folderId: FolderId): string {
    return `S#${this.subscriptionId.value}#FOLDER#${folderId.value}`;
  }

  /**
   * Sparse on purpose: these attributes only exist while deletedAt does not,
   * so a deleted note leaves every listing without a filter anywhere
   * (section 12.4).
   */
  gsi2Note(position: Position, noteId: NoteId): string {
    return `NOTE#${position.value}#${noteId.value}`;
  }
}
