/**
 * The ZIP of a `.notebook`, written and read by hand.
 *
 * Written here rather than pulled from a dependency because the export is the
 * promise of zero lock-in, and the fewer moving parts stand between the notebook
 * and its bytes, the more that promise is worth. The one library of the
 * workspace that writes a zip as a stream, `fflate`, writes no ZIP64, and a
 * file of a notebook is not bounded by 4 GiB (#481).
 *
 * Two kinds of entry (RN-PRT-092):
 *
 *  - **The document**, `notebook.json`, built in memory and deflated: it is
 *    text, and since `1.6` it carries no bytes of any file.
 *  - **Each kept file**, an entry of its own, STORED (a photo, a PDF, a video
 *    are compressed already) and streamed: its bytes go from the store into
 *    the archive as they arrive, never held whole. Its CRC-32 is known only
 *    once the last byte passed, so it follows the data in a descriptor (bit 3);
 *    its size is declared before, and is in the ZIP64 field of the local
 *    header too, so a reader that walks the local headers knows where the data
 *    ends without the central directory. Every such entry is ZIP64, so no size
 *    of a file and no offset of the archive stops it.
 *
 * The archive ends with the ZIP64 end record and its locator whenever it holds
 * a file entry, and with the classic end record always, which carries the real
 * values where they fit, so a reader that knows nothing of ZIP64 still opens an
 * archive under 4 GiB.
 */

import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib';

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const END = 0x06054b50;
const ZIP64_END = 0x06064b50;
const ZIP64_LOCATOR = 0x07064b50;
const DESCRIPTOR = 0x08074b50;
const ZIP64_EXTRA = 0x0001;

export const STORED = 0;
export const DEFLATED = 8;

const UTF8_NAMES = 0x0800;
const SIZES_AFTER = 0x0008;
const MAX16 = 0xffff;
const MAX32 = 0xffffffff;
/** The version a reader needs: 2.0 for deflate, 4.5 for ZIP64. */
const VERSION_DEFLATE = 20;
const VERSION_ZIP64 = 45;

/** An entry written from a string in memory, deflated: the document. */
export interface ZipTextEntry {
  readonly path: string;
  readonly content: string;
}

/** An entry streamed from wherever its bytes are, stored: a kept file. */
export interface ZipStreamEntry {
  readonly path: string;
  /** How many bytes it holds. A stream that gives another number fails the archive. */
  readonly size: number;
  readonly open: () => Promise<AsyncIterable<Uint8Array>>;
}

export type ZipEntry = ZipTextEntry | ZipStreamEntry;

interface Written {
  readonly name: Buffer;
  readonly method: number;
  readonly flags: number;
  readonly zip64: boolean;
  readonly offset: number;
  crc: number;
  compressed: number;
  uncompressed: number;
}

