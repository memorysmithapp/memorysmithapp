/**
 * Subscription: Aggregate Root of the Access context, and the object that
 * carries two roles at once - the business entity (who pays, in which state)
 * and the isolation boundary of every piece of data in the system.
 *
 * That is only safe under one rule, and the rule is enforced here by shape
 * rather than by discipline:
 *
 *   THE SubscriptionId IS PERPETUAL (RN-SUB-005). It is `readonly`, no method
 *   touches it, and no status transition moves, re-keys or deletes anything.
 *   Status governs ACCESS, never ADDRESS.
 *
 * Exactly one OWNER exists at any instant (RN-ACC-001), and that is a property
 * of the shape too: ownership is a single field, not a collection.
 */

import {
  type Authorship,
  createEvent,
  DomainError,
  err,
  type Instant,
  ok,
  Slug,
  type SubscriptionId,
  SubscriptionStatus,
  type UserId,
  type DomainEvent,
  type Result,
} from '@memorysmith/kernel';
import { type RejectionReason, type SubscriptionName } from '../values.js';

/** The transition machine of software-vision.md, section 4.4. */
const TRANSITIONS: Record<string, readonly string[]> = {
  pending_approval: ['trial', 'active', 'rejected'],
  trial: ['active', 'suspended', 'canceled'],
  active: ['trial', 'suspended', 'canceled'],
  rejected: ['pending_approval'],
  suspended: ['active', 'trial', 'canceled'],
  canceled: ['active', 'trial'],
};

export class Subscription {
  private readonly events: DomainEvent[] = [];

  private constructor(
    /** Emitted once, never reissued, immutable across every transition. */
    readonly id: SubscriptionId,
    private _name: SubscriptionName,
    private _slug: Slug,
    private _ownerId: UserId,
    private _ownerEmail: string,
    private _status: SubscriptionStatus,
    readonly requestedAt: Instant,
    private _reviewedBy: UserId | null,
    private _reviewedAt: Instant | null,
    private _rejectionReason: RejectionReason | null,
    private _legalHold: boolean,
    private _version: number,
  ) {}

  /**
   * Onboarding: the user asks for a subscription and becomes its OWNER. No
   * operational access is granted yet (RN-SUB-006, RN-SUB-007).
   */
  static request(input: {
    id: SubscriptionId;
    name: SubscriptionName;
    ownerId: UserId;
    ownerEmail: string;
    by: Authorship;
  }): Result<Subscription, DomainError> {
    const slug = Slug.from(input.name.value);
    if (!slug.ok) return slug;

    const subscription = new Subscription(
      input.id,
      input.name,
      slug.value,
      input.ownerId,
      input.ownerEmail,
      SubscriptionStatus.PENDING_APPROVAL,
      input.by.at,
      null,
      null,
      null,
      false,
      0,
    );
    subscription.record('SubscriptionRequested', input.by, {
      name: input.name.value,
      slug: slug.value.value,
      ownerId: input.ownerId.value,
      ownerEmail: input.ownerEmail,
      status: 'pending_approval',
    });
    return ok(subscription);
  }

  static rehydrate(input: {
    id: SubscriptionId;
    name: SubscriptionName;
    slug: Slug;
    ownerId: UserId;
    ownerEmail: string;
    status: SubscriptionStatus;
    requestedAt: Instant;
    reviewedBy: UserId | null;
    reviewedAt: Instant | null;
    rejectionReason: RejectionReason | null;
    legalHold: boolean;
    version: number;
  }): Subscription {
    return new Subscription(
      input.id,
      input.name,
      input.slug,
      input.ownerId,
      input.ownerEmail,
      input.status,
      input.requestedAt,
      input.reviewedBy,
      input.reviewedAt,
      input.rejectionReason,
      input.legalHold,
      input.version,
    );
  }

  get name(): SubscriptionName {
    return this._name;
  }
  get slug(): Slug {
    return this._slug;
  }
  get ownerId(): UserId {
    return this._ownerId;
  }
  get ownerEmail(): string {
    return this._ownerEmail;
  }
  get status(): SubscriptionStatus {
    return this._status;
  }
  get reviewedBy(): UserId | null {
    return this._reviewedBy;
  }
  get reviewedAt(): Instant | null {
    return this._reviewedAt;
  }
  get rejectionReason(): RejectionReason | null {
    return this._rejectionReason;
  }
  get legalHold(): boolean {
    return this._legalHold;
  }
  get version(): number {
    return this._version;
  }

  markPersisted(): void {
    this._version += 1;
  }

  isOwner(user: UserId): boolean {
    return this._ownerId.equals(user);
  }

  /** RN-SUB-007: only trial and active grant operational access, to anyone. */
  get grantsOperationalAccess(): boolean {
    return this._status.grantsOperationalAccess;
  }

