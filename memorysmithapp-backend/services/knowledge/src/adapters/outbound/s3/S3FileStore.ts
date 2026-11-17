/**
 * Where the bytes of a file live (INV-04, ADR-008, #166).
 *
 * The key is `s/{subscriptionId}/f/{contentId}` and it carries **no
 * extension**: the name of a file is a name, not a path, and the extension
 * decides nothing anywhere in this product. It carries no notebook, no path
 * and no name either, for the reason the key of a note carries none — design
 * INV-04 — so renaming a file, moving it between paths and moving its
 * notebook write not one byte here.
 *
 * What the object DOES carry is its type, written at the put and served back
 * by S3 with `X-Content-Type-Options: nosniff`, so a browser never gets to
 * have an opinion of its own about a file somebody uploaded. The type was
 * checked against the bytes before this was ever called.
 */

import { ContentId, ContentRef, Instant, type SubscriptionContext } from '@memorysmithapp/kernel';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCopyCommand,
  type CompletedPart,
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'node:crypto';
import { rendersAs } from '@memorysmithapp/contracts';
import type { FileDisposition, FileStore, SignedFile } from '../../../domain/ports/index.js';

/** How long a link to a file lasts. Long enough to read a note, and no longer. */
const LINK_SECONDS = 3600;

/** The largest object one CopyObject copies. */
export const SINGLE_COPY_MAX_BYTES = 5 * 1024 * 1024 * 1024;
/** The part of a copy in parts: S3 takes up to 5 GiB a part and 10,000 parts. */
const COPY_PART_BYTES = 1024 * 1024 * 1024;

export class S3FileStore implements FileStore {
  constructor(
    private readonly sub: SubscriptionContext,
    private readonly s3: S3Client,
    private readonly bucket: string,
    /**
     * The host a link is answered on, `https://files.{zone}` (#255), or
     * nothing to answer it on the bucket's own. The link is signed for the
     * bucket exactly as before, and the distribution on that host hands S3
     * the very request it signed: only the name the browser shows changes.
     */
    private readonly publicOrigin: string | null = null,
    /**
     * Whose uploads may become files here: this subscription's, or the one of
     * a person writing through a share, whose upload in parts lands in their
     * own subscription and becomes a file of the owner's (#347).
     */
    private readonly uploadsOf: SubscriptionContext = sub,
  ) {}

