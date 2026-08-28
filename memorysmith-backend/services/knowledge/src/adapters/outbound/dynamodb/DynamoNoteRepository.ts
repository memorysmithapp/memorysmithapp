/**
 * DynamoNoteRepository: form B of the transaction, the note mutation
 * (architecture-guide.md, section 10.2).
 *
 * One TransactWriteItems carries:
 *   1. the NOTE item with ConditionExpression version = :expected, so the lock
 *      is on the item itself;
 *   2. a ConditionCheck with attribute_exists on the destination FOLDER item
 *      and, on a cross-vault move, on the destination META item too;
 *   3. the NSLUG guard, put or deleted as the slug enters or leaves the vault;
 *   4. the event, into the outbox.
 *
 * NO NOTE TRANSACTION EVER WRITES TO THE META ITEM (PE8). That single rule,
 * and not the aggregate split by itself, is what keeps the hot path free of
 * contention: META is one item, and an agent writing fifty notes in a row
 * would turn it into the bottleneck of the entire vault.
 */

import {
  ConcurrencyError,
  NoteId,
  ok,
  Position,
  type FolderId,
  type Result,
  type Slug,
  type SubscriptionContext,
  type VaultId,
} from '@memorysmith/kernel';
import type { DynamoDBDocumentClient, TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { GetCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import type { Note } from '../../../domain/note/Note.js';
import type { NoteOrder } from '../../../domain/services/NotePlacement.js';
import type { NoteRepository } from '../../../domain/ports/index.js';
import { KnowledgeKeys } from './keys.js';
import { isTransactionCanceled } from './DynamoVaultRepository.js';
import { noteItem, outboxItem, parseNote, unwrapOrThrow, type Item } from './items.js';

type TransactItem = NonNullable<TransactWriteCommandInput['TransactItems']>[number];

interface NoteSnapshot {
  version: number;
  slug: string;
  vaultId: string;
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

  async findById(vault: VaultId, id: NoteId): Promise<Note | null> {
    const response = await this.db.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: this.keys.vault(vault), SK: this.keys.note(id) },
      }),
    );
    if (!response.Item) return null;
    const note = parseNote(response.Item as Item, this.sub.subscriptionId);
    this.remember(note);
    return note;
  }

  /** Resolves through the NSLUG guard, which is the index of slug to note. */
  async findBySlug(vault: VaultId, slug: Slug): Promise<Note | null> {
    const guard = await this.db.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: this.keys.vault(vault), SK: this.keys.noteSlugGuard(slug.value) },
      }),
    );
    const noteId = guard.Item?.['noteId'];
    if (!noteId) return null;
    return this.findById(vault, unwrapOrThrow(NoteId.create(String(noteId))));
  }

  /** GSI2 already returns the notes of a folder IN THE DEFINED ORDER. */
  async listByFolder(_vault: VaultId, folder: FolderId): Promise<Note[]> {
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

  async listByVault(vault: VaultId): Promise<Note[]> {
    const response = await this.db.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': this.keys.vault(vault), ':prefix': 'NOTE#' },
      }),
    );
    return ((response.Items ?? []) as Item[])
      .map((item) => parseNote(item, this.sub.subscriptionId))
      .filter((note) => !note.isDeleted);
  }

  /** Identity and order key only: all a placement decision needs. */
  async siblingOrder(_vault: VaultId, folder: FolderId): Promise<NoteOrder[]> {
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
    const items = this.writesFor(note, snapshot);
    return this.commit(note, items);
  }

  /**
   * The cross-vault move: the only operation that writes into two vault
   * partitions in one transaction (section 9.2). It does not lock either
   * vault, since the tree does not change; existence ConditionChecks are
   * enough. Forgetting the origin slug guard would pin that slug in the origin
   * vault forever.
   */
  async saveMoved(
    note: Note,
    from: { vaultId: VaultId; slug: Slug },
  ): Promise<Result<void, ConcurrencyError>> {
    const snapshot = this.snapshots.get(note.id.value);
    const items: TransactItem[] = [
      {
        Delete: {
          TableName: this.tableName,
          Key: { PK: this.keys.vault(from.vaultId), SK: this.keys.note(note.id) },
          ...(snapshot
            ? {
                ConditionExpression: 'version = :expected',
                ExpressionAttributeValues: { ':expected': snapshot.version },
              }
            : {}),
        },
      },
      {
        Delete: {
          TableName: this.tableName,
          Key: {
            PK: this.keys.vault(from.vaultId),
            SK: this.keys.noteSlugGuard(from.slug.value),
          },
        },
      },
      // The destination vault must exist at the instant of the write.
      {
        ConditionCheck: {
          TableName: this.tableName,
          Key: { PK: this.keys.vault(note.vaultId), SK: 'META' },
          ConditionExpression: 'attribute_exists(PK)',
        },
      },
      ...this.writesFor(note, undefined),
    ];
    return this.commit(note, items);
  }

  private writesFor(note: Note, snapshot: NoteSnapshot | undefined): TransactItem[] {
    const pk = this.keys.vault(note.vaultId);
    const items: TransactItem[] = [];

    // 1. The note item, locked on its own version.
    items.push({
      Put: {
        TableName: this.tableName,
        Item: noteItem(note, {
          pk,
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
    });

    // 2. The destination folder must exist, checked WITHOUT writing to it.
    items.push({
      ConditionCheck: {
        TableName: this.tableName,
        Key: { PK: pk, SK: this.keys.folder(note.folderId) },
        ConditionExpression: 'attribute_exists(SK)',
      },
    });

    // 3. The slug guard enters or leaves the vault with the note.
    const previousSlug = snapshot?.slug;
    if (note.isDeleted) {
      // Deleting releases the slug back to the vault (RN-KNW-030).
      items.push({
        Delete: {
          TableName: this.tableName,
          Key: { PK: pk, SK: this.keys.noteSlugGuard(note.slug.value) },
        },
      });
    } else if (!snapshot || snapshot.deleted || previousSlug !== note.slug.value) {
      items.push({
        Put: {
          TableName: this.tableName,
          Item: {
            PK: pk,
            SK: this.keys.noteSlugGuard(note.slug.value),
            entity: 'NSLUG',
            noteId: note.id.value,
          },
          ConditionExpression: 'attribute_not_exists(SK)',
        },
      });
      if (previousSlug && previousSlug !== note.slug.value) {
        items.push({
          Delete: {
            TableName: this.tableName,
            Key: { PK: pk, SK: this.keys.noteSlugGuard(previousSlug) },
          },
        });
      }
    }

    return items;
  }

  private async commit(note: Note, items: TransactItem[]): Promise<Result<void, ConcurrencyError>> {
    const pk = this.keys.vault(note.vaultId);
    // 4. The event, into the outbox, in the same transaction.
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
      slug: note.slug.value,
      vaultId: note.vaultId.value,
      deleted: note.isDeleted,
    });
  }
}
