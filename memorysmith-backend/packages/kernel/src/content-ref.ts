/**
 * ContentRef: the pointer that links DynamoDB to S3, and the only such link in
 * the whole system (architecture-guide.md, section 9.2).
 *
 * It carries a ContentId, not a path. An S3 key is a concept shaped like S3,
 * and holding one inside a domain value object would scratch PE1 without the
 * CI dependency rule complaining, because a string imports nothing. Building
 * s/{subscriptionId}/c/{contentId}.md is the exclusive job of the adapter.
 */

import { DomainError } from './errors.js';
import { ContentId } from './ids.js';
import { err, ok, type Result } from './result.js';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export class ContentRef {
  private readonly __contentRef!: void;
  private constructor(
    /** Which slot. */
    readonly contentId: ContentId,
    /** Which revision of it: this is what turns "points at the content" into
     * "points at the content OF THAT INSTANT", the basis of read_note(asOf). */
    readonly versionId: string,
    /** Integrity, and the "did it actually change" check of RN-KNW-028. */
    readonly sha256: string,
    /** Size, for the UI and the limits, without a HEAD request. */
    readonly bytes: number,
  ) {}

  static create(input: {
    contentId: ContentId;
    versionId: string;
    sha256: string;
    bytes: number;
  }): Result<ContentRef, DomainError> {
    if (typeof input.versionId !== 'string' || input.versionId.length === 0) {
      return err(DomainError.validation('A ContentRef requires a version identifier'));
    }
    if (typeof input.sha256 !== 'string' || !SHA256_PATTERN.test(input.sha256)) {
      return err(DomainError.validation('A ContentRef requires a lowercase hex sha256'));
    }
    if (!Number.isInteger(input.bytes) || input.bytes < 0) {
      return err(DomainError.validation('A ContentRef requires a non-negative byte count'));
    }
    return ok(new ContentRef(input.contentId, input.versionId, input.sha256, input.bytes));
  }

  /** Rehydration from a stored item; the shape was validated when it was written. */
  static fromJSON(raw: unknown): Result<ContentRef, DomainError> {
    if (typeof raw !== 'object' || raw === null) {
      return err(DomainError.validation('Not a serialized ContentRef'));
    }
    const record = raw as Record<string, unknown>;
    const contentId = ContentId.create(String(record['contentId']));
    if (!contentId.ok) return contentId;
    return ContentRef.create({
      contentId: contentId.value,
      versionId: String(record['versionId']),
      sha256: String(record['sha256']),
      bytes: Number(record['bytes']),
    });
  }

  /** Same slot, same bytes: no new revision, no event, no re-indexing. */
  hasSameContentAs(other: ContentRef): boolean {
    return this.sha256 === other.sha256;
  }

  pointsAtSameSlotAs(other: ContentRef): boolean {
    return this.contentId.equals(other.contentId);
  }

  equals(other: unknown): boolean {
    return (
      other instanceof ContentRef &&
      other.contentId.equals(this.contentId) &&
      other.versionId === this.versionId
    );
  }

  toJSON(): { contentId: string; versionId: string; sha256: string; bytes: number } {
    return {
      contentId: this.contentId.value,
      versionId: this.versionId,
      sha256: this.sha256,
      bytes: this.bytes,
    };
  }
}

/**
 * The meaning attached to a slot. A note, a guidance and a template are the
 * SAME kind of thing; what differs is who points at it and with which role
 * (software-vision.md, section 8.1).
 */
export type ContentRole = 'body' | 'guidance' | 'template';
