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
  type VaultId,
  type WorkspaceId,
} from '@memorysmith/kernel';
import { createHash } from 'node:crypto';
import type { Note } from '../../../domain/note/Note.js';
import type { NoteOrder } from '../../../domain/services/NotePlacement.js';
import type { ContentStore, NoteRepository, VaultRepository } from '../../../domain/ports/index.js';
import type { Vault } from '../../../domain/vault/Vault.js';

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

/** The shared "database", so several repositories can see the same state. */
export class InMemoryDatabase {
  readonly vaults = new Map<string, { vault: Vault; version: number }>();
  readonly notes = new Map<string, { note: Note; version: number }>();
  readonly noteSlugs = new Map<string, string>();
  readonly content = new Map<string, { revisions: Map<string, string>; latest: string }>();

  clear(): void {
    this.vaults.clear();
    this.notes.clear();
    this.noteSlugs.clear();
    this.content.clear();
  }
}

function vaultKey(sub: SubscriptionContext, id: VaultId): string {
  return `S#${sub.subscriptionId.value}#VAULT#${id.value}`;
}

function noteKey(sub: SubscriptionContext, vault: VaultId, note: NoteId): string {
  return `${vaultKey(sub, vault)}#NOTE#${note.value}`;
}

function slugKey(sub: SubscriptionContext, vault: VaultId, slug: string): string {
  return `${vaultKey(sub, vault)}#NSLUG#${slug}`;
}

export class InMemoryVaultRepository implements VaultRepository {
  constructor(
    private readonly sub: SubscriptionContext,
    private readonly db: InMemoryDatabase,
    private readonly events: EventPublisher,
  ) {}

  async findById(id: VaultId): Promise<Vault | null> {
    return this.db.vaults.get(vaultKey(this.sub, id))?.vault ?? null;
  }

  async listByWorkspace(workspaceId: WorkspaceId): Promise<Vault[]> {
    const prefix = `S#${this.sub.subscriptionId.value}#VAULT#`;
    return [...this.db.vaults.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, entry]) => entry.vault)
      .filter((vault) => vault.workspaceId.equals(workspaceId));
  }

  async save(vault: Vault): Promise<Result<void, ConcurrencyError>> {
    const key = vaultKey(this.sub, vault.id);
    const stored = this.db.vaults.get(key);
    if (stored && stored.version !== vault.version) {
      return { ok: false, error: new ConcurrencyError() };
    }
    const events = vault.pullEvents();
    vault.markPersisted();
    this.db.vaults.set(key, { vault, version: vault.version });
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

  async findById(vault: VaultId, id: NoteId): Promise<Note | null> {
    return this.db.notes.get(noteKey(this.sub, vault, id))?.note ?? null;
  }

  async findBySlug(vault: VaultId, slug: Slug): Promise<Note | null> {
    const noteId = this.db.noteSlugs.get(slugKey(this.sub, vault, slug.value));
    if (!noteId) return null;
    const found = [...this.db.notes.values()].find((entry) => entry.note.id.value === noteId);
    return found?.note ?? null;
  }

  async listByFolder(vault: VaultId, folder: FolderId): Promise<Note[]> {
    return (await this.listByVault(vault))
      .filter((note) => note.folderId.equals(folder))
      .sort((left, right) => left.position.compare(right.position));
  }

  async listByVault(vault: VaultId): Promise<Note[]> {
    const prefix = `${vaultKey(this.sub, vault)}#NOTE#`;
    return [...this.db.notes.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, entry]) => entry.note)
      .filter((note) => !note.isDeleted);
  }

  async siblingOrder(vault: VaultId, folder: FolderId): Promise<NoteOrder[]> {
    return (await this.listByFolder(vault, folder)).map((note) => ({
      noteId: note.id,
      position: note.position,
    }));
  }

  async save(note: Note): Promise<Result<void, ConcurrencyError>> {
    const key = noteKey(this.sub, note.vaultId, note.id);
    const stored = this.db.notes.get(key);
    if (stored && stored.version !== note.version) {
      return { ok: false, error: new ConcurrencyError() };
    }

    const slug = slugKey(this.sub, note.vaultId, note.slug.value);
    const holder = this.db.noteSlugs.get(slug);
    if (!note.isDeleted && holder && holder !== note.id.value) {
      // The NSLUG guard: the slug is unique within the vault (RN-KNW-020).
      return { ok: false, error: new ConcurrencyError('That slug is already taken in this vault') };
    }

    // A deleted note releases its slug back to the vault (RN-KNW-030).
    if (note.isDeleted) this.db.noteSlugs.delete(slug);
    else this.db.noteSlugs.set(slug, note.id.value);

    // Drop any stale guard this note used to hold under another slug.
    for (const [existing, owner] of this.db.noteSlugs) {
      if (owner === note.id.value && existing !== slug) this.db.noteSlugs.delete(existing);
    }

    const events = note.pullEvents();
    note.markPersisted();
    this.db.notes.set(key, { note, version: note.version });
    await this.events.publish(events);
    return ok();
  }

  async saveMoved(
    note: Note,
    from: { vaultId: VaultId; slug: Slug },
  ): Promise<Result<void, ConcurrencyError>> {
    // The item key itself changes, so the old one is deleted and a new one is
    // written; the origin slug guard goes with it, or the slug would stay
    // pinned in the origin vault forever.
    this.db.notes.delete(noteKey(this.sub, from.vaultId, note.id));
    this.db.noteSlugs.delete(slugKey(this.sub, from.vaultId, from.slug.value));
    return this.save(note);
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
