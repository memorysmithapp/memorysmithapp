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

import {
  RESERVED_FRONTMATTER_KEYS,
  NOTEBOOK_DOCUMENT_ENTRY,
  notebookDocumentSchema,
} from '@memorysmith/contracts';
import type { NotebookDocument } from '@memorysmith/svc-portability/domain';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { S3Client } from '@aws-sdk/client-s3';
import { Role, type SubscriptionContext } from '@memorysmith/kernel';
import {
  DynamoConnectorBindingRepository,
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
import { ACCESS_LIMITS, StorageQuota } from '@memorysmith/svc-access/domain/values';
import { DynamoNoteRepository } from '@memorysmith/svc-knowledge/adapters/notes';
import { DynamoContentSlotRepository } from '@memorysmith/svc-knowledge/adapters/slots';
import { DynamoFolderNumbers } from '@memorysmith/svc-knowledge/adapters/numbers';
import { DynamoNotebookRepository } from '@memorysmith/svc-knowledge/adapters/notebooks';
import { S3ContentStore } from '@memorysmith/svc-knowledge/adapters/content';
import { DynamoStorageMeter } from '@memorysmith/svc-knowledge/adapters/storage';
import type { StorageState } from '@memorysmith/svc-knowledge/domain';
import { DynamoAuditTrail } from '@memorysmith/svc-audit/adapters/trail';
import { S3RevisionReader } from '@memorysmith/svc-audit/adapters/content';
import {
  DynamoContentIndex,
  DynamoFacetIndex,
  DynamoLinkGraph,
  DynamoStructureProjection,
} from '@memorysmith/svc-discovery/adapters/aws';
import { DynamoTransferStore } from '@memorysmith/svc-portability/adapters/dynamo';

export interface Infrastructure {
  readonly db: DynamoDBDocumentClient;
  readonly s3: S3Client;
  readonly knowledgeTable: string;
  readonly accessTable: string;
  readonly auditTable: string;
  readonly discoveryTable: string;
  /** Where the transfers of each person live (RN-PRT-019, RN-PRT-020). */
  readonly portabilityTable: string;
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
        connectors: buildConnectorBindings(infra, context),
      }
    : null;

  return { links, onboarding, platform, scoped };
}

/**
 * Knowledge repositories. The signature is what carries the guarantee: it
 * takes a SubscriptionContext, so a platform session has nothing to pass.
 */
/**
 * The one entry of a `.notebook` archive, validated against the schema the
 * contracts package publishes before a byte of it is written (RN-PRT-011).
 *
 * It lives here because the schema is zod and neither `domain/` nor
 * `application/` may import it — and because the version of the specification
 * the build implements is a fact of the composition root, not of the export.
 */
export function serializeNotebookDocument(document: unknown): { entry: string; content: string } {
  return {
    entry: NOTEBOOK_DOCUMENT_ENTRY,
    content: JSON.stringify(notebookDocumentSchema.parse(document), null, 2),
  };
}

/**
 * Reads a notebook document, validated against the published schema. The mirror
 * of `serializeNotebookDocument`, and here for the same reason: the schema is zod
 * and neither `domain/` nor `application/` may import it (RN-PRT-014).
 */
export function parseNotebookDocument(json: string): NotebookDocument {
  return notebookDocumentSchema.parse(JSON.parse(json)) as NotebookDocument;
}

export function buildKnowledge(infra: Infrastructure, context: SubscriptionContext) {
  return {
    notebooks: new DynamoNotebookRepository(context, infra.db, infra.knowledgeTable),
    notes: new DynamoNoteRepository(context, infra.db, infra.knowledgeTable),
    // The Guidance of a notebook and the Template of a folder, each an
    // aggregate of its own and locked on its own item (RN-KNW-044).
    slots: new DynamoContentSlotRepository(context, infra.db, infra.knowledgeTable),
    // The numbers each folder issues, one item per folder (RN-KNW-043).
    numbers: new DynamoFolderNumbers(context, infra.db, infra.knowledgeTable),
    content: new S3ContentStore(context, infra.s3, infra.contentBucket),
    storage: { current: () => readStorageBudget(infra, context) },
    // The one layer allowed to know which version of the specification the
    // product implements. The Notebook Context declares these names to the agent
    // (RN-AGT-025), and neither the domain nor the application reads a
    // specification to find them.
    reservedVocabulary: RESERVED_FRONTMATTER_KEYS,
  };
}

/**
 * The THREE halves of the budget, joined HERE and nowhere else: how much
 * content is stored is a Knowledge fact, how much the kept exports occupy is a
 * Portability one, and how much is allowed is an Access one. No context may
 * read the table of another, and joining them is exactly what a composition
 * root is for.
 *
 * A kept export counts because it is bytes the subscription asked to keep
 * (RN-SUB-021). What an import uploads does not: it is discarded the moment the
 * import ends, whichever way it ended (RN-PRT-014).
 *
 * A subscription that cannot be read falls back to the default quota rather
 * than to zero: a transient read failure must not present itself to the person
 * writing as "your plan is full".
 */
export async function readStorageBudget(
  infra: Infrastructure,
  context: SubscriptionContext,
): Promise<StorageState> {
  const meter = new DynamoStorageMeter(context, infra.db, infra.knowledgeTable);
  const platform = new DynamoPlatformAdmin(infra.db, infra.accessTable, NULL_OUTBOX_SINK);
  const transfers = buildTransfers(infra, context);
  const [usedBytes, keptBytes, subscription] = await Promise.all([
    meter.usedBytes(),
    transfers.keptBytes().catch(() => 0),
    platform.findById(context.subscriptionId).catch(() => null),
  ]);
  return {
    usedBytes: usedBytes + keptBytes,
    limitBytes: (subscription?.quota ?? StorageQuota.DEFAULT).bytes,
  };
}

/** The transfers of one subscription: the exports it keeps and the imports. */
export function buildTransfers(
  infra: Infrastructure,
  context: SubscriptionContext,
): DynamoTransferStore {
  return new DynamoTransferStore(infra.db, infra.portabilityTable, context.subscriptionId.value);
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
    facets: new DynamoFacetIndex(context.subscriptionId, infra.db, infra.discoveryTable),
    index: new DynamoContentIndex(context.subscriptionId, infra.db, infra.discoveryTable),
    structure: new DynamoStructureProjection(
      context.subscriptionId,
      infra.db,
      infra.discoveryTable,
    ),
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
 * The connector of each token of the connector proxy, under the subscription of
 * the token. Access owns it; the core reads it in process, where Access already
 * runs, and the proxy writes it through a route of Access (section 13.3).
 */
export function buildConnectorBindings(
  infra: Infrastructure,
  context: SubscriptionContext,
): DynamoConnectorBindingRepository {
  return new DynamoConnectorBindingRepository(context, infra.db, infra.accessTable);
}

/** The role the session holds in the subscription, owner above every member. */
export function roleOf(resolved: ResolvedContext): Role {
  return resolved.isOwner ? Role.OWNER : resolved.role;
}
