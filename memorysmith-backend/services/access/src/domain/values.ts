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

/**
 * SubscriptionType: what the subscription IS, commercially (RN-SUB-018).
 *
 * One value exists today. It is a value object and not a boolean or a loose
 * string so that adding the next one is a change in one place, and so that no
 * caller can invent a type the product does not sell.
 */
export const SUBSCRIPTION_TYPES = ['individual'] as const;

export type SubscriptionTypeName = (typeof SUBSCRIPTION_TYPES)[number];

export class SubscriptionType {
  private readonly __subscriptionType!: void;
  private constructor(readonly name: SubscriptionTypeName) {}

  static readonly INDIVIDUAL = new SubscriptionType('individual');

  /** What a subscription gets when nobody says otherwise. */
  static readonly DEFAULT = SubscriptionType.INDIVIDUAL;

  static create(raw: string): Result<SubscriptionType, DomainError> {
    const match = SUBSCRIPTION_TYPES.find((type) => type === raw);
    if (!match) {
      return err(DomainError.validation(`Not a valid subscription type: ${String(raw)}`));
    }
    return ok(new SubscriptionType(match));
  }

  equals(other: unknown): boolean {
    return other instanceof SubscriptionType && other.name === this.name;
  }

  toString(): string {
    return this.name;
  }

  toJSON(): string {
    return this.name;
  }
}

/**
 * StorageQuota: how much the subscription may store (RN-SUB-019).
 *
 * DECLARED, NOT ENFORCED. Nothing refuses a write for exceeding it yet, and
 * the value object says so out loud: it exposes `bytes` for whoever will
 * enforce it later, and no adapter reads it today. Keeping it a closed set of
 * named sizes, rather than a number, is what makes the plans comparable and
 * keeps a stray byte count out of the domain.
 */
export const STORAGE_QUOTAS = ['500MB', '1GB', '2GB'] as const;

export type StorageQuotaName = (typeof STORAGE_QUOTAS)[number];

const QUOTA_BYTES: Record<StorageQuotaName, number> = {
  '500MB': 500 * 1024 * 1024,
  '1GB': 1024 * 1024 * 1024,
  '2GB': 2 * 1024 * 1024 * 1024,
};

export class StorageQuota {
  private readonly __storageQuota!: void;
  private constructor(readonly name: StorageQuotaName) {}

  static readonly HALF_GIGABYTE = new StorageQuota('500MB');
  static readonly ONE_GIGABYTE = new StorageQuota('1GB');
  static readonly TWO_GIGABYTES = new StorageQuota('2GB');

  /** What a subscription gets when nobody says otherwise. */
  static readonly DEFAULT = StorageQuota.ONE_GIGABYTE;

  static create(raw: string): Result<StorageQuota, DomainError> {
    const match = STORAGE_QUOTAS.find((quota) => quota === raw);
    if (!match) {
      return err(DomainError.validation(`Not a valid storage quota: ${String(raw)}`));
    }
    return ok(new StorageQuota(match));
  }

  get bytes(): number {
    return QUOTA_BYTES[this.name];
  }

  equals(other: unknown): boolean {
    return other instanceof StorageQuota && other.name === this.name;
  }

  toString(): string {
    return this.name;
  }

  toJSON(): string {
    return this.name;
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
