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
 *   PK  S#{subscriptionId}                 SK  TRANSIT
 *   PK  S#{subscriptionId}                 SK  TRANSIT#{notebookId}
 *
 * **The partition carries the person**, which is the whole of RN-PRT-020: the
 * transfer of somebody else is a key that does not exist, so asking for one
 * answers as missing rather than as refused, and no listing can reveal a
 * notebook the reader may not see (rule 9). The counter of what the kept
 * exports occupy is of the SUBSCRIPTION, because the quota is (RN-SUB-021),
 * and so is the one of what the open uploads reserve (RN-SUB-025).
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
import type {
  KeptUsage,
  Transfer,
  TransferRequest,
  TransferStore,
  TransferUpload,
} from '../domain/Transfer.js';

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
  // An upload whose notebook became unavailable is pointed at another one,
  // and its failure keeps what it was (RN-PRT-029).
  'upload',
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
    await this.move(COUNTERS.kept, delta, notebookId);
  }

  /** The total and every line per notebook, from the one partition of the subscription. */
  async keptUsage(): Promise<KeptUsage> {
    return this.usageOf(COUNTERS.kept);
  }

  /**
   * One entry of the map of parts, and the instant it arrived: a part that
   * arrives twice replaces its own entry and nobody else's (RN-PRT-027).
   */
  async recordPart(
    userId: string,
    transferId: string,
    part: number,
    versionId: string,
    at: string,
  ): Promise<void> {
    await this.db
      .send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: this.key(userId, transferId),
          UpdateExpression: 'SET #upload.#parts.#part = :version, #upload.#last = :at',
          ExpressionAttributeNames: {
            '#upload': 'upload',
            '#parts': 'parts',
            '#part': String(part),
            '#last': 'lastPartAt',
          },
          ExpressionAttributeValues: { ':version': versionId, ':at': at },
          ConditionExpression: 'attribute_exists(SK)',
        }),
      )
      .catch((error: { name?: string }) => {
        if (error?.name === 'ConditionalCheckFailedException') return;
        throw error;
      });
  }

  /** What the open uploads reserve moves with the declared size of one (RN-SUB-025). */
  async addTransitBytes(delta: number, notebookId: string | null): Promise<void> {
    await this.move(COUNTERS.transit, delta, notebookId);
  }

  async transitUsage(): Promise<KeptUsage> {
    return this.usageOf(COUNTERS.transit);
  }

  private async move(family: Counter, delta: number, notebookId: string | null): Promise<void> {
    if (delta === 0) return;
    const one = Math.sign(delta);
    await this.db.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: `S#${this.subscriptionId}`, SK: family.total },
        // `bytes` is a reserved word of DynamoDB, as `status` and `key` are:
        // every attribute of this table travels behind a name placeholder.
        UpdateExpression: 'SET #entity = :entity ADD #bytes :delta, #count :one',
        ExpressionAttributeNames: { '#entity': 'entity', '#bytes': 'bytes', '#count': 'count' },
        ExpressionAttributeValues: { ':entity': family.total, ':delta': delta, ':one': one },
      }),
    );
    if (!notebookId) return;
    await this.db.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: `S#${this.subscriptionId}`, SK: `${family.total}#${notebookId}` },
        UpdateExpression:
          'SET #entity = :entity, #notebookId = :notebookId ADD #bytes :delta, #count :one',
        ExpressionAttributeNames: {
          '#entity': 'entity',
          '#notebookId': 'notebookId',
          '#bytes': 'bytes',
          '#count': 'count',
        },
        ExpressionAttributeValues: {
          ':entity': family.line,
          ':notebookId': notebookId,
          ':delta': delta,
          ':one': one,
        },
      }),
    );
  }

  private async usageOf(family: Counter): Promise<KeptUsage> {
    let count = 0;
    let bytes = 0;
    const byNotebook = new Map<string, { count: number; bytes: number }>();
    let startKey: Record<string, unknown> | undefined;
    do {
      const page = await this.db.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
          ExpressionAttributeValues: {
            ':pk': `S#${this.subscriptionId}`,
            ':prefix': family.total,
          },
          ConsistentRead: true,
          ...(startKey ? { ExclusiveStartKey: startKey } : {}),
        }),
      );
      for (const item of (page.Items ?? []) as Item[]) {
        const line = { count: counter(item['count']), bytes: counter(item['bytes']) };
        if (item['SK'] === family.total) {
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

/**
 * The two counters of this table, each a total and a line per notebook: what
 * the kept exports occupy, and what the open uploads reserve. They live in the
 * one partition of the subscription and never share a prefix the query of the
 * other would read.
 */
interface Counter {
  readonly total: 'KEPT' | 'TRANSIT';
  readonly line: 'KEPT_NOTEBOOK' | 'TRANSIT_NOTEBOOK';
}

const COUNTERS = {
  kept: { total: 'KEPT', line: 'KEPT_NOTEBOOK' },
  transit: { total: 'TRANSIT', line: 'TRANSIT_NOTEBOOK' },
} as const satisfies Record<string, Counter>;

/** What one counter of one subscription turned out to be. */
export interface CounterMeasure {
  readonly count: number;
  readonly bytes: number;
  readonly byNotebook: ReadonlyMap<string, { count: number; bytes: number }>;
  /** Lines the table holds for a notebook nothing counted is of any more. */
  readonly stale: readonly string[];
}

/**
 * What the kept exports of one subscription turned out to be (RN-SUB-024), and
 * beside them what its open uploads reserve (RN-SUB-025).
 */
export interface KeptMeasure extends CounterMeasure {
  readonly subscriptionId: string;
  readonly transit: CounterMeasure;
}

const SUBSCRIPTION_OF_TRANSFER = /^S#([^#]+)#USER#/;
const SUBSCRIPTION_OF_COUNTER = /^S#([^#]+)$/;

/** A counter being measured: the totals found and the lines the table holds. */
class Tally {
  count = 0;
  bytes = 0;
  readonly byNotebook = new Map<string, { count: number; bytes: number }>();
  readonly lines = new Set<string>();

  add(bytes: number, notebookId: string): void {
    this.count += 1;
    this.bytes += bytes;
    if (!notebookId) return;
    const line = this.byNotebook.get(notebookId) ?? { count: 0, bytes: 0 };
    this.byNotebook.set(notebookId, { count: line.count + 1, bytes: line.bytes + bytes });
  }

  measure(): CounterMeasure {
    return {
      count: this.count,
      bytes: this.bytes,
      byNotebook: this.byNotebook,
      stale: [...this.lines].filter((notebookId) => !this.byNotebook.has(notebookId)).sort(),
    };
  }
}

/**
 * The recount of what the kept exports occupy (RN-SUB-021, RN-SUB-024): the
 * counters of this table rebuilt from the transfers themselves, the same way
 * the storage of Knowledge is rebuilt from its items. It runs beside that
 * recount, from the same command and under the same IAM, and never as a route:
 * it reads every subscription at once.
 *
 * A kept export is a transfer of kind `export` that is `ready`: the counter
 * moves when its bytes exist, and leaves when it is deleted, which removes the
 * transfer. An open upload is a transfer of kind `agent` that is `running`,
 * and what it reserves is the size it declared (RN-SUB-025).
 */
export class KeptRecount {
  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async measure(): Promise<KeptMeasure[]> {
    const totals = new Map<string, { kept: Tally; transit: Tally }>();
    const of = (subscriptionId: string) => {
      const found = totals.get(subscriptionId) ?? { kept: new Tally(), transit: new Tally() };
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
        const notebookId = item['notebookId'] ? String(item['notebookId']) : '';
        if (item['entity'] === 'TRANSFER') {
          const subscriptionId = SUBSCRIPTION_OF_TRANSFER.exec(key)?.[1];
          if (!subscriptionId) continue;
          if (item['kind'] === 'export' && item['status'] === 'ready') {
            of(subscriptionId).kept.add(counter(item['bytes']), notebookId);
          } else if (item['kind'] === 'agent' && item['status'] === 'running') {
            of(subscriptionId).transit.add(counter(item['bytes']), notebookId);
          }
          continue;
        }
        const subscriptionId = SUBSCRIPTION_OF_COUNTER.exec(key)?.[1];
        if (!subscriptionId) continue;
        const sortKey = String(item['SK'] ?? '');
        if (sortKey.startsWith('KEPT#')) of(subscriptionId).kept.lines.add(sortKey.slice(5));
        else if (sortKey.startsWith('TRANSIT#')) {
          of(subscriptionId).transit.lines.add(sortKey.slice(8));
        } else if (sortKey === 'KEPT' || sortKey === 'TRANSIT') of(subscriptionId);
      }
      startKey = page.LastEvaluatedKey;
    } while (startKey);

    return [...totals.entries()].map(([subscriptionId, total]) => ({
      subscriptionId,
      ...total.kept.measure(),
      transit: total.transit.measure(),
    }));
  }

  /** Replaces the counters with what was measured, and removes the stale lines. */
  async apply(measured: readonly KeptMeasure[]): Promise<void> {
    for (const each of measured) {
      await this.write(each.subscriptionId, COUNTERS.kept, each);
      await this.write(each.subscriptionId, COUNTERS.transit, each.transit);
    }
  }

  private async write(subscriptionId: string, family: Counter, measured: CounterMeasure) {
    const partition = `S#${subscriptionId}`;
    await this.db.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: partition,
          SK: family.total,
          entity: family.total,
          bytes: measured.bytes,
          count: measured.count,
        },
      }),
    );
    for (const [notebookId, line] of measured.byNotebook) {
      await this.db.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            PK: partition,
            SK: `${family.total}#${notebookId}`,
            entity: family.line,
            notebookId,
            bytes: line.bytes,
            count: line.count,
          },
        }),
      );
    }
    for (const notebookId of measured.stale) {
      await this.db.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { PK: partition, SK: `${family.total}#${notebookId}` },
        }),
      );
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
    kind:
      item['kind'] === 'import' || item['kind'] === 'agent' || item['kind'] === 'request'
        ? item['kind']
        : 'export',
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
    ...(item['upload'] ? { upload: uploadOf(item['upload'] as Item) } : {}),
    ...(item['request'] ? { request: requestOf(item['request'] as Item) } : {}),
  };
}

