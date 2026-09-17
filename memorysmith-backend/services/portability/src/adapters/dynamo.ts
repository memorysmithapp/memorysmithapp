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
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { Transfer, TransferStore } from '../domain/Transfer.js';

type Item = Record<string, unknown>;

/** The attributes a caller may patch, and no key among them. */
const PATCHABLE = [
  'status',
  'finishedAt',
  'done',
  'total',
  'bytes',
  'key',
  'versionId',
  'failure',
  'notebookName',
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

  async addKeptBytes(delta: number): Promise<void> {
    if (delta === 0) return;
    await this.db.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: `S#${this.subscriptionId}`, SK: 'KEPT' },
        // `bytes` is a reserved word of DynamoDB, as `status` and `key` are:
        // every attribute of this table travels behind a name placeholder.
        UpdateExpression: 'SET #entity = :entity ADD #bytes :delta',
        ExpressionAttributeNames: { '#entity': 'entity', '#bytes': 'bytes' },
        ExpressionAttributeValues: { ':entity': 'KEPT', ':delta': delta },
      }),
    );
  }
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
  };
}

/** The transfers of a person, in memory, for the tests and the local harness. */
export class InMemoryTransferStore implements TransferStore {
  private readonly byUser = new Map<string, Map<string, Transfer>>();
  private kept = 0;

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

  async addKeptBytes(delta: number): Promise<void> {
    this.kept += delta;
  }
}
