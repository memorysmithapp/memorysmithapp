/**
 * S3ArchiveStore: where an export lands, and how the person who asked for it
 * reaches the bytes (architecture-guide.md, section 16).
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
  ListPartsCommand,
  PutObjectCommand,
  UploadPartCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { ArchiveStore } from '../application/ExportNotebook.js';
import type { UploadStore } from '../application/ImportNotebook.js';
import type { PartStore } from '../application/Uploads.js';

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

  async put(key: string, archive: Buffer): Promise<{ versionId: string | null }> {
    const written = await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: archive,
        ContentType: 'application/zip',
      }),
    );
    // The revision it wrote. An export is written once and never overwritten,
    // so this version IS the object: deleting it destroys the bytes without
    // listing versions and without leaving a delete marker (RN-PRT-020).
    return { versionId: written.VersionId ?? null };
  }

  /**
   * Destroys one revision of one archive. The role that calls this may delete a
   * version under `exports/` and nowhere else, so no revision of a note is
   * within its reach: the one principal allowed to destroy one of those is the
   * purge worker (rule 8, RN-KNW-047).
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
  const plain = name
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '');
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${plain}"; filename*=UTF-8''${encoded}`;
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

  async read(key: string): Promise<Buffer | null> {
    try {
      const found = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const bytes = await found.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : null;
    } catch {
      // An upload that never happened and one that expired are the same
      // answer: there is nothing at that key.
      return null;
    }
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
      const name = (error as { name?: string } | null)?.name ?? '';
      if (name === 'NoSuchKey' || name === 'NotFound') return false;
      throw error;
    }
  }
}

/**
 * S3PartStore: where the parts of an upload of an agent are kept (RN-PRT-027),
 * under `s/{subscriptionId}/uploads/{transferId}/` — the subscription first,
 * as every key of this system, and no notebook anywhere in it (rule 4).
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

  async putObject(key: string, bytes: Uint8Array): Promise<string> {
    const written = await this.s3.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: bytes }),
    );
    if (!written.VersionId) {
      throw new Error(`Bucket ${this.bucket} returned no VersionId: versioning must be enabled`);
    }
    return written.VersionId;
  }

  async readObject(key: string, versionId: string): Promise<Uint8Array | null> {
    try {
      const found = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key, VersionId: versionId }),
      );
      return (await found.Body?.transformToByteArray()) ?? null;
    } catch (error) {
      const name = (error as { name?: string } | null)?.name ?? '';
      if (name === 'NoSuchKey' || name === 'NoSuchVersion' || name === 'NotFound') return null;
      throw error;
    }
  }

  async destroy(key: string, versionId: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key, VersionId: versionId }),
    );
  }
}
