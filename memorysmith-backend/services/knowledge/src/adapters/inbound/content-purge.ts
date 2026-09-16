/**
 * The purge: what a deletion left behind stops existing (RN-KNW-047,
 * architecture-guide.md §12.4).
 *
 * Deleting is one write on the unit deleted, and everything under it becomes
 * invalid in the same instant without being written (RN-KNW-046). Invalid is a
 * transitory state by design: this worker is what ends it. It reads a deletion
 * event off a queue, walks what that deletion invalidated, and for each unit
 * destroys **every revision of its content first and its item second**.
 *
 * That order is chosen. A retry after a failure between the two finds the item
 * and does the work again; the reverse order would leave bytes nothing in any
 * table can name, which is the one outcome nothing later could repair. And an
 * item whose content is gone is already invalid, so the window between the two
 * writes shows nobody anything.
 *
 * **The subscription comes from the envelope of the event**, which is the case
 * §8.2 makes for a consumer of the outbox: the worker serves no request, so
 * there is no claim to take it from, and the envelope is the only thing that
 * carries it. The authorship comes from the deletion event, so the trail
 * records the purge under whoever asked for it (rule 7, RN-AUD-010).
 *
 * Delivery is at least once and a second pass changes nothing: destroying a
 * revision that is gone destroys nothing, and deleting an item that is gone
 * deletes nothing.
 */

