/**
 * DynamoFolderNumbers: the numbers a folder issues (RN-KNW-043).
 *
 *   PK = S#{s}#NOTEBOOK#{v}   SK = SEQ#{folderId}   lastNumber, issuedBy, issuedAt
 *
 * One `UpdateItem` with `ADD lastNumber :one` answering the new value. DynamoDB
 * applies updates of one item one after the other, so twenty requests on one
 * folder at once answer twenty distinct numbers and none of them fails: there
 * is no lock to lose and no transaction to cancel. The item is removed with
 * its folder, beside the `FSTAT#` counter, and a folder identifier is never
 * reused, so a number is never issued twice.
 */

import type { Authorship, FolderId, NotebookId, SubscriptionContext } from '@memorysmith/kernel';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { FolderNumbers } from '../../../domain/ports/index.js';
import { KnowledgeKeys } from './keys.js';
import { serializeAuthorship } from './items.js';

export class DynamoFolderNumbers implements FolderNumbers {
  private readonly keys: KnowledgeKeys;

  constructor(
    sub: SubscriptionContext,
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {
    this.keys = new KnowledgeKeys(sub.subscriptionId);
  }

  async next(notebook: NotebookId, folder: FolderId, by: Authorship): Promise<number> {
    const response = await this.db.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: this.keys.notebook(notebook), SK: this.keys.folderNumbers(folder) },
        UpdateExpression:
          'ADD lastNumber :one SET entity = :entity, folderId = :folder, issuedBy = :by, issuedAt = :at',
        ExpressionAttributeValues: {
          ':one': 1,
          ':entity': 'SEQ',
          ':folder': folder.value,
          ':by': serializeAuthorship(by),
          ':at': by.at.toISOString(),
        },
        ReturnValues: 'UPDATED_NEW',
      }),
    );
    return Number(response.Attributes?.['lastNumber']);
  }

  async lastIssued(notebook: NotebookId): Promise<Map<string, number>> {
    const numbers = new Map<string, number>();
    let startKey: Record<string, unknown> | undefined;
    do {
      const page: {
        Items?: Record<string, unknown>[] | undefined;
        LastEvaluatedKey?: Record<string, unknown> | undefined;
      } = await this.db.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
          ExpressionAttributeValues: { ':pk': this.keys.notebook(notebook), ':prefix': 'SEQ#' },
          ...(startKey ? { ExclusiveStartKey: startKey } : {}),
        }),
      );
      for (const item of page.Items ?? []) {
        numbers.set(String(item['folderId']), Number(item['lastNumber'] ?? 0));
      }
      startKey = page.LastEvaluatedKey;
    } while (startKey);
    return numbers;
  }

  async restore(
    notebook: NotebookId,
    folder: FolderId,
    lastNumber: number,
    by: Authorship,
  ): Promise<void> {
    try {
      await this.db.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: this.keys.notebook(notebook), SK: this.keys.folderNumbers(folder) },
          UpdateExpression:
            'SET lastNumber = :n, entity = :entity, folderId = :folder, issuedBy = :by, issuedAt = :at',
          // Never down: a counter that already passed the number keeps its own.
          ConditionExpression: 'attribute_not_exists(lastNumber) OR lastNumber < :n',
          ExpressionAttributeValues: {
            ':n': lastNumber,
            ':entity': 'SEQ',
            ':folder': folder.value,
            ':by': serializeAuthorship(by),
            ':at': by.at.toISOString(),
          },
        }),
      );
    } catch (error) {
      if ((error as { name?: string }).name !== 'ConditionalCheckFailedException') throw error;
    }
  }
}
