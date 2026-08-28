/**
 * SubscriptionStatus: the state of the subscription as a business object.
 *
 * It governs ACCESS, never ADDRESS (RN-SUB-005, architecture-guide.md 8.1).
 * No persistence code may read it to build a key; that is why the type lives
 * in the kernel with no key-building capability whatsoever.
 *
 * The transition machine itself belongs to the Subscription aggregate in the
 * Access context; what lives here is the value and the one question the
 * authorizer asks of it.
 */

import { DomainError } from './errors.js';
import { err, ok, type Result } from './result.js';

export const SUBSCRIPTION_STATUSES = [
  'pending_approval',
  'trial',
  'active',
  'rejected',
  'suspended',
  'canceled',
] as const;

export type SubscriptionStatusName = (typeof SUBSCRIPTION_STATUSES)[number];

/** The two statuses that grant operational access, and only these (RN-SUB-007). */
const OPERATIONAL: ReadonlySet<SubscriptionStatusName> = new Set(['trial', 'active']);

export class SubscriptionStatus {
  private readonly __subscriptionStatus!: void;
  private constructor(readonly name: SubscriptionStatusName) {}

  static readonly PENDING_APPROVAL = new SubscriptionStatus('pending_approval');
  static readonly TRIAL = new SubscriptionStatus('trial');
  static readonly ACTIVE = new SubscriptionStatus('active');
  static readonly REJECTED = new SubscriptionStatus('rejected');
  static readonly SUSPENDED = new SubscriptionStatus('suspended');
  static readonly CANCELED = new SubscriptionStatus('canceled');

  static create(raw: string): Result<SubscriptionStatus, DomainError> {
    const match = SUBSCRIPTION_STATUSES.find((status) => status === raw);
    if (!match) {
      return err(DomainError.validation(`Not a valid subscription status: ${String(raw)}`));
    }
    return ok(new SubscriptionStatus(match));
  }

  get grantsOperationalAccess(): boolean {
    return OPERATIONAL.has(this.name);
  }

  equals(other: unknown): boolean {
    return other instanceof SubscriptionStatus && other.name === this.name;
  }

  toString(): string {
    return this.name;
  }

  toJSON(): string {
    return this.name;
  }
}
