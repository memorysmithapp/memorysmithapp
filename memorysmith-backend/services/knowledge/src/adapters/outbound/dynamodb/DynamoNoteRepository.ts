/**
 * DynamoNoteRepository: form B of the transaction, the note mutation
 * (architecture-guide.md, section 10.2).
 *
 * One TransactWriteItems carries:
 *   1. the NOTE item with ConditionExpression version = :expected, so the lock
 *      is on the item itself (a move between notebooks deletes the item it
 *      moves from, under the same lock);
 *   2. the event, into the outbox.
 *
 * NO NOTE TRANSACTION INCLUDES AN ITEM ANOTHER NOTE TRANSACTION INCLUDES (PE8).
 * DynamoDB cancels a transaction when any item of it is part of another
 * transaction in flight, and a ConditionCheck makes an item part of it just as
 * a write does. So neither the META item of the notebook nor the FOLDER item a
 * note is written into belongs in the transaction: fifty notes written into one
 * folder at once would all include it, and all but one would be cancelled.
 * Whether the folder and the notebook exist is read by the use case before the
 * write, and a read never conflicts with a transaction.
 *
 * There is no third write any more. The NSLUG guard held one name per notebook,
 * and a notebook has no key to guard: two notes may carry one name (RN-KNW-037),
 * so nothing is reserved on a write and nothing is released on a delete.
 */

