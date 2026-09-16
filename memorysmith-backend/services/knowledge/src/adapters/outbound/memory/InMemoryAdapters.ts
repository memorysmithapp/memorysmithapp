/**
 * In-memory adapters (architecture-guide.md, section 7.2). They exist so that
 * use cases can be tested without DynamoDB Local or MinIO, and they honour the
 * same two properties the production ones do:
 *
 *  - the subscription comes from the SubscriptionContext held by the
 *    repository, never from a method argument (PE2);
 *  - saving state and recording the events is one atomic step, which is what
 *    the outbox buys in production (section 10.4).
 */

import {
  ConcurrencyError,
  ContentId,
  ContentRef,
  Instant,
  ok,
  type DomainEvent,
  type EventPublisher,
  type FolderId,
  type NoteId,
  type Result,
  type Slug,
  type SubscriptionContext,
  type NotebookId,
} from '@memorysmith/kernel';
import { createHash } from 'node:crypto';
import type { Note } from '../../../domain/note/Note.js';
import type { ContentSlot } from '../../../domain/content-slot/ContentSlot.js';
import type { Guidance } from '../../../domain/content-slot/Guidance.js';
import type { Template } from '../../../domain/content-slot/Template.js';
import type { NoteOrder } from '../../../domain/services/NotePlacement.js';
import type {
  ContentSlotRepository,
  ContentStore,
  NoteRepository,
  NotebookRepository,
} from '../../../domain/ports/index.js';
import type { StorageBudget, StorageState } from '../../../domain/services/StorageQuota.js';
import { Notebook } from '../../../domain/notebook/Notebook.js';
import { NotebookRoleLimit } from '@memorysmith/kernel';

/** Records what was published, so a test can assert on the event stream. */
export class RecordingEventPublisher implements EventPublisher {
  readonly published: DomainEvent[] = [];

  async publish(events: DomainEvent[]): Promise<void> {
    this.published.push(...events);
  }

  ofType(type: string): DomainEvent[] {
    return this.published.filter((event) => event.type === type);
  }

  clear(): void {
    this.published.length = 0;
  }
}

/**
 * The storage budget, in memory. Production keeps the used bytes in a counter
 * the outbox relay maintains; a test states them directly, and moves them with
 * `record()` to stand in for the relay having caught up.
 *
 * The default limit is generous on purpose: a test that is not about the quota
 * must never trip over it.
 */
export class InMemoryStorageBudget implements StorageBudget {
  constructor(
    public limitBytes = Number.MAX_SAFE_INTEGER,
    public usedBytes = 0,
  ) {}

  async current(): Promise<StorageState> {
    return { usedBytes: this.usedBytes, limitBytes: this.limitBytes };
  }

  /** What the relay would have applied for these events (RN-SUB-021). */
  record(events: readonly DomainEvent[]): void {
    for (const event of events) this.usedBytes += event.storageDelta;
    if (this.usedBytes < 0) this.usedBytes = 0;
  }
}

/** The shared "database", so several repositories can see the same state. */
export class InMemoryDatabase {
  readonly notebooks = new Map<string, { notebook: Notebook; version: number }>();
  readonly notes = new Map<string, { note: Note; version: number }>();
  readonly slots = new Map<string, { slot: ContentSlot; version: number }>();
  readonly content = new Map<string, { revisions: Map<string, string>; latest: string }>();

  clear(): void {
    this.notebooks.clear();
    this.notes.clear();
    this.slots.clear();
    this.content.clear();
  }
}

function notebookKey(sub: SubscriptionContext, id: NotebookId): string {
  return `S#${sub.subscriptionId.value}#NOTEBOOK#${id.value}`;
}

function noteKey(sub: SubscriptionContext, notebook: NotebookId, note: NoteId): string {
  return `${notebookKey(sub, notebook)}#NOTE#${note.value}`;
}

function guidanceKey(sub: SubscriptionContext, notebook: NotebookId): string {
  return `${notebookKey(sub, notebook)}#GUIDANCE`;
}

function templateKey(sub: SubscriptionContext, notebook: NotebookId, folder: FolderId): string {
  return `${notebookKey(sub, notebook)}#TEMPLATE#${folder.value}`;
}

/**
 * Which folders carry a Template and whether the notebook has a Guidance, as
 * the one Query of production reads them from the same partition: the slots
 * are aggregates of their own, and this is the read model the tree reports
 * (RN-KNW-044). Loading a notebook rebuilds it, which is what the Query does.
 */
