/**
 * Invites and memberships (software-vision.md, section 5.4).
 *
 * Members belong to the SUBSCRIPTION. There is no level between it and the
 * vault (section 4.3), so a member reaches every vault of the subscription
 * with the role they hold, down to whatever ceiling each vault sets on them
 * (RN-ACC-011).
 *
 * Only the OWNER invites, changes roles and removes members (RN-ACC-006). An
 * EDITOR does not invite.
 */

import {
  type Authorship,
  DomainError,
  err,
  Instant,
  ok,
  Role,
  type Result,
  type SubscriptionContext,
  type UserId,
} from '@memorysmith/kernel';
import { Invite } from '../domain/invite/Invite.js';
import type { Subscription } from '../domain/subscription/Subscription.js';
import { Email, InviteToken } from '../domain/values.js';
import type {
  InviteRepository,
  SubscriptionLink,
  SubscriptionRepository,
  UserLinkRepository,
  UserProfile,
} from '../domain/ports/index.js';

/**
 * Loads the subscription and confirms the caller holds it, in one step, so no
 * caller reads it twice for the same question.
 */
async function requireOwner(
  subscriptions: SubscriptionRepository,
  user: UserId,
): Promise<Result<Subscription, DomainError>> {
  const subscription = await subscriptions.find();
  if (!subscription) return err(DomainError.notFound('Subscription not found'));
  if (!subscription.grantsOperationalAccess) {
    return err(DomainError.forbiddenVisible(`This subscription is ${subscription.status.name}`));
  }
  if (!subscription.isOwner(user)) {
    // The caller can see the subscription they belong to, so this is a real
    // 403 rather than the 404 that protects existence.
    return err(DomainError.forbiddenVisible('Only the subscription owner can do this'));
  }
  return ok(subscription);
}

export class ListMembers {
  constructor(private readonly subscriptions: SubscriptionRepository) {}

  async execute(input: {
    context: SubscriptionContext;
  }): Promise<Result<Subscription['members'], DomainError>> {
    const subscription = await this.subscriptions.find();
    if (!subscription) return err(DomainError.notFound('Subscription not found'));
    void input;
    return ok(subscription.members);
  }
}

export class InviteMember {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly invites: InviteRepository,
  ) {}

  async execute(input: {
    context: SubscriptionContext;
    email: string;
    role: string;
    by: Authorship;
  }): Promise<Result<{ token: InviteToken }, DomainError>> {
    // RN-ACC-008: an invite can only be issued by a trial or active
    // subscription, which requireOwner already checks.
    const owned = await requireOwner(this.subscriptions, input.context.userId);
    if (!owned.ok) return owned;

    const email = Email.create(input.email);
    if (!email.ok) return email;
    const role = Role.membership(input.role);
    if (!role.ok) return role;

    // RN-ACC-003: the e-mail is unique among the members of a subscription.
    if (owned.value.members.some((member) => member.email.equals(email.value))) {
      return err(DomainError.conflict('That e-mail already belongs to a member'));
    }

    const invite = Invite.issue({
      subscriptionId: input.context.subscriptionId,
      email: email.value,
      role: role.value,
      by: input.by,
    });
    if (!invite.ok) return invite;

    const saved = await this.invites.save(invite.value);
    return saved.ok ? ok({ token: invite.value.token }) : err(saved.error);
  }
}

/**
 * Accepting an invite does NOT create a subscription for the invitee and they
 * pay nothing: they start acting inside the subscription of whoever invited
 * them (RN-SUB-017).
 */
export class AcceptInvite {
  constructor(
    private readonly invites: InviteRepository,
    private readonly subscriptions: SubscriptionRepository,
    private readonly links: UserLinkRepository,
  ) {}

