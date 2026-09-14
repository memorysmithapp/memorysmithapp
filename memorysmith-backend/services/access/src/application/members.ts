/**
 * Memberships (software-vision.md, section 5.4).
 *
 * Members belong to the SUBSCRIPTION. There is no level between it and the
 * notebook (section 4.3), so a member reaches every notebook of the subscription
 * with the role they hold, down to whatever ceiling each notebook sets on them
 * (RN-ACC-011).
 *
 * Only the OWNER changes roles and removes members (RN-ACC-006). How a person
 * becomes a member of somebody else's subscription is not part of the product
 * yet: the invitation left the API in 0.6.0, and comes back with a screen of its
 * own and a way to find an invitation that does not start from the subscription
 * of whoever accepts it.
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
import type { Subscription } from '../domain/subscription/Subscription.js';
import { Email } from '../domain/values.js';
import type { SubscriptionRepository, UserLinkRepository } from '../domain/ports/index.js';

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
