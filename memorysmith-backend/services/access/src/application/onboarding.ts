/**
 * Onboarding and the session (software-vision.md, sections 4.4 and 4.5).
 *
 * Signup creates only the user account. Asking for a subscription is a
 * separate, explicit act, and it grants no operational access until a platform
 * admin approves it (RN-SUB-006, RN-SUB-007).
 */

import {
  type Authorship,
  DomainError,
  err,
  ok,
  Role,
  SubscriptionId,
  type Result,
  type SubscriptionContext,
  type UserId,
} from '@memorysmith/kernel';
import { Subscription } from '../domain/subscription/Subscription.js';
import { SubscriptionName } from '../domain/values.js';
import type {
  SubscriptionOnboarding,
  SubscriptionRepository,
  UserLinkRepository,
  UserProfile,
} from '../domain/ports/index.js';

export class RequestSubscription {
  constructor(
    private readonly onboarding: SubscriptionOnboarding,
    private readonly links: UserLinkRepository,
  ) {}

  async execute(input: {
    profile: UserProfile;
    name: string;
    by: Authorship;
  }): Promise<Result<{ subscriptionId: SubscriptionId }, DomainError>> {
    const existing = await this.onboarding.ownedBy(input.profile.userId);
    if (existing) {
      return err(
        DomainError.conflict('This user already holds a subscription', {
          subscriptionId: existing.value,
        }),
      );
    }

    const name = SubscriptionName.create(input.name);
    if (!name.ok) return name;

    const subscription = Subscription.request({
      id: SubscriptionId.generate(),
      name: name.value,
      ownerId: input.profile.userId,
      ownerEmail: input.profile.email.value,
      by: input.by,
    });
    if (!subscription.ok) return subscription;

    const written = await this.onboarding.create({
      subscription: subscription.value,
      link: {
        userId: input.profile.userId,
        subscriptionId: subscription.value.id,
        isOwner: true,
        isDefault: true,
        joinedAt: input.by.at.toISOString(),
      },
    });
    if (!written.ok) return err(written.error);

    return ok({ subscriptionId: subscription.value.id });
  }
}

/** What the SPA needs to render its shell, in one call. */
export interface SessionView {
  readonly user: UserProfile;
  readonly links: Array<{
    subscriptionId: string;
    name: string;
    slug: string;
    status: string;
    isOwner: boolean;
    isDefault: boolean;
    joinedAt: string;
  }>;
  /** The role in the ACTIVE subscription; NONE when there is none. */
  readonly role: string;
}

export class GetSession {
  constructor(
    private readonly links: UserLinkRepository,
    private readonly subscriptions: SubscriptionRepository | null,
    /** Reads the metadata of a link; the only cross-subscription read there is. */
    private readonly describeLink: (id: SubscriptionId) => Promise<{
      name: string;
      slug: string;
      status: string;
    } | null>,
  ) {}

  async execute(input: {
    profile: UserProfile;
    context: SubscriptionContext | null;
  }): Promise<Result<SessionView, DomainError>> {
    const links = await this.links.linksOf(input.profile.userId);
    const described = [];
    for (const link of links) {
      const metadata = await this.describeLink(link.subscriptionId);
      if (!metadata) continue;
      described.push({
        subscriptionId: link.subscriptionId.value,
        name: metadata.name,
        slug: metadata.slug,
        status: metadata.status,
        isOwner: link.isOwner,
        isDefault: link.isDefault,
        joinedAt: link.joinedAt,
      });
    }

    /**
     * The role only exists for the ACTIVE subscription: no session sees two
     * subscriptions at once (RN-SUB-003). Without a context there is no
     * subscription to have a role in, and NONE is the honest answer.
     */
    let role = Role.NONE;
    if (input.context && this.subscriptions) {
      const subscription = await this.subscriptions.find();
      if (subscription) {
        role = subscription.isOwner(input.profile.userId)
          ? Role.OWNER
          : subscription.memberRole(input.profile.userId);
      }
    }

    return ok({ user: input.profile, links: described, role: role.name });
  }
}

/**
 * Switching the active subscription is an explicit user action and takes a
 * new token afterwards; no business operation ever receives the subscription
 * as an argument (RN-SUB-013).
 */
export class SwitchActiveSubscription {
  constructor(private readonly links: UserLinkRepository) {}

  async execute(input: {
    user: UserId;
    subscriptionId: SubscriptionId;
  }): Promise<Result<void, DomainError>> {
    const links = await this.links.linksOf(input.user);
    const target = links.find((link) => link.subscriptionId.equals(input.subscriptionId));
    if (!target) {
      // Not a link of this user: indistinguishable from a subscription that
      // does not exist (RN-SUB-004).
      return err(DomainError.notFound('Subscription not found'));
    }
    await this.links.setDefault(input.user, input.subscriptionId);
    return ok();
  }
}
