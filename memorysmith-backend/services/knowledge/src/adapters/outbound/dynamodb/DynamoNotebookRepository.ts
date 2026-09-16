/**
 * DynamoNotebookRepository: form A of the transaction, the tree mutation
 * (architecture-guide.md, section 10.1).
 *
 * One TransactWriteItems carries:
 *   1. the META item with ConditionExpression version = :expected, which is
 *      the optimistic lock of the aggregate;
 *   2. the affected folder items;
 *   3. the slug guards with attribute_not_exists, which puts I1 in the
 *      database and not only in memory;
 *   4. the domain events, into the outbox, in the same transaction.
 *
 * The subscription belongs to the repository, resolved per request from the
 * token claim; it is never a method argument (PE2).
 */

import {
  ConcurrencyError,
  ok,
  type Result,
  type Slug,
  type SubscriptionContext,
  NotebookId,
} from '@memorysmith/kernel';
import type { DynamoDBDocumentClient, TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import {
  BatchWriteCommand,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import type { Notebook } from '../../../domain/notebook/Notebook.js';
import type { NotebookRepository } from '../../../domain/ports/index.js';
import { AGGREGATE_RANGE_END, AGGREGATE_RANGE_START, KnowledgeKeys } from './keys.js';
import { folderItem, outboxItem, parseNotebook, notebookMetaItem, type Item } from './items.js';

type TransactItem = NonNullable<TransactWriteCommandInput['TransactItems']>[number];

/** What the aggregate looked like when it was loaded, for the write diff. */
interface Snapshot {
  version: number;
  /** The slug as it was loaded: a change means the guard has to move. */
  slug: string;
  /** Whether it was deleted when loaded: crossing that line moves the guard. */
  deleted: boolean;
  folders: Map<string, { parentFolderId: string | null; slug: string }>;
  limits: Set<string>;
}

const MAX_TRANSACT_ITEMS = 100;

export class DynamoNotebookRepository implements NotebookRepository {
  private readonly keys: KnowledgeKeys;
  private readonly snapshots = new Map<string, Snapshot>();

  constructor(
    private readonly sub: SubscriptionContext,
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {
    this.keys = new KnowledgeKeys(sub.subscriptionId);
  }

  /**
   * ONE Query brings the whole aggregate back: folders, counters, ceilings and
   * the META item, because the sort keys were chosen to sit in that order
   * (section 9.3).
   */
  async findById(id: NotebookId): Promise<Notebook | null> {
    const response = await this.db.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND SK BETWEEN :from AND :to',
        ExpressionAttributeValues: {
          ':pk': this.keys.notebook(id),
          ':from': AGGREGATE_RANGE_START,
          ':to': AGGREGATE_RANGE_END,
        },
      }),
    );
    const items = (response.Items ?? []) as Item[];
    const notebook = parseNotebook(items, this.sub.subscriptionId);
    if (notebook) this.snapshots.set(notebook.id.value, snapshotOf(notebook));
    return notebook;
  }

  /** Reads the guard item, which IS the index from slug to notebook. */
  async findBySlug(slug: Slug): Promise<Notebook | null> {
    const guard = await this.db.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: this.keys.subscriptionNotebooks(),
          SK: this.keys.notebookSlugGuard(slug.value),
        },
      }),
    );
    const notebookId = guard.Item?.['notebookId'];
    if (!notebookId) return null;
    const parsed = NotebookId.create(String(notebookId));
    return parsed.ok ? this.findById(parsed.value) : null;
  }

  /**
   * Every notebook of the subscription, from ONE partition of GSI1, already
   * carrying the note count. This used to be a question about a workspace,
   * and answering it once meant querying a partition that never existed.
   */
  async listAll(): Promise<Notebook[]> {
    const response = await this.db.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: { ':pk': this.keys.subscriptionNotebooks() },
      }),
    );
    const items = (response.Items ?? []) as Item[];
    const counts = new Map<string, number>();
    for (const item of items) {
      const sk = String(item['GSI1SK'] ?? '');
      if (sk.startsWith('NBSTAT#'))
        counts.set(String(item['notebookId']), Number(item['noteCount'] ?? 0));
    }
    const notebooks: Notebook[] = [];
    for (const item of items) {
      if (!String(item['GSI1SK'] ?? '').startsWith('NOTEBOOK#')) continue;
      const notebook = parseNotebook(
        [item, { SK: 'FSTAT', noteCount: counts.get(String(item['notebookId'])) ?? 0 }],
        this.sub.subscriptionId,
      );
      if (notebook) {
        this.snapshots.set(notebook.id.value, snapshotOf(notebook));
        notebooks.push(notebook);
      }
    }
    return notebooks;
  }

  async save(notebook: Notebook): Promise<Result<void, ConcurrencyError>> {
    const pk = this.keys.notebook(notebook.id);
    const snapshot = this.snapshots.get(notebook.id.value);
    const events = notebook.pullEvents();

    const conditional: TransactItem[] = [];
    const bulk: TransactItem[] = [];

    // 1. The META item, with the optimistic lock of the aggregate.
    conditional.push({
      Put: {
        TableName: this.tableName,
        Item: {
          ...notebookMetaItem(notebook, pk),
          // GSI1 is sparse: a deleted notebook carries no index attributes, so it
          // leaves `listAll` with no filter anywhere, the way a deleted note
          // leaves GSI2.
          ...(notebook.isDeleted
            ? {}
            : {
                GSI1PK: this.keys.subscriptionNotebooks(),
                GSI1SK: this.keys.gsi1Notebook(notebook.id),
              }),
        },
        ...(snapshot
          ? {
              ConditionExpression: 'version = :expected',
              ExpressionAttributeValues: { ':expected': snapshot.version },
            }
          : { ConditionExpression: 'attribute_not_exists(PK)' }),
      },
    });

    /**
     * The slug guard, which is what makes RN-KNW-032 a database rule instead
     * of a check that races. It sits in the notebooks partition of the
     * subscription, so two notebooks of the SAME subscription collide and two of
     * different subscriptions never meet. A rename moves it: delete the old
     * key and claim the new one, both in this transaction, so a failed rename
     * leaves neither half behind.
     */
    const guardPk = this.keys.subscriptionNotebooks();
    const claimGuard = (slug: string): TransactItem => ({
      Put: {
        TableName: this.tableName,
        Item: {
          PK: guardPk,
          SK: this.keys.notebookSlugGuard(slug),
          entity: 'NBSLUG',
          notebookId: notebook.id.value,
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      },
    });
    const releaseGuard = (slug: string): TransactItem => ({
      Delete: {
        TableName: this.tableName,
        Key: { PK: guardPk, SK: this.keys.notebookSlugGuard(slug) },
      },
    });

    if (!snapshot) {
      conditional.push(claimGuard(notebook.slug.value));
    } else if (!snapshot.deleted && notebook.isDeleted) {
      // Deleting frees the name, exactly as deleting a note frees its slug.
      conditional.push(releaseGuard(snapshot.slug));
    } else if (snapshot.deleted && !notebook.isDeleted) {
      // Restoring claims it back, and fails if someone took it meanwhile.
      conditional.push(claimGuard(notebook.slug.value));
    } else if (snapshot.slug !== notebook.slug.value) {
      conditional.push({
        Delete: {
          TableName: this.tableName,
          Key: { PK: guardPk, SK: this.keys.notebookSlugGuard(snapshot.slug) },
        },
      });
      conditional.push({
        Put: {
          TableName: this.tableName,
          Item: {
            PK: guardPk,
            SK: this.keys.notebookSlugGuard(notebook.slug.value),
            entity: 'NBSLUG',
            notebookId: notebook.id.value,
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      });
    }

    // A brand new notebook also gets its counter item, which GSI1 projects as
    // NBSTAT# so that listing notebooks already carries the note count.
    if (!snapshot) {
      conditional.push({
        Put: {
          TableName: this.tableName,
          Item: {
            PK: pk,
            SK: this.keys.notebookStat(),
            entity: 'NBSTAT',
            notebookId: notebook.id.value,
            noteCount: 0,
            updatedAt: notebook.updatedAt.toISOString(),
            GSI1PK: this.keys.subscriptionNotebooks(),
            GSI1SK: this.keys.gsi1NotebookStat(notebook.id),
          },
        },
      });
    }

    // 2. Folders: added, changed and removed, against the loaded snapshot.
    const previous =
      snapshot?.folders ?? new Map<string, { parentFolderId: string | null; slug: string }>();
    const current = new Map(notebook.folders.all().map((folder) => [folder.id.value, folder]));

    for (const [id, folder] of current) {
      const before = previous.get(id);
      const target = folder.parentFolderId?.value ?? null;
      bulk.push({
        Put: {
          TableName: this.tableName,
          Item: folderItem(folder, pk, this.keys.folder(folder.id)),
        },
      });
      if (!before) {
        // 3. The slug guard: I1 enforced by the database (RN-KNW-002).
        conditional.push({
          Put: {
            TableName: this.tableName,
            Item: {
              PK: pk,
              SK: this.keys.folderSlugGuard(folder.parentFolderId, folder.slug.value),
              entity: 'SLUG',
              folderId: id,
            },
            ConditionExpression: 'attribute_not_exists(SK)',
          },
        });
      } else if (before.slug !== folder.slug.value || before.parentFolderId !== target) {
        bulk.push({
          Delete: {
            TableName: this.tableName,
            Key: {
              PK: pk,
              SK: `SLUG#${before.parentFolderId ?? 'ROOT'}#${before.slug}`,
            },
          },
        });
        conditional.push({
          Put: {
            TableName: this.tableName,
            Item: {
              PK: pk,
              SK: this.keys.folderSlugGuard(folder.parentFolderId, folder.slug.value),
              entity: 'SLUG',
              folderId: id,
            },
            ConditionExpression: 'attribute_not_exists(SK)',
          },
        });
      }
    }

    for (const [id, before] of previous) {
      if (current.has(id)) continue;
      bulk.push(
        { Delete: { TableName: this.tableName, Key: { PK: pk, SK: `FOLDER#${id}` } } },
        {
          Delete: {
            TableName: this.tableName,
            Key: { PK: pk, SK: `SLUG#${before.parentFolderId ?? 'ROOT'}#${before.slug}` },
          },
        },
        { Delete: { TableName: this.tableName, Key: { PK: pk, SK: `FSTAT#${id}` } } },
        // The numbers of the folder go with it; its identifier is never reused,
        // so no later folder can issue them again (RN-KNW-043).
        { Delete: { TableName: this.tableName, Key: { PK: pk, SK: `SEQ#${id}` } } },
      );
    }

    // Role ceilings, which live in this partition so that the authorization
    // decision costs no extra read (section 9.3).
    const limitsBefore = snapshot?.limits ?? new Set<string>();
    const limitsNow = new Set(notebook.limitedUserIds);
    for (const userId of limitsNow) {
      if (limitsBefore.has(userId)) continue;
      bulk.push({
        Put: {
          TableName: this.tableName,
          Item: {
            PK: pk,
            SK: this.keys.limit(userId),
            entity: 'LIMIT',
            userId,
            limit: 'VIEWER',
            setBy: this.sub.userId.value,
            setAt: notebook.updatedAt.toISOString(),
          },
        },
      });
    }
    for (const userId of limitsBefore) {
      if (limitsNow.has(userId)) continue;
      bulk.push({
        Delete: { TableName: this.tableName, Key: { PK: pk, SK: this.keys.limit(userId) } },
      });
    }

    // 4. The events, into the outbox, in the same transaction.
    for (const event of events) {
      conditional.push({
        Put: {
          TableName: this.tableName,
          Item: outboxItem(event, pk, this.keys.event(event.eventId)),
        },
      });
    }

    const result = await this.write(conditional, bulk);
    if (!result.ok) return result;

    notebook.markPersisted();
    this.snapshots.set(notebook.id.value, snapshotOf(notebook));
    return ok();
  }

  /**
   * Writes the conditional items in one transaction and, when a cascade pushes
   * past the 100-item ceiling, drains the remaining unconditional writes in
   * batches. The lock and the guards always travel in the transaction, so what
   * a partial failure can leave behind is orphan folder items no tree points
   * at, which the same cascade removes on the next attempt.
   */
  private async write(
    conditional: TransactItem[],
    bulk: TransactItem[],
  ): Promise<Result<void, ConcurrencyError>> {
    const room = MAX_TRANSACT_ITEMS - conditional.length;
    if (room < 0) {
      return {
        ok: false,
        error: new ConcurrencyError('This change is too large for one transaction'),
      };
    }
    const inTransaction = [...conditional, ...bulk.slice(0, room)];
    const leftover = bulk.slice(room);

    try {
      await this.db.send(
        new TransactWriteCommand({
          TransactItems: inTransaction as TransactWriteCommandInput['TransactItems'],
        }),
      );
    } catch (error) {
      // PE7: an AWS exception never reaches the domain.
      if (isTransactionCanceled(error)) return { ok: false, error: new ConcurrencyError() };
      throw error;
    }

    for (let index = 0; index < leftover.length; index += 25) {
      const chunk = leftover.slice(index, index + 25);
      await this.db.send(
        new BatchWriteCommand({
          RequestItems: {
            [this.tableName]: chunk.map((item) =>
              'Put' in item && item.Put
                ? { PutRequest: { Item: item.Put.Item } }
                : { DeleteRequest: { Key: (item as { Delete: { Key: Item } }).Delete.Key } },
            ),
          },
        }),
      );
    }
    return ok();
  }
}

function snapshotOf(notebook: Notebook): Snapshot {
  return {
    version: notebook.version,
    slug: notebook.slug.value,
    deleted: notebook.isDeleted,
    folders: new Map(
      notebook.folders
        .all()
        .map((folder) => [
          folder.id.value,
          { parentFolderId: folder.parentFolderId?.value ?? null, slug: folder.slug.value },
        ]),
    ),
    limits: new Set(notebook.limitedUserIds),
  };
}

export function isTransactionCanceled(error: unknown): boolean {
  const name = (error as { name?: string })?.name ?? '';
  return name === 'TransactionCanceledException' || name === 'ConditionalCheckFailedException';
}
