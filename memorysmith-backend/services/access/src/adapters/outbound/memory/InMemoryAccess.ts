/**
 * In-memory adapters of the Access context. Every key is built the same way
 * the DynamoDB adapter builds it, so a test that passes here is testing the
 * same isolation the production adapter enforces.
 */

import {
  ConcurrencyError,
  DomainError,
  ok,
  type AgentIdentity,
  type Instant,
  type DomainEvent,
  type EventPublisher,
  type NotebookId,
  type Result,
  type SubscriptionContext,
  type SubscriptionId,
  type SubscriptionStatus,
  type UserId,
} from '@memorysmith/kernel';
import type { Subscription } from '../../../domain/subscription/Subscription.js';
import { Share } from '../../../domain/share/Share.js';
import type { AccountLocale, Email, PersonName } from '../../../domain/values.js';
import type {
  AccountDirectory,
  AvatarRepository,
  MemberAvatar,
  ConnectorBindingRepository,
  PlatformSubscriptionAdmin,
  PlatformSubscriptionView,
  AccountLookup,
  ShareRepository,
  SubscriptionLink,
  SubscriptionOnboarding,
  SubscriptionRepository,
  UserLinkRepository,
} from '../../../domain/ports/index.js';

export class InMemoryAccessDatabase {
  readonly subscriptions = new Map<string, { subscription: Subscription; version: number }>();
  readonly links = new Map<string, SubscriptionLink>();
  readonly connectors = new Map<string, { agent: AgentIdentity; expiresAt: Instant }>();
  readonly avatars = new Map<string, MemberAvatar>();
  /** Both sides of every share, keyed as the table keys them (section 8.3). */
  readonly shares = new Map<string, Share>();

  clear(): void {
    this.shares.clear();
    this.subscriptions.clear();
    this.links.clear();
    this.connectors.clear();
    this.avatars.clear();
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

  async link(link: Omit<SubscriptionLink, 'welcomedAt'>): Promise<void> {
    const key = this.key(link.userId, link.subscriptionId);
    this.db.links.set(key, { ...link, welcomedAt: this.db.links.get(key)?.welcomedAt ?? null });
  }

  async markWelcomed(user: UserId, at: string): Promise<void> {
    for (const link of await this.linksOf(user)) {
      if (link.welcomedAt) continue;
      this.db.links.set(this.key(user, link.subscriptionId), { ...link, welcomedAt: at });
    }
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
        ownerEmail: entry.subscription.ownerEmail,
        status: entry.subscription.status.name,
        type: entry.subscription.type.name,
        quota: entry.subscription.quota.name,
        requestedAt: entry.subscription.requestedAt.toISOString(),
        memberCount: entry.subscription.members.length,
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
    link: SubscriptionLink;
  }): Promise<Result<void, ConcurrencyError>> {
    const pending = input.subscription.pullEvents();
    input.subscription.markPersisted();
    this.db.subscriptions.set(`S#${input.subscription.id.value}`, {
      subscription: input.subscription,
      version: input.subscription.version,
    });
    this.db.links.set(
      `USER#${input.link.userId.value}#SUB#${input.link.subscriptionId.value}`,
      input.link,
    );
    await this.events.publish(pending);
    return ok();
  }
}

export class InMemoryConnectorBindingRepository implements ConnectorBindingRepository {
  constructor(
    private readonly sub: SubscriptionContext,
    private readonly db: InMemoryAccessDatabase,
  ) {}

  private key(kind: 'TOKEN' | 'REFRESH', id: string): string {
    return `S#${this.sub.subscriptionId.value}#CONNECTOR#${kind}#${id}`;
  }

  async bindAccessToken(
    tokenId: string,
    agent: AgentIdentity,
    expiresAt: Instant,
  ): Promise<boolean> {
    const key = this.key('TOKEN', tokenId);
    if (this.db.connectors.has(key)) return false;
    this.db.connectors.set(key, { agent, expiresAt });
    return true;
  }

  async bindRefreshToken(
    tokenHash: string,
    agent: AgentIdentity,
    expiresAt: Instant,
  ): Promise<void> {
    this.db.connectors.set(this.key('REFRESH', tokenHash), { agent, expiresAt });
  }

  async agentOfAccessToken(tokenId: string, now: Instant): Promise<AgentIdentity | null> {
    return this.read(this.key('TOKEN', tokenId), now);
  }

  async agentOfRefreshToken(tokenHash: string, now: Instant): Promise<AgentIdentity | null> {
    return this.read(this.key('REFRESH', tokenHash), now);
  }

  private read(key: string, now: Instant): AgentIdentity | null {
    const found = this.db.connectors.get(key);
    if (!found || found.expiresAt.isAtOrBefore(now)) return null;
    return found.agent;
  }
}

/** The language of each account, kept by e-mail, as the identity provider keeps it. */
export class InMemoryAccountDirectory implements AccountDirectory {
  readonly locales = new Map<string, string>();
  readonly names = new Map<string, string>();
  readonly passwords = new Map<string, string>();

  async setLocale(account: Email, locale: AccountLocale): Promise<void> {
    this.locales.set(account.value, locale.name);
  }

  async setName(account: Email, name: PersonName): Promise<void> {
    this.names.set(account.value, name.value);
  }

  async nameOf(account: Email): Promise<string | null> {
    return this.names.get(account.value) ?? null;
  }

