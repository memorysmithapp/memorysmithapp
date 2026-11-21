/**
 * S3ArchiveStore: where an export lands, and how the person who asked for it
 * reaches the bytes.
 *
 * The archive lives under the SAME subscription prefix as everything else,
 * `s/{subscriptionId}/exports/`, so the first rule of the design holds here
 * too: every key of this system begins with the subscription.
 *
 * The bucket blocks public access, so the download is a pre-signed URL,
 * short-lived and issued for that one object. Nothing else about the export is
 * reachable, and a link that leaks stops working within the quarter of an hour
 * the use case declares. It is answered on `files.{zone}`, a host of the
 * product, and not on the name of the bucket (#255).
 *
 * **The archive carries no lifecycle tag any more.** It used to, and the bucket
 * rule threw it away a day later, on the reasoning that an export is derived
 * and rebuildable. It is not: the notebook it was made of can be deleted, and
 * an export is then the one way back (RN-PRT-020). An export is kept until
 * whoever generated it deletes it, and it counts towards the storage of the
 * subscription while it is kept (RN-SUB-021). The tag stays on the upload of an
 * IMPORT, which really is thrown away the moment the import ends.
 */

import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  UploadPartCommand,
  UploadPartCopyCommand,
  type CompletedPart,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'node:stream';
import { createInflateRaw } from 'node:zlib';
import type { ArchiveStore } from '../application/ExportNotebook.js';
import type { StagedEntry, UploadedArchive, UploadStore } from '../application/ImportNotebook.js';
import type { PartStore } from '../application/Uploads.js';
import { DEFLATED, STORED, dataStartOf, readDirectory, readText, type RangeSource } from './zip.js';

/**
 * The size of each part an archive goes to the store in (RN-PRT-093): what
 * the worker holds of an archive at once, twice over while a part is sent.
 * Ten thousand of them, the most a multipart upload takes, are 78 GiB.
 */
export const ARCHIVE_PART_BYTES = 8 * 1024 * 1024;

/**
 * The size of each part a copy inside the store is made in. The copy never
 * passes through the function, so the part is as large as the store takes
 * one under its ceiling of 5 GiB, and a copy of a whole object of up to this
 * size is one `CopyObject`.
 */
export const COPY_PART_BYTES = 1024 * 1024 * 1024;
const COPY_OBJECT_MAX_BYTES = 5 * 1024 * 1024 * 1024;

/**
 * Writes an object from a stream of chunks, in parts of at least
 * `ARCHIVE_PART_BYTES` (RN-PRT-093): nothing longer than one part is held. An
 * object smaller than one part is one `PutObject`. A write that fails midway
 * aborts its multipart upload, so it leaves nothing billed behind.
 */
export async function writeInParts(
  s3: S3Client,
  bucket: string,
  key: string,
  chunks: AsyncIterable<Uint8Array>,
  options: { readonly contentType: string; readonly tagging?: string },
): Promise<{ versionId: string | null; bytes: number }> {
  let pending: Buffer[] = [];
  let pendingBytes = 0;
  let total = 0;
  let uploadId: string | undefined;
  const parts: CompletedPart[] = [];

  const flush = async (): Promise<void> => {
    if (uploadId === undefined) {
      const started = await s3.send(
        new CreateMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          ContentType: options.contentType,
          ChecksumAlgorithm: 'CRC32',
          ...(options.tagging ? { Tagging: options.tagging } : {}),
        }),
      );
      if (!started.UploadId) throw new Error('The store opened no multipart upload');
      uploadId = started.UploadId;
    }
    const body = Buffer.concat(pending, pendingBytes);
    pending = [];
    pendingBytes = 0;
    const number = parts.length + 1;
    const sent = await s3.send(
      new UploadPartCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: number,
        Body: body,
        ChecksumAlgorithm: 'CRC32',
      }),
    );
    parts.push({
      PartNumber: number,
      ETag: sent.ETag,
      ...(sent.ChecksumCRC32 ? { ChecksumCRC32: sent.ChecksumCRC32 } : {}),
    });
  };

  try {
    for await (const chunk of chunks) {
      if (chunk.byteLength === 0) continue;
      pending.push(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength));
      pendingBytes += chunk.byteLength;
      total += chunk.byteLength;
      if (pendingBytes >= ARCHIVE_PART_BYTES) await flush();
    }
    if (uploadId === undefined) {
      const written = await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: Buffer.concat(pending, pendingBytes),
          ContentType: options.contentType,
          ...(options.tagging ? { Tagging: options.tagging } : {}),
        }),
      );
      return { versionId: written.VersionId ?? null, bytes: total };
    }
    if (pendingBytes > 0) await flush();
    const completed = await s3.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
      }),
    );
    return { versionId: completed.VersionId ?? null, bytes: total };
  } catch (error) {
    if (uploadId !== undefined) {
      const opened = uploadId;
      await s3
        .send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: opened }))
        .catch(() => undefined);
    }
    throw error;
  }
}

