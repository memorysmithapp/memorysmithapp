/**
 * The platform surface (software-vision.md, section 4.6).
 *
 * A platform session carries NO active subscription, so there is no key it can
 * build for a vault or a note. These use cases take a plain
 * UserId and reach only subscription metadata, which is the whole of what the
 * platform admin is allowed to see: holder, e-mail, status, dates and a
 * member count. Never a vault name, never content.
 */

import {
  type Authorship,
  DomainError,
  err,
  ok,
  type SubscriptionId,
  SubscriptionStatus,
  type Result,
  type UserId,
} from '@memorysmith/kernel';
import { RejectionReason, StorageQuota, SubscriptionType } from '../domain/values.js';
import type { Subscription } from '../domain/subscription/Subscription.js';
import type { PlatformSubscriptionAdmin, PlatformSubscriptionView } from '../domain/ports/index.js';

/** Whoever calls these has already been proven to be a platform admin. */
export interface PlatformActor {
  readonly userId: UserId;
  readonly isPlatformAdmin: boolean;
}

function requirePlatformAdmin(actor: PlatformActor): Result<void, DomainError> {
  if (!actor.isPlatformAdmin) {
    return err(DomainError.forbidden('Not found'));
  }
  return ok();
}

export class ListPlatformQueue {
  constructor(private readonly admin: PlatformSubscriptionAdmin) {}

  async execute(input: {
    actor: PlatformActor;
    status: string;
  }): Promise<Result<PlatformSubscriptionView[], DomainError>> {
    const allowed = requirePlatformAdmin(input.actor);
    if (!allowed.ok) return allowed;

    const status = SubscriptionStatus.create(input.status);
    if (!status.ok) return status;
    return ok(await this.admin.listByStatus(status.value));
  }
}

export class ReviewSubscription {
  constructor(private readonly admin: PlatformSubscriptionAdmin) {}

  /** Approving sets trial or active, per the commercial agreement. */
  async approve(input: {
    actor: PlatformActor;
    subscriptionId: SubscriptionId;
    status: string;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    return this.apply(input.actor, input.subscriptionId, (subscription) => {
      const status = SubscriptionStatus.create(input.status);
      if (!status.ok) return status;
      return subscription.approve(status.value, input.actor.userId, input.by);
    });
  }

  /** Rejecting requires a reason, which is communicated (RN-SUB-009). */
  async reject(input: {
    actor: PlatformActor;
    subscriptionId: SubscriptionId;
    reason: string;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    return this.apply(input.actor, input.subscriptionId, (subscription) => {
      const reason = RejectionReason.create(input.reason);
      if (!reason.ok) return reason;
      return subscription.reject(reason.value, input.actor.userId, input.by);
    });
  }

  async suspend(input: {
    actor: PlatformActor;
    subscriptionId: SubscriptionId;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    return this.apply(input.actor, input.subscriptionId, (subscription) =>
      subscription.suspend(input.actor.userId, input.by),
    );
  }

  /**
   * The administrative override (RN-SUB-018). It reaches the same aggregate
   * through the same port, so the write, the event and the audit trail are the
   * ordinary ones; what it skips is the transition machine, and only that.
   */
  async setStatus(input: {
    actor: PlatformActor;
    subscriptionId: SubscriptionId;
    status: string;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    return this.apply(input.actor, input.subscriptionId, (subscription) => {
      const status = SubscriptionStatus.create(input.status);
      if (!status.ok) return status;
      return subscription.setStatus(status.value, input.actor.userId, input.by);
    });
  }

  /** Type and quota, either one alone (RN-SUB-018, RN-SUB-019). */
  async changePlan(input: {
    actor: PlatformActor;
    subscriptionId: SubscriptionId;
    type?: string;
    quota?: string;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    return this.apply(input.actor, input.subscriptionId, (subscription) => {
      const type = input.type ? SubscriptionType.create(input.type) : null;
      if (type && !type.ok) return type;
      const quota = input.quota ? StorageQuota.create(input.quota) : null;
      if (quota && !quota.ok) return quota;
      return subscription.changePlan(
        {
          ...(type?.ok ? { type: type.value } : {}),
          ...(quota?.ok ? { quota: quota.value } : {}),
        },
        input.actor.userId,
        input.by,
      );
    });
  }

  async reactivate(input: {
    actor: PlatformActor;
    subscriptionId: SubscriptionId;
    status: string;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    return this.apply(input.actor, input.subscriptionId, (subscription) => {
      const status = SubscriptionStatus.create(input.status);
      if (!status.ok) return status;
      return subscription.reactivate(status.value, input.actor.userId, input.by);
    });
  }

  private async apply(
    actor: PlatformActor,
    subscriptionId: SubscriptionId,
    change: (subscription: Subscription) => Result<void, DomainError>,
  ): Promise<Result<void, DomainError>> {
    const allowed = requirePlatformAdmin(actor);
    if (!allowed.ok) return allowed;

    const subscription = await this.admin.findById(subscriptionId);
    if (!subscription) return err(DomainError.notFound('Subscription not found'));

    const changed = change(subscription);
    if (!changed.ok) return changed;

    const saved = await this.admin.save(subscription);
    return saved.ok ? ok() : err(saved.error);
  }
}
