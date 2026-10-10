/**
 * Where a preview is kept, and how it is read back (#260, RN-PRT-032).
 *
 * Under the subscription of whoever asked, as every key of this system is:
 * `s/{subscriptionId}/previews/{previewId}.md` holds the draft, when a draft
 * is what is drawn; `{previewId}.png` the image, with the size it was drawn at
 * as metadata of the object; and `{previewId}.failed` the reason, when the
 * renderer could not draw one. All three wear the lifecycle tag the bucket
 * expires in a day: a preview is looked at once, by the agent that asked for
 * it, and so it never counts towards the storage of the subscription.
 */

import { GetObjectCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import type { PreviewState, PreviewStore } from '../application/Previews.js';
import { UPLOAD_LIFECYCLE_TAG } from './s3.js';

export function previewKey(
  subscriptionId: string,
  previewId: string,
  ending: 'md' | 'png' | 'failed',
): string {
  return `s/${subscriptionId}/previews/${previewId}.${ending}`;
}

const TAGGING = `${UPLOAD_LIFECYCLE_TAG.key}=${UPLOAD_LIFECYCLE_TAG.value}`;

function isMissing(error: unknown): boolean {
  const name = (error as { name?: string }).name;
  const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  return name === 'NotFound' || name === 'NoSuchKey' || status === 404 || status === 403;
}

function whole(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

export class S3PreviewStore implements PreviewStore {
  constructor(
    private readonly s3: S3Client,
    private readonly bucket: string,
  ) {}

  async keepDraft(subscriptionId: string, previewId: string, content: string): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: previewKey(subscriptionId, previewId, 'md'),
        Body: content,
        ContentType: 'text/markdown; charset=utf-8',
        Tagging: TAGGING,
      }),
    );
  }

  async state(subscriptionId: string, previewId: string): Promise<PreviewState> {
    try {
      const image = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: previewKey(subscriptionId, previewId, 'png'),
        }),
      );
      const png = (await image.Body?.transformToByteArray()) ?? new Uint8Array();
      const width = whole(image.Metadata?.['width']);
      const height = whole(image.Metadata?.['height']);
      return {
        status: 'ready',
        image: {
          png,
          width,
          height,
          drawnHeight: Math.max(height, whole(image.Metadata?.['drawn-height'])),
        },
      };
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
    try {
      const failed = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: previewKey(subscriptionId, previewId, 'failed'),
        }),
      );
      const reason = (await failed.Body?.transformToString())?.trim();
      return { status: 'failed', failure: reason || 'FAILED' };
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
    return { status: 'running' };
  }
}

/** What the renderer reads and writes: the draft, and the image or why there is none. */
export class S3PreviewOutput {
  constructor(
    private readonly s3: S3Client,
    private readonly bucket: string,
  ) {}

  async draft(subscriptionId: string, previewId: string): Promise<string> {
    const kept = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: previewKey(subscriptionId, previewId, 'md'),
      }),
    );
    return (await kept.Body?.transformToString('utf-8')) ?? '';
  }

  async keep(
    subscriptionId: string,
    previewId: string,
    image: { png: Uint8Array; width: number; height: number; drawnHeight: number },
  ): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: previewKey(subscriptionId, previewId, 'png'),
        Body: image.png,
        ContentType: 'image/png',
        Metadata: {
          width: String(image.width),
          height: String(image.height),
          'drawn-height': String(image.drawnHeight),
        },
        Tagging: TAGGING,
      }),
    );
  }

  async fail(subscriptionId: string, previewId: string, failure: string): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: previewKey(subscriptionId, previewId, 'failed'),
        Body: failure,
        ContentType: 'text/plain',
        Tagging: TAGGING,
      }),
    );
  }
}
