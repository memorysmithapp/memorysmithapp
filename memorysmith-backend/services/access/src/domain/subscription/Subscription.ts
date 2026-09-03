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
  Role,
  type SubscriptionId,
  SubscriptionStatus,
  type UserId,
  type DomainEvent,
  type Result,
} from '@memorysmith/kernel';
import { type Email, type RejectionReason, StorageQuota, SubscriptionType } from '../values.js';

/**
 * A member of the subscription. THE OWNER IS NOT ONE. Ownership lives in a
 * single field, which is how "exactly one OWNER" (RN-ACC-001) stops being a
 * rule to check and becomes the shape of the data. A membership is EDITOR or
 * VIEWER, and nothing else.
 */
export interface Membership {
  readonly userId: UserId;
  readonly email: Email;
  readonly role: Role;
  readonly invitedBy: UserId | null;
  readonly joinedAt: Instant;
}

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
    private _ownerId: UserId,
    private _ownerEmail: string,
    private _status: SubscriptionStatus,
    private _type: SubscriptionType,
    private _quota: StorageQuota,
    readonly requestedAt: Instant,
    private _reviewedBy: UserId | null,
    private _reviewedAt: Instant | null,
    private _rejectionReason: RejectionReason | null,
    private _version: number,
    private readonly _members: Map<string, Membership>,
  ) {}

  /**
   * Onboarding: the user asks for a subscription and becomes its OWNER. No
   * operational access is granted yet (RN-SUB-006, RN-SUB-007).
   */
  static request(input: {
    id: SubscriptionId;
    ownerId: UserId;
    ownerEmail: string;
    /** The commercial shape, chosen at the request (RN-SUB-018, RN-SUB-019). */
    type?: SubscriptionType;
    quota?: StorageQuota;
    by: Authorship;
  }): Result<Subscription, DomainError> {
    const type = input.type ?? SubscriptionType.DEFAULT;
    const quota = input.quota ?? StorageQuota.DEFAULT;
    const subscription = new Subscription(
      input.id,
      input.ownerId,
      input.ownerEmail,
      SubscriptionStatus.PENDING_APPROVAL,
      type,
      quota,
      input.by.at,
      null,
      null,
      null,
      0,
      new Map(),
    );
    subscription.record('SubscriptionRequested', input.by, {
      ownerId: input.ownerId.value,
      ownerEmail: input.ownerEmail,
      status: 'pending_approval',
      type: type.name,
      quota: quota.name,
    });
    return ok(subscription);
  }

  static rehydrate(input: {
    id: SubscriptionId;
    ownerId: UserId;
    ownerEmail: string;
    status: SubscriptionStatus;
    type: SubscriptionType;
    quota: StorageQuota;
    requestedAt: Instant;
    reviewedBy: UserId | null;
    reviewedAt: Instant | null;
    rejectionReason: RejectionReason | null;
    version: number;
    members: Membership[];
  }): Subscription {
    return new Subscription(
      input.id,
      input.ownerId,
      input.ownerEmail,
      input.status,
      input.type,
      input.quota,
      input.requestedAt,
      input.reviewedBy,
      input.reviewedAt,
      input.rejectionReason,
      input.version,
      new Map(input.members.map((member) => [member.userId.value, member])),
    );
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
  get type(): SubscriptionType {
    return this._type;
  }
  get quota(): StorageQuota {
    return this._quota;
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
        ownerId: this._ownerId.value,
        ownerEmail: this._ownerEmail,
        status: 'pending_approval',
        type: this._type.name,
        quota: this._quota.name,
      },
    });
    if (!moved.ok) return moved;
    this._rejectionReason = null;
    return ok();
  }

  /**
   * The administrative override (RN-SUB-018): it sets the status to whatever
   * it is given, WITHOUT walking the transition machine.
   *
   * It exists for operating an environment, and it is deliberately a method of
   * its own rather than a flag on `transition`: the ordinary review path keeps
   * its machine intact, and the trail says which of the two happened, because
   * this one records `SubscriptionStatusSet` and nothing else does. Setting
   * `rejected` this way records NO reason, so RN-SUB-009 is not satisfied by
   * it: rejecting a request that a person is waiting on still goes through
   * `reject`.
   */
  setStatus(to: SubscriptionStatus, reviewer: UserId, by: Authorship): Result<void, DomainError> {
    if (this._status.equals(to)) return ok();

    const from = this._status;
    this._status = to;
    this._reviewedBy = reviewer;
    this._reviewedAt = by.at;
    if (!to.equals(SubscriptionStatus.REJECTED)) this._rejectionReason = null;
    this.record('SubscriptionStatusSet', by, {
      from: from.name,
      to: to.name,
      reviewedBy: reviewer.value,
    });
    return ok();
  }

  /**
   * The commercial shape changes, and nothing else does: the quota is declared
   * and not enforced (RN-SUB-019), so this never touches a byte of content and
   * never moves a key.
   */
  changePlan(
    to: { type?: SubscriptionType; quota?: StorageQuota },
    reviewer: UserId,
    by: Authorship,
  ): Result<void, DomainError> {
    const type = to.type ?? this._type;
    const quota = to.quota ?? this._quota;
    if (type.equals(this._type) && quota.equals(this._quota)) return ok();

    const from = { type: this._type.name, quota: this._quota.name };
    this._type = type;
    this._quota = quota;
    this.record('SubscriptionPlanChanged', by, {
      from,
      to: { type: type.name, quota: quota.name },
      reviewedBy: reviewer.value,
    });
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

  // ---- Members (they used to belong to Workspace, section 4.3) ------------

  get members(): Membership[] {
    return [...this._members.values()];
  }

  /** NONE for a stranger and for the owner, whose reach is not a membership. */
  memberRole(user: UserId): Role {
    return this._members.get(user.value)?.role ?? Role.NONE;
  }

  hasMember(user: UserId): boolean {
    return this._members.has(user.value);
  }

  /** Only accepting an invite creates a member (RN-ACC-004). */
  addMember(
    user: UserId,
    email: Email,
    role: Role,
    invitedBy: UserId | null,
    by: Authorship,
  ): Result<void, DomainError> {
    if (!role.equals(Role.EDITOR) && !role.equals(Role.VIEWER)) {
      return err(DomainError.validation('A membership is EDITOR or VIEWER'));
    }
    if (this._members.has(user.value)) {
      return err(DomainError.conflict('That user is already a member of this subscription'));
    }
    // RN-ACC-003: the e-mail is unique among the members of a subscription.
    if (this.members.some((member) => member.email.equals(email))) {
      return err(
        DomainError.conflict('That e-mail already belongs to a member of this subscription'),
      );
    }

    this._members.set(user.value, { userId: user, email, role, invitedBy, joinedAt: by.at });
    this.recordAbout('MemberJoined', 'MEMBER', user.value, by, {
      userId: user.value,
      role: role.name,
    });
    return ok();
  }

  changeMemberRole(user: UserId, role: Role, by: Authorship): Result<void, DomainError> {
    const member = this._members.get(user.value);
    if (!member) return err(DomainError.notFound('That user is not a member of this subscription'));
    if (!role.equals(Role.EDITOR) && !role.equals(Role.VIEWER)) {
      return err(DomainError.validation('A membership is EDITOR or VIEWER'));
    }
    if (member.role.equals(role)) return ok();

    const from = member.role;
    this._members.set(user.value, { ...member, role });
    this.recordAbout('MemberRoleChanged', 'MEMBER', user.value, by, {
      userId: user.value,
      from: from.name,
      to: role.name,
    });
    return ok();
  }

  /**
   * Removing a member revokes access and preserves everything they wrote,
   * including the recorded authorship (RN-ACC-009). Nothing about their past
   * writes is touched here, because authorship lives on the events.
   */
  removeMember(user: UserId, by: Authorship): Result<void, DomainError> {
    if (!this._members.delete(user.value)) {
      return err(DomainError.notFound('That user is not a member of this subscription'));
    }
    this.recordAbout('MemberRemoved', 'MEMBER', user.value, by, { userId: user.value });
    return ok();
  }

  /** An event ABOUT something inside the subscription, not about it. */
  private recordAbout(
    type: Parameters<typeof createEvent>[0]['type'],
    subject: Parameters<typeof createEvent>[0]['subject'],
    subjectId: string,
    by: Authorship,
    payload: Record<string, unknown>,
  ): void {
    this.events.push(
      createEvent({
        type,
        subscriptionId: this.id,
        subject,
        subjectId,
        authorship: by,
        payload,
      }),
    );
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