function withSlotReadModel(
  notebook: Notebook,
  sub: SubscriptionContext,
  db: InMemoryDatabase,
): Notebook {
  const prefix = `${notebookKey(sub, notebook.id)}#TEMPLATE#`;
  const templatedFolderIds = new Set(
    [...db.slots.keys()]
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length)),
  );
  return Notebook.rehydrate({
    id: notebook.id,
    subscriptionId: notebook.subscriptionId,
    name: notebook.name,
    slug: notebook.slug,
    description: notebook.description,
    folders: notebook.folders.all(),
    limits: new Map(
      notebook.limitedUserIds.map((userId) => [userId, NotebookRoleLimit.VIEWER] as const),
    ),
    noteCounts: new Map(
      notebook.folders.all().map((folder) => [folder.id.value, notebook.noteCountOf(folder.id)]),
    ),
    notebookNoteCount: notebook.noteCount,
    templatedFolderIds,
    hasGuidance: db.slots.has(guidanceKey(sub, notebook.id)),
    version: notebook.version,
    createdBy: notebook.createdBy,
    updatedAt: notebook.updatedAt,
    deletedAt: notebook.deletedAt,
  });
}

export class InMemoryNotebookRepository implements NotebookRepository {
  constructor(
    private readonly sub: SubscriptionContext,
    private readonly db: InMemoryDatabase,
    private readonly events: EventPublisher,
  ) {}

  async findById(id: NotebookId): Promise<Notebook | null> {
    const stored = this.db.notebooks.get(notebookKey(this.sub, id))?.notebook;
    return stored ? withSlotReadModel(stored, this.sub, this.db) : null;
  }

  /**
   * A deleted notebook is out, with no filter needed in the caller: in DynamoDB
   * that is GSI1 being sparse, and here it is this line.
   */
  async listAll(): Promise<Notebook[]> {
    const prefix = `S#${this.sub.subscriptionId.value}#NOTEBOOK#`;
    return [...this.db.notebooks.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, entry]) => entry.notebook)
      .filter((notebook) => !notebook.isDeleted)
      .map((notebook) => withSlotReadModel(notebook, this.sub, this.db));
  }

  /**
   * Same answer the database gives, from the same question: which notebook of
   * this subscription holds this slug. The adapter in memory has no guard item,
   * so it looks through the list, which is the honest equivalent at this size.
   * A deleted notebook holds no slug, exactly as its guard item is released.
   */
  async findBySlug(slug: Slug): Promise<Notebook | null> {
    const notebooks = await this.listAll();
    return notebooks.find((notebook) => notebook.slug.value === slug.value) ?? null;
  }

  async save(notebook: Notebook): Promise<Result<void, ConcurrencyError>> {
    const key = notebookKey(this.sub, notebook.id);
    const stored = this.db.notebooks.get(key);
    if (stored && stored.version !== notebook.version) {
      return { ok: false, error: new ConcurrencyError() };
    }
    const events = notebook.pullEvents();
    notebook.markPersisted();
    this.db.notebooks.set(key, { notebook, version: notebook.version });
    await this.events.publish(events);
    return ok();
  }
}

export class InMemoryNoteRepository implements NoteRepository {
  constructor(
    private readonly sub: SubscriptionContext,
    private readonly db: InMemoryDatabase,
    private readonly events: EventPublisher,
  ) {}

  async findById(notebook: NotebookId, id: NoteId): Promise<Note | null> {
    return this.db.notes.get(noteKey(this.sub, notebook, id))?.note ?? null;
  }

  async listByFolder(notebook: NotebookId, folder: FolderId): Promise<Note[]> {
    return (await this.listByNotebook(notebook))
      .filter((note) => note.folderId.equals(folder))
      .sort((left, right) => left.position.compare(right.position));
  }

  async listByNotebook(notebook: NotebookId): Promise<Note[]> {
    const prefix = `${notebookKey(this.sub, notebook)}#NOTE#`;
    return [...this.db.notes.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, entry]) => entry.note)
      .filter((note) => !note.isDeleted);
  }

  async siblingOrder(notebook: NotebookId, folder: FolderId): Promise<NoteOrder[]> {
    return (await this.listByFolder(notebook, folder)).map((note) => ({
      noteId: note.id,
      position: note.position,
    }));
  }

  async findByName(notebook: NotebookId, folder: FolderId, name: string): Promise<NoteId | null> {
    return (await this.holderOf(notebook, folder, name, null))?.id ?? null;
  }

  async save(note: Note): Promise<Result<void, ConcurrencyError>> {
    const key = noteKey(this.sub, note.notebookId, note.id);
    const stored = this.db.notes.get(key);
    if (stored && stored.version !== note.version) {
      return { ok: false, error: new ConcurrencyError() };
    }
    // The guard item of DynamoDB, as a question asked of the stored notes:
    // another live note of this folder already carries the name (RN-KNW-042).
    if (
      !note.isDeleted &&
      note.name !== null &&
      (await this.holderOf(note.notebookId, note.folderId, note.name, note.id))
    ) {
      return {
        ok: false,
        error: new ConcurrencyError('A note of this folder already carries this name', {
          code: 'ALREADY_EXISTS',
        }),
      };
    }

    const events = note.pullEvents();
    note.markPersisted();
    this.db.notes.set(key, { note, version: note.version });
    await this.events.publish(events);
    return ok();
  }

  async saveMoved(
    note: Note,
    from: { notebookId: NotebookId },
  ): Promise<Result<void, ConcurrencyError>> {
    // The item key itself changes, so the old one is deleted and a new one is
    // written — unless the name is taken where it arrives, which changes
    // nothing at all.
    const previous = this.db.notes.get(noteKey(this.sub, from.notebookId, note.id));
    this.db.notes.delete(noteKey(this.sub, from.notebookId, note.id));
    const saved = await this.save(note);
    if (!saved.ok && previous) {
      this.db.notes.set(noteKey(this.sub, from.notebookId, note.id), previous);
    }
    return saved;
  }

  private async holderOf(
    notebook: NotebookId,
    folder: FolderId,
    name: string,
    except: NoteId | null,
  ): Promise<Note | null> {
    const notes = await this.listByNotebook(notebook);
    return (
      notes.find(
        (each) =>
          each.folderId.equals(folder) &&
          each.name === name &&
          (except === null || !each.id.equals(except)),
      ) ?? null
    );
  }
}

