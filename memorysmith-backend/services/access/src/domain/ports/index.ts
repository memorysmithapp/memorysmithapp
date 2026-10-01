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
  DomainError,
  Instant,
  NotebookId,
  Result,
  SubscriptionContext,
  SubscriptionId,
  SubscriptionStatus,
  UserId,
} from '@memorysmith/kernel';
import type { Share } from '../share/Share.js';
import type { Subscription } from '../subscription/Subscription.js';
import type { AccountLocale, AvatarSource, Email, PersonName } from '../values.js';

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
 * The account itself, where the identity provider keeps it (RN-ACC-018). The
 * language and the name are attributes of the account, because identity is
 * global and belongs to no subscription; the PICTURE is not here, because the
 * product decided it is data of the person inside a subscription (RN-ACC-022).
 */
export interface AccountDirectory {
  /** Records the language every message to this account is written in. */
  setLocale(account: Email, locale: AccountLocale): Promise<void>;
  /** Records the name every screen shows for this person (RN-ACC-021). */
  setName(account: Email, name: PersonName): Promise<void>;
  /**
   * The name recorded on the account, or null when it carries none. It is
   * read where the token cannot answer: a token minted before the change
   * still carries the old name, and a screen that shows it is a screen that
   * refused the edit it just accepted.
   */
  nameOf(account: Email): Promise<string | null>;
  /**
   * Changes the password, proving the current one (RN-ACC-023). It answers a
   * validation failure when the current password is wrong or the new one does
   * not satisfy the policy of the pool, and NEVER says which.
   *
   * It ends the other sessions of the account, which is what a password change
   * means and what the screen says before it happens.
   */
  changePassword(account: Email, current: string, next: string): Promise<Result<void, DomainError>>;
}

/**
 * The face beside a person, INSIDE one subscription (RN-ACC-022).
 *
 * Keyed under the subscription like everything else, which is what keeps
 * design rule 1 whole and opens no third exception of section 8.3: a picture
 * is data of the membership, not of the global identity. Somebody who takes
 * part in two subscriptions has a picture in each, and that is not an
 * accident — the face your colleagues see and the face your other notebook
 * sees are not obliged to be the same one.
 */
export interface MemberAvatar {
  readonly source: AvatarSource;
  /** The bytes of an uploaded picture, or null for every other source. */
  readonly picture: Uint8Array | null;
  readonly mime: string | null;
}

export interface AvatarRepository {
  find(user: UserId): Promise<MemberAvatar | null>;
  save(user: UserId, avatar: MemberAvatar): Promise<void>;
}

/**
 * What an uploaded picture is allowed to be, injected by the composition root
 * (PE2). The catalogue of types and the reader that checks a declared type
 * against the bytes are published by the contracts package, which `domain/`
 * and `application/` do not import: the root passes the reading in, exactly as
 * it does for the types a notebook accepts.
 */
export interface PictureTypes {
  readonly accepted: readonly string[];
  /** Whether these bytes support the type they were declared under. */
  supports(mime: string, bytes: Uint8Array): boolean;
}

/**
 * Where a share of a notebook is kept (RN-ACC-024), and exception 1 widened
 * (architecture-guide.md, section 8.3).
 *
 * A share is written twice in ONE transaction: under the subscription that
 * owns the notebook, an ordinary key, and under the grantee, beside their links
 * to subscriptions. The second is how a grantee's session finds a notebook of
 * another subscription without that subscription coming from a request: the
 * key is taken from its own token. It answers "which notebooks were shared
 * with me?" and nothing else.
 *
 * The owner's side is reached only with the owner's own context, which is the
 * claim of the request that shares or revokes. The grantee's side holds the
 * subscription of the owner, read from the stored item and never from a
 * request.
 */
export interface ShareRepository {
  /** Both items, written together with the events of the transition. */
  save(share: Share): Promise<void>;
  /**
   * The owner revoked: their item goes, and the grantee's stays as the notice
   * of it until they dismiss it (RN-ACC-029).
   */
  saveRevoked(share: Share): Promise<void>;
  /** The grantee answered no or left: their item goes, the owner's says so. */
  saveClosedByGrantee(share: Share): Promise<void>;
  /** Only the owner's item, for what the grantee never sees: a notice dismissed. */
  saveOwnerSide(share: Share): Promise<void>;
  /** A rejected or departed line taken off the owner's list; the grantee holds nothing. */
  removeOutgoing(share: Share): Promise<void>;
  /** The share of one notebook with one person, from the owner's side. */
  findOutgoing(
    owner: SubscriptionContext,
    notebookId: NotebookId,
    grantee: UserId,
  ): Promise<Share | null>;
  /** Every share of one notebook, or of every notebook, from the owner's side. */
  listOutgoing(owner: SubscriptionContext, notebookId: NotebookId | null): Promise<Share[]>;
  /** The share of one notebook with this person, from their own side. */
  findIncoming(grantee: UserId, notebookId: NotebookId): Promise<Share | null>;
  /** Every notebook shared with this person, from their own side. */
  listIncoming(grantee: UserId): Promise<Share[]>;
  /** The grantee dismissed the notice of a revocation: their item goes. */
  dismissIncoming(grantee: UserId, notebookId: NotebookId): Promise<void>;
  /** A notebook was deleted: both items of every share of it go (RN-ACC-028). */
  removeAllOf(owner: SubscriptionContext, notebookId: NotebookId): Promise<void>;
}

/**
 * Who an e-mail belongs to, where identity lives (RN-ACC-025). It answers null
 * for an e-mail with no account, and the use case that asks says nothing
 * different either way.
 */
export interface AccountLookup {
  userIdOf(email: Email): Promise<UserId | null>;
}

/** What a share shows of its notebook, read through the context that owns it. */
export interface SharedNotebookView {
  readonly name: string;
  readonly description: string;
  readonly noteCount: number;
  readonly updatedAt: string;
}

/**
 * The notebooks Access shares and does not hold (RN-ACC-026). The composition
 * root answers it from Knowledge, which Access may not import: the owner's
 * notebooks under the owner's context, and a notebook shared with somebody
 * under the subscription the stored share names.
 */
export interface SharedNotebooks {
  /** A notebook of the session's own subscription, or null when it holds none such. */
  own(owner: SubscriptionContext, notebookId: NotebookId): Promise<SharedNotebookView | null>;
  /** A notebook of the subscription a share names, or null when it is gone. */
  through(share: Share): Promise<SharedNotebookView | null>;
  /** Whether the subscription a share names grants operational access (RN-SUB-007). */
  ownerGrantsAccess(share: Share): Promise<boolean>;
}