import {
  type Authorship,
  type ContentRef,
  createEvent,
  type DomainEvent,
  type DomainEventType,
  type EventSubject,
  Instant,
  SubscriptionId,
} from '@memorysmith/kernel';
import {
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { ContentPurger } from '../outbound/s3/S3ContentPurger.js';
import {
  outboxItem,
  parseAuthorship,
  parseContentRef,
  type Item,
} from '../outbound/dynamodb/items.js';

export interface PurgeDependencies {
  readonly db: DynamoDBDocumentClient;
  readonly tableName: string;
  /** Built per subscription, from the envelope, like every repository (PE2). */
  readonly purgerFor: (subscriptionId: SubscriptionId) => ContentPurger;
}

/**
 * How many units one invocation takes before handing the rest to a new
 * message. A notebook of two thousand notes is four thousand writes, which is
 * more than one Lambda should hold open; the continuation costs one message.
 */
export const UNITS_PER_RUN = 200;

/** What the worker answers, so the handler knows whether to continue. */
export interface PurgeOutcome {
  /** Units destroyed in this pass: notes, Templates, Guidances. */
  readonly purged: number;
  /** False when a new message has to carry on where this one stopped. */
  readonly done: boolean;
}

/** The envelope as the worker reads it, narrowed to what it uses. */
export interface DeletionEnvelope {
  readonly type: string;
  readonly subscriptionId: string;
  readonly authorship: unknown;
  readonly contentRef: unknown;
  readonly payload: Record<string, unknown>;
}

export class ContentPurge {
  constructor(private readonly deps: PurgeDependencies) {}

  async run(envelope: DeletionEnvelope): Promise<PurgeOutcome> {
    const subscriptionId = SubscriptionId.fromClaim(envelope.subscriptionId);
    if (!subscriptionId.ok) return { purged: 0, done: true };

    const context: Context = {
      subscriptionId: subscriptionId.value,
      by: parseAuthorship(envelope.authorship),
      purger: this.deps.purgerFor(subscriptionId.value),
      notebookId: String(envelope.payload['notebookId'] ?? ''),
      budget: UNITS_PER_RUN,
      purged: 0,
    };
    if (!context.notebookId) return { purged: 0, done: true };

    switch (envelope.type) {
      case 'NoteDeleted':
        // One note, read by its key: walking the partition to find it would
        // make deleting a note cost a scan of the notebook.
        await this.purgeOneNote(context, String(envelope.payload['noteId'] ?? ''));
        break;

      case 'GuidanceDeleted':
      case 'TemplateDeleted':
        // Its item went at the deletion (RN-KNW-044), so what is left of it is
        // the content, named by the reference the event carries. The bytes
        // left the count then, so this event declares none.
        await this.purgeOrphanContent(context, envelope);
        break;

      case 'FolderRemoved': {
        const removed = new Set((envelope.payload['removedFolderIds'] as string[]) ?? []);
        await this.purgeTemplates(context, (folderId) => removed.has(folderId));
        await this.purgeNotes(context, (note) => removed.has(note.folderId));
        break;
      }

      case 'NotebookDeleted':
        await this.purgeNotes(context, () => true);
        await this.purgeTemplates(context, () => true);
        await this.purgeGuidance(context);
        // The tree itself goes last, and only once nothing under it is left:
        // what is above a unit is what says the unit is invalid, so taking it
        // away first would leave a live note nothing marked.
        if (context.budget > 0) await this.purgeTree(context);
        break;

      default:
        break;
    }

    return { purged: context.purged, done: context.budget > 0 };
  }

  /** The one note a `NoteDeleted` named, when its item is still there. */
  private async purgeOneNote(context: Context, noteId: string): Promise<void> {
    if (!noteId) return;
    const found = await this.deps.db.send(
      new GetCommand({
        TableName: this.deps.tableName,
        Key: { PK: this.partitionOf(context), SK: `NOTE#${noteId}` },
        ConsistentRead: true,
      }),
    );
    const item = found.Item as Item | undefined;
    // Already purged, by this message delivered twice or by the deletion of
    // something above it. Destroying nothing is the right outcome.
    if (!item) return;
    await this.purgeNoteItem(context, item);
    context.purged += 1;
    context.budget -= 1;
  }

  /** The content of a slot whose item is already gone. */
  private async purgeOrphanContent(context: Context, envelope: DeletionEnvelope): Promise<void> {
    const ref = parseContentRef(envelope.contentRef);
    if (!ref) return;
    await context.purger.purge(ref.contentId);
    const folderId = String(envelope.payload['folderId'] ?? '');
    await this.record(context, {
      type: envelope.type === 'GuidanceDeleted' ? 'GuidancePurged' : 'TemplatePurged',
      subject: envelope.type === 'GuidanceDeleted' ? 'NOTEBOOK' : 'FOLDER',
      subjectId: envelope.type === 'GuidanceDeleted' ? context.notebookId : folderId,
      payload:
        envelope.type === 'GuidanceDeleted'
          ? { notebookId: context.notebookId }
          : { notebookId: context.notebookId, folderId },
      contentRef: ref,
      storageDelta: 0,
      deletes: [],
    });
    context.purged += 1;
    context.budget -= 1;
  }

  private async purgeNotes(
    context: Context,
    wanted: (note: { noteId: string; folderId: string }) => boolean,
  ): Promise<void> {
    await this.walk(context, 'NOTE#', async (item) => {
      const note = {
        noteId: String(item['noteId'] ?? ''),
        folderId: String(item['folderId'] ?? ''),
      };
      if (!wanted(note)) return false;
      await this.purgeNoteItem(context, item);
      return true;
    });
  }

  private async purgeNoteItem(context: Context, item: Item): Promise<void> {
    const noteId = String(item['noteId'] ?? '');
    const folderId = String(item['folderId'] ?? '');
    const ref = parseContentRef(item['bodyRef']);
    if (ref) await context.purger.purge(ref.contentId);
    await this.record(context, {
      type: 'NotePurged',
      subject: 'NOTE',
      subjectId: noteId,
      payload: { notebookId: context.notebookId, noteId, folderId },
      contentRef: ref,
      // A note deleted on its own freed its bytes at the deletion, and freeing
      // them again would make the counter of the subscription lie. A note
      // invalidated by its parent never freed them, and frees them here
      // (RN-SUB-021).
      storageDelta: item['deletedAt'] ? 0 : -(ref?.bytes ?? 0),
      deletes: [String(item['SK'])],
    });
  }

  private async purgeTemplates(
    context: Context,
    wanted: (folderId: string) => boolean,
  ): Promise<void> {
    await this.walk(context, 'FTPL#', async (item) => {
      const folderId = String(item['folderId'] ?? '');
      if (!wanted(folderId)) return false;

      const ref = parseContentRef(item['contentRef']);
      if (ref) await context.purger.purge(ref.contentId);
      await this.record(context, {
        type: 'TemplatePurged',
        subject: 'FOLDER',
        subjectId: folderId,
        payload: { notebookId: context.notebookId, folderId },
        contentRef: ref,
        storageDelta: -(ref?.bytes ?? 0),
        deletes: [String(item['SK'])],
      });
      return true;
    });
  }

  private async purgeGuidance(context: Context): Promise<void> {
    await this.walk(context, 'GUIDANCE', async (item) => {
      const ref = parseContentRef(item['contentRef']);
      if (ref) await context.purger.purge(ref.contentId);
      await this.record(context, {
        type: 'GuidancePurged',
        subject: 'NOTEBOOK',
        subjectId: context.notebookId,
        payload: { notebookId: context.notebookId },
        contentRef: ref,
        storageDelta: -(ref?.bytes ?? 0),
        deletes: [String(item['SK'])],
      });
      return true;
    });
  }

  /**
   * Everything else of the partition: the folders, the counters, the ceilings,
   * the slug guards and the `META` item itself. None of them points at
   * content, so they go in batches with one event at the end.
   *
   * The outbox items are NOT deleted, and neither are the dedup markers: both
   * carry a TTL of their own, and taking an outbox item away before the relay
   * published it would lose the very events this purge is writing.
   */
  private async purgeTree(context: Context): Promise<void> {
    const keys: string[] = [];
    for (const prefix of ['FOLDER#', 'FSTAT', 'LIMIT#', 'SLUG#', 'META']) {
      await this.walk(context, prefix, async (item) => {
        keys.push(String(item['SK']));
        return false; // counted as tree, not as a unit of its own
      });
    }

    await this.record(context, {
      type: 'NotebookPurged',
      subject: 'NOTEBOOK',
      subjectId: context.notebookId,
      payload: { notebookId: context.notebookId },
      contentRef: null,
      storageDelta: 0,
      deletes: keys,
    });
  }

  /**
   * Pages through the items of the partition under a prefix, handing each to
   * `take`, until the budget of the run is spent. It re-reads from the start
   * on the next message rather than carrying a cursor: what it already purged
   * is gone, so the next pass simply finds less.
   */
  private async walk(
    context: Context,
    prefix: string,
    take: (item: Item) => Promise<boolean>,
  ): Promise<void> {
    let startKey: Record<string, unknown> | undefined;
    do {
      if (context.budget <= 0) return;
      const page = await this.deps.db.send(
        new QueryCommand({
          TableName: this.deps.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
          ExpressionAttributeValues: { ':pk': this.partitionOf(context), ':prefix': prefix },
          // What was written a moment ago is exactly what a purge must not
          // miss: the note that landed in a folder as it was being removed.
          ConsistentRead: true,
          ...(startKey ? { ExclusiveStartKey: startKey } : {}),
        }),
      );
      for (const item of (page.Items ?? []) as Item[]) {
        if (context.budget <= 0) return;
        if (await take(item)) {
          context.purged += 1;
          context.budget -= 1;
        }
      }
      startKey = page.LastEvaluatedKey;
    } while (startKey);
  }

  /**
   * The item goes and its event is written in the SAME transaction, so a purge
   * that happened is a purge the trail records (§10.4). The event travels the
   * ordinary way, through the outbox of the notebook it belonged to.
   */
  private async record(
    context: Context,
    unit: {
      type: DomainEventType;
      subject: EventSubject;
      subjectId: string;
      payload: Record<string, unknown>;
      contentRef: ContentRef | null;
      storageDelta: number;
      deletes: string[];
    },
  ): Promise<void> {
    const partition = this.partitionOf(context);
    const event: DomainEvent = createEvent({
      type: unit.type,
      subscriptionId: context.subscriptionId,
      subject: unit.subject,
      subjectId: unit.subjectId,
      authorship: context.by,
      payload: unit.payload,
      contentRef: unit.contentRef,
      storageDelta: unit.storageDelta,
      occurredAt: Instant.now(),
    });

    const items = [
      ...unit.deletes.map((sk) => ({
        Delete: { TableName: this.deps.tableName, Key: { PK: partition, SK: sk } },
      })),
      {
        Put: {
          TableName: this.deps.tableName,
          Item: outboxItem(event, partition, `EVENT#${event.eventId}`),
        },
      },
    ];

    // A transaction takes 100 items; the tree of a notebook can exceed that.
    for (let index = 0; index < items.length; index += MAX_TRANSACT_ITEMS) {
      const chunk = items.slice(index, index + MAX_TRANSACT_ITEMS);
      await this.deps.db.send(new TransactWriteCommand({ TransactItems: chunk }));
    }
  }

  /** Every item of a notebook lives in this one partition (§9.3, rule 1). */
  private partitionOf(context: Context): string {
    return `S#${context.subscriptionId.value}#NOTEBOOK#${context.notebookId}`;
  }
}

const MAX_TRANSACT_ITEMS = 100;

interface Context {
  readonly subscriptionId: SubscriptionId;
  readonly by: Authorship;
  readonly purger: ContentPurger;
  readonly notebookId: string;
  budget: number;
  purged: number;
}
