/**
 * Identifiers. Every one of them is a value object, never a bare string:
 * "no raw string crosses the domain boundary" is what makes PE2 checkable by
 * the compiler instead of by review (architecture-guide.md, sections 6.4, 8.2).
 *
 * SubscriptionId is the one that carries a rule: it can only be built from a
 * JWT claim, and it is perpetual, since no status transition ever rewrites it
 * (RN-SUB-005).
 */

import { DomainError } from './errors.js';
import { err, ok, type Result } from './result.js';
import { isUlid, ulid } from './ulid.js';

abstract class UlidIdentifier {
  protected constructor(readonly value: string) {}

  equals(other: unknown): boolean {
    return other instanceof this.constructor && (other as UlidIdentifier).value === this.value;
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }
}

function parseUlid<T>(
  raw: string,
  label: string,
  build: (value: string) => T,
): Result<T, DomainError> {
  if (typeof raw !== 'string' || !isUlid(raw)) {
    return err(DomainError.validation(`Not a valid ${label}: ${String(raw)}`));
  }
  return ok(build(raw));
}

/**
 * The isolation boundary of the entire system. Only reachable from the
 * subscription_id claim of a verified token (RN-SUB-002); every key builder in
 * every service accepts this type and nothing else.
 */
export class SubscriptionId extends UlidIdentifier {
  private readonly __subscriptionId!: void;

  /**
   * The only public door into the type, and it is named after where the value
   * legitimately comes from. A path, a query string or a body cannot produce
   * one of these without lying about what it is.
   */
  static fromClaim(raw: string): Result<SubscriptionId, DomainError> {
    return parseUlid(raw, 'SubscriptionId', (value) => new SubscriptionId(value));
  }

  /** Minting a brand new subscription during onboarding. */
  static generate(): SubscriptionId {
    return new SubscriptionId(ulid());
  }
}

export class VaultId extends UlidIdentifier {
  private readonly __vaultId!: void;
  static create(raw: string): Result<VaultId, DomainError> {
    return parseUlid(raw, 'VaultId', (value) => new VaultId(value));
  }
  static generate(): VaultId {
    return new VaultId(ulid());
  }
}

export class FolderId extends UlidIdentifier {
  private readonly __folderId!: void;
  static create(raw: string): Result<FolderId, DomainError> {
    return parseUlid(raw, 'FolderId', (value) => new FolderId(value));
  }
  static generate(): FolderId {
    return new FolderId(ulid());
  }
}

export class NoteId extends UlidIdentifier {
  private readonly __noteId!: void;
  static create(raw: string): Result<NoteId, DomainError> {
    return parseUlid(raw, 'NoteId', (value) => new NoteId(value));
  }
  static generate(): NoteId {
    return new NoteId(ulid());
  }
}

/**
 * Addresses a Content Slot. Stored explicitly and never derived from a NoteId:
 * one day the same slot may be pointed at by another Content Role
 * (architecture-guide.md, section 9.2).
 */
export class ContentId extends UlidIdentifier {
  private readonly __contentId!: void;
  static create(raw: string): Result<ContentId, DomainError> {
    return parseUlid(raw, 'ContentId', (value) => new ContentId(value));
  }
  static generate(): ContentId {
    return new ContentId(ulid());
  }
}

/**
 * Global identity: the Cognito `sub`. It belongs to no subscription at all
 * (RN-SUB-011), which is why it is neither a ULID nor scoped by anything.
 */
export class UserId {
  private readonly __userId!: void;
  private constructor(readonly value: string) {}

  static create(raw: string): Result<UserId, DomainError> {
    if (typeof raw !== 'string' || !/^[A-Za-z0-9._:@-]{1,128}$/.test(raw)) {
      return err(DomainError.validation(`Not a valid UserId: ${String(raw)}`));
    }
    return ok(new UserId(raw));
  }

  equals(other: unknown): boolean {
    return other instanceof UserId && other.value === this.value;
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }
}
