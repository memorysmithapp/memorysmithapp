/**
 * Where the transfers of a subscription are kept (architecture-guide.md §16).
 *
 * The table is `mv-portability`, and it is the first one this context owns: an
 * export used to leave nothing behind but an object in the bucket that nothing
 * listed, and a transfer that reports its progress has to be somewhere both the
 * worker and the interface can reach.
 *
 *   PK  S#{subscriptionId}#USER#{userId}   SK  TRANSFER#{transferId}
 *   PK  S#{subscriptionId}                 SK  KEPT
 *   PK  S#{subscriptionId}                 SK  KEPT#{notebookId}
 *
 * **The partition carries the person**, which is the whole of RN-PRT-020: the
 * transfer of somebody else is a key that does not exist, so asking for one
 * answers as missing rather than as refused, and no listing can reveal a
 * notebook the reader may not see (rule 9). The counter of what the kept
 * exports occupy is of the SUBSCRIPTION, because the quota is (RN-SUB-021).
 */

import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { KeptUsage, Transfer, TransferStore } from '../domain/Transfer.js';

type Item = Record<string, unknown>;

/** The attributes a caller may patch, and no key among them. */
const PATCHABLE = [
  'status',
  // An import learns the identifier of the notebook it created only once the
  // worker has written it.
  'notebookId',
  'finishedAt',
  'done',
  'total',
  'bytes',
  'key',
  'versionId',
  'failure',
  'notebookName',
  'fileName',
] as const;

export class DynamoTransferStore implements TransferStore {
  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
    private readonly subscriptionId: string,
  ) {}

  private pk(userId: string): string {
    return `S#${this.subscriptionId}#USER#${userId}`;
  }

  private key(userId: string, transferId: string): Item {
    return { PK: this.pk(userId), SK: `TRANSFER#${transferId}` };
  }

  async put(transfer: Transfer): Promise<void> {
    await this.db.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          ...this.key(transfer.userId, transfer.transferId),
          entity: 'TRANSFER',
          ...transfer,
        },
      }),
    );
  }

  async get(userId: string, transferId: string): Promise<Transfer | null> {
    const found = await this.db.send(
      new GetCommand({
        TableName: this.tableName,
        Key: this.key(userId, transferId),
        ConsistentRead: true,
      }),
    );
    return found.Item ? transferOf(found.Item as Item) : null;
  }

  async list(userId: string): Promise<Transfer[]> {
    const answer = await this.db.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': this.pk(userId), ':prefix': 'TRANSFER#' },
        // The identifier is a ULID, so the sort key is already chronological:
        // newest first is the order the panel and the page read them in.
        ScanIndexForward: false,
      }),
    );
    return ((answer.Items ?? []) as Item[]).map(transferOf);
  }

  async patch(userId: string, transferId: string, changes: Partial<Transfer>): Promise<void> {
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {};
    const sets: string[] = [];
    for (const field of PATCHABLE) {
      if (!(field in changes)) continue;
      names[`#${field}`] = field;
      values[`:${field}`] = changes[field];
      sets.push(`#${field} = :${field}`);
    }
    if (sets.length === 0) return;

    await this.db
      .send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: this.key(userId, transferId),
          UpdateExpression: `SET ${sets.join(', ')}`,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          // A patch never creates: a transfer somebody deleted meanwhile stays
          // deleted, whatever the worker was in the middle of.
          ConditionExpression: 'attribute_exists(SK)',
        }),
      )
      .catch((error: { name?: string }) => {
        if (error?.name === 'ConditionalCheckFailedException') return;
        throw error;
      });
  }

  async remove(userId: string, transferId: string): Promise<void> {
    await this.db.send(
      new DeleteCommand({ TableName: this.tableName, Key: this.key(userId, transferId) }),
    );
  }

  async keptBytes(): Promise<number> {
    const found = await this.db.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: `S#${this.subscriptionId}`, SK: 'KEPT' },
        ConsistentRead: true,
      }),
    );
    return Number(found.Item?.['bytes'] ?? 0);
  }

  /**
   * The total and, beside it, the line of the notebook the export was made of
   * (RN-SUB-024). Two writes and not one transaction: both are counters a
   * recount rebuilds, and neither decides anything a person is refused over
   * but the total, which is the first.
   */
  async addKeptBytes(delta: number, notebookId: string | null = null): Promise<void> {
    if (delta === 0) return;
    const one = Math.sign(delta);
    await this.db.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: `S#${this.subscriptionId}`, SK: 'KEPT' },
        // `bytes` is a reserved word of DynamoDB, as `status` and `key` are:
        // every attribute of this table travels behind a name placeholder.
        UpdateExpression: 'SET #entity = :entity ADD #bytes :delta, #count :one',
        ExpressionAttributeNames: { '#entity': 'entity', '#bytes': 'bytes', '#count': 'count' },
        ExpressionAttributeValues: { ':entity': 'KEPT', ':delta': delta, ':one': one },
      }),
    );
    if (!notebookId) return;
    await this.db.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: `S#${this.subscriptionId}`, SK: `KEPT#${notebookId}` },
        UpdateExpression:
          'SET #entity = :entity, #notebookId = :notebookId ADD #bytes :delta, #count :one',
        ExpressionAttributeNames: {
          '#entity': 'entity',
          '#notebookId': 'notebookId',
          '#bytes': 'bytes',
          '#count': 'count',
        },
        ExpressionAttributeValues: {
          ':entity': 'KEPT_NOTEBOOK',
          ':notebookId': notebookId,
          ':delta': delta,
          ':one': one,
        },
      }),
    );
  }

  /** The total and every line per notebook, from the one partition of the subscription. */
  async keptUsage(): Promise<KeptUsage> {
    let count = 0;
    let bytes = 0;
    const byNotebook = new Map<string, { count: number; bytes: number }>();
    let startKey: Record<string, unknown> | undefined;
    do {
      const page = await this.db.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
          ExpressionAttributeValues: { ':pk': `S#${this.subscriptionId}`, ':prefix': 'KEPT' },
          ConsistentRead: true,
          ...(startKey ? { ExclusiveStartKey: startKey } : {}),
        }),
      );
      for (const item of (page.Items ?? []) as Item[]) {
        const line = { count: counter(item['count']), bytes: counter(item['bytes']) };
        if (item['SK'] === 'KEPT') {
          count = line.count;
          bytes = line.bytes;
        } else if (item['notebookId']) {
          byNotebook.set(String(item['notebookId']), line);
        }
      }
      startKey = page.LastEvaluatedKey;
    } while (startKey);
    return { count, bytes, byNotebook };
  }
}

