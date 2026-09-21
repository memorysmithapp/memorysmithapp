/**
 * The files of a notebook (#166, RN-KNW-048), in the partition of that
 * notebook and outside the range that loads its tree.
 *
 * `FILE#` and `FNAME#` both sort before `FOLDER#`, which is the lower bound of
 * the single Query that loads the aggregate — so a notebook with two thousand
 * files is loaded exactly as fast as one with none, and nothing that reads the
 * tree ever reads a file.
 *
 * One TransactWriteItems carries the item, the guard of the name and the
 * event, which is the shape every write of this context takes (§10.2). The
 * guard is a real item written under a condition and not a read: two uploads
 * of one name arriving together would both find the name free.
 */

import {
  ContentRef,
  DomainError,
  err,
  FileId,
  Instant,
  ok,
  NotebookId,
  type Result,
  type SubscriptionContext,
} from '@memorysmith/kernel';
import type { DynamoDBDocumentClient, TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { GetCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { NotebookFile } from '../../../domain/file/NotebookFile.js';
import type { FileRepository } from '../../../domain/ports/index.js';
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

export class DynamoFileRepository implements FileRepository {
  private readonly keys: KnowledgeKeys;

  constructor(
    private readonly context: SubscriptionContext,
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {
    this.keys = new KnowledgeKeys(context.subscriptionId);
  }

  async findById(notebook: NotebookId, file: FileId): Promise<NotebookFile | null> {
    const found = await this.db.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: this.keys.notebook(notebook), SK: this.keys.file(file) },
        ConsistentRead: true,
      }),
    );
    const parsed = found.Item ? this.parse(found.Item as Item) : null;
    return parsed && !parsed.isDeleted ? parsed : null;
  }

  async findByName(notebook: NotebookId, name: string): Promise<NotebookFile | null> {
    const guard = await this.db.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: this.keys.notebook(notebook), SK: this.keys.fileNameGuard(name) },
        ConsistentRead: true,
      }),
    );
    const held = guard.Item?.['fileId'];
    if (!held) return null;
    return this.findById(notebook, unwrapOrThrow(FileId.create(String(held))));
  }

  async list(notebook: NotebookId): Promise<NotebookFile[]> {
    const items: Item[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const response = await this.db.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
          ExpressionAttributeValues: { ':pk': this.keys.notebook(notebook), ':prefix': 'FILE#' },
          ...(startKey ? { ExclusiveStartKey: startKey } : {}),
        }),
      );
      items.push(...((response.Items ?? []) as Item[]));
      startKey = response.LastEvaluatedKey;
    } while (startKey);

    return items.map((item) => this.parse(item)).filter((file) => !file.isDeleted);
  }

  async save(file: NotebookFile): Promise<Result<void, DomainError>> {
    const pk = this.keys.notebook(file.notebookId);
    const writes: TransactItem[] = [
      {
        Put: {
          TableName: this.tableName,
          Item: this.itemOf(file, pk),
          ConditionExpression: file.version === 0 ? 'attribute_not_exists(PK)' : 'version = :v',
          ...(file.version === 0 ? {} : { ExpressionAttributeValues: { ':v': file.version } }),
        },
      },
    ];

    if (file.version === 0) {
      // The name, held by this file and by no other of the notebook. It is the
      // first write that wins, and the second is told which file holds it.
      writes.push({
        Put: {
          TableName: this.tableName,
          Item: {
            PK: pk,
            SK: this.keys.fileNameGuard(file.name),
            entity: 'FILE_NAME',
            fileId: file.id.value,
            name: file.name,
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      });
    } else if (file.isDeleted) {
      // Deleting frees the name at once, the way deleting a note does.
      writes.push({
        Delete: {
          TableName: this.tableName,
          Key: { PK: pk, SK: this.keys.fileNameGuard(file.name) },
        },
      });
    }

    for (const event of file.pullEvents()) {
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
        const holder = await this.findByName(file.notebookId, file.name);
        if (holder && holder.id.value !== file.id.value) {
          return err(
            DomainError.conflict(
              `This notebook already keeps a file called "${file.name}"`,
              holder.id.value,
            ),
          );
        }
        return err(DomainError.conflict('The file changed while this write was in flight'));
      }
      throw error;
    }
  }

  private itemOf(file: NotebookFile, pk: string): Item {
    const item: Item = {
      PK: pk,
      SK: this.keys.file(file.id),
      entity: 'FILE',
      fileId: file.id.value,
      notebookId: file.notebookId.value,
      name: file.name,
      description: file.description,
      mimeType: file.mimeType,
      tags: [...file.tags],
      path: file.path,
      contentRef: {
        contentId: file.contentRef.contentId.value,
        versionId: file.contentRef.versionId,
        sha256: file.contentRef.sha256,
        bytes: file.contentRef.bytes,
      },
      createdBy: serializeAuthorship(file.createdBy),
      updatedBy: serializeAuthorship(file.updatedBy),
      updatedAt: file.updatedBy.at.toISOString(),
      version: file.nextVersion(),
    };
    if (file.isDeleted) item['deletedAt'] = file.deletedAt?.toISOString();
    return item;
  }

  private parse(item: Item): NotebookFile {
    const deletedAt = item['deletedAt'];
    return NotebookFile.rehydrate({
      id: unwrapOrThrow(FileId.create(String(item['fileId']))),
      subscriptionId: this.context.subscriptionId,
      notebookId: unwrapOrThrow(NotebookId.create(String(item['notebookId']))),
      name: String(item['name']),
      description: String(item['description'] ?? ''),
      mimeType: String(item['mimeType']),
      tags: Array.isArray(item['tags']) ? (item['tags'] as string[]) : [],
      path: String(item['path'] ?? '/'),
      contentRef: unwrapOrThrow(ContentRef.fromJSON(item['contentRef'])),
      createdBy: parseAuthorship(item['createdBy']),
      updatedBy: parseAuthorship(item['updatedBy']),
      deletedAt: deletedAt ? unwrapOrThrow(Instant.fromISO(String(deletedAt))) : null,
      version: Number(item['version'] ?? 0),
    });
  }
}
