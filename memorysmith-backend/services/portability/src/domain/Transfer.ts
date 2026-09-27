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

/**
 * `request` is a file an agent asked the person for instead of sending it
 * itself (#253, RN-PRT-030): it has no bytes, reserves no room, and ends when
 * the person keeps the file it names.
 */
export type TransferKind = 'export' | 'import' | 'agent' | 'request';

/**
 * `running` is the only state a worker moves out of, and it moves out of it
 * once: a transfer ends as `ready`, `failed` or `cancelled` and stays there.
 *
 * An upload of an agent never reaches `ready` on the record: the moment it is
 * ready it is a file of the notebook, and the record goes (RN-PRT-028). It is
 * `running` while parts may still arrive — for days, if nobody sends them —
 * and `failed` when its finish found the bytes wrong.
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
  /**
   * The file an IMPORT came from, as the person chose it, or nothing — a
   * transfer recorded before this was kept, and every export, whose file is
   * named after the notebook when it is downloaded (RN-PRT-019).
   */
  readonly fileName: string | null;
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
  /** What an upload of an agent is and where its parts are (RN-PRT-027); only on that kind. */
  readonly upload?: TransferUpload | undefined;
  /** The file an agent asked the person for (RN-PRT-030); only on a request. */
  readonly request?: TransferRequest | undefined;
}

/**
 * A file an agent asked the person for (#253, RN-PRT-030): what travels with a
 * file, declared by the agent as it would declare an upload, and nothing of
 * its bytes. The name is `fileName` of the transfer, and the file is kept under
 * it, so the embed the agent wrote draws it without anybody touching the note.
 */
export interface TransferRequest {
  readonly mimeType: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly path: string;
  /** What the file is for, in the words of the agent. */
  readonly purpose: string;
  /** The connector that asked, as the token names it. */
  readonly platform: string | null;
  /**
   * The size and SHA-256 the agent knows of the file, when it knows them: a
   * reference the person is shown, never a lock — what an agent knows may be
   * a copy its client reduced.
   */
  readonly expectedSize: number | null;
  readonly expectedSha256: string | null;
}

/**
 * An upload in parts (RN-PRT-027). The file it becomes is declared up front —
 * name, type, description, tags and path, as `keep_file` takes them — with the
 * size and the hash of the whole, which the finish holds the bytes to.
 *
 * Its parts live under the transfer, `s/{subscriptionId}/uploads/{transferId}/`,
 * and never under the notebook: the key names no notebook (rule 4), so the
 * purge of a deleted notebook does not reach them, and pointing the upload at
 * another notebook moves no byte (RN-PRT-029).
 */
export interface TransferUpload {
  readonly mimeType: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly path: string;
  /** What the file is for, in the words of the agent. */
  readonly purpose: string;
  /** The connector that started it, as the token names it, or `null` for a person. */
  readonly platform: string | null;
  readonly transport: 'url' | 'inline';
  readonly sha256: string;
  readonly partSize: number;
  readonly partCount: number;
  /**
   * The multipart upload of the store, on an upload by URL: its parts reach the
   * store without passing through the API, so the store is what says which
   * arrived.
   */
  readonly multipartId: string | null;
  /**
   * The inline parts that arrived, by number, each with the exact revision it
   * was written as — so discarding destroys the bytes rather than hiding them
   * behind a delete marker.
   */
  readonly parts: Readonly<Record<string, string>>;
  /**
   * The revision of the whole, once the parts were joined. A finish refused for
   * a reason that leaves the upload open — a name taken meanwhile, no room, the
   * notebook unavailable — keeps it, so asking again joins nothing twice.
   */
  readonly assembled: string | null;
  readonly lastPartAt: string | null;
  /** The request of the person this upload fulfils, when it does (RN-PRT-030). */
  readonly fulfils?: string | null | undefined;
}

/** The part size of an upload by URL: S3 asks at least 5 MiB of every part but the last. */
export const UPLOAD_URL_PART_BYTES = 8 * 1024 * 1024;
/** What one file may be through an upload in parts, whichever way it travels. */
export const UPLOAD_MAX_BYTES = 100 * 1024 * 1024;
/** What an inline upload may be in all: the door a call already had (RN-KNW-053). */
export const UPLOAD_INLINE_MAX_BYTES = 4 * 1024 * 1024;
/** The bounds of an inline part, and how many an inline upload may have. */
export const UPLOAD_INLINE_PART_MIN = 1024;
export const UPLOAD_INLINE_PART_MAX = 1024 * 1024;
export const UPLOAD_INLINE_MAX_PARTS = 256;

/** The prefix every part of one upload lives under. */
export function uploadPrefixOf(subscriptionId: string, transferId: string): string {
  return `s/${subscriptionId}/uploads/${transferId}/`;
}

/** Where the whole of an upload is assembled before it becomes a file. */
export function uploadAssemblyKeyOf(subscriptionId: string, transferId: string): string {
  return `${uploadPrefixOf(subscriptionId, transferId)}whole`;
}

/** Where one inline part of an upload is kept. */
export function uploadPartKeyOf(subscriptionId: string, transferId: string, part: number): string {
  return `${uploadPrefixOf(subscriptionId, transferId)}part-${part}`;
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
  fileName?: string | null;
}): Transfer {
  return {
    fileName: null,
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
  /**
   * Moves what the kept exports occupy by one export: its bytes, positive
   * when it is kept and negative when it is deleted, and the notebook it was
   * made of, so the space of the subscription can say which notebook its
   * exports are of (RN-SUB-024). The count moves by one with the sign.
   */
  addKeptBytes(delta: number, notebookId?: string | null): Promise<void>;
  /** How many exports are kept and what they occupy, whole and per notebook. */
  keptUsage(): Promise<KeptUsage>;
  /**
   * Records that one inline part arrived, as the revision it was written as.
   * Only that entry of the record is written, so two parts arriving together
   * do not overwrite each other (RN-PRT-027).
   */
  recordPart(
    userId: string,
    transferId: string,
    part: number,
    versionId: string,
    at: string,
  ): Promise<void>;
  /**
   * Moves what the open uploads reserve, by one upload: its declared size,
   * positive when it starts and negative when it ends either way, under the
   * notebook it is for (RN-SUB-025). The count moves by one with the sign.
   */
  addTransitBytes(delta: number, notebookId: string | null): Promise<void>;
  /** What the open uploads of the SUBSCRIPTION reserve, whole and per notebook. */
  transitUsage(): Promise<KeptUsage>;
}

/** What the kept exports of a subscription add up to (RN-SUB-024). */
export interface KeptUsage {
  readonly count: number;
  readonly bytes: number;
  /** Per notebook the exports were made of; a notebook long gone included. */
  readonly byNotebook: ReadonlyMap<string, { readonly count: number; readonly bytes: number }>;
}
