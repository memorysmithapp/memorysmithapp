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
 * the use case declares.
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
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { ArchiveStore } from '../application/ExportNotebook.js';
import type { UploadStore } from '../application/ImportNotebook.js';

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

  async presign(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        // The browser is navigating to this URL, so what it does with the
        // response is decided here: a file named after the notebook, saved
        // rather than rendered.
        ResponseContentDisposition: `attachment; filename="${filenameOf(key)}"`,
      }),
      { expiresIn: expiresInSeconds },
    );
  }
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
}