function dosTime(date: Date): { time: number; date: number } {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function writeUInt64(target: Buffer, value: number, at: number): void {
  target.writeBigUInt64LE(BigInt(value), at);
}

function readUInt64(source: Buffer, at: number): number {
  const value = source.readBigUInt64LE(at);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('a ZIP64 field past 2^53');
  return Number(value);
}

function localHeader(entry: Written, stamp: { time: number; date: number }, size: number): Buffer {
  const extra = entry.zip64 ? 20 : 0;
  const header = Buffer.alloc(30 + entry.name.length + extra);
  header.writeUInt32LE(LOCAL, 0);
  header.writeUInt16LE(entry.zip64 ? VERSION_ZIP64 : VERSION_DEFLATE, 4);
  header.writeUInt16LE(entry.flags, 6);
  header.writeUInt16LE(entry.method, 8);
  header.writeUInt16LE(stamp.time, 10);
  header.writeUInt16LE(stamp.date, 12);
  header.writeUInt32LE(entry.crc, 14);
  header.writeUInt32LE(entry.zip64 ? MAX32 : entry.compressed, 18);
  header.writeUInt32LE(entry.zip64 ? MAX32 : entry.uncompressed, 22);
  header.writeUInt16LE(entry.name.length, 26);
  header.writeUInt16LE(extra, 28);
  entry.name.copy(header, 30);
  if (entry.zip64) {
    const at = 30 + entry.name.length;
    header.writeUInt16LE(ZIP64_EXTRA, at);
    header.writeUInt16LE(16, at + 2);
    writeUInt64(header, size, at + 4);
    writeUInt64(header, size, at + 12);
  }
  return header;
}

function centralHeader(entry: Written, stamp: { time: number; date: number }): Buffer {
  // A ZIP64 entry says all three in the extra field; another says there only
  // what its own fields cannot hold, in the order the format fixes.
  const big = (value: number) => entry.zip64 || value >= MAX32;
  const fields = [entry.uncompressed, entry.compressed, entry.offset].filter(big);
  const extra = fields.length > 0 ? 4 + 8 * fields.length : 0;
  const header = Buffer.alloc(46 + entry.name.length + extra);
  const version = fields.length > 0 ? VERSION_ZIP64 : VERSION_DEFLATE;
  header.writeUInt32LE(CENTRAL, 0);
  header.writeUInt16LE(version, 4);
  header.writeUInt16LE(version, 6);
  header.writeUInt16LE(entry.flags, 8);
  header.writeUInt16LE(entry.method, 10);
  header.writeUInt16LE(stamp.time, 12);
  header.writeUInt16LE(stamp.date, 14);
  header.writeUInt32LE(entry.crc, 16);
  header.writeUInt32LE(big(entry.compressed) ? MAX32 : entry.compressed, 20);
  header.writeUInt32LE(big(entry.uncompressed) ? MAX32 : entry.uncompressed, 24);
  header.writeUInt16LE(entry.name.length, 28);
  header.writeUInt16LE(extra, 30);
  header.writeUInt32LE(big(entry.offset) ? MAX32 : entry.offset, 42);
  entry.name.copy(header, 46);
  if (extra > 0) {
    let at = 46 + entry.name.length;
    header.writeUInt16LE(ZIP64_EXTRA, at);
    header.writeUInt16LE(8 * fields.length, at + 2);
    at += 4;
    for (const value of fields) {
      writeUInt64(header, value, at);
      at += 8;
    }
  }
  return header;
}

/**
 * The archive, as a stream of chunks: each entry in the order given, then the
 * central directory and the end records. What it holds in memory at once is
 * the document, one chunk of a file and the directory, never a file whole.
 */
export async function* zipStream(entries: readonly ZipEntry[], now: Date): AsyncGenerator<Buffer> {
  const stamp = dosTime(now);
  const written: Written[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.path, 'utf8');
    if ('content' in entry) {
      const data = Buffer.from(entry.content, 'utf8');
      const compressed = deflateRawSync(data);
      const record: Written = {
        name,
        method: DEFLATED,
        flags: UTF8_NAMES,
        zip64: compressed.length >= MAX32 || data.length >= MAX32,
        offset,
        crc: crc32(data),
        compressed: compressed.length,
        uncompressed: data.length,
      };
      const header = localHeader(record, stamp, data.length);
      yield header;
      yield compressed;
      offset += header.length + compressed.length;
      written.push(record);
      continue;
    }

    const record: Written = {
      name,
      method: STORED,
      flags: UTF8_NAMES | SIZES_AFTER,
      zip64: true,
      offset,
      crc: 0,
      compressed: 0,
      uncompressed: 0,
    };
    const header = localHeader(record, stamp, entry.size);
    yield header;
    offset += header.length;

    let crc = 0;
    let size = 0;
    for await (const chunk of await entry.open()) {
      if (chunk.byteLength === 0) continue;
      crc = crc32(chunk, crc);
      size += chunk.byteLength;
      yield Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    }
    // An archive whose header says one size and whose data holds another is
    // an archive that lies, and it is not finished.
    if (size !== entry.size) {
      throw new Error(
        `The entry ${entry.path} held ${size} bytes, and ${entry.size} were declared`,
      );
    }
    record.crc = crc;
    record.compressed = size;
    record.uncompressed = size;

    const descriptor = Buffer.alloc(24);
    descriptor.writeUInt32LE(DESCRIPTOR, 0);
    descriptor.writeUInt32LE(crc, 4);
    writeUInt64(descriptor, size, 8);
    writeUInt64(descriptor, size, 16);
    yield descriptor;
    offset += size + descriptor.length;
    written.push(record);
  }

  const centralStart = offset;
  for (const record of written) {
    const header = centralHeader(record, stamp);
    yield header;
    offset += header.length;
  }
  const centralSize = offset - centralStart;

  const zip64 =
    written.some((record) => record.zip64) ||
    written.length >= MAX16 ||
    centralStart >= MAX32 ||
    centralSize >= MAX32;
  if (zip64) {
    const end64 = Buffer.alloc(56);
    end64.writeUInt32LE(ZIP64_END, 0);
    writeUInt64(end64, 44, 4);
    end64.writeUInt16LE(VERSION_ZIP64, 12);
    end64.writeUInt16LE(VERSION_ZIP64, 14);
    writeUInt64(end64, written.length, 24);
    writeUInt64(end64, written.length, 32);
    writeUInt64(end64, centralSize, 40);
    writeUInt64(end64, centralStart, 48);
    const locator = Buffer.alloc(20);
    locator.writeUInt32LE(ZIP64_LOCATOR, 0);
    writeUInt64(locator, offset, 8);
    locator.writeUInt32LE(1, 16);
    yield end64;
    yield locator;
  }

  const end = Buffer.alloc(22);
  end.writeUInt32LE(END, 0);
  end.writeUInt16LE(Math.min(written.length, MAX16), 8);
  end.writeUInt16LE(Math.min(written.length, MAX16), 10);
  end.writeUInt32LE(Math.min(centralSize, MAX32), 12);
  end.writeUInt32LE(Math.min(centralStart, MAX32), 16);
  yield end;
}

