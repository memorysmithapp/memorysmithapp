/**
 * SubscriptionContext: the per-request carrier of the isolation boundary.
 *
 * Repositories take one in their CONSTRUCTOR, never as a method argument, and
 * it can only be built from verified token claims. Two consequences fall out
 * of that, and both are guarantees rather than conventions:
 *
 *  - No code path can build a repository without a subscription: the compiler
 *    rejects it (PE2, architecture-guide.md section 8.2).
 *  - A platform admin session carries no subscription_id claim, so no
 *    Knowledge use case is even instantiable under it. The attempt fails at
 *    composition, before any role check (RN-SUB-016, section 8.4).
 */

import { DomainError } from './errors.js';
import { SubscriptionId, UserId } from './ids.js';
import { err, ok, type Result } from './result.js';
import { SubscriptionStatus } from './subscription-status.js';

/** The claims the authorizer extracts from a verified Cognito access token. */
export interface TokenClaims {
  readonly sub: string;
  readonly subscription_id?: string | undefined;
  readonly subscription_status?: string | undefined;
  /** The app client the token was issued to: the interface's, or the connector proxy's. */
  readonly client_id?: string | undefined;
}

export class SubscriptionContext {
  private readonly __subscriptionContext!: void;
  private constructor(
    readonly subscriptionId: SubscriptionId,
    readonly userId: UserId,
    readonly status: SubscriptionStatus,
  ) {}

  /**
   * The only constructor, and it is named after the claim it reads. A request
   * path, query or body cannot reach it (RN-SUB-002).
   */
  static fromClaims(claims: TokenClaims): Result<SubscriptionContext, DomainError> {
    const user = UserId.create(claims.sub);
    if (!user.ok) return user;

    if (!claims.subscription_id) {
      return err(
        DomainError.forbidden(
          'This session carries no subscription: no subscription-scoped key can be built',
        ),
      );
    }
    const subscriptionId = SubscriptionId.fromClaim(claims.subscription_id);
    if (!subscriptionId.ok) return subscriptionId;

    const status = SubscriptionStatus.create(claims.subscription_status ?? '');
    if (!status.ok) return status;

    return ok(new SubscriptionContext(subscriptionId.value, user.value, status.value));
  }

  /**
   * The second constructor, and the only door through the boundary: a share
   * of a notebook its grantee ACCEPTED (RN-ACC-026, architecture-guide.md
   * section 8.3). The person is the one of the token; the subscription is the
   * one the stored share names, which an authenticated act of its owner wrote
   * and which the grantee's session reached by a key taken from its own token.
   * Nothing of it comes from the request (RN-SUB-002).
   *
   * Only the core reaches for it, after reading the accepted share, and what it
   * builds reaches that one notebook, read-only: the request it goes into
   * carries the VIEWER role, so every write is refused by the notebook's own
   * policy (RN-ACC-027).
   */
  static fromAcceptedShare(share: {
    readonly granteeUserId: string;
    readonly ownerSubscriptionId: string;
    readonly ownerStatus: string;
  }): Result<SubscriptionContext, DomainError> {
    return SubscriptionContext.fromClaims({
      sub: share.granteeUserId,
      subscription_id: share.ownerSubscriptionId,
      subscription_status: share.ownerStatus,
    });
  }

  /**
   * Whether the subscription grants operational access at all (RN-SUB-007).
   * Checked by the authorizer, never by a repository: status governs access,
   * never address (RN-SUB-005).
   */
  get grantsOperationalAccess(): boolean {
    return this.status.grantsOperationalAccess;
  }
}