/**
 * The Guidance of a notebook and the Template of a folder, each keyed by its
 * parent, which is what makes "at most one" true here as the item key makes it
 * true in DynamoDB (RN-KNW-044).
 */
export class InMemoryContentSlotRepository implements ContentSlotRepository {
  constructor(
    private readonly sub: SubscriptionContext,
    private readonly db: InMemoryDatabase,
    private readonly events: EventPublisher,
  ) {}

  async findGuidance(notebook: NotebookId): Promise<Guidance | null> {
    return (this.db.slots.get(guidanceKey(this.sub, notebook))?.slot as Guidance) ?? null;
  }

  async findTemplate(notebook: NotebookId, folder: FolderId): Promise<Template | null> {
    return (this.db.slots.get(templateKey(this.sub, notebook, folder))?.slot as Template) ?? null;
  }

  async listTemplates(notebook: NotebookId): Promise<Template[]> {
    const prefix = `${notebookKey(this.sub, notebook)}#TEMPLATE#`;
    return [...this.db.slots.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, entry]) => entry.slot as Template);
  }

  async save(slot: ContentSlot): Promise<Result<void, ConcurrencyError>> {
    const key = slot.folderId
      ? templateKey(this.sub, slot.notebookId, slot.folderId)
      : guidanceKey(this.sub, slot.notebookId);
    const stored = this.db.slots.get(key);
    if (stored && stored.version !== slot.version) {
      return { ok: false, error: new ConcurrencyError() };
    }
    // The first write claims the key: a second one that never read it finds
    // the key taken, which is what `attribute_not_exists` answers in DynamoDB.
    if (!stored && slot.version > 0) {
      return { ok: false, error: new ConcurrencyError() };
    }

    const events = slot.pullEvents();
    slot.markPersisted();
    // Deleting takes the slot out; the content it pointed at stays in the
    // store, as it does in production (rule 8).
    if (slot.isDeleted) this.db.slots.delete(key);
    else this.db.slots.set(key, { slot, version: slot.version });
    await this.events.publish(events);
    return ok();
  }
}

export class InMemoryContentStore implements ContentStore {
  constructor(
    private readonly sub: SubscriptionContext,
    private readonly db: InMemoryDatabase,
  ) {}

  /** The same opaque key shape the S3 adapter builds. */
  private keyOf(contentId: ContentId): string {
    return `s/${this.sub.subscriptionId.value}/c/${contentId.value}.md`;
  }

  async create(markdown: string): Promise<ContentRef> {
    return this.write(ContentId.generate(), markdown);
  }

  async overwrite(slot: ContentId, markdown: string): Promise<ContentRef> {
    return this.write(slot, markdown);
  }

  async read(ref: ContentRef): Promise<string> {
    const slot = this.db.content.get(this.keyOf(ref.contentId));
    const revision = slot?.revisions.get(ref.versionId);
    if (revision === undefined) {
      throw new Error(`No such revision: ${ref.contentId.value}@${ref.versionId}`);
    }
    return revision;
  }

  private write(contentId: ContentId, markdown: string): ContentRef {
    const key = this.keyOf(contentId);
    const slot = this.db.content.get(key) ?? { revisions: new Map<string, string>(), latest: '' };
    const versionId = `v${slot.revisions.size + 1}-${Instant.now().epochMillis}`;
    slot.revisions.set(versionId, markdown);
    slot.latest = versionId;
    this.db.content.set(key, slot);

    const bytes = Buffer.byteLength(markdown, 'utf8');
    const sha256 = createHash('sha256').update(markdown, 'utf8').digest('hex');
    const ref = ContentRef.create({ contentId, versionId, sha256, bytes });
    if (!ref.ok) throw new Error(ref.error.message);
    return ref.value;
  }
}