/** What the kept exports of one subscription turned out to be (RN-SUB-024). */
export interface KeptMeasure {
  readonly subscriptionId: string;
  readonly count: number;
  readonly bytes: number;
  readonly byNotebook: ReadonlyMap<string, { count: number; bytes: number }>;
  /** Lines the table holds for a notebook no kept export is of any more. */
  readonly stale: readonly string[];
}

const SUBSCRIPTION_OF_TRANSFER = /^S#([^#]+)#USER#/;
const SUBSCRIPTION_OF_COUNTER = /^S#([^#]+)$/;

/**
 * The recount of what the kept exports occupy (RN-SUB-021, RN-SUB-024): the
 * counters of this table rebuilt from the transfers themselves, the same way
 * the storage of Knowledge is rebuilt from its items. It runs beside that
 * recount, from the same command and under the same IAM, and never as a route:
 * it reads every subscription at once.
 *
 * A kept export is a transfer of kind `export` that is `ready`: the counter
 * moves when its bytes exist, and leaves when it is deleted, which removes the
 * transfer.
 */
export class KeptRecount {
  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async measure(): Promise<KeptMeasure[]> {
    const totals = new Map<
      string,
      {
        count: number;
        bytes: number;
        byNotebook: Map<string, { count: number; bytes: number }>;
        lines: Set<string>;
      }
    >();
    const of = (subscriptionId: string) => {
      const found = totals.get(subscriptionId) ?? {
        count: 0,
        bytes: 0,
        byNotebook: new Map<string, { count: number; bytes: number }>(),
        lines: new Set<string>(),
      };
      totals.set(subscriptionId, found);
      return found;
    };

    let startKey: Record<string, unknown> | undefined;
    do {
      const page = await this.db.send(
        new ScanCommand({
          TableName: this.tableName,
          ProjectionExpression: 'PK, SK, entity, kind, #status, #bytes, notebookId',
          ExpressionAttributeNames: { '#status': 'status', '#bytes': 'bytes' },
          ...(startKey ? { ExclusiveStartKey: startKey } : {}),
        }),
      );
      for (const item of (page.Items ?? []) as Item[]) {
        const key = String(item['PK'] ?? '');
        if (item['entity'] === 'TRANSFER') {
          const subscriptionId = SUBSCRIPTION_OF_TRANSFER.exec(key)?.[1];
          if (!subscriptionId || item['kind'] !== 'export' || item['status'] !== 'ready') continue;
          const bytes = counter(item['bytes']);
          const total = of(subscriptionId);
          total.count += 1;
          total.bytes += bytes;
          const notebookId = item['notebookId'] ? String(item['notebookId']) : '';
          if (notebookId) {
            const line = total.byNotebook.get(notebookId) ?? { count: 0, bytes: 0 };
            total.byNotebook.set(notebookId, { count: line.count + 1, bytes: line.bytes + bytes });
          }
        } else if (item['entity'] === 'KEPT' || item['entity'] === 'KEPT_NOTEBOOK') {
          const subscriptionId = SUBSCRIPTION_OF_COUNTER.exec(key)?.[1];
          if (!subscriptionId) continue;
          const total = of(subscriptionId);
          const sortKey = String(item['SK'] ?? '');
          if (sortKey.startsWith('KEPT#')) total.lines.add(sortKey.slice('KEPT#'.length));
        }
      }
      startKey = page.LastEvaluatedKey;
    } while (startKey);

    return [...totals.entries()].map(([subscriptionId, total]) => ({
      subscriptionId,
      count: total.count,
      bytes: total.bytes,
      byNotebook: total.byNotebook,
      stale: [...total.lines].filter((notebookId) => !total.byNotebook.has(notebookId)).sort(),
    }));
  }

