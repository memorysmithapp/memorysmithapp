/**
 * The Tables of a notebook and their rows (#366), in mv-knowledge.
 *
 * The schema is one item in the notebook's partition, beside the guard of its
 * name, both after `META` and so outside the range that loads the tree. The
 * rows are in a partition of the table's own, under the generation they belong
 * to, with the relay's count of them (`TSTAT`).
 *
 * A row write is one TransactWriteItems: the rows, the events, and a check on
 * the table item that it is at the version the rows were validated against and
 * not locked by an alteration. At most 50 rows, two events and the check: 53
 * of the 100 items a transaction takes.
 *
 * An alteration that rewrites the rows writes the next generation with
 * BatchWriteItem, which is not a transaction, and then moves the table to it
 * with one conditioned write. Until that write the old generation is the
 * table's and the new one is invisible; after it, the old one is. Whatever is
 * left of a generation that is not the table's is removed after the move, and
 * again by the purge.
 */

import {
  DomainError,
  type DomainEvent,
  err,
  Instant,
  NotebookId,
  ok,
  type Result,
  type SubscriptionContext,
  TableId,
} from '@memorysmithapp/kernel';
import type { DynamoDBDocumentClient, TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import {
  BatchGetCommand,
  BatchWriteCommand,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { Row } from '../../../domain/table/Row.js';
import { Table } from '../../../domain/table/Table.js';
import type { CellValue, Column } from '../../../domain/table/TableSchema.js';
import type { RowWrite, TableRepository, TableUsage } from '../../../domain/ports/index.js';
import { KnowledgeKeys } from './keys.js';
import { isTransactionCanceled } from './DynamoNotebookRepository.js';
import {
  outboxItem,
  parseAuthorship,
  serializeAuthorship,
  unwrapOrThrow,
  type Item,
} from './items.js';

type TransactItem = NonNullable<TransactWriteCommandInput['TransactItems']>[number];

/** How long an alteration holds a table while it rewrites the rows. */
const LOCK_MILLISECONDS = 120_000;
/** How many batches of rows travel at once while a generation is written. */
const PARALLEL_BATCHES = 8;

export class DynamoTableRepository implements TableRepository {
  private readonly keys: KnowledgeKeys;

  constructor(
    private readonly context: SubscriptionContext,
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {
    this.keys = new KnowledgeKeys(context.subscriptionId);
  }

  async findById(notebook: NotebookId, table: TableId): Promise<Table | null> {
    const found = await this.db.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: this.keys.notebook(notebook), SK: this.keys.table(table) },
        ConsistentRead: true,
      }),
    );
    const parsed = found.Item ? this.parse(found.Item as Item) : null;
    return parsed && !parsed.isDeleted ? parsed : null;
  }

  async findByName(notebook: NotebookId, name: string): Promise<Table | null> {
    const guard = await this.db.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: this.keys.notebook(notebook), SK: this.keys.tableNameGuard(name) },
        ConsistentRead: true,
      }),
    );
    const held = guard.Item?.['tableId'];
    if (!held) return null;
    return this.findById(notebook, unwrapOrThrow(TableId.create(String(held))));
  }

  async list(notebook: NotebookId): Promise<Table[]> {
    const items = await this.queryAll(this.keys.notebook(notebook), 'TABLE#');
    return items
      .map((item) => this.parse(item))
      .filter((table) => !table.isDeleted)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async usage(table: Table): Promise<TableUsage> {
    const found = await this.db.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: this.keys.tableRows(table.id), SK: this.keys.tableStat() },
      }),
    );
    return {
      rows: Math.max(0, Number(found.Item?.['rows'] ?? 0)),
      bytes: Math.max(0, Number(found.Item?.['bytes'] ?? 0)),
    };
  }

  async save(table: Table): Promise<Result<void, DomainError>> {
    const pk = this.keys.notebook(table.notebookId);
    const writes: TransactItem[] = [
      {
        Put: {
          TableName: this.tableName,
          Item: this.itemOf(table, pk),
          ConditionExpression: table.version === 0 ? 'attribute_not_exists(PK)' : 'version = :v',
          ...(table.version === 0 ? {} : { ExpressionAttributeValues: { ':v': table.version } }),
        },
      },
    ];

    const guard = (name: string): TransactItem => ({
      Put: {
        TableName: this.tableName,
        Item: {
          PK: pk,
          SK: this.keys.tableNameGuard(name),
          entity: 'TABLE_NAME',
          tableId: table.id.value,
          name,
        },
        ConditionExpression: 'attribute_not_exists(PK) OR tableId = :id',
        ExpressionAttributeValues: { ':id': table.id.value },
      },
    });
    if (table.version === 0) {
      writes.push(guard(table.name));
    } else {
      const before = await this.db.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { PK: pk, SK: this.keys.table(table.id) },
          ConsistentRead: true,
        }),
      );
      const was = String(before.Item?.['name'] ?? table.name);
      const renamed = this.keys.tableNameGuard(was) !== this.keys.tableNameGuard(table.name);
      if (table.isDeleted || renamed) {
        writes.push({
          Delete: { TableName: this.tableName, Key: { PK: pk, SK: this.keys.tableNameGuard(was) } },
        });
      }
      if (renamed && !table.isDeleted) writes.push(guard(table.name));
    }

    for (const event of table.pullEvents()) {
      writes.push({
        Put: {
          TableName: this.tableName,
          Item: outboxItem(event, pk, this.keys.event(event.eventId)),
        },
      });
    }

    try {
      await this.db.send(new TransactWriteCommand({ TransactItems: writes }));
      return ok(undefined);
    } catch (error) {
      if (isTransactionCanceled(error)) {
        const holder = await this.findByName(table.notebookId, table.name);
        if (holder && holder.id.value !== table.id.value) {
          return err(
            DomainError.conflict(
              `This notebook already has a table called "${table.name}"`,
              holder.id.value,
            ),
          );
        }
        return err(DomainError.conflict('The table changed while this write was in flight'));
      }
      throw error;
    }
  }

  async rows(table: Table): Promise<Row[]> {
    const items = await this.queryAll(
      this.keys.tableRows(table.id),
      this.keys.rowsOf(table.generation),
    );
    return items
      .map((item) => this.parseRow(item))
      .sort((a, b) => (a.seq < b.seq ? -1 : a.seq > b.seq ? 1 : 0));
  }

  async findRows(table: Table, rowIds: readonly string[]): Promise<Row[]> {
    const pk = this.keys.tableRows(table.id);
    const found: Row[] = [];
    for (let index = 0; index < rowIds.length; index += 100) {
      let keys: Item[] = rowIds
        .slice(index, index + 100)
        .map((rowId) => ({ PK: pk, SK: this.keys.row(table.generation, rowId) }));
      for (let attempt = 0; keys.length > 0 && attempt < 8; attempt++) {
        const answer = await this.db.send(
          new BatchGetCommand({
            RequestItems: { [this.tableName]: { Keys: keys, ConsistentRead: true } },
          }),
        );
        found.push(
          ...((answer.Responses?.[this.tableName] ?? []) as Item[]).map((item) =>
            this.parseRow(item),
          ),
        );
        keys = (answer.UnprocessedKeys?.[this.tableName]?.Keys ?? []) as Item[];
        if (keys.length > 0) await pause(attempt);
      }
      if (keys.length > 0) throw new Error('The rows of a table could not be read');
    }
    return found;
  }

  async writeRows(
    table: Table,
    writes: readonly RowWrite[],
    events: readonly DomainEvent[],
  ): Promise<Result<void, DomainError>> {
    const pk = this.keys.tableRows(table.id);
    const items: TransactItem[] = [
      {
        ConditionCheck: {
          TableName: this.tableName,
          Key: { PK: this.keys.notebook(table.notebookId), SK: this.keys.table(table.id) },
          ConditionExpression:
            'version = :v AND attribute_not_exists(deletedAt) AND (attribute_not_exists(lockedUntil) OR lockedUntil < :now)',
          ExpressionAttributeValues: { ':v': table.version, ':now': Instant.now().toISOString() },
        },
      },
    ];
    for (const write of writes) {
      if (write.kind === 'delete') {
        items.push({
          Delete: {
            TableName: this.tableName,
            Key: { PK: pk, SK: this.keys.row(table.generation, write.rowId) },
            ConditionExpression: 'version = :v',
            ExpressionAttributeValues: { ':v': write.expectedVersion },
          },
        });
        continue;
      }
      items.push({
        Put: {
          TableName: this.tableName,
          Item: this.rowItem(table, write.row, write.row.version + 1),
          ConditionExpression:
            write.kind === 'insert' ? 'attribute_not_exists(PK)' : 'version = :v',
          ...(write.kind === 'insert'
            ? {}
            : { ExpressionAttributeValues: { ':v': write.expectedVersion } }),
        },
      });
    }
    for (const event of events) {
      items.push({
        Put: {
          TableName: this.tableName,
          Item: outboxItem(event, pk, this.keys.event(event.eventId)),
        },
      });
    }

    try {
      await this.db.send(new TransactWriteCommand({ TransactItems: items }));
      return ok(undefined);
    } catch (error) {
      if (isTransactionCanceled(error)) {
        return err(
          DomainError.conflict(
            'The table or one of these rows changed while this write was in flight: read them and write again',
          ),
        );
      }
      throw error;
    }
  }

  async lock(table: Table): Promise<Result<Table, DomainError>> {
    const now = Instant.now();
    const until = unwrapOrThrow(
      Instant.fromEpochMillis(Date.parse(now.toISOString()) + LOCK_MILLISECONDS),
    );
    try {
      await this.db.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: this.keys.notebook(table.notebookId), SK: this.keys.table(table.id) },
          UpdateExpression: 'SET lockedUntil = :until, version = version + :one',
          ConditionExpression:
            'version = :v AND attribute_not_exists(deletedAt) AND (attribute_not_exists(lockedUntil) OR lockedUntil < :now)',
          ExpressionAttributeValues: {
            ':until': until.toISOString(),
            ':one': 1,
            ':v': table.version,
            ':now': now.toISOString(),
          },
        }),
      );
    } catch (error) {
      if ((error as { name?: string })?.name === 'ConditionalCheckFailedException') {
        return err(
          DomainError.conflict(
            'The table is being altered, or changed meanwhile: alter it again in a moment',
          ),
        );
      }
      throw error;
    }
    const locked = await this.findById(table.notebookId, table.id);
    return locked ? ok(locked) : err(DomainError.notFound('Table not found'));
  }

  async unlock(table: Table): Promise<void> {
    try {
      await this.db.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: this.keys.notebook(table.notebookId), SK: this.keys.table(table.id) },
          UpdateExpression: 'REMOVE lockedUntil SET version = version + :one',
          ConditionExpression: 'version = :v',
          ExpressionAttributeValues: { ':one': 1, ':v': table.version },
        }),
      );
    } catch (error) {
      // A lock nobody can release lapses on its own: that is why it has a deadline.
      if ((error as { name?: string })?.name !== 'ConditionalCheckFailedException') throw error;
    }
  }

  async replaceRows(next: Table, rows: readonly Row[]): Promise<Result<void, DomainError>> {
    const pk = this.keys.tableRows(next.id);
    const puts = rows.map((row) => ({
      PutRequest: { Item: this.rowItem(next, row, row.version + 1) },
    }));
    await this.batchWrite(puts);

    const saved = await this.save(next);
    if (!saved.ok) return saved;

    // What is left of every other generation goes now; the purge takes what a
    // failure here would leave.
    const stale = (await this.queryAll(pk, 'ROW#', true)).filter(
      (item) => !String(item['SK']).startsWith(this.keys.rowsOf(next.generation)),
    );
    await this.batchWrite(
      stale.map((item) => ({ DeleteRequest: { Key: { PK: item['PK'], SK: item['SK'] } } })),
    );
    return ok(undefined);
  }

  private async batchWrite(requests: Item[]): Promise<void> {
    const chunks: Item[][] = [];
    for (let index = 0; index < requests.length; index += 25)
      chunks.push(requests.slice(index, index + 25));
    for (let index = 0; index < chunks.length; index += PARALLEL_BATCHES) {
      await Promise.all(
        chunks.slice(index, index + PARALLEL_BATCHES).map(async (chunk) => {
          let pending = chunk;
          for (let attempt = 0; pending.length > 0 && attempt < 10; attempt++) {
            const answer = await this.db.send(
              new BatchWriteCommand({ RequestItems: { [this.tableName]: pending } }),
            );
            pending = (answer.UnprocessedItems?.[this.tableName] ?? []) as Item[];
            if (pending.length > 0) await pause(attempt);
          }
          if (pending.length > 0) throw new Error('The rows of a table could not be written');
        }),
      );
    }
  }

  private async queryAll(pk: string, prefix: string, keysOnly = false): Promise<Item[]> {
    const items: Item[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const response = await this.db.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
          ExpressionAttributeValues: { ':pk': pk, ':prefix': prefix },
          ...(keysOnly ? { ProjectionExpression: 'PK, SK' } : {}),
          ...(startKey ? { ExclusiveStartKey: startKey } : {}),
        }),
      );
      items.push(...((response.Items ?? []) as Item[]));
      startKey = response.LastEvaluatedKey;
    } while (startKey);
    return items;
  }

  private itemOf(table: Table, pk: string): Item {
    const item: Item = {
      PK: pk,
      SK: this.keys.table(table.id),
      entity: 'TABLE',
      tableId: table.id.value,
      notebookId: table.notebookId.value,
      name: table.name,
      description: table.description,
      columns: table.columns.map((column) => ({ ...column })),
      key: table.key ? [...table.key] : null,
      nextColumn: table.nextColumn,
      generation: table.generation,
      createdBy: serializeAuthorship(table.createdBy),
      updatedBy: serializeAuthorship(table.updatedBy),
      updatedAt: table.updatedBy.at.toISOString(),
      version: table.nextVersion(),
    };
    if (table.isDeleted) item['deletedAt'] = table.deletedAt?.toISOString();
    return item;
  }

  private parse(item: Item): Table {
    const deletedAt = item['deletedAt'];
    const lockedUntil = item['lockedUntil'];
    return Table.rehydrate({
      id: unwrapOrThrow(TableId.create(String(item['tableId']))),
      subscriptionId: this.context.subscriptionId,
      notebookId: unwrapOrThrow(NotebookId.create(String(item['notebookId']))),
      name: String(item['name']),
      description: String(item['description'] ?? ''),
      columns: ((item['columns'] as Item[] | undefined) ?? []).map(parseColumn),
      key: Array.isArray(item['key']) ? (item['key'] as string[]) : null,
      nextColumn: Number(item['nextColumn'] ?? 1),
      generation: Number(item['generation'] ?? 1),
      createdBy: parseAuthorship(item['createdBy']),
      updatedBy: parseAuthorship(item['updatedBy']),
      deletedAt: deletedAt ? unwrapOrThrow(Instant.fromISO(String(deletedAt))) : null,
      version: Number(item['version'] ?? 0),
      lockedUntil: lockedUntil ? unwrapOrThrow(Instant.fromISO(String(lockedUntil))) : null,
    });
  }

  private rowItem(table: Table, row: Row, version: number): Item {
    return {
      PK: this.keys.tableRows(table.id),
      SK: this.keys.row(table.generation, row.rowId),
      entity: 'ROW',
      rowId: row.rowId,
      // One attribute holding the values as text, so a number keeps every
      // digit it was written with and the bytes counted are the bytes kept.
      v: JSON.stringify(row.values),
      seq: row.seq,
      createdBy: serializeAuthorship(row.createdBy),
      updatedBy: serializeAuthorship(row.updatedBy),
      version,
    };
  }

  private parseRow(item: Item): Row {
    return {
      rowId: String(item['rowId']),
      values: JSON.parse(String(item['v'] ?? '{}')) as Record<string, CellValue>,
      seq: String(item['seq'] ?? ''),
      createdBy: parseAuthorship(item['createdBy']),
      updatedBy: parseAuthorship(item['updatedBy']),
      version: Number(item['version'] ?? 0),
    };
  }
}

function parseColumn(item: Item): Column {
  return {
    id: String(item['id']),
    name: String(item['name']),
    type: item['type'] as Column['type'],
    description: String(item['description'] ?? ''),
    required: item['required'] === true,
    default: (item['default'] ?? null) as CellValue | null,
    enum: Array.isArray(item['enum']) ? (item['enum'] as string[]) : null,
    minimum: item['minimum'] == null ? null : String(item['minimum']),
    maximum: item['maximum'] == null ? null : String(item['maximum']),
    maxLength: item['maxLength'] == null ? null : Number(item['maxLength']),
  };
}

function pause(attempt: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.min(1000, 25 * 2 ** attempt)));
}
