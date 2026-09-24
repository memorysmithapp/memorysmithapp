/**
 * What fills the space of a subscription, as counters (#197, RN-SUB-024).
 *
 * The quota is one number, the stored bytes (RN-SUB-021), and the screen that
 * shows it asks two more questions of it: WHAT fills it and WHICH notebook
 * holds it. Answering either by reading content would mean reading every note
 * and every file of every notebook to draw a panel, so both are answered the
 * way the total already is: counters, moved by the outbox relay from the
 * events that move the total, in the same transaction and under the same
 * dedup marker (architecture-guide.md §10.3).
 *
 * This file is the arithmetic and nothing else: which event moves which
 * counter, and by how much. It takes the envelope as plain data and imports
 * no SDK, so the relay applies it to the table and a test, or the in-memory
 * harness, applies it to a map, and both apply the same rules.
 *
 * Two rules decide most of it:
 *
 *  - **A count leaves with its bytes.** A note, a Template or a Guidance
 *    invalidated by its parent keeps its bytes counted until the purge
 *    destroys them (RN-KNW-047), so it stays counted as a note until then
 *    too; one deleted on its own left both at the deletion.
 *  - **A revision is counted and never charged.** Every write of Markdown
 *    content adds one to `revisions`, and the purge takes away how many it
 *    destroyed; only the bytes of the current revision are in the total.
 */

/** The counters of the whole subscription, beside `storedBytes`. */
export interface SubscriptionUsageCounters {
  readonly notebooks: number;
  readonly folders: number;
  readonly revisions: number;
  readonly noteCount: number;
  readonly noteBytes: number;
  readonly fileCount: number;
  readonly fileBytes: number;
  /** A Guidance and the Templates, together: the screen calls them others. */
  readonly otherCount: number;
  readonly otherBytes: number;
}

/** The counters of one notebook. */
export interface NotebookUsageCounters {
  readonly bytes: number;
  readonly notes: number;
  readonly folders: number;
  readonly files: number;
}

export type SubscriptionCounter = keyof SubscriptionUsageCounters;
export type NotebookCounter = keyof NotebookUsageCounters;

/**
 * What the counters say now, read without reading any content: the totals of
 * the subscription and a line per notebook that holds anything. The port the
 * use case reads them through; the relay is what writes them.
 */
export interface StorageUsageSnapshot {
  readonly subscription: SubscriptionUsageCounters;
  readonly notebooks: ReadonlyMap<string, NotebookUsageCounters>;
}

export interface StorageUsageReader {
  read(): Promise<StorageUsageSnapshot>;
}

/** What one event moves: never an absolute value, always a delta. */
export interface UsageChange {
  readonly subscription: Partial<Record<SubscriptionCounter, number>>;
  readonly notebooks: ReadonlyArray<{
    readonly notebookId: string;
    readonly delta: Partial<Record<NotebookCounter, number>>;
  }>;
  /**
   * The notebook whose counters stop existing, because its purge ended: it
   * leaves the list at the instant its last bytes leave the total.
   */
  readonly forget: string | null;
}

/** The envelope as the arithmetic reads it. */
export interface UsageEvent {
  readonly type: string;
  readonly storageDelta: number;
  readonly contentRef: unknown;
  readonly payload: Record<string, unknown>;
}

export const EMPTY_SUBSCRIPTION_USAGE: SubscriptionUsageCounters = {
  notebooks: 0,
  folders: 0,
  revisions: 0,
  noteCount: 0,
  noteBytes: 0,
  fileCount: 0,
  fileBytes: 0,
  otherCount: 0,
  otherBytes: 0,
};

export const EMPTY_NOTEBOOK_USAGE: NotebookUsageCounters = {
  bytes: 0,
  notes: 0,
  folders: 0,
  files: 0,
};

const NONE: UsageChange = { subscription: {}, notebooks: [], forget: null };

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function count(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : 0;
}

/**
 * Whether a purged unit was still counted when the purge found it. An event
 * written before the flag existed says so through its bytes: only a unit that
 * was still counted declares any.
 */
function wasLive(event: UsageEvent): boolean {
  const live = event.payload['live'];
  return typeof live === 'boolean' ? live : event.storageDelta < 0;
}

function bytesOfRef(ref: unknown): number {
  if (typeof ref !== 'object' || ref === null) return 0;
  return count((ref as Record<string, unknown>)['bytes']);
}

function one(
  notebookId: string,
  delta: Partial<Record<NotebookCounter, number>>,
): UsageChange['notebooks'] {
  return notebookId ? [{ notebookId, delta }] : [];
}

