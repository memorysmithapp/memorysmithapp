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
 * A third write appears only when the NAME moves: the guard of the folder it is
 * held in (RN-KNW-042). A folder holds one live note of each name, so the guard
 * is claimed with attribute_not_exists when a name arrives and released when it
 * leaves — on a rename, a move or a delete. It keeps PE8: the only two note
 * transactions that share a guard are two writes of one name into one folder,
 * which are exactly the pair that must collide.
 */

import {
  ConcurrencyError,
  FolderId,
  NoteId,
  ok,
  Position,
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
  /** Where the name was held when the note was loaded, if it held one. */
  folderId: string;
  name: string | null;
}

/** The refusal of RN-KNW-042, which the use case turns into its answer. */
export function nameTaken(): ConcurrencyError {
  return new ConcurrencyError('A note of this folder already carries this name', {
    code: 'ALREADY_EXISTS',
  });
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

  async findByName(notebook: NotebookId, folder: FolderId, name: string): Promise<NoteId | null> {
    const response = await this.db.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: this.keys.notebook(notebook), SK: this.keys.noteNameGuard(folder, name) },
        ConsistentRead: true,
      }),
    );
    const holder = response.Item?.['noteId'];
    return holder ? unwrapOrThrow(NoteId.create(String(holder))) : null;
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
   * Every note item of the notebook, page after page. A notebook of thousands of notes
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
    const before = snapshot ? this.heldGuard(snapshot) : null;
    const after = this.guardOf(note);
    const guards =
      before?.sk === after?.sk && before?.pk === after?.pk
        ? []
        : [
            ...(before ? [this.release(note, before)] : []),
            ...(after ? [this.claim(note, after)] : []),
          ];
    return this.commit(note, [this.noteWrite(note, snapshot), ...guards]);
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
    // The name leaves the folder of the source notebook and arrives in the
    // folder of the destination: two partitions, so never the same guard.
    const before = snapshot ? this.heldGuard(snapshot) : null;
    const after = this.guardOf(note);
    if (before) items.push(this.release(note, before));
    if (after) items.push(this.claim(note, after));
    return this.commit(note, items);
  }

  /** The guard a note holds as it is now: none when deleted or unnamed. */
  private guardOf(note: Note): { pk: string; sk: string } | null {
    if (note.isDeleted || note.name === null) return null;
    return {
      pk: this.keys.notebook(note.notebookId),
      sk: this.keys.noteNameGuard(note.folderId, note.name),
    };
  }

  /** The guard a note held when it was loaded. */
  private heldGuard(snapshot: NoteSnapshot): { pk: string; sk: string } | null {
    if (snapshot.deleted || snapshot.name === null) return null;
    const folderId = unwrapOrThrow(FolderId.create(snapshot.folderId));
    return {
      pk: `S#${this.sub.subscriptionId.value}#NOTEBOOK#${snapshot.notebookId}`,
      sk: this.keys.noteNameGuard(folderId, snapshot.name),
    };
  }

  private claim(note: Note, guard: { pk: string; sk: string }): TransactItem {
    return {
      Put: {
        TableName: this.tableName,
        Item: {
          PK: guard.pk,
          SK: guard.sk,
          entity: 'NAME',
          noteId: note.id.value,
          folderId: note.folderId.value,
        },
        // A second live note of this name in this folder is the one thing this
        // item exists to refuse (RN-KNW-042).
        ConditionExpression: 'attribute_not_exists(SK)',
      },
    };
  }

  /**
   * Releases a guard only if THIS note holds it. A guard that is missing is
   * released too, which is the state of a note written before the guard
   * existed; one held by another note is never freed from here.
   */
  private release(note: Note, guard: { pk: string; sk: string }): TransactItem {
    return {
      Delete: {
        TableName: this.tableName,
        Key: { PK: guard.pk, SK: guard.sk },
        ConditionExpression: 'attribute_not_exists(SK) OR noteId = :me',
        ExpressionAttributeValues: { ':me': note.id.value },
      },
    };
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
      if (!isTransactionCanceled(error)) throw error;
      // Which item refused says which refusal this is: a claimed guard is a
      // taken name, which no retry changes; anything else is a lost lock.
      const reasons = (error as { CancellationReasons?: Array<{ Code?: string }> })
        .CancellationReasons;
      const claimRefused = (reasons ?? []).some(
        (reason, index) =>
          reason?.Code === 'ConditionalCheckFailed' &&
          (all[index] as { Put?: { Item?: Item } }).Put?.Item?.['entity'] === 'NAME',
      );
      return { ok: false, error: claimRefused ? nameTaken() : new ConcurrencyError() };
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
      folderId: note.folderId.value,
      name: note.name,
    });
  }
}