/** A key as a `CopySource` takes it, with the revision it copies when one is named. */
function copySourceOf(bucket: string, key: string, versionId: string | null): string {
  const path = `${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
  return versionId ? `${path}?versionId=${encodeURIComponent(versionId)}` : path;
}

/**
 * Copies a range of one object into another inside the store, in parts of
 * `COPY_PART_BYTES`: the bytes never pass through the function, and no size
 * stops it, where one `CopyObject` stops at 5 GiB.
 */
export async function copyRangeInParts(
  s3: S3Client,
  bucket: string,
  source: { readonly key: string; readonly versionId: string | null },
  range: { readonly start: number; readonly length: number },
  key: string,
  options: { readonly contentType: string; readonly tagging?: string },
): Promise<string | null> {
  const started = await s3.send(
    new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: options.contentType,
      ...(options.tagging ? { Tagging: options.tagging } : {}),
    }),
  );
  if (!started.UploadId) throw new Error('The store opened no multipart upload');
  const uploadId = started.UploadId;
  try {
    const parts: CompletedPart[] = [];
    for (let at = 0; at < range.length; at += COPY_PART_BYTES) {
      const last = Math.min(range.length, at + COPY_PART_BYTES) - 1;
      const number = parts.length + 1;
      const copied = await s3.send(
        new UploadPartCopyCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
          PartNumber: number,
          CopySource: copySourceOf(bucket, source.key, source.versionId),
          CopySourceRange: `bytes=${range.start + at}-${range.start + last}`,
        }),
      );
      parts.push({ PartNumber: number, ETag: copied.CopyPartResult?.ETag });
    }
    const completed = await s3.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
      }),
    );
    return completed.VersionId ?? null;
  } catch (error) {
    await s3
      .send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }))
      .catch(() => undefined);
    throw error;
  }
}

/** Whether the store said there is nothing at that key, or at that revision. */
function missing(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name ?? '';
  return name === 'NoSuchKey' || name === 'NotFound' || name === 'NoSuchVersion';
}

/**
 * What the bucket rule expires on. It is worn by the upload of an IMPORT and by
 * nothing else: that file has done its job the moment the import ends, whichever
 * way it ended (RN-PRT-014). An export used to wear it too, and the bucket threw
 * it away a day later — which is what made a backup something nobody could come
 * back to (RN-PRT-020).
 */
export const UPLOAD_LIFECYCLE_TAG = { key: 'lifecycle', value: 'export' } as const;

export class S3ArchiveStore implements ArchiveStore {
  constructor(
    private readonly s3: S3Client,
    private readonly bucket: string,
    /**
     * The host a download is answered on, `https://files.{zone}` (#255), or
     * nothing to answer it on the bucket's own — the worker that builds an
     * export signs nothing.
     */
    private readonly publicOrigin: string | null = null,
  ) {}

  /**
   * The archive, written as it is made, in parts of 8 MiB (RN-PRT-093): a
   * file of the notebook goes from its object into the archive without being
   * held, so the size of the archive is not bounded by the memory of the
   * worker. It answers the revision it wrote: an export is written once and
   * never overwritten, so this version IS the object, and deleting it destroys
   * the bytes without listing versions and without leaving a delete marker
   * (RN-PRT-020).
   */
  async write(
    key: string,
    archive: AsyncIterable<Uint8Array>,
  ): Promise<{ versionId: string | null; bytes: number }> {
    return writeInParts(this.s3, this.bucket, key, archive, { contentType: 'application/zip' });
  }

  /**
   * Destroys one revision of one archive. The role that calls this may delete a
   * version under `exports/` and nowhere else, so no revision of a note is
   * within its reach: the one principal allowed to destroy one of those is the
   * purge worker (INV-08, RN-KNW-047).
   */
  async destroy(key: string, versionId: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key, VersionId: versionId }),
    );
  }

  async presign(key: string, expiresInSeconds: number, filename?: string): Promise<string> {
    const signed = await getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        // The browser is navigating to this URL, so what it does with the
        // response is decided here: a file named after the notebook, saved
        // rather than rendered. It was named after the last segment of the
        // key, an identifier, whatever name the use case asked for.
        ResponseContentDisposition: attachmentNamed(filename ?? filenameOf(key)),
      }),
      { expiresIn: expiresInSeconds },
    );
    return answeredOn(signed, this.publicOrigin);
  }
}