function requestOf(item: Item): TransferRequest {
  return {
    mimeType: String(item['mimeType'] ?? ''),
    description: String(item['description'] ?? ''),
    tags: Array.isArray(item['tags']) ? (item['tags'] as unknown[]).map(String) : [],
    path: String(item['path'] ?? ''),
    purpose: String(item['purpose'] ?? ''),
    platform: item['platform'] ? String(item['platform']) : null,
    expectedSize:
      item['expectedSize'] === null || item['expectedSize'] === undefined
        ? null
        : Number(item['expectedSize']),
    expectedSha256: item['expectedSha256'] ? String(item['expectedSha256']) : null,
  };
}

function uploadOf(item: Item): TransferUpload {
  const parts: Record<string, string> = {};
  for (const [part, version] of Object.entries((item['parts'] as Item | undefined) ?? {})) {
    parts[part] = String(version);
  }
  return {
    mimeType: String(item['mimeType'] ?? ''),
    description: String(item['description'] ?? ''),
    tags: Array.isArray(item['tags']) ? (item['tags'] as unknown[]).map(String) : [],
    path: String(item['path'] ?? ''),
    purpose: String(item['purpose'] ?? ''),
    platform: item['platform'] ? String(item['platform']) : null,
    transport: item['transport'] === 'inline' ? 'inline' : 'url',
    sha256: String(item['sha256'] ?? ''),
    partSize: Number(item['partSize'] ?? 0),
    partCount: Number(item['partCount'] ?? 0),
    multipartId: item['multipartId'] ? String(item['multipartId']) : null,
    parts,
    assembled: item['assembled'] ? String(item['assembled']) : null,
    lastPartAt: item['lastPartAt'] ? String(item['lastPartAt']) : null,
    fulfils: item['fulfils'] ? String(item['fulfils']) : null,
  };
}

