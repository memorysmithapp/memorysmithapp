import { notebookDocumentSchema, type NotebookDocument } from '@memorysmithapp/contracts';

/**
 * Reading a `.notebook` **in the browser**, before a byte is uploaded (#143).
 *
 * The file used to be read only by the server, after the upload, so the first
 * thing a person learned about its contents was whether it had worked. Now the
 * page opens the archive, validates the document against the same schema the
 * server validates it with, and shows what it will create.
 *
 * **What the browser checks is a courtesy and never the guarantee.** The server
 * validates everything again, and it is the one that decides: a document that
 * passes here and fails there is answered there, in the same words.
 *
 * The ZIP is read by hand rather than with a dependency, for the reason the
 * writer on the server is: the fewer moving parts stand between a notebook and
 * its bytes, the more the promise of no lock-in is worth. Entries are stored or
 * deflated, and `DecompressionStream` is what inflates them.
 *
 * **It reads the archive by slices, never whole** (#481). Since format `1.6`
 * each kept file is an entry of its own beside the document, and an archive
 * may be gigabytes: what is read is its tail, its central directory, ZIP64
 * included, and the document, and no byte of any file.
 */

const EOCD = 0x06054b50;
const ZIP64_EOCD = 0x06064b50;
const ZIP64_LOCATOR = 0x07064b50;
const ZIP64_EXTRA = 0x0001;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
const STORED = 0;
const DEFLATED = 8;
const MAX32 = 0xffffffff;
/** The end record, a comment of the longest length, and the ZIP64 locator before it. */
const TAIL = 22 + 0xffff + 20;

export type ArchiveRefusal = 'NOT_AN_ARCHIVE' | 'NO_DOCUMENT' | 'BAD_FORMAT' | 'UNREADABLE_VERSION';

export class ArchiveError extends Error {
  constructor(readonly refusal: ArchiveRefusal) {
    super(refusal);
    this.name = 'ArchiveError';
  }
}

interface Entry {
  readonly name: string;
  readonly method: number;
  readonly compressedSize: number;
  readonly localOffset: number;
}

/** A range of the file, as a view; a range past its end is not an archive. */
async function slice(file: Blob, start: number, length: number): Promise<DataView> {
  if (start < 0 || length < 0 || start + length > file.size) {
    throw new ArchiveError('NOT_AN_ARCHIVE');
  }
  try {
    return new DataView(await file.slice(start, start + length).arrayBuffer());
  } catch {
    throw new ArchiveError('NOT_AN_ARCHIVE');
  }
}

function uint64(view: DataView, at: number): number {
  const value = view.getBigUint64(at, true);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new ArchiveError('NOT_AN_ARCHIVE');
  return Number(value);
}

/** The entries of the archive, out of its central directory. */
async function entriesOf(file: Blob): Promise<Entry[]> {
  // The end-of-central-directory record is the last thing in the file, and its
  // comment may follow it: it is found by scanning back for the signature.
  const tailStart = Math.max(0, file.size - TAIL);
  const tail = await slice(file, tailStart, file.size - tailStart);
  let eocd = -1;
  for (let at = tail.byteLength - 22; at >= 0; at -= 1) {
    if (tail.getUint32(at, true) === EOCD) {
      eocd = at;
      break;
    }
  }
  if (eocd < 0) throw new ArchiveError('NOT_AN_ARCHIVE');

  let count = tail.getUint16(eocd + 10, true);
  let size = tail.getUint32(eocd + 12, true);
  let start = tail.getUint32(eocd + 16, true);
  // A locator right before the end record points at the ZIP64 end record,
  // whose values are the ones that hold (RN-PRT-092).
  if (eocd >= 20 && tail.getUint32(eocd - 20, true) === ZIP64_LOCATOR) {
    const end64 = await slice(file, uint64(tail, eocd - 20 + 8), 56);
    if (end64.getUint32(0, true) !== ZIP64_EOCD) throw new ArchiveError('NOT_AN_ARCHIVE');
    count = uint64(end64, 32);
    size = uint64(end64, 40);
    start = uint64(end64, 48);
  }

  const view = await slice(file, start, size);
  const entries: Entry[] = [];
  let at = 0;
  for (let index = 0; index < count; index += 1) {
    if (at + 46 > view.byteLength || view.getUint32(at, true) !== CENTRAL) {
      throw new ArchiveError('NOT_AN_ARCHIVE');
    }
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    if (at + 46 + nameLength + extraLength > view.byteLength) {
      throw new ArchiveError('NOT_AN_ARCHIVE');
    }
    const name = new TextDecoder().decode(
      new Uint8Array(view.buffer, view.byteOffset + at + 46, nameLength),
    );
    let uncompressedSize = view.getUint32(at + 24, true);
    let compressedSize = view.getUint32(at + 20, true);
    let localOffset = view.getUint32(at + 42, true);
    // The ZIP64 field holds, in this order, each of the three whose own
    // field says it could not.
    let extra = at + 46 + nameLength;
    const extraEnd = extra + extraLength;
    while (extra + 4 <= extraEnd) {
      const id = view.getUint16(extra, true);
      const length = view.getUint16(extra + 2, true);
      if (id === ZIP64_EXTRA) {
        let field = extra + 4;
        if (uncompressedSize === MAX32) {
          uncompressedSize = uint64(view, field);
          field += 8;
        }
        if (compressedSize === MAX32) {
          compressedSize = uint64(view, field);
          field += 8;
        }
        if (localOffset === MAX32) localOffset = uint64(view, field);
      }
      extra += 4 + length;
    }
    entries.push({
      name,
      method: view.getUint16(at + 10, true),
      compressedSize,
      localOffset,
    });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function inflate(bytes: Uint8Array, method: number): Promise<string> {
  if (method === STORED) return new TextDecoder().decode(bytes);
  if (method !== DEFLATED) throw new ArchiveError('NOT_AN_ARCHIVE');

  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}

/** The document a `.notebook` carries, or the reason it carries none. */
export async function readNotebookArchive(file: Blob): Promise<NotebookDocument> {
  if (file.size < 22) throw new ArchiveError('NOT_AN_ARCHIVE');

  const entries = await entriesOf(file);
  const entry = entries.find((each) => each.name.endsWith('.json'));
  if (!entry) throw new ArchiveError('NO_DOCUMENT');

  const header = await slice(file, entry.localOffset, 30);
  if (header.getUint32(0, true) !== LOCAL) throw new ArchiveError('NOT_AN_ARCHIVE');
  const nameLength = header.getUint16(26, true);
  const extraLength = header.getUint16(28, true);
  const from = entry.localOffset + 30 + nameLength + extraLength;
  const data = await slice(file, from, entry.compressedSize);
  const json = await inflate(
    new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    entry.method,
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ArchiveError('BAD_FORMAT');
  }

  // A version this build does not read is its own answer, said before the
  // shape is blamed for not matching.
  const version = (parsed as { documentVersion?: unknown })?.documentVersion;
  const document = notebookDocumentSchema.safeParse(parsed);
  if (!document.success) {
    throw new ArchiveError(
      typeof version === 'string' && version !== '1.0' ? 'UNREADABLE_VERSION' : 'BAD_FORMAT',
    );
  }
  return document.data;
}
