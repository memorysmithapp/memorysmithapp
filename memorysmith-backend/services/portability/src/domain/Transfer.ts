/**
 * A transfer: a notebook on its way out of the product, or a document on its
 * way in (RN-PRT-018, RN-PRT-019).
 *
 * Both used to run inside the request that asked for them, and the function
 * behind the API stops at 29 seconds, so a notebook large enough could neither
 * leave nor come back. A transfer is a **job with a status** instead: started
 * by the API, run by a worker, its progress recorded where the interface reads
 * it.
 *
 * It is also what makes an export **reachable a second time** (RN-PRT-020). The
 * archive used to be answered as a link of fifteen minutes and nothing listed
 * it, so the file became unreachable within the quarter of an hour and the
 * bucket threw it away the next day. An export is kept until whoever generated
 * it deletes it, it counts towards the storage of the subscription (RN-SUB-021),
 * and it survives the deletion of its notebook: it is a document, not a part of
 * the notebook.
 */

export type TransferKind = 'export' | 'import';

/**
 * `running` is the only state a worker moves out of, and it moves out of it
 * once: a transfer ends as `ready`, `failed` or `cancelled` and stays there.
 */
export type TransferStatus = 'running' | 'ready' | 'failed' | 'cancelled';

export interface Transfer {
  readonly transferId: string;
  readonly kind: TransferKind;
  readonly status: TransferStatus;
  /**
   * Whoever generated it, and the only person who sees it (RN-PRT-020). Other
   * members of the subscription may see less of that notebook than they do, and
   * a listing must never reveal a notebook somebody cannot see (rule 9).
   */
  readonly userId: string;
  readonly notebookId: string | null;
  /** The name of the notebook AS IT WAS, because the notebook may be gone. */
  readonly notebookName: string;
  readonly requestedAt: string;
  readonly finishedAt: string | null;
  /** How far it got: notes read for an export, notes written for an import. */
  readonly done: number;
  readonly total: number;
  readonly bytes: number;
  /** The archive, and the exact revision of it, so deleting destroys the bytes. */
  readonly key: string | null;
  readonly versionId: string | null;
  /** A code the interface turns into words in the language of the person. */
  readonly failure: string | null;
}

/** What a transfer is when it starts, before a worker has touched it. */
export function startedTransfer(input: {
  transferId: string;
  kind: TransferKind;
  userId: string;
  notebookId: string | null;
  notebookName: string;
  requestedAt: string;
  total: number;
}): Transfer {
  return {
    ...input,
    status: 'running',
    finishedAt: null,
    done: 0,
    bytes: 0,
    key: null,
    versionId: null,
    failure: null,
  };
}

/**
 * Where the transfers of a subscription live, and the counter of what its kept
 * exports occupy.
 *
 * A transfer is addressed by the person AND the identifier, which is the whole
 * of RN-PRT-020: asking for the transfer of somebody else is asking for a key
 * that does not exist, so it answers as missing rather than as refused.
 */
export interface TransferStore {
  put(transfer: Transfer): Promise<void>;
  get(userId: string, transferId: string): Promise<Transfer | null>;
  /** Newest first, which is how the panel and the page read them. */
  list(userId: string): Promise<Transfer[]>;
  patch(userId: string, transferId: string, changes: Partial<Transfer>): Promise<void>;
  remove(userId: string, transferId: string): Promise<void>;
  /** What the kept exports of the SUBSCRIPTION occupy (RN-SUB-021). */
  keptBytes(): Promise<number>;
  addKeptBytes(delta: number): Promise<void>;
}
