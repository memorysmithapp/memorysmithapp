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
  WorkspaceId,
  type Result,
  type SubscriptionContext,
  type UserId,
} from '@memorysmith/kernel';
import { Subscription } from '../domain/subscription/Subscription.js';
import { Workspace } from '../domain/workspace/Workspace.js';
import { SubscriptionName, WorkspaceName } from '../domain/values.js';
import type {
  SubscriptionOnboarding,
  SubscriptionRepository,
  UserLinkRepository,
  UserProfile,
  WorkspaceRepository,
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

    // The default workspace exists from day one; the UI just hides the level
    // while there is only one of them (PP8).
    const workspaceName = WorkspaceName.create(name.value.value);
    if (!workspaceName.ok) return workspaceName;
    const workspace = Workspace.create({
      id: WorkspaceId.generate(),
      subscriptionId: subscription.value.id,
      name: workspaceName.value,
      isDefault: true,
      by: input.by,
    });
    if (!workspace.ok) return workspace;

    const written = await this.onboarding.create({
      subscription: subscription.value,
      workspace: workspace.value,
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
  readonly workspaces: Array<{
    workspaceId: string;
    name: string;
    slug: string;
    isDefault: boolean;
    role: string;
    createdAt: string;
  }>;
}

export class GetSession {
  constructor(
    private readonly links: UserLinkRepository,
    private readonly subscriptions: SubscriptionRepository | null,
    private readonly workspaces: WorkspaceRepository | null,
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

    // Workspaces only exist for the ACTIVE subscription: there is no session
    // that sees the workspaces of two subscriptions at once (RN-SUB-003).
    const workspaces: SessionView['workspaces'] = [];
    if (input.context && this.workspaces && this.subscriptions) {
      const subscription = await this.subscriptions.find();
      const isOwner = subscription?.isOwner(input.profile.userId) ?? false;
      for (const workspace of await this.workspaces.listAll()) {
        const role = isOwner ? Role.OWNER : workspace.memberRole(input.profile.userId);
        if (!role.canRead()) continue;
        workspaces.push({
          workspaceId: workspace.id.value,
          name: workspace.name.value,
          slug: workspace.slug.value,
          isDefault: workspace.isDefault,
          role: role.name,
          createdAt: workspace.createdAt.toISOString(),
        });
      }
    }

    return ok({ user: input.profile, links: described, workspaces });
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