  async execute(input: {
    profile: UserProfile;
    token: string;
    by: Authorship;
  }): Promise<Result<{ subscriptionId: string; role: string }, DomainError>> {
    const token = InviteToken.create(input.token);
    if (!token.ok) return err(DomainError.notFound('Invite not found'));

    const invite = await this.invites.findByToken(token.value);
    if (!invite) return err(DomainError.notFound('Invite not found'));

    const accepted = invite.accept(input.profile.userId, input.profile.email, input.by.at);
    if (!accepted.ok) return accepted;

    const subscription = await this.subscriptions.find();
    if (!subscription) return err(DomainError.notFound('Subscription not found'));

    const added = subscription.addMember(
      input.profile.userId,
      input.profile.email,
      invite.role,
      invite.invitedBy,
      input.by,
    );
    if (!added.ok) return added;

    const savedSubscription = await this.subscriptions.save(subscription);
    if (!savedSubscription.ok) return err(savedSubscription.error);
    const savedInvite = await this.invites.save(invite);
    if (!savedInvite.ok) return err(savedInvite.error);

    const link: SubscriptionLink = {
      userId: input.profile.userId,
      subscriptionId: invite.subscriptionId,
      isOwner: false,
      isDefault: (await this.links.linksOf(input.profile.userId)).length === 0,
      joinedAt: input.by.at.toISOString(),
    };
    await this.links.link(link);

    return ok({ subscriptionId: subscription.id.value, role: invite.role.name });
  }
}

export class ChangeMemberRole {
  constructor(private readonly subscriptions: SubscriptionRepository) {}

  async execute(input: {
    context: SubscriptionContext;
    userId: UserId;
    role: string;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const owned = await requireOwner(this.subscriptions, input.context.userId);
    if (!owned.ok) return owned;

    const role = Role.membership(input.role);
    if (!role.ok) return role;

    const changed = owned.value.changeMemberRole(input.userId, role.value, input.by);
    if (!changed.ok) return changed;

    const saved = await this.subscriptions.save(owned.value);
    return saved.ok ? ok() : err(saved.error);
  }
}

export class RemoveMember {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly links: UserLinkRepository,
  ) {}

  async execute(input: {
    context: SubscriptionContext;
    userId: UserId;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const owned = await requireOwner(this.subscriptions, input.context.userId);
    if (!owned.ok) return owned;

    // RN-ACC-001: removing the OWNER is refused; the only way out is a
    // transfer of ownership.
    if (owned.value.isOwner(input.userId)) {
      return err(
        DomainError.conflict('The subscription owner cannot be removed; transfer ownership first'),
      );
    }

    const removed = owned.value.removeMember(input.userId, input.by);
    if (!removed.ok) return removed;

    const saved = await this.subscriptions.save(owned.value);
    if (!saved.ok) return err(saved.error);

    // No membership left means no reason to reach this subscription at all.
    await this.links.unlink(input.userId, input.context.subscriptionId);
    return ok();
  }
}

/**
 * Ownership transfer is atomic by construction: the new holder becomes OWNER
 * and the previous one becomes EDITOR in the same operation, so the
 * subscription is never without a holder (RN-ACC-002).
 *
 * Both halves now live on the SAME aggregate, so "atomic" stopped being a
 * promise the use case keeps by ordering two writes and became a single save.
 */
export class TransferOwnership {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly links: UserLinkRepository,
  ) {}

  async execute(input: {
    context: SubscriptionContext;
    toUserId: UserId;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const owned = await requireOwner(this.subscriptions, input.context.userId);
    if (!owned.ok) return owned;
    const subscription = owned.value;

    if (!subscription.hasMember(input.toUserId)) {
      return err(DomainError.validation('The new holder must already be a member'));
    }

    const previousEmail = Email.create(subscription.ownerEmail);
    const previous = subscription.transferOwnership(input.toUserId, input.by);
    if (!previous.ok) return previous;

    // The new holder stops being a member: ownership is not a membership.
    subscription.removeMember(input.toUserId, input.by);
    if (previousEmail.ok) {
      subscription.addMember(previous.value, previousEmail.value, Role.EDITOR, null, input.by);
    }

    const saved = await this.subscriptions.save(subscription);
    if (!saved.ok) return err(saved.error);

    await this.links.link({
      userId: input.toUserId,
      subscriptionId: input.context.subscriptionId,
      isOwner: true,
      isDefault: true,
      joinedAt: Instant.now().toISOString(),
    });
    await this.links.link({
      userId: previous.value,
      subscriptionId: input.context.subscriptionId,
      isOwner: false,
      isDefault: true,
      joinedAt: Instant.now().toISOString(),
    });
    return ok();
  }
}