  /** Approving sets trial or active, at the platform admin's discretion. */
  approve(to: SubscriptionStatus, reviewer: UserId, by: Authorship): Result<void, DomainError> {
    if (!to.equals(SubscriptionStatus.TRIAL) && !to.equals(SubscriptionStatus.ACTIVE)) {
      return err(DomainError.validation('Approving sets the status to trial or active'));
    }
    return this.transition(to, by, { reviewer, event: 'SubscriptionApproved' });
  }

  /** Rejection requires a reason, which is communicated (RN-SUB-009). */
  reject(reason: RejectionReason, reviewer: UserId, by: Authorship): Result<void, DomainError> {
    const moved = this.transition(SubscriptionStatus.REJECTED, by, {
      reviewer,
      reason,
      event: 'SubscriptionRejected',
    });
    if (!moved.ok) return moved;
    this._rejectionReason = reason;
    return ok();
  }

  suspend(reviewer: UserId, by: Authorship): Result<void, DomainError> {
    return this.transition(SubscriptionStatus.SUSPENDED, by, {
      reviewer,
      event: 'SubscriptionSuspended',
    });
  }

  reactivate(to: SubscriptionStatus, reviewer: UserId, by: Authorship): Result<void, DomainError> {
    if (!to.grantsOperationalAccess) {
      return err(DomainError.validation('Reactivating sets the status to trial or active'));
    }
    return this.transition(to, by, { reviewer, event: 'SubscriptionReactivated' });
  }

  /**
   * Cancelling changes a field. It does not move, re-key or delete a single
   * byte, which is what makes reactivation a field change rather than an
   * import (RN-SUB-005).
   */
  cancel(by: Authorship): Result<void, DomainError> {
    return this.transition(SubscriptionStatus.CANCELED, by, { event: 'SubscriptionCanceled' });
  }

  /**
   * A rejected requester may ask again (RN-SUB-009), and it is the SAME
   * subscription: the identifier is perpetual, so asking again is a status
   * change and never a new record.
   */
  requestAgain(by: Authorship): Result<void, DomainError> {
    const moved = this.transition(SubscriptionStatus.PENDING_APPROVAL, by, {
      event: 'SubscriptionRequested',
      // The payload of a request carries the identity of the subscription, not
      // a status pair, because that is what its consumers expect.
      payload: {
        name: this._name.value,
        slug: this._slug.value,
        ownerId: this._ownerId.value,
        ownerEmail: this._ownerEmail,
        status: 'pending_approval',
      },
    });
    if (!moved.ok) return moved;
    this._rejectionReason = null;
    return ok();
  }

  /**
   * Atomic by construction: the new owner becomes OWNER and the previous one
   * becomes EDITOR in the same operation, so the subscription is never without
   * a holder (RN-ACC-002). The membership side is applied by the use case, on
   * the workspace aggregates.
   */
  transferOwnership(to: UserId, by: Authorship): Result<UserId, DomainError> {
    if (this._ownerId.equals(to)) {
      return err(DomainError.validation('That user already holds this subscription'));
    }
    const previous = this._ownerId;
    this._ownerId = to;
    this.record('OwnershipTransferred', by, {
      fromUserId: previous.value,
      toUserId: to.value,
    });
    return ok(previous);
  }

  /** Legal hold and erasure are incompatible by design (RN-AUD-009). */
  setLegalHold(enabled: boolean): void {
    this._legalHold = enabled;
  }

  get hasChanges(): boolean {
    return this.events.length > 0;
  }

  pullEvents(): DomainEvent[] {
    return this.events.splice(0, this.events.length);
  }

  private transition(
    to: SubscriptionStatus,
    by: Authorship,
    options: {
      reviewer?: UserId;
      reason?: RejectionReason;
      event: Parameters<typeof createEvent>[0]['type'];
      payload?: Record<string, unknown>;
    },
  ): Result<void, DomainError> {
    const allowed = TRANSITIONS[this._status.name] ?? [];
    if (!allowed.includes(to.name)) {
      return err(
        DomainError.conflict(`A subscription in ${this._status.name} cannot move to ${to.name}`, {
          from: this._status.name,
          to: to.name,
        }),
      );
    }
    const from = this._status;
    this._status = to;
    if (options.reviewer) {
      this._reviewedBy = options.reviewer;
      this._reviewedAt = by.at;
    }
    this.record(
      options.event,
      by,
      options.payload ?? {
        from: from.name,
        to: to.name,
        ...(options.reviewer ? { reviewedBy: options.reviewer.value } : {}),
        ...(options.reason ? { reason: options.reason.value } : {}),
      },
    );
    return ok();
  }

  private record(
    type: Parameters<typeof createEvent>[0]['type'],
    by: Authorship,
    payload: Record<string, unknown>,
  ): void {
    this.events.push(
      createEvent({
        type,
        subscriptionId: this.id,
        subject: 'SUBSCRIPTION',
        subjectId: this.id.value,
        authorship: by,
        payload,
      }),
    );
  }
}
