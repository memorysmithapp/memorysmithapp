/**
 * The archive goes to the store and comes back from it as a stream (#481,
 * RN-PRT-093), asserted on what the store is sent.
 *
 * The store here is a fake of the S3 client: it answers the commands the
 * adapters send and records each one, which is what lets a case say that an
 * export of a file of half a gigabyte went in parts of 8 MiB, each sent while
 * the file was still being read, and that an import staged a file entry by a
 * copy inside the store, reading none of its bytes.
 */

import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  UploadPartCommand,
  UploadPartCopyCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { ExportNotebook, type ExportSource } from '../src/application/ExportNotebook.js';
import { ARCHIVE_PART_BYTES, S3ArchiveStore, S3UploadStore } from '../src/adapters/s3.js';
import { createZip, zipStream } from '../src/adapters/zip.js';
import { Instant } from '@memorysmithapp/kernel';
import type { ExportInput } from '../src/domain/NotebookDocumentBuilder.js';

const BUCKET = 'content-bucket';
const MiB = 1024 * 1024;

interface Sent {
  readonly command: string;
  readonly input: Record<string, unknown>;
  /** How many bytes of the file the source had given when this was sent. */
  readonly read: number;
  readonly bodyBytes: number;
}

/**
 * A bucket in memory behind the S3 client's `send`. `keep: false` records the
 * size and hash of what is written and keeps no byte of it, for a case that
 * writes more than a test should hold.
 */
class FakeS3 {
  readonly objects = new Map<string, { bytes: Buffer; versionId: string }>();
  readonly sent: Sent[] = [];
  private readonly multiparts = new Map<string, { key: string; parts: Map<number, Buffer> }>();
  private sequence = 0;
  /** Each multipart upload's running size and hash, when nothing is kept. */
  readonly written = new Map<string, { bytes: number; hash: ReturnType<typeof createHash> }>();

  constructor(
    private readonly keep: boolean,
    private readonly progress: () => number = () => 0,
  ) {}

  get client(): S3Client {
    return this as unknown as S3Client;
  }

  async send(command: unknown): Promise<unknown> {
    const input = (command as { input: Record<string, unknown> }).input;
    const body = input['Body'];
    // What was sent, without the bytes of a body, which the fake never keeps
    // from being collected once it is handled.
    const { Body: _body, ...recorded } = input;
    this.sent.push({
      command: (command as object).constructor.name,
      input: recorded,
      read: this.progress(),
      bodyBytes: Buffer.isBuffer(body) ? body.length : 0,
    });
    const key = String(input['Key']);

    if (command instanceof HeadObjectCommand) {
      const found = this.objects.get(key);
      if (!found) throw Object.assign(new Error('NotFound'), { name: 'NotFound' });
      return { ContentLength: found.bytes.length, VersionId: found.versionId };
    }
    if (command instanceof GetObjectCommand) {
      const found = this.objects.get(key);
      if (!found) throw Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' });
      const range = /^bytes=(\d+)-(\d+)$/.exec(String(input['Range'] ?? ''));
      const bytes = range
        ? found.bytes.subarray(Number(range[1]), Number(range[2]) + 1)
        : found.bytes;
      const stream = Readable.from([bytes]);
      return {
        Body: Object.assign(stream, { transformToByteArray: async () => new Uint8Array(bytes) }),
      };
    }
    if (command instanceof PutObjectCommand) {
      const versionId = `v${++this.sequence}`;
      this.objects.set(key, { bytes: Buffer.from(body as Buffer), versionId });
      return { VersionId: versionId };
    }
    if (command instanceof CreateMultipartUploadCommand) {
      const uploadId = `mp${++this.sequence}`;
      this.multiparts.set(uploadId, { key, parts: new Map() });
      this.written.set(uploadId, { bytes: 0, hash: createHash('sha256') });
      return { UploadId: uploadId };
    }
    if (command instanceof UploadPartCommand) {
      const upload = this.multiparts.get(String(input['UploadId']));
      if (!upload) throw new Error('NoSuchUpload');
      const bytes = body as Buffer;
      const tally = this.written.get(String(input['UploadId']));
      if (tally) {
        tally.bytes += bytes.length;
        tally.hash.update(bytes);
      }
      if (this.keep) upload.parts.set(Number(input['PartNumber']), Buffer.from(bytes));
      return { ETag: `"etag-${String(input['PartNumber'])}"`, ChecksumCRC32: 'AAAAAA==' };
    }
    if (command instanceof UploadPartCopyCommand) {
      const upload = this.multiparts.get(String(input['UploadId']));
      if (!upload) throw new Error('NoSuchUpload');
      const source = decodeURIComponent(
        String(input['CopySource'])
          .split('?')[0]
          ?.slice(BUCKET.length + 1) ?? '',
      );
      const range = /^bytes=(\d+)-(\d+)$/.exec(String(input['CopySourceRange']));
      const found = this.objects.get(source);
      if (!found || !range) throw new Error('NoSuchKey');
      upload.parts.set(
        Number(input['PartNumber']),
        Buffer.from(found.bytes.subarray(Number(range[1]), Number(range[2]) + 1)),
      );
      return { CopyPartResult: { ETag: `"copy-${String(input['PartNumber'])}"` } };
    }
    if (command instanceof CompleteMultipartUploadCommand) {
      const upload = this.multiparts.get(String(input['UploadId']));
      if (!upload) throw new Error('NoSuchUpload');
      const versionId = `v${++this.sequence}`;
      const ordered = [...upload.parts.entries()].sort(([a], [b]) => a - b);
      this.objects.set(key, {
        bytes: Buffer.concat(ordered.map(([, part]) => part)),
        versionId,
      });
      this.multiparts.delete(String(input['UploadId']));
      return { VersionId: versionId };
    }
    if (command instanceof AbortMultipartUploadCommand) {
      this.multiparts.delete(String(input['UploadId']));
      return {};
    }
    if (command instanceof DeleteObjectCommand) {
      const found = this.objects.get(key);
      if (found && found.versionId === input['VersionId']) this.objects.delete(key);
      return {};
    }
    throw new Error(`The fake store does not answer ${(command as object).constructor.name}`);
  }

