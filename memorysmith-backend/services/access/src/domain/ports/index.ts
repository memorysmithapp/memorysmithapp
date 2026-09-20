/**
 * Ports of the Access context.
 *
 * Two of them take a SubscriptionContext in their constructor, like every
 * other repository in the system. The other three are THE TWO NAMED EXCEPTIONS
 * of architecture-guide.md section 8.3, plus onboarding, and they are declared
 * apart precisely so they stay countable:
 *
 *  - UserLinkRepository answers "which subscriptions do I take part in?" and
 *    nothing else. Identity is global; a subscription is a link (RN-SUB-011).
 *  - PlatformSubscriptionAdmin serves the platform queue, reading metadata
 *    only through GSI2. It never reaches a notebook or a note, and
 *    it could not: those keys start with a subscription it cannot build.
 *  - SubscriptionOnboarding writes the first items of a brand new
 *    subscription, at the one moment when no context exists yet.
 */

import type {
  AgentIdentity,
  ConcurrencyError,
  Instant,
  Result,
  SubscriptionId,
  SubscriptionStatus,
  UserId,
} from '@memorysmith/kernel';
import type { Subscription } from '../subscription/Subscription.js';
import type { AccountLocale, Email } from '../values.js';

/** The subscription the session acts for; there is no findById by design. */
export interface SubscriptionRepository {
  find(): Promise<Subscription | null>;
  save(subscription: Subscription): Promise<Result<void, ConcurrencyError>>;
}

/** One link between a user and a subscription (exception 1). */
export interface SubscriptionLink {
  readonly userId: UserId;
  readonly subscriptionId: SubscriptionId;
  readonly isOwner: boolean;
  readonly isDefault: boolean;
  readonly joinedAt: string;
  /**
   * When this person was first shown what the product is (#167), or null while
   * they never were. It rides on the link because the link is the one item
   * this context already holds about a person, and it is an ATTRIBUTE of it:
   * exception 1 names a key shape, and this adds none.
   */
  readonly welcomedAt: string | null;
}

export interface UserLinkRepository {
  linksOf(user: UserId): Promise<SubscriptionLink[]>;
  /**
   * Writes the link, and never the welcome: joining a subscription says
   * nothing about whether the person has already been welcomed, and an
   * ownership transfer rewrites both ends of a link.
   */
  link(link: Omit<SubscriptionLink, 'welcomedAt'>): Promise<void>;
  /** Records that this person has seen the welcome, on every link they hold. */
  markWelcomed(user: UserId, at: string): Promise<void>;
  unlink(user: UserId, subscriptionId: SubscriptionId): Promise<void>;
  /** Switching the active subscription is an explicit act (RN-SUB-013). */
  setDefault(user: UserId, subscriptionId: SubscriptionId): Promise<void>;
}

/** Exactly the fields the platform screen shows, and no others. */
export interface PlatformSubscriptionView {
  readonly subscriptionId: string;
  readonly ownerEmail: string;
  readonly status: string;
  readonly type: string;
  readonly quota: string;
  readonly requestedAt: string;
  readonly memberCount: number;
}

export interface PlatformSubscriptionAdmin {
  listByStatus(status: SubscriptionStatus): Promise<PlatformSubscriptionView[]>;
  findById(id: SubscriptionId): Promise<Subscription | null>;
  save(subscription: Subscription): Promise<Result<void, ConcurrencyError>>;
}

export interface SubscriptionOnboarding {
  /** Subscription and link, written together. */
  create(input: {
    subscription: Subscription;
    link: Omit<SubscriptionLink, 'welcomedAt'>;
  }): Promise<Result<void, ConcurrencyError>>;
  /** Whether this user already asked for a subscription of their own. */
  ownedBy(user: UserId): Promise<SubscriptionId | null>;
}

/**
 * Which connector each token of the connector proxy was issued to
 * (architecture-guide.md, sections 9.4 and 13.3).
 *
 * Scoped by the subscription of the token itself, like every other repository:
 * a binding is found only under the subscription the token names, so no token
 * can borrow the connector of a session of another subscription (rule 1).
 */
export interface ConnectorBindingRepository {
  /**
   * Records the connector of an access token, once. It answers false when the
   * token already had one, and that one stays: a token never changes connector.
   */
  bindAccessToken(tokenId: string, agent: AgentIdentity, expiresAt: Instant): Promise<boolean>;
  /** Records, or replaces, the connector a refresh token renews. */
  bindRefreshToken(tokenHash: string, agent: AgentIdentity, expiresAt: Instant): Promise<void>;
  /** The connector of an access token, or null when it has none or it expired. */
  agentOfAccessToken(tokenId: string, now: Instant): Promise<AgentIdentity | null>;
  /** The connector a refresh token renews, or null when it has none or it expired. */
  agentOfRefreshToken(tokenHash: string, now: Instant): Promise<AgentIdentity | null>;
}

/** What a user is, for the session payload. Identity lives in Cognito. */
export interface UserProfile {
  readonly userId: UserId;
  readonly email: Email;
  readonly name: string;
  readonly isPlatformAdmin: boolean;
}

/**
 * The account itself, where the identity provider keeps it (RN-ACC-018). Access
 * writes one attribute of it, the language, and reads none: who the person is
 * travels in the token.
 */
export interface AccountDirectory {
  /** Records the language every message to this account is written in. */
  setLocale(account: Email, locale: AccountLocale): Promise<void>;
}
