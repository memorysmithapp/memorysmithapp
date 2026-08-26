/**
 * S3ContentStore: the only piece of the system that knows what an S3 key looks
 * like (architecture-guide.md, sections 9.2 and 10.5).
 *
 * The key is `s/{subscriptionId}/c/{contentId}.md` and encodes NO vault, NO
 * folder, NO name and NO role. That is the difference between opaque as an
 * intention and opaque as a structural property: renaming, moving or
 * reordering cannot touch S3, because the key holds no field those operations
 * would change (PE3).
 *
 * The subscriptionId comes from the SubscriptionContext of the constructor,
 * never from an argument.
 */

import { ContentId, ContentRef, Instant, type SubscriptionContext } from '@memorysmith/kernel';
import { GetObjectCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import type { ContentStore } from '../../../domain/ports/index.js';

export class S3ContentStore implements ContentStore {
  constructor(
    private readonly sub: SubscriptionContext,
    private readonly s3: S3Client,
    private readonly bucket: string,
  ) {}

  async create(markdown: string): Promise<ContentRef> {
    return this.put(ContentId.generate(), markdown);
  }

  async overwrite(slot: ContentId, markdown: string): Promise<ContentRef> {
    return this.put(slot, markdown);
  }

  async read(ref: ContentRef): Promise<string> {
    const response = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.keyOf(ref.contentId),
        // The EXACT revision the ref points at, which is what makes
        // read_note(asOf) answer the past instead of the present.
        VersionId: ref.versionId,
      }),
    );
    return (await response.Body?.transformToString('utf-8')) ?? '';
  }

  private keyOf(contentId: ContentId): string {
    return `s/${this.sub.subscriptionId.value}/c/${contentId.value}.md`;
  }

  private async put(contentId: ContentId, markdown: string): Promise<ContentRef> {
    const body = Buffer.from(markdown, 'utf8');
    const sha256 = createHash('sha256').update(body).digest('hex');

    const response = await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.keyOf(contentId),
        Body: body,
        ContentType: 'text/markdown; charset=utf-8',
        // Only what never changes. Deliberately NOT vaultId, folderId or
        // title: those turn into lies on the first move, and keeping them
        // current would hand S3 back exactly the write we are removing.
        Metadata: {
          'subscription-id': this.sub.subscriptionId.value,
          'content-id': contentId.value,
          'created-at': Instant.now().toISOString(),
        },
      }),
    );

    const versionId = response.VersionId;
    if (!versionId) {
      // Without versioning there is no revision to point at, and the whole
      // historical reconstruction of section 12.3 quietly stops working.
      throw new Error(
        `Bucket ${this.bucket} returned no VersionId: object versioning must be enabled`,
      );
    }

    const ref = ContentRef.create({ contentId, versionId, sha256, bytes: body.length });
    if (!ref.ok) throw new Error(ref.error.message);
    return ref.value;
  }
}
