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
  /** The CIMD client_id when the caller is an MCP connector. */
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
   * Whether the subscription grants operational access at all (RN-SUB-007).
   * Checked by the authorizer, never by a repository: status governs access,
   * never address (RN-SUB-005).
   */
  get grantsOperationalAccess(): boolean {
    return this.status.grantsOperationalAccess;
  }
}