/** The whole archive of entries held in memory, as a `1.5` export wrote it. */
export function createZip(files: Array<{ path: string; content: string }>, now: Date): Buffer {
  const chunks: Buffer[] = [];
  const stamp = dosTime(now);
  let offset = 0;
  const written: Written[] = [];
  for (const file of files) {
    const data = Buffer.from(file.content, 'utf8');
    const compressed = deflateRawSync(data);
    const record: Written = {
      name: Buffer.from(file.path, 'utf8'),
      method: DEFLATED,
      flags: UTF8_NAMES,
      zip64: false,
      offset,
      crc: crc32(data),
      compressed: compressed.length,
      uncompressed: data.length,
    };
    const header = localHeader(record, stamp, data.length);
    chunks.push(header, compressed);
    offset += header.length + compressed.length;
    written.push(record);
  }
  const centralStart = offset;
  for (const record of written) {
    const header = centralHeader(record, stamp);
    chunks.push(header);
    offset += header.length;
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(END, 0);
  end.writeUInt16LE(written.length, 8);
  end.writeUInt16LE(written.length, 10);
  end.writeUInt32LE(offset - centralStart, 12);
  end.writeUInt32LE(centralStart, 16);
  chunks.push(end);
  return Buffer.concat(chunks);
}

/** One entry, as the central directory of an archive says it. */
export interface ZipDirectoryEntry {
  readonly name: string;
  readonly method: number;
  readonly crc: number;
  readonly compressedSize: number;
  readonly uncompressedSize: number;
  readonly localOffset: number;
}

/**
 * Where an archive is read from, a range at a time: the bytes of an object of
 * the store, by ranged reads, or a buffer. `read` answers exactly the bytes
 * asked for, or fails.
 */
export interface RangeSource {
  readonly size: number;
  read(start: number, length: number): Promise<Buffer>;
}

/** A buffer, read as a source of ranges. */
export function bufferSource(archive: Buffer): RangeSource {
  return {
    size: archive.length,
    read: async (start, length) => {
      if (start < 0 || start + length > archive.length) throw new Error('past the end');
      return archive.subarray(start, start + length);
    },
  };
}

/** The end record and a comment nobody writes and anyone may, at most. */
const TAIL = 22 + MAX16 + 20;

interface Directory {
  readonly count: number;
  readonly size: number;
  readonly start: number;
}

/** The end record, found from the end of the tail, and the ZIP64 end record it points at, if any. */
function endOf(tail: Buffer): { directory: Directory; end64At: number | null } {
  let end = -1;
  for (let at = tail.length - 22; at >= 0; at--) {
    if (tail.readUInt32LE(at) === END) {
      end = at;
      break;
    }
  }
  if (end === -1) throw new Error('not a zip archive');
  const directory = {
    count: tail.readUInt16LE(end + 10),
    size: tail.readUInt32LE(end + 12),
    start: tail.readUInt32LE(end + 16),
  };
  // A locator right before the end record points at the ZIP64 end record,
  // whose values are the ones that hold.
  const located = end >= 20 && tail.readUInt32LE(end - 20) === ZIP64_LOCATOR;
  return { directory, end64At: located ? readUInt64(tail, end - 20 + 8) : null };
}

function end64Of(record: Buffer): Directory {
  if (record.length < 56 || record.readUInt32LE(0) !== ZIP64_END) {
    throw new Error('corrupt ZIP64 end record');
  }
  return {
    count: readUInt64(record, 32),
    size: readUInt64(record, 40),
    start: readUInt64(record, 48),
  };
}

function entriesOf(central: Buffer, count: number): ZipDirectoryEntry[] {
  const entries: ZipDirectoryEntry[] = [];
  let at = 0;
  for (let index = 0; index < count; index++) {
    if (at + 46 > central.length || central.readUInt32LE(at) !== CENTRAL) {
      throw new Error('corrupt central directory');
    }
    const nameLength = central.readUInt16LE(at + 28);
    const extraLength = central.readUInt16LE(at + 30);
    const commentLength = central.readUInt16LE(at + 32);
    let compressedSize = central.readUInt32LE(at + 20);
    let uncompressedSize = central.readUInt32LE(at + 24);
    let localOffset = central.readUInt32LE(at + 42);
    const name = central.subarray(at + 46, at + 46 + nameLength).toString('utf8');

    // The ZIP64 field holds, in this order, each of the three whose own field
    // says it could not.
    let extraAt = at + 46 + nameLength;
    const extraEnd = extraAt + extraLength;
    while (extraAt + 4 <= extraEnd) {
      const id = central.readUInt16LE(extraAt);
      const length = central.readUInt16LE(extraAt + 2);
      if (id === ZIP64_EXTRA) {
        let field = extraAt + 4;
        if (uncompressedSize === MAX32) {
          uncompressedSize = readUInt64(central, field);
          field += 8;
        }
        if (compressedSize === MAX32) {
          compressedSize = readUInt64(central, field);
          field += 8;
        }
        if (localOffset === MAX32) localOffset = readUInt64(central, field);
      }
      extraAt += 4 + length;
    }

    entries.push({
      name,
      method: central.readUInt16LE(at + 10),
      crc: central.readUInt32LE(at + 16),
      compressedSize,
      uncompressedSize,
      localOffset,
    });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/**
 * The entries of an archive, out of its central directory, which is the
 * authoritative index of a zip: a local header may declare a size of zero and
 * defer it to a descriptor. It reads the tail, the ZIP64 end record when
 * there is one, and the directory, and nothing else.
 */
export async function readDirectory(source: RangeSource): Promise<ZipDirectoryEntry[]> {
  if (source.size < 22) throw new Error('not a zip archive');
  const tailStart = Math.max(0, source.size - TAIL);
  const found = endOf(await source.read(tailStart, source.size - tailStart));
  const directory =
    found.end64At === null ? found.directory : end64Of(await source.read(found.end64At, 56));
  if (directory.start + directory.size > source.size) throw new Error('corrupt central directory');
  return entriesOf(await source.read(directory.start, directory.size), directory.count);
}

function localDataStart(header: Buffer, entry: ZipDirectoryEntry, size: number): number {
  if (header.length < 30 || header.readUInt32LE(0) !== LOCAL) {
    throw new Error('corrupt local header');
  }
  const start = entry.localOffset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
  if (start + entry.compressedSize > size) throw new Error('an entry past the end');
  return start;
}

/** Where the data of an entry starts, read off its local header. */
export async function dataStartOf(source: RangeSource, entry: ZipDirectoryEntry): Promise<number> {
  return localDataStart(await source.read(entry.localOffset, 30), entry, source.size);
}

function decoded(data: Buffer, method: number): string {
  if (method === STORED) return data.toString('utf8');
  if (method === DEFLATED) return inflateRawSync(data).toString('utf8');
  throw new Error(`unsupported compression method ${method}`);
}

/** One entry whole, as text: the document, which is the one entry read so. */
export async function readText(source: RangeSource, entry: ZipDirectoryEntry): Promise<string> {
  const start = await dataStartOf(source, entry);
  return decoded(await source.read(start, entry.compressedSize), entry.method);
}

/**
 * Every entry of an archive held in memory, by name, as text. It is what a
 * test reads an archive with: the import reads one where it is, a range at a
 * time, and never a file entry as text.
 */
export function readZip(archive: Buffer): Record<string, string> {
  if (archive.length < 22) throw new Error('not a zip archive');
  const found = endOf(archive.subarray(Math.max(0, archive.length - TAIL)));
  const directory =
    found.end64At === null
      ? found.directory
      : end64Of(archive.subarray(found.end64At, found.end64At + 56));
  if (directory.start + directory.size > archive.length) {
    throw new Error('corrupt central directory');
  }
  const entries: Record<string, string> = {};
  for (const entry of entriesOf(
    archive.subarray(directory.start, directory.start + directory.size),
    directory.count,
  )) {
    const start = localDataStart(
      archive.subarray(entry.localOffset, entry.localOffset + 30),
      entry,
      archive.length,
    );
    entries[entry.name] = decoded(
      archive.subarray(start, start + entry.compressedSize),
      entry.method,
    );
  }
  return entries;
}
