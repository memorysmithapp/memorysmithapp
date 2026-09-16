/**
 * DynamoContentSlotRepository: shape B of the transaction applied to the two
 * Content Slots that are not notes (architecture-guide.md, section 10.2).
 *
 * One TransactWriteItems carries:
 *   1. the slot item, with ConditionExpression version = :expected, which is
 *      the optimistic lock of THIS slot and of nothing else;
 *   2. its domain event, into the outbox, in the same transaction.
 *
 * The `META` item of the notebook is not in it, and neither is the `FOLDER`
 * item a Template belongs to (PE8). That is the whole point of RN-KNW-044:
 * writing the Template of one folder used to lock the entire tree, so it
 * conflicted with renaming another folder and with writing the Template of
 * another one.
 *
 * The subscription belongs to the repository, resolved per request from the
 * token claim; it is never a method argument (PE2).
 */

import {
  ConcurrencyError,
  type FolderId,
  ok,
  type Result,
  type SubscriptionContext,
  type NotebookId,
} from '@memorysmith/kernel';
import type { DynamoDBDocumentClient, TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { GetCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import type { ContentSlot } from '../../../domain/content-slot/ContentSlot.js';
import type { Guidance } from '../../../domain/content-slot/Guidance.js';
import type { Template } from '../../../domain/content-slot/Template.js';
import type { ContentSlotRepository } from '../../../domain/ports/index.js';
import { isTransactionCanceled } from './DynamoNotebookRepository.js';
import { KnowledgeKeys } from './keys.js';
import { contentSlotItem, outboxItem, parseGuidance, parseTemplate, type Item } from './items.js';

export class DynamoContentSlotRepository implements ContentSlotRepository {
  private readonly keys: KnowledgeKeys;
  /** The version each loaded slot had, which is what the lock expects. */
  private readonly loaded = new Map<string, number>();

  constructor(
    private readonly sub: SubscriptionContext,
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {
    this.keys = new KnowledgeKeys(sub.subscriptionId);
  }

  async findGuidance(notebook: NotebookId): Promise<Guidance | null> {
    const item = await this.get(this.keys.notebook(notebook), this.keys.guidance());
    if (!item) return null;
    const guidance = parseGuidance(item, this.sub.subscriptionId);
    this.remember(notebook, guidance);
    return guidance;
  }

  async findTemplate(notebook: NotebookId, folder: FolderId): Promise<Template | null> {
    const item = await this.get(this.keys.notebook(notebook), this.keys.template(folder));
    if (!item) return null;
    const template = parseTemplate(item, this.sub.subscriptionId);
    this.remember(notebook, template);
    return template;
  }

  /**
   * Every Template of a notebook, from the one partition that holds them, in
   * one Query. An export asks this; reading them one folder at a time would be
   * one round trip per folder.
   */
  async listTemplates(notebook: NotebookId): Promise<Template[]> {
    const response = await this.db.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': this.keys.notebook(notebook),
          ':prefix': 'FTPL#',
        },
      }),
    );
    return ((response.Items ?? []) as Item[]).map((item) => {
      const template = parseTemplate(item, this.sub.subscriptionId);
      this.remember(notebook, template);
      return template;
    });
  }

  async save(slot: ContentSlot): Promise<Result<void, ConcurrencyError>> {
    const pk = this.keys.notebook(slot.notebookId);
    const sk = this.keyOf(slot);
    const expected = this.loaded.get(`${pk}|${sk}`);
    const events = slot.pullEvents();

    /**
     * Deleting takes the item out. What it does NOT take out is the content:
     * the blob stays in the store, unreferenced, and no path in the product
     * destroys a revision (rule 8). The event carries the reference that was
     * live, so the trail still names it.
     */
    const written: NonNullable<TransactWriteCommandInput['TransactItems']>[number] = slot.isDeleted
      ? {
          Delete: {
            TableName: this.tableName,
            Key: { PK: pk, SK: sk },
            ConditionExpression: 'version = :expected',
            ExpressionAttributeValues: { ':expected': expected ?? -1 },
          },
        }
      : {
          Put: {
            TableName: this.tableName,
            Item: {
              ...contentSlotItem(slot, pk, sk),
              // A Guidance is projected into GSI1 so that listing the notebooks
              // of the subscription answers which of them have one, from the
              // same partition it already reads.
              ...(slot.role === 'GUIDANCE'
                ? {
                    GSI1PK: this.keys.subscriptionNotebooks(),
                    GSI1SK: this.keys.gsi1NotebookGuidance(slot.notebookId),
                  }
                : {}),
            },
            ...(expected === undefined
              ? // The first write of this slot claims the key. Two of them racing
                // leave exactly one, and the loser is told so (RN-KNW-044).
                { ConditionExpression: 'attribute_not_exists(SK)' }
              : {
                  ConditionExpression: 'version = :expected',
                  ExpressionAttributeValues: { ':expected': expected },
                }),
          },
        };
    const items: NonNullable<TransactWriteCommandInput['TransactItems']> = [written];

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
    } catch (error) {
      // PE7: an AWS exception never reaches the domain.
      if (isTransactionCanceled(error)) return { ok: false, error: new ConcurrencyError() };
      throw error;
    }

    slot.markPersisted();
    if (slot.isDeleted) this.loaded.delete(`${pk}|${sk}`);
    else this.loaded.set(`${pk}|${sk}`, slot.version);
    return ok();
  }

  private keyOf(slot: ContentSlot): string {
    return slot.folderId ? this.keys.template(slot.folderId) : this.keys.guidance();
  }

  private remember(notebook: NotebookId, slot: ContentSlot): void {
    this.loaded.set(`${this.keys.notebook(notebook)}|${this.keyOf(slot)}`, slot.version);
  }

  private async get(pk: string, sk: string): Promise<Item | null> {
    const response = await this.db.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: pk, SK: sk },
        // The revision read here is what the next write is locked on and what
        // the revision guard compares against: it may not be stale.
        ConsistentRead: true,
      }),
    );
    return (response.Item as Item | undefined) ?? null;
  }
}
