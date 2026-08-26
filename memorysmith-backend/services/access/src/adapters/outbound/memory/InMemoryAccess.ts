/**
 * In-memory adapters of the Access context. Every key is built the same way
 * the DynamoDB adapter builds it, so a test that passes here is testing the
 * same isolation the production adapter enforces.
 */

import {
  ConcurrencyError,
  ok,
  type DomainEvent,
  type EventPublisher,
  type Result,
  type SubscriptionContext,
  type SubscriptionId,
  type SubscriptionStatus,
  type UserId,
  type WorkspaceId,
} from '@memorysmith/kernel';
import type { Subscription } from '../../../domain/subscription/Subscription.js';
import type { Workspace } from '../../../domain/workspace/Workspace.js';
import type { Invite } from '../../../domain/invite/Invite.js';
import type { InviteToken } from '../../../domain/values.js';
import type {
  InviteRepository,
  PlatformSubscriptionAdmin,
  PlatformSubscriptionView,
  SubscriptionLink,
  SubscriptionOnboarding,
  SubscriptionRepository,
  UserLinkRepository,
  WorkspaceRepository,
} from '../../../domain/ports/index.js';

export class InMemoryAccessDatabase {
  readonly subscriptions = new Map<string, { subscription: Subscription; version: number }>();
  readonly workspaces = new Map<string, { workspace: Workspace; version: number }>();
  readonly invites = new Map<string, Invite>();
  readonly links = new Map<string, SubscriptionLink>();

  clear(): void {
    this.subscriptions.clear();
    this.workspaces.clear();
    this.invites.clear();
    this.links.clear();
  }
}

export class InMemorySubscriptionRepository implements SubscriptionRepository {
  constructor(
    private readonly sub: SubscriptionContext,
    private readonly db: InMemoryAccessDatabase,
    private readonly events: EventPublisher,
  ) {}

  async find(): Promise<Subscription | null> {
    return this.db.subscriptions.get(`S#${this.sub.subscriptionId.value}`)?.subscription ?? null;
  }

  async save(subscription: Subscription): Promise<Result<void, ConcurrencyError>> {
    const key = `S#${this.sub.subscriptionId.value}`;
    const stored = this.db.subscriptions.get(key);
    if (stored && stored.version !== subscription.version) {
      return { ok: false, error: new ConcurrencyError() };
    }
    const pending: DomainEvent[] = subscription.pullEvents();
    subscription.markPersisted();
    this.db.subscriptions.set(key, { subscription, version: subscription.version });
    await this.events.publish(pending);
    return ok();
  }
}

export class InMemoryWorkspaceRepository implements WorkspaceRepository {
  constructor(
    private readonly sub: SubscriptionContext,
    private readonly db: InMemoryAccessDatabase,
    private readonly events: EventPublisher,
  ) {}

  private key(id: WorkspaceId): string {
    return `S#${this.sub.subscriptionId.value}#WS#${id.value}`;
  }

  async findById(id: WorkspaceId): Promise<Workspace | null> {
    return this.db.workspaces.get(this.key(id))?.workspace ?? null;
  }

  async listAll(): Promise<Workspace[]> {
    const prefix = `S#${this.sub.subscriptionId.value}#WS#`;
    return [...this.db.workspaces.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, entry]) => entry.workspace);
  }

  async findDefault(): Promise<Workspace | null> {
    return (await this.listAll()).find((workspace) => workspace.isDefault) ?? null;
  }

  async save(workspace: Workspace): Promise<Result<void, ConcurrencyError>> {
    const key = this.key(workspace.id);
    const stored = this.db.workspaces.get(key);
    if (stored && stored.version !== workspace.version) {
      return { ok: false, error: new ConcurrencyError() };
    }
    const pending = workspace.pullEvents();
    workspace.markPersisted();
    this.db.workspaces.set(key, { workspace, version: workspace.version });
    await this.events.publish(pending);
    return ok();
  }
}

export class InMemoryInviteRepository implements InviteRepository {
  constructor(
    private readonly sub: SubscriptionContext,
    private readonly db: InMemoryAccessDatabase,
    private readonly events: EventPublisher,
  ) {}

  async findByToken(token: InviteToken): Promise<Invite | null> {
    // The token is the key, and it is scoped to the subscription like
    // everything else: a token of another subscription simply is not found.
    return this.db.invites.get(`S#${this.sub.subscriptionId.value}#INVITE#${token.value}`) ?? null;
  }

