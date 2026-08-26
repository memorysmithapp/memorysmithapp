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
import type { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import {
  Authorship,
  AgentIdentity,
  Role,
  type SubscriptionContext,
  type UserId,
} from '@memorysmith/kernel';
import {
  DynamoInviteRepository,
  DynamoOnboarding,
  DynamoPlatformAdmin,
  DynamoSubscriptionRepository,
  DynamoUserLinkRepository,
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
import { DynamoAuditTrail } from '@memorysmith/svc-audit/adapters/trail';
import { S3RevisionReader } from '@memorysmith/svc-audit/adapters/content';
import {
  BedrockEmbedder,
  DynamoFacetIndex,
  DynamoLinkGraph,
  DynamoStructureProjection,
  DynamoVectorIndex,
} from '@memorysmith/svc-discovery/adapters/aws';

export interface Infrastructure {
  readonly db: DynamoDBDocumentClient;
  readonly s3: S3Client;
  readonly bedrock: BedrockRuntimeClient;
  readonly knowledgeTable: string;
  readonly accessTable: string;
  readonly auditTable: string;
  readonly discoveryTable: string;
  readonly contentBucket: string;
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

/** Audit reads. Writing is the consumer's job, in its own deployable. */
export function buildAudit(infra: Infrastructure, context: SubscriptionContext) {
  return {
    trail: new DynamoAuditTrail(infra.db, infra.auditTable, context.subscriptionId),
    revisions: new S3RevisionReader(context.subscriptionId, infra.s3, infra.contentBucket),
  };
}

export function buildDiscovery(infra: Infrastructure, context: SubscriptionContext) {
  return {
    graph: new DynamoLinkGraph(context.subscriptionId, infra.db, infra.discoveryTable),
    vectors: new DynamoVectorIndex(context.subscriptionId, infra.db, infra.discoveryTable),
    facets: new DynamoFacetIndex(context.subscriptionId, infra.db, infra.discoveryTable),
    structure: new DynamoStructureProjection(
      context.subscriptionId,
      infra.db,
      infra.discoveryTable,
    ),
    embedder: new BedrockEmbedder(infra.bedrock),
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
    new ResolveRequestContext(access.scoped.subscriptions),
    ACCESS_LIMITS.authorizerCacheSeconds,
  );
}

/**
 * A write through the UI carries no agent. A write through the MCP connector
 * arrives with the CIMD client_id in the token, and that is what becomes the
 * AgentIdentity: the authorship records the agent AND the human, with no side
 * channel to trust (RN-AGT-001, section 12.1).
 */
export function authorshipFor(user: UserId, clientId?: string | undefined): Authorship {
  const isConnector = Boolean(clientId && /^https?:\/\//i.test(clientId));
  if (!isConnector || !clientId) return Authorship.byHuman(user);

  const agent = AgentIdentity.create(clientId, clientId);
  return agent.ok ? Authorship.byAgent(user, agent.value) : Authorship.byHuman(user);
}

/** The role the session holds in the subscription, owner above every member. */
export function roleOf(resolved: ResolvedContext): Role {
  return resolved.isOwner ? Role.OWNER : resolved.role;
}
