/**
 * Invite: single use, bound to the e-mail it was sent to, valid for seven days
 * (RN-ACC-005). A pending invite grants no access at all; only the aceite
 * creates a member (RN-ACC-004).
 *
 * The stored item carries a TTL equal to its expiry, so an expired invite
 * disappears on its own: no cleanup job, and no date check scattered across
 * every read (architecture-guide.md, section 9.4).
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
  ulid,
  type UserId,
  type DomainEvent,
  type Result,
} from '@memorysmith/kernel';
import { ACCESS_LIMITS, type Email, InviteToken } from '../values.js';

export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export class Invite {
  private readonly events: DomainEvent[] = [];

  private constructor(
    readonly id: string,
    readonly subscriptionId: SubscriptionId,
    readonly email: Email,
    readonly role: Role,
    readonly invitedBy: UserId,
    readonly token: InviteToken,
    private _status: InviteStatus,
    readonly sentAt: Instant,
    readonly expiresAt: Instant,
    private _acceptedAt: Instant | null,
  ) {}

  static issue(input: {
    subscriptionId: SubscriptionId;
    email: Email;
    role: Role;
    by: Authorship;
  }): Result<Invite, DomainError> {
    if (!input.role.equals(Role.EDITOR) && !input.role.equals(Role.VIEWER)) {
      return err(DomainError.validation('An invite grants EDITOR or VIEWER'));
    }
    const invite = new Invite(
      ulid(),
      input.subscriptionId,
      input.email,
      input.role,
      input.by.user,
      InviteToken.generate(),
      'pending',
      input.by.at,
      input.by.at.plusDays(ACCESS_LIMITS.inviteValidityDays),
      null,
    );
    invite.record('MemberInvited', input.by, {
      inviteeEmail: input.email.value,
      role: input.role.name,
      expiresAt: invite.expiresAt.toISOString(),
    });
    return ok(invite);
  }

  static rehydrate(input: {
    id: string;
    subscriptionId: SubscriptionId;
    email: Email;
    role: Role;
    invitedBy: UserId;
    token: InviteToken;
    status: InviteStatus;
    sentAt: Instant;
    expiresAt: Instant;
    acceptedAt: Instant | null;
  }): Invite {
    return new Invite(
      input.id,
      input.subscriptionId,
      input.email,
      input.role,
      input.invitedBy,
      input.token,
      input.status,
      input.sentAt,
      input.expiresAt,
      input.acceptedAt,
    );
  }

  get status(): InviteStatus {
    return this._status;
  }

  get acceptedAt(): Instant | null {
    return this._acceptedAt;
  }

  isExpiredAt(now: Instant): boolean {
    return now.isAfter(this.expiresAt);
  }

  /**
   * Accepting does NOT create a subscription for the invitee: they start
   * acting inside the subscription of whoever invited them (RN-SUB-017).
   */
  accept(user: UserId, email: Email, at: Instant): Result<void, DomainError> {
    if (this._status !== 'pending') {
      return err(DomainError.conflict(`This invite is ${this._status}`));
    }
    if (this.isExpiredAt(at)) {
      this._status = 'expired';
      return err(DomainError.conflict('This invite has expired'));
    }
    // Bound to the e-mail it was sent to: a forwarded link does not work.
    if (!this.email.equals(email)) {
      return err(DomainError.forbidden('This invite was issued for another e-mail address'));
    }
    void user;
    this._status = 'accepted';
    this._acceptedAt = at;
    return ok();
  }

  revoke(): Result<void, DomainError> {
    if (this._status !== 'pending') {
      return err(DomainError.conflict(`This invite is ${this._status}`));
    }
    this._status = 'revoked';
    return ok();
  }

  pullEvents(): DomainEvent[] {
    return this.events.splice(0, this.events.length);
  }

  private record(
    type: Parameters<typeof createEvent>[0]['type'],
    by: Authorship,
    payload: Record<string, unknown>,
  ): void {
    this.events.push(
      createEvent({
        type,
        subscriptionId: this.subscriptionId,
        subject: 'MEMBER',
        subjectId: this.email.value,
        authorship: by,
        payload,
      }),
    );
  }
}