  named(command: string): Sent[] {
    return this.sent.filter((each) => each.command === command);
  }

  get openMultiparts(): number {
    return this.multiparts.size;
  }
}

/** A notebook of one file, whose bytes a generator gives in chunks as they are asked for. */
function notebookOf(file: {
  size: number;
  chunk: Buffer;
  counted: { read: number; opened: number };
}): ExportSource {
  const input: ExportInput = {
    notebookName: 'Acervo',
    notebookDescription: 'Um vídeo.',
    guidance: null,
    folders: [],
    notes: [],
    files: [
      {
        name: 'aula.mp4',
        description: 'A aula inteira.',
        mimeType: 'video/mp4',
        tags: [],
        path: '/',
        size: file.size,
        sha256: 'a'.repeat(64),
        read: async () => {
          file.counted.opened += 1;
          return (async function* () {
            for (let given = 0; given < file.size; given += file.chunk.length) {
              const piece = file.chunk.subarray(0, Math.min(file.chunk.length, file.size - given));
              file.counted.read += piece.length;
              yield piece;
            }
          })();
        },
      },
    ],
  };
  return { load: async () => input };
}

const serialize = (document: unknown) => ({
  entry: 'notebook.json',
  content: JSON.stringify(document),
});

describe('an export of a large file', () => {
  it('goes to the store in parts of 8 MiB, each sent while the file is still being read', async () => {
    // Half a gigabyte and a little more, as a stream: one chunk of 256 KiB
    // given again and again, so the test holds no file at all.
    const size = 520 * MiB + 12_345;
    const counted = { read: 0, opened: 0 };
    const s3 = new FakeS3(false, () => counted.read);
    const exporter = new ExportNotebook(
      notebookOf({ size, chunk: Buffer.alloc(256 * 1024, 7), counted }),
      new S3ArchiveStore(s3.client, BUCKET),
      zipStream,
      'SUB',
      serialize,
    );

    const result = await exporter.execute({ notebookId: 'n', now: Instant.now() });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(counted).toEqual({ read: size, opened: 1 });
    // Never one PUT of the whole: a multipart upload, opened once, completed once.
    expect(s3.named('PutObjectCommand')).toEqual([]);
    expect(s3.named('CreateMultipartUploadCommand')).toHaveLength(1);
    expect(s3.named('CompleteMultipartUploadCommand')).toHaveLength(1);
    expect(s3.openMultiparts).toBe(0);

    const parts = s3.named('UploadPartCommand');
    // Every part but the last is at least 8 MiB and never much more: what
    // the worker holds of the archive at once is one part.
    for (const part of parts.slice(0, -1)) {
      expect(part.bodyBytes).toBeGreaterThanOrEqual(ARCHIVE_PART_BYTES);
      expect(part.bodyBytes).toBeLessThan(ARCHIVE_PART_BYTES + 256 * 1024);
    }
    expect(parts.length).toBeGreaterThanOrEqual(
      Math.floor(size / (ARCHIVE_PART_BYTES + 256 * 1024)),
    );
    // Each part was sent before the file was read past it: the bytes went
    // into the archive as they arrived, and were never gathered first.
    let sent = 0;
    for (const part of parts) {
      sent += part.bodyBytes;
      expect(part.read).toBeLessThanOrEqual(sent);
      expect(part.read).toBeGreaterThan(sent - 2 * ARCHIVE_PART_BYTES);
    }
    // What the archive holds is what was sent, and the stored record says so.
    expect(result.value.bytes).toBe(sent);
    expect(result.value.bytes).toBeGreaterThan(size);
  });

  it('is one PUT when the whole archive is smaller than a part', async () => {
    const counted = { read: 0, opened: 0 };
    const s3 = new FakeS3(true, () => counted.read);
    const result = await new ExportNotebook(
      notebookOf({ size: 100_000, chunk: Buffer.alloc(64 * 1024, 1), counted }),
      new S3ArchiveStore(s3.client, BUCKET),
      zipStream,
      'SUB',
      serialize,
    ).execute({ notebookId: 'n', now: Instant.now() });

    expect(result.ok).toBe(true);
    expect(s3.named('CreateMultipartUploadCommand')).toEqual([]);
    expect(s3.named('PutObjectCommand')).toHaveLength(1);
  });

  it('leaves no multipart upload behind when the file ends short of its size', async () => {
    // A store that answered fewer bytes than the file declares: the archive
    // would lie about the entry, so it is not finished, and nothing is billed.
    const counted = { read: 0, opened: 0 };
    const s3 = new FakeS3(false, () => counted.read);
    const source = notebookOf({ size: 30 * MiB, chunk: Buffer.alloc(256 * 1024, 2), counted });
    const loaded = await source.load('n');
    const short: ExportSource = {
      load: async () =>
        loaded && {
          ...loaded,
          files: (loaded.files ?? []).map((file) => ({ ...file, size: file.size + 1 })),
        },
    };

    await expect(
      new ExportNotebook(
        short,
        new S3ArchiveStore(s3.client, BUCKET),
        zipStream,
        'SUB',
        serialize,
      ).execute({ notebookId: 'n', now: Instant.now() }),
    ).rejects.toThrow(/declared/);
    expect(s3.named('AbortMultipartUploadCommand')).toHaveLength(1);
    expect(s3.named('CompleteMultipartUploadCommand')).toEqual([]);
    expect(s3.openMultiparts).toBe(0);
  });
});

