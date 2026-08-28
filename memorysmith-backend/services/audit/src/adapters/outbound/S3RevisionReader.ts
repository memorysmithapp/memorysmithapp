/**
 * Reads one revision by the pair (contentId, versionId) the event carries.
 *
 * The Audit context has its own reader, and its own IAM policy, because it
 * must be able to read the past without holding any of the write permissions
 * the Knowledge context holds.
 */

import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import type { ContentRef, SubscriptionId } from '@memorysmith/kernel';
import type { RevisionReader } from '../../domain/index.js';

export class S3RevisionReader implements RevisionReader {
  constructor(
    private readonly subscriptionId: SubscriptionId,
    private readonly s3: S3Client,
    private readonly bucket: string,
  ) {}

  async read(ref: ContentRef): Promise<string> {
    const response = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: `s/${this.subscriptionId.value}/c/${ref.contentId.value}.md`,
        VersionId: ref.versionId,
      }),
    );
    return (await response.Body?.transformToString('utf-8')) ?? '';
  }
}
