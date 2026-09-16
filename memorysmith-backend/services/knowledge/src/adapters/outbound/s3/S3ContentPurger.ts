/**
 * S3ContentPurger: the ONE piece of the system that destroys a revision
 * (RN-KNW-047, architecture-guide.md §12.4).
 *
 * It is a port of its own, and deliberately not a method on `ContentStore`.
 * Every use case of Knowledge holds a `ContentStore`; a `purge` on it would be
 * callable from all of them, and "no use case destroys a revision" would go
 * back to being a rule somebody has to remember. Here it is a type nothing
 * but the purge worker is given (PE3), and IAM says the same thing: only the
 * role of the worker may delete a version of an object of the content bucket.
 *
 * The subscriptionId comes from the envelope of the deletion event, through
 * the constructor, and never from a request (§8.2).
 */

import type { ContentId, SubscriptionId } from '@memorysmith/kernel';
import { DeleteObjectsCommand, ListObjectVersionsCommand, type S3Client } from '@aws-sdk/client-s3';

/** What the purge worker needs of the object store, and nothing more. */
export interface ContentPurger {
  /**
   * Destroys EVERY revision of one slot, current and superseded, and answers
   * how many it destroyed. Purging a slot that is already gone destroys
   * nothing and is not an error: the worker is delivered at least once, so a
   * second pass has to be a no-op (RN-KNW-047).
   */
  purge(slot: ContentId): Promise<number>;
}

/** What one DeleteObjects call takes. */
const MAX_KEYS_PER_CALL = 1000;

export class S3ContentPurger implements ContentPurger {
  constructor(
    private readonly subscriptionId: SubscriptionId,
    private readonly s3: S3Client,
    private readonly bucket: string,
  ) {}

  async purge(slot: ContentId): Promise<number> {
    const key = `s/${this.subscriptionId.value}/c/${slot.value}.md`;
    let destroyed = 0;
    let keyMarker: string | undefined;
    let versionMarker: string | undefined;

    do {
      const listed = await this.s3.send(
        new ListObjectVersionsCommand({
          Bucket: this.bucket,
          // The exact key, not a prefix of it: a slot is one object, and its
          // revisions are versions of that object (§9.2).
          Prefix: key,
          ...(keyMarker ? { KeyMarker: keyMarker } : {}),
          ...(versionMarker ? { VersionIdMarker: versionMarker } : {}),
        }),
      );

      // A delete marker is a version too, and leaving one behind would leave
      // the object alive as far as the bucket is concerned.
      const versions = [...(listed.Versions ?? []), ...(listed.DeleteMarkers ?? [])]
        .filter((version) => version.Key === key && version.VersionId)
        .map((version) => ({ Key: key, VersionId: version.VersionId as string }));

      for (let index = 0; index < versions.length; index += MAX_KEYS_PER_CALL) {
        const chunk = versions.slice(index, index + MAX_KEYS_PER_CALL);
        const answer = await this.s3.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: chunk, Quiet: true },
          }),
        );
        // A refused delete is reported in the answer rather than thrown, and
        // swallowing it would leave bytes nothing can find again.
        const errors = answer.Errors ?? [];
        if (errors.length > 0) {
          throw new Error(
            `The bucket refused ${errors.length} versions of ${key}: ${errors
              .map((error) => `${error.Code ?? ''} ${error.Message ?? ''}`.trim())
              .join('; ')}`,
          );
        }
        destroyed += chunk.length;
      }

      keyMarker = listed.IsTruncated ? listed.NextKeyMarker : undefined;
      versionMarker = listed.IsTruncated ? listed.NextVersionIdMarker : undefined;
    } while (keyMarker || versionMarker);

    return destroyed;
  }
}