  async put(bytes: Uint8Array, mimeType: string): Promise<ContentRef> {
    const contentId = ContentId.generate();
    const response = await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.keyOf(contentId),
        Body: bytes,
        ContentType: mimeType,
        // What is drawn is drawn, and everything else is saved: a document is
        // never rendered inside the origin that serves it (#166).
        ContentDisposition: rendersAs(mimeType) === 'card' ? 'attachment' : 'inline',
      }),
    );
    const versionId = response.VersionId;
    if (!versionId) {
      // Without versioning there is no revision to point at, and a file is a
      // revision like every other piece of content here.
      throw new Error(
        `Bucket ${this.bucket} returned no VersionId: object versioning must be enabled`,
      );
    }
    const ref = ContentRef.create({
      contentId,
      versionId,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.byteLength,
    });
    if (!ref.ok) throw new Error(ref.error.message);
    return ref.value;
  }

  async read(ref: ContentRef): Promise<Uint8Array> {
    const response = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.keyOf(ref.contentId),
        VersionId: ref.versionId,
      }),
    );
    return (await response.Body?.transformToByteArray()) ?? new Uint8Array();
  }

  async stream(ref: ContentRef): Promise<AsyncIterable<Uint8Array>> {
    const response = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.keyOf(ref.contentId),
        VersionId: ref.versionId,
      }),
    );
    const body = response.Body as AsyncIterable<Uint8Array> | undefined;
    if (!body) throw new Error(`The store answered no body for the file ${ref.contentId.value}`);
    return body;
  }

  /**
   * A link a browser can follow on its own, which is what an `<img>` needs:
   * it carries its own authorisation in the query string, and it points at
   * the object store and not at the API — so a file somebody uploaded is
   * served from an origin that is not the one the product runs in. That
   * origin is `files.{zone}`, a host of the product that is still not the
   * product's own, rather than the name of the bucket (#255).
   */
  async signedUrl(
    ref: ContentRef,
    downloadName: string,
    mimeType: string,
    disposition: FileDisposition,
  ): Promise<SignedFile> {
    const signed = await getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.keyOf(ref.contentId),
        VersionId: ref.versionId,
        ResponseContentType: mimeType,
        // Which of the two it is was decided by the application (#171). It
        // used to be decided here, off the type, and that is why a card had
        // two verbs doing one thing: one link, signed as an attachment, under
        // both of them.
        ResponseContentDisposition:
          disposition === 'attachment'
            ? `attachment; filename="${downloadName.replace(/["\\]/g, '')}"`
            : 'inline',
      }),
      { expiresIn: LINK_SECONDS },
    );
    const url = answeredOn(signed, this.publicOrigin);
    const expiresAt = Instant.fromEpochMillis(Date.now() + LINK_SECONDS * 1000);
    if (!expiresAt.ok) throw new Error(expiresAt.error.message);
    return { url, expiresAt: expiresAt.value };
  }

  async peekAssembled(key: string, versionId: string, bytes: number): Promise<Uint8Array | null> {
    if (!this.isUpload(key)) return null;
    try {
      const found = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          VersionId: versionId,
          Range: `bytes=0-${Math.max(0, bytes - 1)}`,
        }),
      );
      return (await found.Body?.transformToByteArray()) ?? null;
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
  }

  /**
   * One read to hash the whole and one copy inside the store to write it where
   * a file lives (RN-PRT-027). The copy is what keeps a file of a hundred
   * megabytes out of the memory of the function: the bytes are streamed through
   * the hash and never held, and never sent back up.
   */
  async adoptAssembled(input: {
    key: string;
    versionId: string;
    mimeType: string;
    sha256: string;
  }): Promise<ContentRef | 'mismatch' | null> {
    if (!this.isUpload(input.key)) return null;
    let body: AsyncIterable<Uint8Array> | undefined;
    try {
      const found = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: input.key, VersionId: input.versionId }),
      );
      body = found.Body as AsyncIterable<Uint8Array> | undefined;
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
    if (!body) return null;

    const hash = createHash('sha256');
    let size = 0;
    for await (const chunk of body) {
      hash.update(chunk);
      size += chunk.byteLength;
    }
    const sha256 = hash.digest('hex');
    if (sha256 !== input.sha256) return 'mismatch';

    const contentId = ContentId.generate();
    const copySource = `${this.bucket}/${input.key
      .split('/')
      .map(encodeURIComponent)
      .join('/')}?versionId=${encodeURIComponent(input.versionId)}`;
    const disposition = rendersAs(input.mimeType) === 'card' ? 'attachment' : 'inline';
    // One CopyObject stops at 5 GiB; above it the copy goes in parts (#485),
    // the bytes never passing through the function either way.
    const versionId =
      size > SINGLE_COPY_MAX_BYTES
        ? await this.copyInParts(copySource, this.keyOf(contentId), size, {
            contentType: input.mimeType,
            disposition,
          })
        : (
            await this.s3.send(
              new CopyObjectCommand({
                Bucket: this.bucket,
                Key: this.keyOf(contentId),
                CopySource: copySource,
                MetadataDirective: 'REPLACE',
                ContentType: input.mimeType,
                ContentDisposition: disposition,
              }),
            )
          ).VersionId;
    if (!versionId) {
      throw new Error(
        `Bucket ${this.bucket} returned no VersionId: object versioning must be enabled`,
      );
    }
    const ref = ContentRef.create({ contentId, versionId, sha256, bytes: size });
    if (!ref.ok) throw new Error(ref.error.message);
    return ref.value;
  }

  /** The copy of a whole larger than one CopyObject takes, in parts of 1 GiB (#485). */
  private async copyInParts(
    copySource: string,
    key: string,
    size: number,
    options: { readonly contentType: string; readonly disposition: string },
  ): Promise<string | undefined> {
    const started = await this.s3.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: options.contentType,
        ContentDisposition: options.disposition,
      }),
    );
    if (!started.UploadId) throw new Error('The store opened no multipart upload');
    const uploadId = started.UploadId;
    try {
      const parts: CompletedPart[] = [];
      for (let at = 0; at < size; at += COPY_PART_BYTES) {
        const number = parts.length + 1;
        const copied = await this.s3.send(
          new UploadPartCopyCommand({
            Bucket: this.bucket,
            Key: key,
            UploadId: uploadId,
            PartNumber: number,
            CopySource: copySource,
            CopySourceRange: `bytes=${at}-${Math.min(size, at + COPY_PART_BYTES) - 1}`,
          }),
        );
        parts.push({ PartNumber: number, ETag: copied.CopyPartResult?.ETag });
      }
      const completed = await this.s3.send(
        new CompleteMultipartUploadCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: { Parts: parts },
        }),
      );
      return completed.VersionId;
    } catch (error) {
      await this.s3
        .send(
          new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId }),
        )
        .catch(() => undefined);
      throw error;
    }
  }

  /**
   * Only an upload of this subscription, or of the person writing through a
   * share, may become one of its files (INV-01): the file is written under
   * this subscription either way.
   */
  private isUpload(key: string): boolean {
    return key.startsWith(`s/${this.uploadsOf.subscriptionId.value}/uploads/`);
  }

  private keyOf(contentId: ContentId): string {
    return `s/${this.sub.subscriptionId.value}/f/${contentId.value}`;
  }
}

/** A URL signed for the bucket, with the host a browser is shown swapped in. */
function answeredOn(signed: string, publicOrigin: string | null): string {
  if (!publicOrigin) return signed;
  const url = new URL(signed);
  const origin = new URL(publicOrigin);
  url.protocol = origin.protocol;
  url.host = origin.host;
  return url.toString();
}

function missing(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name ?? '';
  return name === 'NoSuchKey' || name === 'NotFound' || name === 'NoSuchVersion';
}
