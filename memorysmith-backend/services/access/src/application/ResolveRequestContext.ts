/**
 * Stage 1 of the two-stage authorization (architecture-guide.md, section 14.2).
 *
 * It validates that the active subscription is in trial or active (RN-SUB-007),
 * resolves ownership and the role in the subscription, and injects all of it
 * into the request context. IT DOES NOT KNOW WHAT A VAULT IS, and could not:
 * whoever holds the per-vault ceiling is the Knowledge context.
 *
 * The result is cached for five minutes, which is the declared propagation
 * delay of a role change (RN-ACC-016).
 */

import {
  DomainError,
  err,
  ok,
  Role,
  type Result,
  type SubscriptionContext,
  type UserId,
} from '@memorysmith/kernel';
import type { SubscriptionRepository } from '../domain/ports/index.js';

/** Exactly the shape the Knowledge context expects to receive. */
export interface ResolvedContext {
  readonly user: UserId;
  readonly isOwner: boolean;
  /** One role for the whole subscription; a vault ceiling can only lower it. */
  readonly role: Role;
}

export class ResolveRequestContext {
  constructor(private readonly subscriptions: SubscriptionRepository) {}

  async execute(context: SubscriptionContext): Promise<Result<ResolvedContext, DomainError>> {
    const subscription = await this.subscriptions.find();
    if (!subscription) {
      return err(DomainError.notFound('Subscription not found'));
    }
    // A suspended or cancelled subscription grants operational access to
    // nobody, not even to its own OWNER, and not over MCP either.
    if (!subscription.grantsOperationalAccess) {
      return err(
        DomainError.forbiddenVisible(
          `This subscription is ${subscription.status.name} and grants no operational access`,
          { status: subscription.status.name },
        ),
      );
    }

    const isOwner = subscription.isOwner(context.userId);
    const role = isOwner ? Role.OWNER : subscription.memberRole(context.userId);

    return ok({ user: context.userId, isOwner, role });
  }
}

/**
 * A tiny time-based cache in front of the resolution. It is deliberately the
 * ONLY place the five-minute delay of RN-ACC-016 exists, so the number is
 * declared once and the screens can quote it.
 */
export class CachedRequestContext {
  private readonly entries = new Map<string, { at: number; value: ResolvedContext }>();

  constructor(
    private readonly inner: ResolveRequestContext,
    private readonly ttlSeconds: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async execute(context: SubscriptionContext): Promise<Result<ResolvedContext, DomainError>> {
    const key = `${context.subscriptionId.value}#${context.userId.value}`;
    const cached = this.entries.get(key);
    if (cached && this.now() - cached.at < this.ttlSeconds * 1000) {
      return ok(cached.value);
    }
    const resolved = await this.inner.execute(context);
    if (resolved.ok) this.entries.set(key, { at: this.now(), value: resolved.value });
    return resolved;
  }

  invalidate(): void {
    this.entries.clear();
  }
}