describe('an import of a 1.6 archive from the store', () => {
  /** A file of `size` bytes, different at every offset, so a range off by one is seen. */
  function bytesOf(size: number): Buffer {
    const bytes = Buffer.alloc(size);
    for (let at = 0; at + 4 <= size; at += 4) bytes.writeUInt32LE(at >>> 0, at);
    return bytes;
  }
  const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

  async function archived(files: Array<{ path: string; bytes: Buffer }>): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of zipStream(
      [
        { path: 'notebook.json', content: JSON.stringify({ documentVersion: '1.6' }) },
        ...files.map((file) => ({
          path: file.path,
          size: file.bytes.length,
          open: async () =>
            (async function* () {
              for (let at = 0; at < file.bytes.length; at += 1 * MiB) {
                yield file.bytes.subarray(at, at + MiB);
              }
            })(),
        })),
      ],
      new Date(),
    )) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  it('reads the directory and the document by range, and copies a large entry inside the store', async () => {
    const large = bytesOf(20 * MiB + 3);
    const small = bytesOf(70_001);
    const s3 = new FakeS3(true);
    const archive = await archived([
      { path: 'files/1/aula.mp4', bytes: large },
      { path: 'files/2/capa.png', bytes: small },
    ]);
    s3.objects.set('s/SUB/imports/U.notebook', { bytes: archive, versionId: 'v-upload' });

    const opened = await new S3UploadStore(s3.client, BUCKET).open('s/SUB/imports/U.notebook');
    if (!opened || opened === 'not-an-archive') throw new Error('the archive did not open');
    expect(opened.entries).toEqual(['notebook.json', 'files/1/aula.mp4', 'files/2/capa.png']);
    expect(JSON.parse(await opened.text('notebook.json'))).toEqual({ documentVersion: '1.6' });

    const stagedLarge = await opened.stage('files/1/aula.mp4', 's/SUB/uploads/U/entries/1');
    const stagedSmall = await opened.stage('files/2/capa.png', 's/SUB/uploads/U/entries/2');

    // Each staged object is the file, byte for byte.
    expect(stagedLarge?.size).toBe(large.length);
    expect(sha256(s3.objects.get('s/SUB/uploads/U/entries/1')?.bytes ?? Buffer.alloc(0))).toBe(
      sha256(large),
    );
    expect(sha256(s3.objects.get('s/SUB/uploads/U/entries/2')?.bytes ?? Buffer.alloc(0))).toBe(
      sha256(small),
    );
    // The large one by a copy of its range inside the store, of the revision
    // the directory was read from; the small one in one PUT.
    const copies = s3.named('UploadPartCopyCommand');
    expect(copies).toHaveLength(1);
    expect(copies[0]?.input['CopySource']).toBe(
      `${BUCKET}/s/SUB/imports/U.notebook?versionId=v-upload`,
    );
    expect(s3.named('PutObjectCommand')).toHaveLength(1);
    // What the function read of the archive is its tail, its directory, the
    // headers of the entries, the document and the small file: never the large one.
    const read = s3
      .named('GetObjectCommand')
      .map((get) => /^bytes=(\d+)-(\d+)$/.exec(String(get.input['Range'])))
      .reduce((total, range) => total + (range ? Number(range[2]) - Number(range[1]) + 1 : 0), 0);
    expect(read).toBeLessThan(large.length / 50);

    // What was staged is destroyed by its revision.
    const store = new S3UploadStore(s3.client, BUCKET);
    if (stagedLarge) await store.discardStaged(stagedLarge);
    if (stagedSmall) await store.discardStaged(stagedSmall);
    expect(s3.objects.has('s/SUB/uploads/U/entries/1')).toBe(false);
    expect(s3.objects.has('s/SUB/uploads/U/entries/2')).toBe(false);
  });

  it('answers what is not a zip, and what is not there, apart', async () => {
    const s3 = new FakeS3(true);
    s3.objects.set('s/SUB/imports/X.notebook', {
      bytes: Buffer.from('not a zip at all, just some text'),
      versionId: 'v1',
    });
    const store = new S3UploadStore(s3.client, BUCKET);

    expect(await store.open('s/SUB/imports/X.notebook')).toBe('not-an-archive');
    expect(await store.open('s/SUB/imports/missing.notebook')).toBeNull();
  });

  it('opens an archive of 1.5, one deflated document, as it always did', async () => {
    const s3 = new FakeS3(true);
    const document = { documentVersion: '1.5', files: [{ name: 'a', bytes: 'AAEC' }] };
    s3.objects.set('s/SUB/imports/O.notebook', {
      bytes: createZip([{ path: 'notebook.json', content: JSON.stringify(document) }], new Date()),
      versionId: 'v1',
    });

    const opened = await new S3UploadStore(s3.client, BUCKET).open('s/SUB/imports/O.notebook');
    if (!opened || opened === 'not-an-archive') throw new Error('the archive did not open');
    expect(opened.entries).toEqual(['notebook.json']);
    expect(JSON.parse(await opened.text('notebook.json'))).toEqual(document);
  });
});
