/**
 * The community catalog in the portability table (#360).
 *
 * Its items are the one place of the table a key does not start with a
 * subscription (INV-01): an entry is the platform's, `PK = CATALOG`. The
 * reports the operator once read lie in `PK = CATALOG#REPORTS`, read by
 * nothing since #439. The public
 * handler is granted the first partition and nothing else of the table, so
 * what it can read is what an entry says, and the subscription an entry names
 * is reached only through it (INV-02).
 */

import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { CatalogEntry, CatalogStore } from '../domain/CommunityCatalog.js';
import { parameterOf } from './dynamo.js';

type Item = Record<string, unknown>;

export const CATALOG_PARTITION = 'CATALOG';

async function queryAll(
  db: DynamoDBDocumentClient,
  tableName: string,
  partition: string,
): Promise<Item[]> {
  const items: Item[] = [];
  let from: Record<string, unknown> | undefined;
  do {
    const page = await db.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': partition },
        ExclusiveStartKey: from,
      }),
    );
    items.push(...((page.Items ?? []) as Item[]));
    from = page.LastEvaluatedKey;
  } while (from);
  return items;
}

export class DynamoCatalogStore implements CatalogStore {
  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async get(publicId: string): Promise<CatalogEntry | null> {
    const found = await this.db.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: CATALOG_PARTITION, SK: `MODEL#${publicId}` },
      }),
    );
    return found.Item ? entryOf(found.Item) : null;
  }

  async list(): Promise<CatalogEntry[]> {
    return (await queryAll(this.db, this.tableName, CATALOG_PARTITION)).map(entryOf);
  }

  async put(entry: CatalogEntry): Promise<void> {
    await this.db.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: CATALOG_PARTITION,
          SK: `MODEL#${entry.publicId}`,
          entity: 'CATALOG_ENTRY',
          ...entry,
        },
      }),
    );
  }

  async remove(publicId: string): Promise<void> {
    await this.db.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { PK: CATALOG_PARTITION, SK: `MODEL#${publicId}` },
      }),
    );
  }
}

function entryOf(item: Item): CatalogEntry {
  // An entry written before #431 listed versions, the newest first, each with
  // the parameters it declared: what it says of the model is read from the
  // newest one until it is said again.
  const versions = Array.isArray(item['versions']) ? (item['versions'] as Item[]) : [];
  const newest = versions[0];
  const declared = Array.isArray(item['parameters'])
    ? (item['parameters'] as Item[])
    : Array.isArray(newest?.['parameters'])
      ? (newest['parameters'] as Item[])
      : [];
  const publishedAt = String(item['publishedAt'] ?? '');
  return {
    publicId: String(item['publicId']),
    subscriptionId: String(item['subscriptionId']),
    notebookId: String(item['notebookId']),
    ownerUserId: String(item['ownerUserId'] ?? ''),
    authorName: String(item['authorName'] ?? ''),
    authorEmail: String(item['authorEmail'] ?? ''),
    name: String(item['name'] ?? ''),
    objective: String(item['objective'] ?? ''),
    description: String(item['description'] ?? ''),
    audience: String(item['audience'] ?? ''),
    language: String(item['language'] ?? ''),
    basedOn: item['basedOn'] ? String(item['basedOn']) : null,
    publishedAt,
    updatedAt: String(item['updatedAt'] ?? newest?.['createdAt'] ?? publishedAt),
    parameters: declared.map(parameterOf),
  };
}

export class InMemoryCatalogStore implements CatalogStore {
  private readonly entries = new Map<string, CatalogEntry>();
  async get(publicId: string): Promise<CatalogEntry | null> {
    return this.entries.get(publicId) ?? null;
  }
  async list(): Promise<CatalogEntry[]> {
    return [...this.entries.values()];
  }
  async put(entry: CatalogEntry): Promise<void> {
    this.entries.set(entry.publicId, entry);
  }
  async remove(publicId: string): Promise<void> {
    this.entries.delete(publicId);
  }
}
