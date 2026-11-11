/**
 * The community catalog, joined where its parts meet (#360): its entries in
 * the portability table, whether the subscription an entry names grants
 * access, and the edge cache of the public route. Shared by the API, the
 * public handler and the in-memory wiring of the tests. Only an author
 * withdraws a model, and nobody reports one (#439).
 */

import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { GetCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { ulid } from '@memorysmithapp/kernel';
import type { PublicCatalogUseCases } from '@memorysmithapp/svc-portability/adapters/catalog-http';
import {
  ReadCatalogContents,
  ReadCatalogHistory,
  ReadCatalogModel,
  SearchCatalog,
  type CatalogCache,
  type CatalogReading,
  type ReadingOf,
  type SubscriptionAccess,
} from '@memorysmithapp/svc-portability/application/catalog';
import type { CatalogStore } from '@memorysmithapp/svc-portability/domain/catalog';
import type { ModelStore } from '@memorysmithapp/svc-portability/domain/model';

/** Only trial and active grant access to anybody (RN-SUB-007). */
const GRANTING = new Set(['trial', 'active']);

/**
 * Whether a subscription grants access, read as its status and nothing else:
 * the public handler is granted that one attribute of the access table.
 */
export class DynamoSubscriptionAccess implements SubscriptionAccess {
  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly accessTable: string,
  ) {}

  async grants(subscriptionId: string): Promise<boolean> {
    const found = await this.db.send(
      new GetCommand({
        TableName: this.accessTable,
        Key: { PK: `S#${subscriptionId}`, SK: 'META' },
        ProjectionExpression: '#status',
        ExpressionAttributeNames: { '#status': 'status' },
      }),
    );
    return GRANTING.has(String(found.Item?.['status'] ?? ''));
  }
}

/** The edge cache of the public route, emptied whole of the catalog on a withdrawal. */
export class CloudFrontCatalogCache implements CatalogCache {
  constructor(
    private readonly distributionId: string,
    private readonly cloudfront: CloudFrontClient = new CloudFrontClient({}),
  ) {}

  async invalidate(): Promise<void> {
    await this.cloudfront.send(
      new CreateInvalidationCommand({
        DistributionId: this.distributionId,
        InvalidationBatch: {
          CallerReference: ulid(),
          // The search lists every model, so a withdrawal reaches past its own page.
          Paths: { Quantity: 1, Items: ['/public/catalog*'] },
        },
      }),
    );
  }
}

/** Where there is no edge, as on a workstation and in the tests. */
export const NO_EDGE_CACHE: CatalogCache = { invalidate: async () => undefined };

/** What reads the catalog for anybody, over the same use cases everywhere. */
export function publicCatalogUseCasesOf(
  reading: CatalogReading,
  readingOf: ReadingOf,
): PublicCatalogUseCases {
  return {
    search: () => new SearchCatalog(reading),
    readModel: () => new ReadCatalogModel(reading),
    readContents: () => new ReadCatalogContents({ ...reading, readingOf }),
    readHistory: () => new ReadCatalogHistory({ ...reading, readingOf }),
  };
}

/**
 * A model notebook was deleted (#360): its catalog entry goes first, so the
 * public route stops answering before the model is forgotten.
 */
export async function forgetPublication(
  deps: {
    readonly models: ModelStore;
    readonly catalog: CatalogStore;
    readonly cache: CatalogCache;
  },
  notebookId: string,
): Promise<void> {
  const model = await deps.models.get(notebookId);
  if (!model?.publicId) return;
  await deps.catalog.remove(model.publicId);
  await deps.cache.invalidate(model.publicId);
}