/** The transfers of a person, in memory, for the tests and the local harness. */
export class InMemoryTransferStore implements TransferStore {
  private readonly byUser = new Map<string, Map<string, Transfer>>();
  private readonly kept = new MemoryCounter();
  private readonly transit = new MemoryCounter();

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
    return this.kept.bytes;
  }

  async addKeptBytes(delta: number, notebookId: string | null = null): Promise<void> {
    this.kept.move(delta, notebookId);
  }

  async keptUsage(): Promise<KeptUsage> {
    return this.kept.usage();
  }

  async recordPart(
    userId: string,
    transferId: string,
    part: number,
    versionId: string,
    at: string,
  ): Promise<void> {
    const found = this.of(userId).get(transferId);
    if (!found?.upload) return;
    this.of(userId).set(transferId, {
      ...found,
      upload: {
        ...found.upload,
        parts: { ...found.upload.parts, [String(part)]: versionId },
        lastPartAt: at,
      },
    });
  }

  async addTransitBytes(delta: number, notebookId: string | null): Promise<void> {
    this.transit.move(delta, notebookId);
  }

  async transitUsage(): Promise<KeptUsage> {
    return this.transit.usage();
  }
}

/** A total and its lines per notebook, as the table keeps them, in memory. */
class MemoryCounter {
  bytes = 0;
  private count = 0;
  private readonly byNotebook = new Map<string, { count: number; bytes: number }>();

  move(delta: number, notebookId: string | null): void {
    if (delta === 0) return;
    this.bytes += delta;
    this.count += Math.sign(delta);
    if (!notebookId) return;
    const line = this.byNotebook.get(notebookId) ?? { count: 0, bytes: 0 };
    this.byNotebook.set(notebookId, {
      count: line.count + Math.sign(delta),
      bytes: line.bytes + delta,
    });
  }

  usage(): KeptUsage {
    return {
      count: Math.max(0, this.count),
      bytes: Math.max(0, this.bytes),
      byNotebook: new Map(this.byNotebook),
    };
  }
}
