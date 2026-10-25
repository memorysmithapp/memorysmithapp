/**
 * The community catalog, joined where its parts meet (#360): the entries and
 * the reports in the portability table, whether the subscription an entry
 * names grants access, the edge cache of the public route, and the e-mail that
 * tells an author their model was withdrawn. Shared by the API, the public
 * handler and the in-memory wiring of the tests.
 */

import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { GetCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { ulid } from '@memorysmithapp/kernel';
import type { PublicCatalogUseCases } from '@memorysmithapp/svc-portability/adapters/catalog-http';
import type { CatalogOperatorUseCases } from '@memorysmithapp/svc-portability/adapters/catalog-http';
import {
  DismissReport,
  ListReports,
  ReadCatalogModel,
  ReadCatalogVersion,
  SearchCatalog,
  WithdrawByOperator,
  type AuthorNotifier,
  type CatalogCache,
  type CatalogReading,
  type SubscriptionAccess,
} from '@memorysmithapp/svc-portability/application/catalog';
import type { VersionReader } from '@memorysmithapp/svc-portability/application/models';
import type {
  CatalogEntry,
  CatalogReports,
  CatalogStore,
} from '@memorysmithapp/svc-portability/domain/catalog';
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

/** Tells the author, from the product's own address, that the operator withdrew a model. */
export class SesAuthorNotifier implements AuthorNotifier {
  constructor(
    private readonly sender: string,
    private readonly ses: SESv2Client = new SESv2Client({}),
  ) {}

  async withdrawn(entry: CatalogEntry, reason: string): Promise<void> {
    try {
      await this.send(entry, reason);
    } catch (error) {
      // The withdrawal stands whether or not the message left: the log says
      // which author was not told, for the operator to tell them otherwise.
      console.error(
        JSON.stringify({
          event: 'catalog-withdrawal-unsent',
          publicId: entry.publicId,
          error: String(error),
        }),
      );
    }
  }

  private async send(entry: CatalogEntry, reason: string): Promise<void> {
    await this.ses.send(
      new SendEmailCommand({
        FromEmailAddress: `MemorySmith <${this.sender}>`,
        Destination: { ToAddresses: [entry.authorEmail] },
        Content: {
          Simple: {
            Subject: { Data: `Your model "${entry.name}" was withdrawn from the community` },
            Body: {
              Text: {
                Data: [
                  `The operator of MemorySmith withdrew your model "${entry.name}" from the community catalog.`,
                  '',
                  `Why: ${reason}`,
                  '',
                  'The model and its versions stay in your subscription, unchanged, and the notebooks created from it are not touched. You may publish it again once what was reported is addressed.',
                  '',
                  '—',
                  '',
                  `O operador do MemorySmith retirou o seu modelo "${entry.name}" do catálogo da comunidade.`,
                  '',
                  `Motivo: ${reason}`,
                  '',
                  'O modelo e as versões dele continuam na sua assinatura, sem mudança, e os cadernos criados a partir dele não são tocados. Você pode publicá-lo de novo depois de tratar o que foi denunciado.',
                ].join('\n'),
              },
            },
          },
        },
      }),
    );
  }
}

/** What reads the catalog for anybody, over the same use cases everywhere. */
export function publicCatalogUseCasesOf(
  reading: CatalogReading,
  versions: VersionReader,
): PublicCatalogUseCases {
  return {
    search: () => new SearchCatalog(reading),
    readModel: () => new ReadCatalogModel(reading),
    readVersion: () => new ReadCatalogVersion({ ...reading, versions }),
  };
}

export function catalogOperatorUseCasesOf(deps: {
  readonly catalog: CatalogStore;
  readonly reports: CatalogReports;
  readonly cache: CatalogCache;
  readonly notifier: AuthorNotifier;
}): CatalogOperatorUseCases {
  return {
    listReports: (actor) => new ListReports(deps, actor),
    withdraw: (actor) => new WithdrawByOperator(deps, actor),
    dismissReport: (actor) => new DismissReport(deps, actor),
  };
}

/**
 * A model notebook was deleted (#360): its catalog entry goes first, so the
 * public route stops answering before its versions are destroyed.
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
