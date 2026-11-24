/**
 * The first sign-in of a person through the organization's identity provider
 * (#395, ADR-026).
 *
 * The person is the identity the provider asserts, and the account is one of
 * the pool, addressed by e-mail like every other: the identity is LINKED to
 * the account holding that e-mail, created when there is none, so whichever
 * way the person signs in, it is one account, one `sub` and one username
 * (RN-ACC-039). The link is made once, on this first sign-in; every later
 * one finds it and never comes here.
 *
 * What a person finds without an account is the installation's choice
 * (RN-ACC-040): an account to ask for a subscription from, nothing at all
 * unless one was prepared, or an account with its subscription already active
 * (RN-SUB-026).
 */

import {
  Authorship,
  DomainError,
  err,
  type Instant,
  ok,
  type Result,
  SubscriptionId,
  SubscriptionStatus,
  type UserId,
} from '@memorysmithapp/kernel';
import { Subscription } from '../domain/subscription/Subscription.js';
import { Email, type StorageQuota } from '../domain/values.js';
import type { SubscriptionOnboarding } from '../domain/ports/index.js';

/** What a person of the provider finds on their first sign-in. */
export type FirstSignIn = 'request' | 'prepared' | 'automatic';

/** An account of the pool, as the first sign-in needs to see it. */
export interface PoolAccount {
  readonly userId: UserId;
  /** What the pool names it by, which the link points at. */
  readonly username: string;
  /** The name recorded on the account, or null when it has none yet. */
  readonly name: string | null;
  /** The providers whose identities are already linked to it. */
  readonly linkedProviders: readonly string[];
}

/** The pool, where accounts are found, created and linked to an identity. */
export interface FederatedAccounts {
  /** The account holding this e-mail, or null when none does. */
  find(email: Email): Promise<PoolAccount | null>;
  /** An account of the pool, with no password and no message sent. */
  create(email: Email, name: string | null): Promise<PoolAccount>;
  /** Links the identity of the provider to the account, for good. */
  link(account: PoolAccount, provider: string, providerUserId: string): Promise<void>;
  setName(account: PoolAccount, name: string): Promise<void>;
}

export interface FederationPolicy {
  readonly firstSignIn: FirstSignIn;
  /** The claim the address travels in, named when it is missing. */
  readonly emailClaim: string;
  /** Whether the provider must assert the address as verified. */
  readonly requireVerified: boolean;
  /** The quota of the subscription `automatic` gives. */
  readonly quota: StorageQuota;
}

export interface FirstFederatedSignIn {
  /** The provider, as the pool names it. */
  readonly provider: string;
  /** The identifier of the person in the provider: its `sub`. */
  readonly providerUserId: string;
  readonly email: string | undefined;
  readonly emailVerified: string | undefined;
  readonly name: string | undefined;
  readonly at: Instant;
}

export class FederatedSignIn {
  constructor(
    private readonly accounts: FederatedAccounts,
    private readonly onboarding: SubscriptionOnboarding,
    private readonly policy: FederationPolicy,
  ) {}

  async execute(
    input: FirstFederatedSignIn,
  ): Promise<Result<{ userId: UserId; created: boolean }, DomainError>> {
    const written = input.email?.trim() ?? '';
    if (written === '') {
      return err(
        DomainError.validation(
          `The identity provider sent no address in the claim ${this.policy.emailClaim}, and MemorySmith addresses every account by its e-mail`,
        ),
      );
    }
    const email = Email.create(written);
    if (!email.ok) {
      return err(
        DomainError.validation(
          `The claim ${this.policy.emailClaim} holds "${written}", which is not an e-mail address`,
        ),
      );
    }
    if (this.policy.requireVerified && input.emailVerified !== 'true') {
      return err(
        DomainError.validation(
          `The identity provider does not assert ${email.value.value} as verified; verify it there, or have the installation trust it (IDP_TRUST_EMAIL)`,
        ),
      );
    }
    const name = input.name?.trim() || null;

    let account = await this.accounts.find(email.value);
    let created = false;
    if (account) {
      // An e-mail is one account, and one identity of a provider: a second
      // identity claiming it is somebody else, never the same person.
      if (account.linkedProviders.includes(input.provider)) {
        return err(
          DomainError.conflict(
            `${email.value.value} already belongs to another identity of ${input.provider}`,
          ),
        );
      }
      // The name fills an account that has none, and never replaces one
      // somebody typed (RN-ACC-021).
      if (!account.name && name) await this.accounts.setName(account, name);
    } else {
      if (this.policy.firstSignIn === 'prepared') {
        return err(
          DomainError.notFound(
            `${email.value.value} has no account in this installation: ask whoever operates it to prepare one`,
          ),
        );
      }
      account = await this.accounts.create(email.value, name);
      created = true;
    }

    if (this.policy.firstSignIn === 'automatic') {
      const given = await this.subscribe(account.userId, email.value, input.at);
      if (!given.ok) return given;
    }

    // Last, so that a failure above leaves an account the next attempt finds
    // and links, instead of a linked identity nothing ever completes.
    await this.accounts.link(account, input.provider, input.providerUserId);
    return ok({ userId: account.userId, created });
  }

  /**
   * The subscription `automatic` gives (RN-SUB-026): requested and approved
   * in one write, the person recorded as who asked and as who approved, since
   * the approval is the installation's declaration and nobody else's act.
   */
  private async subscribe(
    owner: UserId,
    email: Email,
    at: Instant,
  ): Promise<Result<void, DomainError>> {
    if (await this.onboarding.ownedBy(owner)) return ok();
    const by = Authorship.byHuman(owner, at);
    const requested = Subscription.request({
      id: SubscriptionId.generate(),
      ownerId: owner,
      ownerEmail: email.value,
      quota: this.policy.quota,
      by,
    });
    if (!requested.ok) return requested;
    const approved = requested.value.approve(SubscriptionStatus.ACTIVE, owner, by);
    if (!approved.ok) return approved;
    const written = await this.onboarding.create({
      subscription: requested.value,
      link: {
        userId: owner,
        subscriptionId: requested.value.id,
        isOwner: true,
        isDefault: true,
        joinedAt: at.toISOString(),
      },
    });
    if (!written.ok) {
      return err(
        DomainError.conflict('The subscription of this account was being written already'),
      );
    }
    return ok();
  }
}