/**
 * A URL signed for the bucket, answered on a host of the product (#241, #255).
 * A signature of S3 covers the host it was signed for and the path, and the
 * distribution on the public host forwards the request to the bucket with its
 * own Host, so S3 checks the very request it signed: only the name the client
 * sees changes.
 */
export function answeredOn(signed: string, publicOrigin: string | null): string {
  if (!publicOrigin) return signed;
  const url = new URL(signed);
  const origin = new URL(publicOrigin);
  url.protocol = origin.protocol;
  url.host = origin.host;
  return url.toString();
}

/**
 * A download named after what it is, in any language. The plain `filename` is
 * what an old client reads, so it carries the name without its accents; the
 * `filename*` of RFC 6266 carries it whole, encoded, and every browser prefers
 * it — *Ata de reunião.pdf* is saved as *Ata de reunião.pdf*.
 */
export function attachmentNamed(name: string): string {
  return dispositionNamed('attachment', name);
}

/**
 * The same header for a file the browser shows rather than saves (#522): a
 * PDF opened in a tab keeps the note's name when it is saved from there.
 */
export function dispositionNamed(kind: 'inline' | 'attachment', name: string): string {
  const plain = name
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '');
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${kind}; filename="${plain}"; filename*=UTF-8''${encoded}`;
}

function filenameOf(key: string): string {
  return key.split('/').pop() ?? 'export.zip';
}

/**
 * S3UploadStore: where a `.notebook` arrives before it becomes a notebook.
 *
 * It lives under the same subscription prefix as everything else,
 * `s/{subscriptionId}/imports/`, and it wears the same `lifecycle=export` tag:
 * an upload is as derived as an export — the notebook it describes is either
 * written or it is not, and either way the file has done its job.
 *
 * The bucket blocks public access, so the upload is a pre-signed PUT, issued
 * for that one key and expiring with the use case that asked for it.
 */
export class S3UploadStore implements UploadStore {
  constructor(
    private readonly s3: S3Client,
    private readonly bucket: string,
  ) {}

  async presignUpload(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: 'application/zip',
        Tagging: `${UPLOAD_LIFECYCLE_TAG.key}=${UPLOAD_LIFECYCLE_TAG.value}`,
      }),
      { expiresIn: expiresInSeconds },
    );
  }

  /**
   * The archive where it is (RN-PRT-093): its size and revision, then its
   * tail and central directory by ranged reads of that revision, and later
   * the document by its range. A file entry is never read here: `stage`
   * copies it inside the store.
   */
  async open(key: string): Promise<UploadedArchive | null | 'not-an-archive'> {
    let size: number;
    let versionId: string | null;
    try {
      const head = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      size = head.ContentLength ?? 0;
      versionId = head.VersionId ?? null;
    } catch (error) {
      // An upload that never happened and one that expired are the same
      // answer: there is nothing at that key.
      if (missing(error)) return null;
      throw error;
    }

    const source: RangeSource = {
      size,
      read: async (start, length) => {
        if (length === 0) return Buffer.alloc(0);
        const found = await this.s3.send(
          new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
            ...(versionId ? { VersionId: versionId } : {}),
            Range: `bytes=${start}-${start + length - 1}`,
          }),
        );
        const bytes = Buffer.from((await found.Body?.transformToByteArray()) ?? new Uint8Array());
        if (bytes.length !== length) throw new Error('A ranged read answered another length');
        return bytes;
      },
    };

    let directory: Awaited<ReturnType<typeof readDirectory>>;
    try {
      directory = await readDirectory(source);
    } catch {
      return 'not-an-archive';
    }
    const byName = new Map(directory.map((entry) => [entry.name, entry]));

    return {
      entries: directory.map((entry) => entry.name),
      text: async (name) => {
        const entry = byName.get(name);
        if (!entry) throw new Error(`no entry ${name}`);
        return readText(source, entry);
      },
      stage: async (name, target): Promise<StagedEntry | null> => {
        const entry = byName.get(name);
        if (!entry) return null;
        let start: number;
        try {
          start = await dataStartOf(source, entry);
        } catch {
          return null;
        }
        const options = { contentType: 'application/octet-stream' };
        if (entry.method === STORED) {
          // Copied inside the store, range by range: the bytes of the file
          // never pass through the function on the way to the stage.
          if (entry.compressedSize < ARCHIVE_PART_BYTES) {
            const written = await this.s3.send(
              new PutObjectCommand({
                Bucket: this.bucket,
                Key: target,
                Body: await source.read(start, entry.compressedSize),
                ContentType: options.contentType,
              }),
            );
            return stagedAt(target, written.VersionId, entry.compressedSize);
          }
          const written = await copyRangeInParts(
            this.s3,
            this.bucket,
            { key, versionId },
            { start, length: entry.compressedSize },
            target,
            options,
          );
          return stagedAt(target, written ?? undefined, entry.compressedSize);
        }
        if (entry.method === DEFLATED) {
          // Not what an export writes, and what a person who zipped the
          // archive again may have: inflated as it is read, written in parts.
          if (entry.compressedSize === 0) return null;
          const found = await this.s3.send(
            new GetObjectCommand({
              Bucket: this.bucket,
              Key: key,
              ...(versionId ? { VersionId: versionId } : {}),
              Range: `bytes=${start}-${start + entry.compressedSize - 1}`,
            }),
          );
          const body = found.Body as Readable | undefined;
          if (!body) return null;
          const written = await writeInParts(
            this.s3,
            this.bucket,
            target,
            body.pipe(createInflateRaw()),
            options,
          );
          return stagedAt(target, written.versionId ?? undefined, written.bytes);
        }
        return null;
      },
    };
  }

  /**
   * What `stage` wrote is destroyed by its revision, which the worker may do
   * under `uploads/` and nowhere else: a delete without one would only hide
   * the bytes behind a marker while they stay billed (RN-PRT-028).
   */
  async discardStaged(staged: StagedEntry): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: staged.key,
        VersionId: staged.versionId,
      }),
    );
  }

  async discard(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /**
   * A kept export copied to an upload key, inside the bucket (#207). The bytes
   * never leave it: a single CopyObject reads the current revision of the
   * archive and writes a new object, so the export is untouched and stays
   * kept. The copy does NOT inherit the tags of its source — an export wears
   * none, on purpose (RN-PRT-020) — it is given the tag of an upload, so the
   * rule of the bucket discards it like any other (RN-PRT-014).
   */
  async copyFrom(source: string, key: string): Promise<boolean> {
    try {
      // A single CopyObject stops at 5 GiB; an archive past it is copied in
      // parts, still inside the store (#481).
      const head = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: source }));
      const size = head.ContentLength ?? 0;
      if (size > COPY_OBJECT_MAX_BYTES) {
        await copyRangeInParts(
          this.s3,
          this.bucket,
          { key: source, versionId: head.VersionId ?? null },
          { start: 0, length: size },
          key,
          {
            contentType: 'application/zip',
            tagging: `${UPLOAD_LIFECYCLE_TAG.key}=${UPLOAD_LIFECYCLE_TAG.value}`,
          },
        );
        return true;
      }
      await this.s3.send(
        new CopyObjectCommand({
          Bucket: this.bucket,
          Key: key,
          // The source is `bucket/key`, URL-encoded; the keys of this product
          // are identifiers, and encoding each segment keeps it so if not.
          CopySource: `${this.bucket}/${source.split('/').map(encodeURIComponent).join('/')}`,
          ContentType: 'application/zip',
          MetadataDirective: 'REPLACE',
          TaggingDirective: 'REPLACE',
          Tagging: `${UPLOAD_LIFECYCLE_TAG.key}=${UPLOAD_LIFECYCLE_TAG.value}`,
        }),
      );
      return true;
    } catch (error) {
      // An archive that is not there is the one answer this owes the caller;
      // anything else is a failure of the store, and saying "not found" for
      // it would hide a refusal of IAM behind a 404.
      if (missing(error)) return false;
      throw error;
    }
  }
}

/** Where an entry was staged, or a failure: a staged object is a revision like any other. */
function stagedAt(key: string, versionId: string | undefined, size: number): StagedEntry {
  if (!versionId) throw new Error('The bucket returned no VersionId: versioning must be enabled');
  return { key, versionId, size };
}

/**
 * S3PartStore: where the parts of an upload of an agent are kept (RN-PRT-027),
 * under `s/{subscriptionId}/uploads/{transferId}/` — the subscription first,
 * as every key of this system, and no notebook anywhere in it (INV-04).
 *
 * **Nothing here wears the lifecycle tag, and no rule of the bucket reaches
 * this prefix** (RN-PRT-028): an upload has no deadline, the person sees what
 * it holds and decides, and the bucket must not decide behind the record.
 *
 * Every write answers its revision and every discard destroys by revision, as
 * an export does: the bucket is versioned, and a delete without a version only
 * hides the bytes behind a marker while they stay billed.
 */
export class S3PartStore implements PartStore {
  constructor(
    private readonly s3: S3Client,
    /**
     * The client that signs the address of a part. It is built without the
     * checksum the SDK adds by default: version 3.1117 signs a part with the
     * CRC32 of an EMPTY body, so a plain PUT of the real bytes is refused.
     */
    private readonly signer: S3Client,
    private readonly bucket: string,
    /**
     * The host a signed part is answered on, `https://uploads.{zone}` (#241),
     * or nothing to answer it on the bucket's own.
     */
    private readonly publicOrigin: string | null = null,
  ) {}

  async startMultipart(key: string, mimeType: string): Promise<string> {
    const started = await this.s3.send(
      new CreateMultipartUploadCommand({ Bucket: this.bucket, Key: key, ContentType: mimeType }),
    );
    if (!started.UploadId) throw new Error('The store opened no multipart upload');
    return started.UploadId;
  }

  async signPart(key: string, multipartId: string, part: number, seconds: number): Promise<string> {
    const signed = await getSignedUrl(
      this.signer,
      new UploadPartCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: multipartId,
        PartNumber: part,
      }),
      { expiresIn: seconds },
    );
    return answeredOn(signed, this.publicOrigin);
  }

  async listParts(
    key: string,
    multipartId: string,
  ): Promise<Array<{ part: number; lastModified: string | null }> | null> {
    const listed: Array<{ part: number; lastModified: string | null }> = [];
    let marker: string | undefined;
    try {
      do {
        const page = await this.s3.send(
          new ListPartsCommand({
            Bucket: this.bucket,
            Key: key,
            UploadId: multipartId,
            ...(marker ? { PartNumberMarker: marker } : {}),
          }),
        );
        for (const part of page.Parts ?? []) {
          if (part.PartNumber === undefined) continue;
          listed.push({
            part: part.PartNumber,
            lastModified: part.LastModified ? part.LastModified.toISOString() : null,
          });
        }
        marker = page.IsTruncated ? page.NextPartNumberMarker : undefined;
      } while (marker);
    } catch (error) {
      if ((error as { name?: string } | null)?.name === 'NoSuchUpload') return null;
      throw error;
    }
    return listed;
  }

  async completeMultipart(key: string, multipartId: string): Promise<string> {
    const parts: Array<{ PartNumber: number; ETag: string }> = [];
    let marker: string | undefined;
    do {
      const page = await this.s3.send(
        new ListPartsCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: multipartId,
          ...(marker ? { PartNumberMarker: marker } : {}),
        }),
      );
      for (const part of page.Parts ?? []) {
        if (part.PartNumber !== undefined && part.ETag) {
          parts.push({ PartNumber: part.PartNumber, ETag: part.ETag });
        }
      }
      marker = page.IsTruncated ? page.NextPartNumberMarker : undefined;
    } while (marker);
    const completed = await this.s3.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: multipartId,
        MultipartUpload: { Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber) },
      }),
    );
    if (!completed.VersionId) {
      throw new Error(`Bucket ${this.bucket} returned no VersionId: versioning must be enabled`);
    }
    return completed.VersionId;
  }

  async abortMultipart(key: string, multipartId: string): Promise<void> {
    await this.s3.send(
      new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId: multipartId }),
    );
  }

  async destroy(key: string, versionId: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key, VersionId: versionId }),
    );
  }
}
