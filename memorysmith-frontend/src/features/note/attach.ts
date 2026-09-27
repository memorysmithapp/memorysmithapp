import type {
  BeginUploadRequest,
  FinishedUploadDto,
  UploadStatusDto,
} from '@memorysmith/contracts';

/**
 * A file attached to a note from the editor (#242, RN-KNW-054).
 *
 * It goes through the door an agent's file goes through — the upload in parts
 * by URL (RN-PRT-027) — because that is the one door that keeps a photo whole:
 * the browser hashes the file, sends each part straight to the address the API
 * signed, and the finish keeps it only when the whole hashes to what was
 * declared. It used to be that nothing on the screen kept a file at all, and
 * both agents followed on 2026-09-26 told the person to do exactly this.
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
  /** Throws an upload away, which is what a failure leaves behind. */
  discard(transferId: string): Promise<void>;
  /** A plain PUT of the bytes to a signed address. */
  put(url: string, bytes: Blob): Promise<void>;
  sha256(bytes: ArrayBuffer): Promise<string>;
}

export type AttachProgress = (sent: number, total: number) => void;

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

/**
 * Keeps one file in a notebook: declares it, sends its parts, finishes it.
 * Whatever fails after the declaration throws the upload away, so a person
 * who closes the error is not left an open upload reserving their room.
 */
export async function attachFile(
  ports: AttachPorts,
  input: { notebookId: string; file: File; purpose: string },
  progress: AttachProgress = () => undefined,
): Promise<FinishedUploadDto> {
  const { file } = input;
  if (file.size === 0) throw new AttachRefusal('EMPTY');
  if (file.size > ATTACH_MAX_BYTES) throw new AttachRefusal('TOO_LARGE');
  if (!file.type) throw new AttachRefusal('NO_TYPE');

  const sha256 = await ports.sha256(await file.arrayBuffer());
  const status = await ports.begin({
    notebookId: input.notebookId,
    name: file.name,
    mimeType: file.type,
    purpose: input.purpose,
    size: file.size,
    sha256,
    transport: 'url',
  });
  const transferId = status.transfer.transferId;
  try {
    const total = status.targets.length;
    progress(0, total);
    let sent = 0;
    for (const target of status.targets) {
      const start = (target.part - 1) * ATTACH_PART_BYTES;
      await ports.put(target.url, file.slice(start, start + ATTACH_PART_BYTES));
      sent += 1;
      progress(sent, total);
    }
    return await ports.finish(transferId);
  } catch (error) {
    await ports.discard(transferId).catch(() => undefined);
    throw error;
  }
}
