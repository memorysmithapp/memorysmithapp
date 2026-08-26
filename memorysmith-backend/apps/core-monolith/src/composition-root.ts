/**
 * THE composition root (architecture-guide.md, sections 24 and 8.2).
 *
 * This is the one file that changes between the modular monolith and six
 * deployables. Contexts, aggregates, ports and folder structure are identical
 * in both shapes; what differs is who is wired to whom and over what.
 *
 * Two properties are enforced here and nowhere else:
 *
 *  1. REPOSITORIES ARE BUILT PER REQUEST, from the subscription in the token.
 *     There is no code path that builds one without a subscription, and the
 *     compiler is what says so (PE2).
 *  2. A PLATFORM SESSION CARRIES NO SUBSCRIPTION, so buildKnowledge() cannot
 *     even be called under it. The failure is a composition failure, not a
 *     role check (RN-SUB-016).
 */

import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { S3Client } from '@aws-sdk/client-s3';
import {
  Authorship,
  Role,
  type EventPublisher,
  type SubscriptionContext,
  type UserId,
} from '@memorysmith/kernel';
import {
  DynamoInviteRepository,
  DynamoOnboarding,
  DynamoPlatformAdmin,
  DynamoSubscriptionRepository,
  DynamoUserLinkRepository,
  DynamoWorkspaceRepository,
} from '@memorysmith/svc-access/adapters/dynamodb';
import { NULL_OUTBOX_SINK } from '@memorysmith/svc-access/adapters/items';
import {
  CachedRequestContext,
  ResolveRequestContext,
  type ResolvedContext,
} from '@memorysmith/svc-access/application/context';
import { ACCESS_LIMITS } from '@memorysmith/svc-access/domain/values';
import { DynamoNoteRepository } from '@memorysmith/svc-knowledge/adapters/notes';
import { DynamoVaultRepository } from '@memorysmith/svc-knowledge/adapters/vaults';
import { S3ContentStore } from '@memorysmith/svc-knowledge/adapters/content';

export interface Infrastructure {
  readonly db: DynamoDBDocumentClient;
  readonly s3: S3Client;
  readonly knowledgeTable: string;
  readonly accessTable: string;
  readonly contentBucket: string;
  readonly events: EventPublisher;
}

/** Everything the Access routes need, for one request. */
export function buildAccess(infra: Infrastructure, context: SubscriptionContext | null) {
  const links = new DynamoUserLinkRepository(infra.db, infra.accessTable);
  const onboarding = new DynamoOnboarding(infra.db, infra.accessTable, NULL_OUTBOX_SINK);
  const platform = new DynamoPlatformAdmin(infra.db, infra.accessTable, NULL_OUTBOX_SINK);

  // Subscription-scoped repositories only exist when there IS a subscription.
  const scoped = context
    ? {
        subscriptions: new DynamoSubscriptionRepository(
          context,
          infra.db,
          infra.accessTable,
          NULL_OUTBOX_SINK,
        ),
        workspaces: new DynamoWorkspaceRepository(
          context,
          infra.db,
          infra.accessTable,
          NULL_OUTBOX_SINK,
        ),
        invites: new DynamoInviteRepository(context, infra.db, infra.accessTable, NULL_OUTBOX_SINK),
      }
    : null;

  return { links, onboarding, platform, scoped };
}

/**
 * Knowledge repositories. The signature is what carries the guarantee: it
 * takes a SubscriptionContext, so a platform session has nothing to pass.
 */
export function buildKnowledge(infra: Infrastructure, context: SubscriptionContext) {
  return {
    vaults: new DynamoVaultRepository(context, infra.db, infra.knowledgeTable),
    notes: new DynamoNoteRepository(context, infra.db, infra.knowledgeTable),
    content: new S3ContentStore(context, infra.s3, infra.contentBucket),
  };
}

/** Stage 1 of authorization, cached for the declared five minutes. */
export function buildAuthorizer(
  infra: Infrastructure,
  context: SubscriptionContext,
): CachedRequestContext {
  const access = buildAccess(infra, context);
  if (!access.scoped) throw new Error('unreachable: a context was provided');
  return new CachedRequestContext(
    new ResolveRequestContext(access.scoped.subscriptions, access.scoped.workspaces),
    ACCESS_LIMITS.authorizerCacheSeconds,
  );
}

export function authorshipFor(user: UserId): Authorship {
  // A write through the UI carries no agent; the MCP adapter is the one that
  // fills that in (section 12.1).
  return Authorship.byHuman(user);
}

export function roleLookup(resolved: ResolvedContext): (workspaceId: string) => Role {
  return (workspaceId) => resolved.roles.get(workspaceId) ?? Role.NONE;
}
