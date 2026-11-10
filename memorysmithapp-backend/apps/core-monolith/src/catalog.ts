/**
 * The community catalog, joined where its parts meet (#360): the entries and
 * the reports in the portability table, whether the subscription an entry
 * names grants access, the edge cache of the public route, and the e-mail that
 * tells an author their model was withdrawn. Shared by the API, the public
 * handler and the in-memory wiring of the tests.
 */

import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { GetCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { ulid } from '@memorysmithapp/kernel';
import type { PublicCatalogUseCases } from '@memorysmithapp/svc-portability/adapters/catalog-http';
import type { CatalogOperatorUseCases } from '@memorysmithapp/svc-portability/adapters/catalog-http';
import {
  DismissReport,
  ListReports,
  ReadCatalogContents,
  ReadCatalogHistory,
  ReadCatalogModel,
  SearchCatalog,
  WithdrawByOperator,
  type AuthorNotifier,
  type CatalogCache,
  type CatalogReading,
  type ReadingOf,
  type SubscriptionAccess,
} from '@memorysmithapp/svc-portability/application/catalog';
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

/** The notice an author is sent when the operator withdraws a model, in both languages. */
export function withdrawalNotice(
  entry: Pick<CatalogEntry, 'name'>,
  reason: string,
): { subject: string; text: string } {
  return {
    subject: `Your model "${entry.name}" was withdrawn from the community`,
    text: [
      `The operator of MemorySmith withdrew your model "${entry.name}" from the community catalog.`,
      '',
      `Why: ${reason}`,
      '',
      'The model stays in your subscription, unchanged, and the notebooks created from it are not touched. You may publish it again once what was reported is addressed.',
      '',
      '—',
      '',
      `O operador do MemorySmith retirou o seu modelo "${entry.name}" do catálogo da comunidade.`,
      '',
      `Motivo: ${reason}`,
      '',
      'O modelo continua na sua assinatura, sem mudança, e os cadernos criados a partir dele não são tocados. Você pode publicá-lo de novo depois de tratar o que foi denunciado.',
    ].join('\n'),
  };
}

/**
 * Tells the author that the operator withdrew a model. The withdrawal stands
 * whether or not the message left: the log says which author was not told,
 * for the operator to tell them otherwise.
 */
abstract class AuthorNotice implements AuthorNotifier {
  async withdrawn(entry: CatalogEntry, reason: string): Promise<void> {
    try {
      await this.send(entry.authorEmail, withdrawalNotice(entry, reason));
    } catch (error) {
      console.error(
        JSON.stringify({
          event: 'catalog-withdrawal-unsent',
          publicId: entry.publicId,
          error: String(error),
        }),
      );
    }
  }

  protected abstract send(to: string, message: { subject: string; text: string }): Promise<void>;
}

/** Through SES, from the product's own address. */
export class SesAuthorNotifier extends AuthorNotice {
  constructor(
    private readonly sender: string,
    private readonly ses: SESv2Client = new SESv2Client({}),
  ) {
    super();
  }

  protected async send(to: string, message: { subject: string; text: string }): Promise<void> {
    await this.ses.send(
      new SendEmailCommand({
        FromEmailAddress: `MemorySmith <${this.sender}>`,
        Destination: { ToAddresses: [to] },
        Content: {
          Simple: {
            Subject: { Data: message.subject },
            Body: { Text: { Data: message.text } },
          },
        },
      }),
    );
  }
}

/**
 * Through the function that speaks to the organization's relay (#396), which
 * sends every message of an installation with `MAIL=smtp`: the same function
 * the pool's messages leave through, so the relay is reached from one place.
 */
export class RelayAuthorNotifier extends AuthorNotice {
  constructor(
    private readonly functionName: string,
    private readonly lambda: LambdaClient = new LambdaClient({}),
  ) {
    super();
  }

  protected async send(to: string, message: { subject: string; text: string }): Promise<void> {
    const answer = await this.lambda.send(
      new InvokeCommand({
        FunctionName: this.functionName,
        Payload: new TextEncoder().encode(JSON.stringify({ mail: { to, ...message } })),
      }),
    );
    if (answer.FunctionError) {
      throw new Error(`The mail function failed: ${new TextDecoder().decode(answer.Payload)}`);
    }
  }
}

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
