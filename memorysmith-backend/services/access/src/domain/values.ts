/**
 * Value objects of the Access context.
 */

import { DomainError, err, ok, type Result } from '@memorysmith/kernel';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function bounded(
  raw: string,
  min: number,
  max: number,
  label: string,
): Result<string, DomainError> {
  if (typeof raw !== 'string') return err(DomainError.validation(`${label} must be text`));
  const trimmed = raw.trim();
  if (trimmed.length < min || trimmed.length > max) {
    return err(DomainError.validation(`${label} must have ${min} to ${max} characters`));
  }
  return ok(trimmed);
}

export class SubscriptionName {
  private readonly __subscriptionName!: void;
  private constructor(readonly value: string) {}

  static create(raw: string): Result<SubscriptionName, DomainError> {
    const bounds = bounded(raw, 1, 120, 'The subscription name');
    return bounds.ok ? ok(new SubscriptionName(bounds.value)) : bounds;
  }

  toString(): string {
    return this.value;
  }
}

/** Mandatory on rejection, and communicated to the requester (RN-SUB-009). */
export class RejectionReason {
  private readonly __rejectionReason!: void;
  private constructor(readonly value: string) {}

  static create(raw: string): Result<RejectionReason, DomainError> {
    const bounds = bounded(raw, 1, 1000, 'The rejection reason');
    if (!bounds.ok) {
      return err(DomainError.validation('Rejecting a subscription requires a reason'));
    }
    return ok(new RejectionReason(bounds.value));
  }

  toString(): string {
    return this.value;
  }
}

/** Normalized to lowercase, because uniqueness is checked on the value. */
export class Email {
  private readonly __email!: void;
  private constructor(readonly value: string) {}

  static create(raw: string): Result<Email, DomainError> {
    if (typeof raw !== 'string' || !EMAIL_PATTERN.test(raw.trim())) {
      return err(DomainError.validation(`Not a valid e-mail address: ${String(raw)}`));
    }
    return ok(new Email(raw.trim().toLowerCase()));
  }

  equals(other: unknown): boolean {
    return other instanceof Email && other.value === this.value;
  }

  toString(): string {
    return this.value;
  }
}

/** Single use, bound to the e-mail it was sent to, valid for 7 days. */
export class InviteToken {
  private readonly __inviteToken!: void;
  private constructor(readonly value: string) {}

  static generate(): InviteToken {
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    return new InviteToken(
      Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(''),
    );
  }

  static create(raw: string): Result<InviteToken, DomainError> {
    if (typeof raw !== 'string' || !/^[a-f0-9]{64}$/.test(raw)) {
      return err(DomainError.validation('Not a valid invite token'));
    }
    return ok(new InviteToken(raw));
  }

  toString(): string {
    return this.value;
  }
}

export const ACCESS_LIMITS = {
  /** RN-ACC-005: the invite expires in seven days. */
  inviteValidityDays: 7,
  /** RN-ACC-016: role changes take up to five minutes to propagate. */
  authorizerCacheSeconds: 300,
} as const;
