/**
 * Where a PDF made by the server is kept, and how it is reached (#263).
 *
 * It lives under the subscription of whoever asked, as every key of this
 * system does: `s/{subscriptionId}/prints/{printId}.pdf`, and beside it, when
 * the renderer could not make one, `{printId}.failed` with the reason. Both
 * wear the lifecycle tag the bucket expires in a day: a print is made to be
 * downloaded at once, not kept, and so it never counts towards the storage of
 * the subscription.
 *
 * The name of the note travels as metadata of the object, because the API that
 * answers the link never reads the note: the renderer read it on the page.
 */

import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { PrintState, PrintStore } from '../application/Prints.js';
import { answeredOn, attachmentNamed, UPLOAD_LIFECYCLE_TAG } from './s3.js';

export function printKey(subscriptionId: string, printId: string, ending: 'pdf' | 'failed') {
  return `s/${subscriptionId}/prints/${printId}.${ending}`;
}

const TAGGING = `${UPLOAD_LIFECYCLE_TAG.key}=${UPLOAD_LIFECYCLE_TAG.value}`;

function isMissing(error: unknown): boolean {
  const name = (error as { name?: string }).name;
  const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  return name === 'NotFound' || name === 'NoSuchKey' || status === 404 || status === 403;
}

export class S3PrintStore implements PrintStore {
  constructor(
    private readonly s3: S3Client,
    private readonly bucket: string,
    private readonly publicOrigin: string | null = null,
  ) {}

  async state(subscriptionId: string, printId: string): Promise<PrintState> {
    try {
      const head = await this.s3.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: printKey(subscriptionId, printId, 'pdf'),
        }),
      );
      const name = head.Metadata?.['note-name'];
      return { status: 'ready', name: name ? decodeURIComponent(name) : 'note' };
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
    try {
      const failed = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: printKey(subscriptionId, printId, 'failed'),
        }),
      );
      const reason = (await failed.Body?.transformToString())?.trim();
      return { status: 'failed', failure: reason || 'FAILED' };
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
    return { status: 'running' };
  }

  async link(subscriptionId: string, printId: string, name: string, seconds: number) {
    const signed = await getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: printKey(subscriptionId, printId, 'pdf'),
        ResponseContentDisposition: attachmentNamed(name),
        ResponseContentType: 'application/pdf',
      }),
      { expiresIn: seconds },
    );
    return answeredOn(signed, this.publicOrigin);
  }
}

/** What the renderer writes: the file, or why there is none. */
export class S3PrintOutput {
  constructor(
    private readonly s3: S3Client,
    private readonly bucket: string,
  ) {}

  async keep(subscriptionId: string, printId: string, pdf: Uint8Array, name: string) {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: printKey(subscriptionId, printId, 'pdf'),
        Body: pdf,
        ContentType: 'application/pdf',
        Metadata: { 'note-name': encodeURIComponent(name) },
        Tagging: TAGGING,
      }),
    );
  }

  async fail(subscriptionId: string, printId: string, failure: string) {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: printKey(subscriptionId, printId, 'failed'),
        Body: failure,
        ContentType: 'text/plain',
        Tagging: TAGGING,
      }),
    );
  }
}