import {
  ConcurrencyError,
  NoteId,
  ok,
  Position,
  type FolderId,
  type Result,
  type SubscriptionContext,
  type NotebookId,
} from '@memorysmith/kernel';
import type { DynamoDBDocumentClient, TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { GetCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import type { Note } from '../../../domain/note/Note.js';
import type { NoteOrder } from '../../../domain/services/NotePlacement.js';
import type { NoteRepository } from '../../../domain/ports/index.js';
import { KnowledgeKeys } from './keys.js';
import { isTransactionCanceled } from './DynamoNotebookRepository.js';
import { noteItem, outboxItem, parseNote, unwrapOrThrow, type Item } from './items.js';

type TransactItem = NonNullable<TransactWriteCommandInput['TransactItems']>[number];

interface NoteSnapshot {
  version: number;
  notebookId: string;
  deleted: boolean;
}

export class DynamoNoteRepository implements NoteRepository {
  private readonly keys: KnowledgeKeys;
  private readonly snapshots = new Map<string, NoteSnapshot>();

  constructor(
    private readonly sub: SubscriptionContext,
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {
    this.keys = new KnowledgeKeys(sub.subscriptionId);
  }

  async findById(notebook: NotebookId, id: NoteId): Promise<Note | null> {
    const response = await this.db.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: this.keys.notebook(notebook), SK: this.keys.note(id) },
        // A note written a moment ago anchors the next placement, and its
        // version is what the next write is locked on: neither may be stale.
        ConsistentRead: true,
      }),
    );
    if (!response.Item) return null;
    const note = parseNote(response.Item as Item, this.sub.subscriptionId);
    this.remember(note);
    return note;
  }

  /** GSI2 already returns the notes of a folder IN THE DEFINED ORDER. */
  async listByFolder(_notebook: NotebookId, folder: FolderId): Promise<Note[]> {
    const response = await this.db.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk',
        ExpressionAttributeValues: { ':pk': this.keys.folderPartition(folder) },
      }),
    );
    return ((response.Items ?? []) as Item[]).map((item) =>
      parseNote(item, this.sub.subscriptionId),
    );
  }

  async listByNotebook(notebook: NotebookId): Promise<Note[]> {
    return (await this.everyNoteOf(notebook, false)).filter((note) => !note.isDeleted);
  }

  /**
   * Every note item of the notebook, page after page. A notebook of 2,000 notes
   * does not fit in the one megabyte a Query answers, and a listing that stopped
   * at the first page used to say nothing about the rest.
   */
  private async everyNoteOf(notebook: NotebookId, consistent: boolean): Promise<Note[]> {
    const notes: Note[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const response = await this.db.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
          ExpressionAttributeValues: { ':pk': this.keys.notebook(notebook), ':prefix': 'NOTE#' },
          ConsistentRead: consistent,
          ...(startKey ? { ExclusiveStartKey: startKey } : {}),
        }),
      );
      for (const item of (response.Items ?? []) as Item[]) {
        notes.push(parseNote(item, this.sub.subscriptionId));
      }
      startKey = response.LastEvaluatedKey;
    } while (startKey);
    return notes;
  }

  /** Identity and order key only: all a placement decision needs. */
  async siblingOrder(_notebook: NotebookId, folder: FolderId): Promise<NoteOrder[]> {
    const response = await this.db.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk',
        ProjectionExpression: 'noteId, #position',
        ExpressionAttributeNames: { '#position': 'position' },
        ExpressionAttributeValues: { ':pk': this.keys.folderPartition(folder) },
      }),
    );
    return ((response.Items ?? []) as Item[]).map((item) => ({
      noteId: unwrapOrThrow(NoteId.create(String(item['noteId']))),
      position: unwrapOrThrow(Position.create(String(item['position']))),
    }));
  }

  async save(note: Note): Promise<Result<void, ConcurrencyError>> {
    const snapshot = this.snapshots.get(note.id.value);
    return this.commit(note, [this.noteWrite(note, snapshot)]);
  }

  /**
   * The cross-notebook move: the only operation that writes into two notebook
   * partitions in one transaction (section 9.2). Both items are the note's own,
   * the one it leaves and the one it becomes, so it locks no notebook and
   * includes nothing another note transaction could include.
   */
  async saveMoved(
    note: Note,
    from: { notebookId: NotebookId },
  ): Promise<Result<void, ConcurrencyError>> {
    const snapshot = this.snapshots.get(note.id.value);
    const items: TransactItem[] = [
      {
        Delete: {
          TableName: this.tableName,
          Key: { PK: this.keys.notebook(from.notebookId), SK: this.keys.note(note.id) },
          ...(snapshot
            ? {
                ConditionExpression: 'version = :expected',
                ExpressionAttributeValues: { ':expected': snapshot.version },
              }
            : {}),
        },
      },
      this.noteWrite(note, undefined),
    ];
    return this.commit(note, items);
  }

  /** The note item, locked on its own version. */
  private noteWrite(note: Note, snapshot: NoteSnapshot | undefined): TransactItem {
    return {
      Put: {
        TableName: this.tableName,
        Item: noteItem(note, {
          pk: this.keys.notebook(note.notebookId),
          sk: this.keys.note(note.id),
          gsi2pk: this.keys.folderPartition(note.folderId),
          gsi2sk: this.keys.gsi2Note(note.position, note.id),
        }),
        ...(snapshot
          ? {
              ConditionExpression: 'version = :expected',
              ExpressionAttributeValues: { ':expected': snapshot.version },
            }
          : { ConditionExpression: 'attribute_not_exists(SK)' }),
      },
    };
  }

  private async commit(note: Note, items: TransactItem[]): Promise<Result<void, ConcurrencyError>> {
    const pk = this.keys.notebook(note.notebookId);
    // The event, into the outbox, in the same transaction.
    const events = note.pullEvents();
    const all = [
      ...items,
      ...events.map((event) => ({
        Put: {
          TableName: this.tableName,
          Item: outboxItem(event, pk, this.keys.event(event.eventId)),
        },
      })),
    ];

    try {
      await this.db.send(
        new TransactWriteCommand({
          TransactItems: all as TransactWriteCommandInput['TransactItems'],
        }),
      );
    } catch (error) {
      if (isTransactionCanceled(error)) return { ok: false, error: new ConcurrencyError() };
      throw error;
    }
    note.markPersisted();
    this.remember(note);
    return ok();
  }

  private remember(note: Note): void {
    this.snapshots.set(note.id.value, {
      version: note.version,
      notebookId: note.notebookId.value,
      deleted: note.isDeleted,
    });
  }
}
