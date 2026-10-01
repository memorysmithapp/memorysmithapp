/**
 * Where the bytes of a file live (#166; architecture-guide.md §9.2, §10.5).
 *
 * The key is `s/{subscriptionId}/f/{contentId}` and it carries **no
 * extension**: the name of a file is a name, not a path, and the extension
 * decides nothing anywhere in this product. It carries no notebook, no path
 * and no name either, for the reason the key of a note carries none — design
 * rule 4 — so renaming a file, moving it between paths and moving its
 * notebook write not one byte here.
 *
 * What the object DOES carry is its type, written at the put and served back
 * by S3 with `X-Content-Type-Options: nosniff`, so a browser never gets to
 * have an opinion of its own about a file somebody uploaded. The type was
 * checked against the bytes before this was ever called.
 */

import { ContentId, ContentRef, Instant, type SubscriptionContext } from '@memorysmith/kernel';
import {
  CopyObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'node:crypto';
import { rendersAs } from '@memorysmith/contracts';
import type { FileDisposition, FileStore, SignedFile } from '../../../domain/ports/index.js';

/** How long a link to a file lasts. Long enough to read a note, and no longer. */
const LINK_SECONDS = 3600;

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
    const copied = await this.s3.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        Key: this.keyOf(contentId),
        CopySource: `${this.bucket}/${input.key
          .split('/')
          .map(encodeURIComponent)
          .join('/')}?versionId=${encodeURIComponent(input.versionId)}`,
        MetadataDirective: 'REPLACE',
        ContentType: input.mimeType,
        ContentDisposition: rendersAs(input.mimeType) === 'card' ? 'attachment' : 'inline',
      }),
    );
    const versionId = copied.VersionId;
    if (!versionId) {
      throw new Error(
        `Bucket ${this.bucket} returned no VersionId: object versioning must be enabled`,
      );
    }
    const ref = ContentRef.create({ contentId, versionId, sha256, bytes: size });
    if (!ref.ok) throw new Error(ref.error.message);
    return ref.value;
  }

  /** Only an upload of this subscription may become one of its files (rule 1). */
  private isUpload(key: string): boolean {
    return key.startsWith(`s/${this.sub.subscriptionId.value}/uploads/`);
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
