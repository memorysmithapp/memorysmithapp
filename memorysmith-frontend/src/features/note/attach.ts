import type {
  BeginUploadRequest,
  FinishedUploadDto,
  TransferDto,
  UploadStatusDto,
} from '@memorysmith/contracts';

/**
 * A file given from the interface: attached in the note editor (#242,
 * RN-KNW-054), or given to fulfil what an agent asked for (#253, RN-PRT-030).
 *
 * It goes through the door an agent's file goes through — the upload in parts
 * by URL (RN-PRT-027) — because that is the one door that keeps a photo whole:
 * the browser hashes the file, sends each part straight to the address the API
 * signed, and the finish keeps it only when the whole hashes to what was
 * declared.
 *
 * **Large files** (RN-KNW-055). The file is hashed a slice at a time, so a
 * recording of hundreds of megabytes never sits whole in the memory of the tab;
 * and an upload the connection dropped is **found again by the hash of its
 * file** and resumed from the parts the API says arrived, rather than sent from
 * the start. An upload that failed while its parts travelled is therefore left
 * open, for the next attempt to resume; a finish refused for its bytes is
 * thrown away, since nothing of it could ever be kept.
 *
 * Kept apart from the component so each step can be proved without a browser.
 */

/** What a file sent in parts may be, the ceiling the API states. */
export const ATTACH_MAX_BYTES = 100 * 1024 * 1024;
/** The size of every part but the last, which the API fixes for an upload by URL. */
export const ATTACH_PART_BYTES = 8 * 1024 * 1024;

export interface AttachPorts {
  begin(input: BeginUploadRequest): Promise<UploadStatusDto>;
  finish(transferId: string): Promise<FinishedUploadDto>;
  /** Throws an upload away, which is what a finish refused for its bytes leaves behind. */
  discard(transferId: string): Promise<void>;
  /** A plain PUT of the bytes to a signed address. */
  put(url: string, bytes: Blob): Promise<void>;
  /** The SHA-256 of the file in lowercase hex, read a slice at a time. */
  hash(file: Blob, progress: (read: number, total: number) => void): Promise<string>;
  /** The open uploads of the person, where an interrupted one is found again. */
  open(): Promise<TransferDto[]>;
  /** What an open upload is missing, with a fresh address for each missing part. */
  status(transferId: string): Promise<UploadStatusDto>;
}

export type AttachProgress = (sent: number, total: number) => void;

/** Where an attachment is, for whoever draws it. */
export type AttachPhase =
  | { phase: 'hashing'; read: number; total: number }
  | { phase: 'sending'; sent: number; total: number };

/** Why an attachment did not happen, when it is the file and not the server. */
export class AttachRefusal extends Error {
  constructor(readonly reason: 'TOO_LARGE' | 'EMPTY' | 'NO_TYPE') {
    super(reason);
  }
}

/** The reference a note writes to show a file, by the name it is kept under. */
export function referenceOf(name: string): string {
  return `![[${name}]]`;
}

/**
 * Where the reference goes: at the cursor, on a line of its own, so it is an
 * embed and not a word in the middle of a sentence.
 */
export function insertAt(
  text: string,
  at: number,
  reference: string,
): { text: string; cursor: number } {
  const before = text.slice(0, at);
  const after = text.slice(at);
  const lead = before.length === 0 || before.endsWith('\n') ? '' : '\n';
  const tail = after.startsWith('\n') ? '' : '\n';
  const inserted = `${lead}${reference}${tail}`;
  return { text: `${before}${inserted}${after}`, cursor: before.length + inserted.length };
}

/** Lowercase hex, as the API reads a hash. */
export function hexOf(digest: ArrayBuffer): string {
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** A reason the finish answers that no retry of the same bytes can change. */
const TERMINAL = new Set(['HASH_MISMATCH', 'TYPE_MISMATCH']);

function reasonOf(error: unknown): string | null {
  const details = (error as { details?: { reason?: unknown } } | null)?.details;
  return typeof details?.reason === 'string' ? details.reason : null;
}

/**
 * Keeps one file in a notebook: hashes it, resumes the upload of the same file
 * when one is open, or declares it; sends what is missing; finishes it.
 *
 * With `request`, the file fulfils what an agent asked for: the request decides
 * the notebook and the name, and a file without a type of its own takes the one
 * the request asks for.
 */
export async function attachFile(
  ports: AttachPorts,
  input: {
    notebookId: string;
    file: File;
    purpose: string;
    request?: { transferId: string; mimeType: string } | undefined;
  },
  progress: AttachProgress = () => undefined,
  phase: (now: AttachPhase) => void = () => undefined,
): Promise<FinishedUploadDto> {
  const { file } = input;
  const mimeType = file.type || input.request?.mimeType || '';
  if (file.size === 0) throw new AttachRefusal('EMPTY');
  if (file.size > ATTACH_MAX_BYTES) throw new AttachRefusal('TOO_LARGE');
  if (!mimeType) throw new AttachRefusal('NO_TYPE');

  const sha256 = await ports.hash(file, (read, total) => phase({ phase: 'hashing', read, total }));
  const resumed = await resumable(ports, sha256, file.size, input.request?.transferId);
  const status =
    resumed ??
    (await ports.begin({
      notebookId: input.notebookId,
      name: file.name,
      mimeType,
      purpose: input.purpose,
      size: file.size,
      sha256,
      transport: 'url',
      ...(input.request ? { request: input.request.transferId } : {}),
    }));
  const transferId = status.transfer.transferId;
  const partCount = status.transfer.upload?.partCount ?? status.targets.length;

  let sent = partCount - status.targets.length;
  progress(sent, partCount);
  phase({ phase: 'sending', sent, total: partCount });
  for (const target of status.targets) {
    const start = (target.part - 1) * ATTACH_PART_BYTES;
    await ports.put(target.url, file.slice(start, start + ATTACH_PART_BYTES));
    sent += 1;
    progress(sent, partCount);
    phase({ phase: 'sending', sent, total: partCount });
  }

  try {
    return await ports.finish(transferId);
  } catch (error) {
    // Bytes the finish refused are refused for good: nothing is left open for them.
    const reason = reasonOf(error);
    if (reason && TERMINAL.has(reason)) await ports.discard(transferId).catch(() => undefined);
    throw error;
  }
}

/**
 * The open upload of this very file, by the hash of its whole, sent by URL:
 * the one a dropped connection left behind. For a request, only the upload that
 * fulfils it; otherwise only one started from the interface, never an agent's.
 */
async function resumable(
  ports: AttachPorts,
  sha256: string,
  size: number,
  request: string | undefined,
): Promise<UploadStatusDto | null> {
  const open = await ports.open().catch(() => [] as TransferDto[]);
  const found = open.find(
    (transfer) =>
      transfer.kind === 'agent' &&
      transfer.status === 'running' &&
      transfer.bytes === size &&
      transfer.upload?.sha256 === sha256 &&
      transfer.upload.transport === 'url' &&
      transfer.upload.platform === null &&
      (request === undefined || transfer.upload.fulfils === request),
  );
  return found ? ports.status(found.transferId) : null;
}