  /**
   * The same refusal for both halves, like the real one: which of the two
   * failed is exactly what an unauthenticated retry must not learn.
   */
  async changePassword(
    account: Email,
    current: string,
    next: string,
  ): Promise<Result<void, DomainError>> {
    const held = this.passwords.get(account.value);
    if (held !== undefined && held !== current) {
      return { ok: false, error: DomainError.validation('The password could not be changed') };
    }
    this.passwords.set(account.value, next);
    return ok();
  }
}

/** The same, in memory: one picture per person per subscription. */
export class InMemoryAvatarRepository implements AvatarRepository {
  constructor(
    private readonly sub: SubscriptionContext,
    private readonly db: InMemoryAccessDatabase,
  ) {}

  private key(user: UserId): string {
    return `S#${this.sub.subscriptionId.value}#AVATAR#${user.value}`;
  }

  async find(user: UserId): Promise<MemberAvatar | null> {
    return this.db.avatars.get(this.key(user)) ?? null;
  }

  async save(user: UserId, avatar: MemberAvatar): Promise<void> {
    this.db.avatars.set(this.key(user), avatar);
  }
}

const ownerSide = (owner: string, notebookId: string, grantee: string): string =>
  `S#${owner}|SHARE#${notebookId}#USER#${grantee}`;
const granteeSide = (grantee: string, notebookId: string): string =>
  `USER#${grantee}|SHARED#${notebookId}`;

/** A copy, so what is kept never changes under a use case still holding it. */
function copyOf(share: Share): Share {
  return Share.rehydrate({
    notebookId: share.notebookId,
    ownerSubscriptionId: share.ownerSubscriptionId,
    ownerUserId: share.ownerUserId,
    ownerEmail: share.ownerEmail,
    granteeUserId: share.granteeUserId,
    granteeEmail: share.granteeEmail,
    access: share.access,
    state: share.state,
    sharedAt: share.sharedAt,
    answeredAt: share.answeredAt,
    notifyOwner: share.notifyOwner,
    ownerSeenAt: share.ownerSeenAt,
  });
}

/** Both items of a share, under the keys the table uses, and its events published. */
export class InMemoryShareRepository implements ShareRepository {
  constructor(
    private readonly db: InMemoryAccessDatabase,
    private readonly events: EventPublisher,
  ) {}

  private owner(share: Share): string {
    return ownerSide(
      share.ownerSubscriptionId.value,
      share.notebookId.value,
      share.granteeUserId.value,
    );
  }

  private grantee(share: Share): string {
    return granteeSide(share.granteeUserId.value, share.notebookId.value);
  }

  private async publish(share: Share): Promise<void> {
    await this.events.publish(share.pullEvents());
  }

  async save(share: Share): Promise<void> {
    this.db.shares.set(this.owner(share), copyOf(share));
    this.db.shares.set(this.grantee(share), copyOf(share));
    await this.publish(share);
  }

  async saveRevoked(share: Share): Promise<void> {
    this.db.shares.delete(this.owner(share));
    this.db.shares.set(this.grantee(share), copyOf(share));
    await this.publish(share);
  }

  async saveClosedByGrantee(share: Share): Promise<void> {
    this.db.shares.set(this.owner(share), copyOf(share));
    this.db.shares.delete(this.grantee(share));
    await this.publish(share);
  }

  async saveOwnerSide(share: Share): Promise<void> {
    this.db.shares.set(this.owner(share), copyOf(share));
  }

  async removeOutgoing(share: Share): Promise<void> {
    this.db.shares.delete(this.owner(share));
  }

  async findOutgoing(
    owner: SubscriptionContext,
    notebookId: NotebookId,
    grantee: UserId,
  ): Promise<Share | null> {
    const found = this.db.shares.get(
      ownerSide(owner.subscriptionId.value, notebookId.value, grantee.value),
    );
    return found ? copyOf(found) : null;
  }

  async listOutgoing(owner: SubscriptionContext, notebookId: NotebookId | null): Promise<Share[]> {
    const prefix = `S#${owner.subscriptionId.value}|SHARE#${notebookId ? `${notebookId.value}#` : ''}`;
    return [...this.db.shares.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, share]) => copyOf(share));
  }

  async findIncoming(grantee: UserId, notebookId: NotebookId): Promise<Share | null> {
    const found = this.db.shares.get(granteeSide(grantee.value, notebookId.value));
    return found ? copyOf(found) : null;
  }

  async listIncoming(grantee: UserId): Promise<Share[]> {
    const prefix = `USER#${grantee.value}|SHARED#`;
    return [...this.db.shares.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, share]) => copyOf(share));
  }

  async dismissIncoming(grantee: UserId, notebookId: NotebookId): Promise<void> {
    this.db.shares.delete(granteeSide(grantee.value, notebookId.value));
  }

  async removeAllOf(owner: SubscriptionContext, notebookId: NotebookId): Promise<void> {
    for (const share of await this.listOutgoing(owner, notebookId)) {
      this.db.shares.delete(this.owner(share));
      this.db.shares.delete(this.grantee(share));
    }
  }
}

/** Who an e-mail belongs to, as the identity provider would answer it. */
export class InMemoryAccountLookup implements AccountLookup {
  readonly accounts = new Map<string, UserId>();

  register(email: Email, user: UserId): void {
    this.accounts.set(email.value, user);
  }

  async userIdOf(email: Email): Promise<UserId | null> {
    return this.accounts.get(email.value) ?? null;
  }
}