  /** Replaces the counters with what was measured, and removes the stale lines. */
  async apply(measured: readonly KeptMeasure[]): Promise<void> {
    for (const each of measured) {
      const partition = `S#${each.subscriptionId}`;
      await this.db.send(
        new PutCommand({
          TableName: this.tableName,
          Item: { PK: partition, SK: 'KEPT', entity: 'KEPT', bytes: each.bytes, count: each.count },
        }),
      );
      for (const [notebookId, line] of each.byNotebook) {
        await this.db.send(
          new PutCommand({
            TableName: this.tableName,
            Item: {
              PK: partition,
              SK: `KEPT#${notebookId}`,
              entity: 'KEPT_NOTEBOOK',
              notebookId,
              bytes: line.bytes,
              count: line.count,
            },
          }),
        );
      }
      for (const notebookId of each.stale) {
        await this.db.send(
          new DeleteCommand({
            TableName: this.tableName,
            Key: { PK: partition, SK: `KEPT#${notebookId}` },
          }),
        );
      }
    }
  }
}

/** A counter as it is read: never negative, whatever a lost delta did to it. */
function counter(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : 0;
}

function transferOf(item: Item): Transfer {
  return {
    transferId: String(item['transferId']),
    kind: item['kind'] === 'import' ? 'import' : 'export',
    status: item['status'] as Transfer['status'],
    userId: String(item['userId']),
    notebookId: item['notebookId'] ? String(item['notebookId']) : null,
    notebookName: String(item['notebookName'] ?? ''),
    requestedAt: String(item['requestedAt']),
    finishedAt: item['finishedAt'] ? String(item['finishedAt']) : null,
    done: Number(item['done'] ?? 0),
    total: Number(item['total'] ?? 0),
    bytes: Number(item['bytes'] ?? 0),
    key: item['key'] ? String(item['key']) : null,
    versionId: item['versionId'] ? String(item['versionId']) : null,
    failure: item['failure'] ? String(item['failure']) : null,
    fileName: item['fileName'] ? String(item['fileName']) : null,
  };
}

/** The transfers of a person, in memory, for the tests and the local harness. */
export class InMemoryTransferStore implements TransferStore {
  private readonly byUser = new Map<string, Map<string, Transfer>>();
  private kept = 0;
  private keptCount = 0;
  private readonly keptByNotebook = new Map<string, { count: number; bytes: number }>();

  private of(userId: string): Map<string, Transfer> {
    const found = this.byUser.get(userId) ?? new Map<string, Transfer>();
    this.byUser.set(userId, found);
    return found;
  }

  async put(transfer: Transfer): Promise<void> {
    this.of(transfer.userId).set(transfer.transferId, transfer);
  }

  async get(userId: string, transferId: string): Promise<Transfer | null> {
    return this.of(userId).get(transferId) ?? null;
  }

  async list(userId: string): Promise<Transfer[]> {
    return [...this.of(userId).values()].sort((a, b) =>
      a.transferId < b.transferId ? 1 : a.transferId > b.transferId ? -1 : 0,
    );
  }

  async patch(userId: string, transferId: string, changes: Partial<Transfer>): Promise<void> {
    const found = this.of(userId).get(transferId);
    if (!found) return;
    this.of(userId).set(transferId, { ...found, ...changes });
  }

  async remove(userId: string, transferId: string): Promise<void> {
    this.of(userId).delete(transferId);
  }

  async keptBytes(): Promise<number> {
    return this.kept;
  }

  async addKeptBytes(delta: number, notebookId: string | null = null): Promise<void> {
    if (delta === 0) return;
    this.kept += delta;
    this.keptCount += Math.sign(delta);
    if (!notebookId) return;
    const line = this.keptByNotebook.get(notebookId) ?? { count: 0, bytes: 0 };
    this.keptByNotebook.set(notebookId, {
      count: line.count + Math.sign(delta),
      bytes: line.bytes + delta,
    });
  }

  async keptUsage(): Promise<KeptUsage> {
    return {
      count: Math.max(0, this.keptCount),
      bytes: Math.max(0, this.kept),
      byNotebook: new Map(this.keptByNotebook),
    };
  }
}
