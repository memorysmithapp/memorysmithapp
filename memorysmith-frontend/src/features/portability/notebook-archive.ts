import { notebookDocumentSchema, type NotebookDocument } from '@memorysmith/contracts';

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
 */

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
const STORED = 0;
const DEFLATED = 8;

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

/** The entries of the archive, out of its central directory. */
function entriesOf(view: DataView): Entry[] {
  // The end-of-central-directory record is the last thing in the file, and its
  // comment may follow it: it is found by scanning back for the signature.
  let eocd = -1;
  for (let at = view.byteLength - 22; at >= 0; at -= 1) {
    if (view.getUint32(at, true) === EOCD) {
      eocd = at;
      break;
    }
  }
  if (eocd < 0) throw new ArchiveError('NOT_AN_ARCHIVE');

  const count = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);
  const entries: Entry[] = [];

  for (let index = 0; index < count; index += 1) {
    if (at + 46 > view.byteLength || view.getUint32(at, true) !== CENTRAL) {
      throw new ArchiveError('NOT_AN_ARCHIVE');
    }
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const name = new TextDecoder().decode(
      new Uint8Array(view.buffer, view.byteOffset + at + 46, nameLength),
    );
    entries.push({
      name,
      method: view.getUint16(at + 10, true),
      compressedSize: view.getUint32(at + 20, true),
      localOffset: view.getUint32(at + 42, true),
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
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    throw new ArchiveError('NOT_AN_ARCHIVE');
  }
  if (bytes.byteLength < 22) throw new ArchiveError('NOT_AN_ARCHIVE');

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries = entriesOf(view);
  const entry = entries.find((each) => each.name.endsWith('.json'));
  if (!entry) throw new ArchiveError('NO_DOCUMENT');

  const at = entry.localOffset;
  if (view.getUint32(at, true) !== LOCAL) throw new ArchiveError('NOT_AN_ARCHIVE');
  const nameLength = view.getUint16(at + 26, true);
  const extraLength = view.getUint16(at + 28, true);
  const from = at + 30 + nameLength + extraLength;
  const json = await inflate(bytes.subarray(from, from + entry.compressedSize), entry.method);

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