/** Which counters one event moves, and by how much. */
export function usageChangeOf(event: UsageEvent): UsageChange {
  const bytes = event.storageDelta;
  const notebookId = text(event.payload['notebookId']);

  switch (event.type) {
    case 'NotebookCreated':
      return { subscription: { notebooks: 1 }, notebooks: [], forget: null };

    // The folders of a deleted notebook are items until its tree is purged, so
    // they stay counted until then, and they leave with the notebook.
    case 'NotebookPurged':
      return {
        subscription: { notebooks: -1, folders: -count(event.payload['folderCount']) },
        notebooks: [],
        forget: notebookId || null,
      };

    case 'FolderAdded':
      return {
        subscription: { folders: 1 },
        notebooks: one(notebookId, { folders: 1 }),
        forget: null,
      };

    // A removed folder and its subtree go in the write that removes them.
    case 'FolderRemoved': {
      const removed = Array.isArray(event.payload['removedFolderIds'])
        ? (event.payload['removedFolderIds'] as unknown[]).length
        : 0;
      return {
        subscription: { folders: -removed },
        notebooks: one(notebookId, { folders: -removed }),
        forget: null,
      };
    }

    case 'NoteCreated':
      return {
        subscription: { noteCount: 1, noteBytes: bytes, revisions: 1 },
        notebooks: one(notebookId, { notes: 1, bytes }),
        forget: null,
      };

    case 'NoteUpdated':
      return {
        subscription: { noteBytes: bytes, revisions: 1 },
        notebooks: one(notebookId, { bytes }),
        forget: null,
      };

    case 'NoteDeleted':
      return {
        subscription: { noteCount: -1, noteBytes: bytes },
        notebooks: one(notebookId, { notes: -1, bytes }),
        forget: null,
      };

    // A move between notebooks moves nothing in the subscription and moves the
    // note, with the bytes of its current revision, from one to the other.
    case 'NoteMoved': {
      const from = text(event.payload['fromNotebookId']);
      const to = text(event.payload['toNotebookId']);
      if (!from || !to || from === to) return NONE;
      const size = bytesOfRef(event.contentRef);
      return {
        subscription: {},
        notebooks: [
          { notebookId: from, delta: { notes: -1, bytes: -size } },
          { notebookId: to, delta: { notes: 1, bytes: size } },
        ],
        forget: null,
      };
    }

    case 'NotePurged': {
      const revisions = -count(event.payload['revisions']);
      if (!wasLive(event)) {
        return { subscription: { revisions }, notebooks: [], forget: null };
      }
      return {
        subscription: { revisions, noteCount: -1, noteBytes: bytes },
        notebooks: one(notebookId, { notes: -1, bytes }),
        forget: null,
      };
    }

    case 'FileKept':
      return {
        subscription: { fileCount: 1, fileBytes: bytes },
        notebooks: one(notebookId, { files: 1, bytes }),
        forget: null,
      };

    case 'FileDeleted':
      return {
        subscription: { fileCount: -1, fileBytes: bytes },
        notebooks: one(notebookId, { files: -1, bytes }),
        forget: null,
      };

    case 'GuidanceUpdated':
    case 'TemplateUpdated':
      return {
        subscription: {
          otherBytes: bytes,
          revisions: 1,
          ...(event.payload['created'] === true ? { otherCount: 1 } : {}),
        },
        notebooks: one(notebookId, { bytes }),
        forget: null,
      };

    case 'GuidanceDeleted':
    case 'TemplateDeleted':
      return {
        subscription: { otherCount: -1, otherBytes: bytes },
        notebooks: one(notebookId, { bytes }),
        forget: null,
      };

    case 'GuidancePurged':
    case 'TemplatePurged': {
      const revisions = -count(event.payload['revisions']);
      if (!wasLive(event)) {
        return { subscription: { revisions }, notebooks: [], forget: null };
      }
      return {
        subscription: { revisions, otherCount: -1, otherBytes: bytes },
        notebooks: one(notebookId, { bytes }),
        forget: null,
      };
    }

    default:
      return NONE;
  }
}

/** The change with every zero taken out, which is what a write needs. */
export function withoutZeros(change: UsageChange): UsageChange {
  const subscription = Object.fromEntries(
    Object.entries(change.subscription).filter(([, value]) => value !== 0),
  ) as UsageChange['subscription'];
  const notebooks = change.notebooks
    .map((each) => ({
      notebookId: each.notebookId,
      delta: Object.fromEntries(
        Object.entries(each.delta).filter(([, value]) => value !== 0),
      ) as Partial<Record<NotebookCounter, number>>,
    }))
    .filter((each) => Object.keys(each.delta).length > 0);
  return { subscription, notebooks, forget: change.forget };
}

/** Whether applying the change would write anything at all. */
export function isEmptyChange(change: UsageChange): boolean {
  const trimmed = withoutZeros(change);
  return (
    Object.keys(trimmed.subscription).length === 0 &&
    trimmed.notebooks.length === 0 &&
    trimmed.forget === null
  );
}
