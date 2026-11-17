/**
 * What an export or an import the transfer worker never ended leaves in the
 * content bucket (#483), found beside the files nothing names (#377).
 *
 * Since format 1.6 streams the archive (#481), an export cut off — by the 15
 * minutes of the worker, or a crash — leaves its multipart upload under
 * `s/{sub}/exports/` open, and an import that stopped between staging a file
 * entry and deleting it leaves that object under
 * `s/{sub}/uploads/{upload}/entries/{n}`. No record points at either, and no
 * quota counts them.
 *
 * A lifecycle rule cannot take them alone: the subscription comes first in
 * every key (INV-01), so no prefix names the exports of every subscription,
 * and the multipart uploads of an agent's upload in parts, under `uploads/`,
 * must stay open with no deadline (RN-PRT-028). So they are found by their
 * keys, and only past a safety age: no export or import runs for longer than
 * the 15 minutes of its worker, so one older than that has ended.
 */

import {
  AbortMultipartUploadCommand,
  DeleteObjectCommand,
  ListMultipartUploadsCommand,
  ListObjectsV2Command,
  ListObjectVersionsCommand,
  type S3Client,
} from '@aws-sdk/client-s3';

const EXPORT_KEY = /^s\/[^/]+\/exports\/[^/]+$/;
const ENTRY_KEY = /^s\/[^/]+\/uploads\/[^/]+\/entries\/\d+$/;

/** A multipart upload the store holds open. */
export interface OpenMultipart {
  readonly key: string;
  readonly uploadId: string;
  readonly initiated: Date;
}

/** An object of the bucket, as a listing gives it. */
export interface ListedObject {
  readonly key: string;
  readonly bytes: number;
  readonly lastModified: Date;
}

export interface Stranded {
  /** The multipart uploads of exports that never ended. */
  readonly exports: readonly OpenMultipart[];
  /** The file entries an import staged and never deleted. */
  readonly entries: readonly ListedObject[];
}

/** What is stranded among what the bucket holds, older than the cutoff. */
export function strandedAmong(
  multiparts: readonly OpenMultipart[],
  objects: readonly ListedObject[],
  cutoff: Date,
): Stranded {
  return {
    exports: multiparts.filter(
      (each) => EXPORT_KEY.test(each.key) && each.initiated.getTime() <= cutoff.getTime(),
    ),
    entries: objects.filter(
      (each) => ENTRY_KEY.test(each.key) && each.lastModified.getTime() <= cutoff.getTime(),
    ),
  };
}

async function openMultiparts(s3: S3Client, bucket: string): Promise<OpenMultipart[]> {
  const found: OpenMultipart[] = [];
  let keyMarker: string | undefined;
  let uploadIdMarker: string | undefined;
  for (;;) {
    const page = await s3.send(
      new ListMultipartUploadsCommand({
        Bucket: bucket,
        Prefix: 's/',
        ...(keyMarker ? { KeyMarker: keyMarker } : {}),
        ...(uploadIdMarker ? { UploadIdMarker: uploadIdMarker } : {}),
      }),
    );
    for (const upload of page.Uploads ?? []) {
      if (upload.Key && upload.UploadId && upload.Initiated) {
        found.push({ key: upload.Key, uploadId: upload.UploadId, initiated: upload.Initiated });
      }
    }
    if (!page.IsTruncated) return found;
    keyMarker = page.NextKeyMarker;
    uploadIdMarker = page.NextUploadIdMarker;
  }
}

async function stagedEntries(s3: S3Client, bucket: string): Promise<ListedObject[]> {
  const found: ListedObject[] = [];
  let token: string | undefined;
  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: 's/',
        ...(token ? { ContinuationToken: token } : {}),
      }),
    );
    for (const object of page.Contents ?? []) {
      if (object.Key && object.LastModified && ENTRY_KEY.test(object.Key)) {
        found.push({ key: object.Key, bytes: object.Size ?? 0, lastModified: object.LastModified });
      }
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return found;
}

/** Finds what is stranded, older than `olderThanHours`. */
export async function strandedTransfers(input: {
  readonly s3: S3Client;
  readonly bucket: string;
  readonly olderThanHours: number;
  readonly now?: Date;
}): Promise<Stranded> {
  const cutoff = new Date((input.now ?? new Date()).getTime() - input.olderThanHours * 3_600_000);
  const [multiparts, objects] = await Promise.all([
    openMultiparts(input.s3, input.bucket),
    stagedEntries(input.s3, input.bucket),
  ]);
  return strandedAmong(multiparts, objects, cutoff);
}

/**
 * Aborts each multipart upload, which frees its parts, and destroys every
 * revision of each entry: an entry is a copy staged for an import and never a
 * revision of a note or a file (INV-08).
 */
export async function clearStranded(
  s3: S3Client,
  bucket: string,
  stranded: Stranded,
): Promise<void> {
  for (const upload of stranded.exports) {
    await s3.send(
      new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: upload.key,
        UploadId: upload.uploadId,
      }),
    );
  }
  for (const entry of stranded.entries) {
    const versions = await s3.send(
      new ListObjectVersionsCommand({ Bucket: bucket, Prefix: entry.key }),
    );
    const revisions = [...(versions.Versions ?? []), ...(versions.DeleteMarkers ?? [])].filter(
      (each) => each.Key === entry.key && each.VersionId,
    );
    for (const revision of revisions) {
      await s3.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: entry.key, VersionId: revision.VersionId }),
      );
    }
  }
}