  async listByWorkspace(workspaceId: WorkspaceId): Promise<Invite[]> {
    const prefix = `S#${this.sub.subscriptionId.value}#INVITE#`;
    return [...this.db.invites.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, invite]) => invite)
      .filter((invite) => invite.workspaceId.equals(workspaceId));
  }

  async save(invite: Invite): Promise<Result<void, ConcurrencyError>> {
    this.db.invites.set(`S#${this.sub.subscriptionId.value}#INVITE#${invite.token.value}`, invite);
    await this.events.publish(invite.pullEvents());
    return ok();
  }
}

/** Exception 1: identity is global, so this one is not subscription-scoped. */
export class InMemoryUserLinkRepository implements UserLinkRepository {
  constructor(private readonly db: InMemoryAccessDatabase) {}

  private key(user: UserId, subscriptionId: SubscriptionId): string {
    return `USER#${user.value}#SUB#${subscriptionId.value}`;
  }

  async linksOf(user: UserId): Promise<SubscriptionLink[]> {
    const prefix = `USER#${user.value}#SUB#`;
    return [...this.db.links.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, link]) => link);
  }

  async link(link: SubscriptionLink): Promise<void> {
    this.db.links.set(this.key(link.userId, link.subscriptionId), link);
  }

  async unlink(user: UserId, subscriptionId: SubscriptionId): Promise<void> {
    this.db.links.delete(this.key(user, subscriptionId));
  }

  async setDefault(user: UserId, subscriptionId: SubscriptionId): Promise<void> {
    for (const link of await this.linksOf(user)) {
      this.db.links.set(this.key(user, link.subscriptionId), {
        ...link,
        isDefault: link.subscriptionId.equals(subscriptionId),
      });
    }
  }
}

/** Exception 2: metadata only, which is all the platform screen shows. */
export class InMemoryPlatformAdmin implements PlatformSubscriptionAdmin {
  constructor(
    private readonly db: InMemoryAccessDatabase,
    private readonly events: EventPublisher,
  ) {}

  async listByStatus(status: SubscriptionStatus): Promise<PlatformSubscriptionView[]> {
    return [...this.db.subscriptions.values()]
      .filter((entry) => entry.subscription.status.equals(status))
      .map((entry) => ({
        subscriptionId: entry.subscription.id.value,
        name: entry.subscription.name.value,
        ownerEmail: entry.subscription.ownerEmail,
        status: entry.subscription.status.name,
        requestedAt: entry.subscription.requestedAt.toISOString(),
        workspaceCount: [...this.db.workspaces.keys()].filter((key) =>
          key.startsWith(`S#${entry.subscription.id.value}#WS#`),
        ).length,
      }));
  }

  async findById(id: SubscriptionId): Promise<Subscription | null> {
    return this.db.subscriptions.get(`S#${id.value}`)?.subscription ?? null;
  }

  async save(subscription: Subscription): Promise<Result<void, ConcurrencyError>> {
    const key = `S#${subscription.id.value}`;
    const stored = this.db.subscriptions.get(key);
    if (stored && stored.version !== subscription.version) {
      return { ok: false, error: new ConcurrencyError() };
    }
    const pending = subscription.pullEvents();
    subscription.markPersisted();
    this.db.subscriptions.set(key, { subscription, version: subscription.version });
    await this.events.publish(pending);
    return ok();
  }
}

export class InMemoryOnboarding implements SubscriptionOnboarding {
  constructor(
    private readonly db: InMemoryAccessDatabase,
    private readonly events: EventPublisher,
  ) {}

  async ownedBy(user: UserId): Promise<SubscriptionId | null> {
    const owned = [...this.db.subscriptions.values()].find((entry) =>
      entry.subscription.ownerId.equals(user),
    );
    return owned?.subscription.id ?? null;
  }

  async create(input: {
    subscription: Subscription;
    workspace: Workspace;
    link: SubscriptionLink;
  }): Promise<Result<void, ConcurrencyError>> {
    const pending = [...input.subscription.pullEvents(), ...input.workspace.pullEvents()];
    input.subscription.markPersisted();
    input.workspace.markPersisted();
    this.db.subscriptions.set(`S#${input.subscription.id.value}`, {
      subscription: input.subscription,
      version: input.subscription.version,
    });
    this.db.workspaces.set(`S#${input.subscription.id.value}#WS#${input.workspace.id.value}`, {
      workspace: input.workspace,
      version: input.workspace.version,
    });
    this.db.links.set(
      `USER#${input.link.userId.value}#SUB#${input.link.subscriptionId.value}`,
      input.link,
    );
    await this.events.publish(pending);
    return ok();
  }
}
