/**
 * Note: an Aggregate Root of its own, deliberately NOT part of Vault.
 *
 * If it were inside, creating a note would have to load and lock the whole
 * tree, and the structural invariants do not depend on note content. "A folder
 * with notes cannot be removed without a policy" is eventual consistency (via
 * event), not a transactional invariant. It is the most important modelling
 * decision in the system, because it is what keeps note writing cheap and
 * concurrent (architecture-guide.md, section 6.2).
 *
 * Two details follow from it:
 *  - vaultId is NOT readonly: moving between vaults is a first-class operation
 *    and the NoteId is preserved (RN-KNW-023), which is what keeps the audit
 *    timeline intact, since its key is by subject and not by vault.
 *  - replaceBody takes an ALREADY written ContentRef: whoever talks to S3 is
 *    the use case, never the aggregate.
 */

import {
  type Authorship,
  type ContentRef,
  createEvent,
  DomainError,
  err,
  type FolderId,
  type Instant,
  type NoteId,
  ok,
  type Position,
  type Slug,
  type SubscriptionId,
  type VaultId,
  type DomainEvent,
  type Result,
} from '@memorysmith/kernel';
import type { NoteTitle } from '../values.js';

export class Note {
  private readonly events: DomainEvent[] = [];

  private constructor(
    readonly id: NoteId,
    readonly subscriptionId: SubscriptionId,
    private _vaultId: VaultId,
    private _folderId: FolderId,
    private _title: NoteTitle,
    private _slug: Slug,
    private _position: Position,
    private _bodyRef: ContentRef,
    readonly createdBy: Authorship,
    private _updatedBy: Authorship,
    private _deletedAt: Instant | null,
    private _version: number,
  ) {}

  static create(input: {
    id: NoteId;
    subscriptionId: SubscriptionId;
    vaultId: VaultId;
    folderId: FolderId;
    title: NoteTitle;
    slug: Slug;
    position: Position;
    bodyRef: ContentRef;
    by: Authorship;
  }): Result<Note, DomainError> {
    const note = new Note(
      input.id,
      input.subscriptionId,
      input.vaultId,
      input.folderId,
      input.title,
      input.slug,
      input.position,
      input.bodyRef,
      input.by,
      input.by,
      null,
      0,
    );
    note.record(
      'NoteCreated',
      input.by,
      {
        vaultId: input.vaultId.value,
        noteId: input.id.value,
        folderId: input.folderId.value,
        title: input.title.value,
        slug: input.slug.value,
        position: input.position.value,
      },
      input.bodyRef,
    );
    return ok(note);
  }

  static rehydrate(input: {
    id: NoteId;
    subscriptionId: SubscriptionId;
    vaultId: VaultId;
    folderId: FolderId;
    title: NoteTitle;
    slug: Slug;
    position: Position;
    bodyRef: ContentRef;
    createdBy: Authorship;
    updatedBy: Authorship;
    deletedAt: Instant | null;
    version: number;
  }): Note {
    return new Note(
      input.id,
      input.subscriptionId,
      input.vaultId,
      input.folderId,
      input.title,
      input.slug,
      input.position,
      input.bodyRef,
      input.createdBy,
      input.updatedBy,
      input.deletedAt,
      input.version,
    );
  }

  /** The version currently stored, which is what the optimistic lock expects. */
  get version(): number {
    return this._version;
  }

  /** Called by the repository after a successful write. */
  markPersisted(): void {
    this._version += 1;
  }

  get vaultId(): VaultId {
    return this._vaultId;
  }
  get folderId(): FolderId {
    return this._folderId;
  }
  get title(): NoteTitle {
    return this._title;
  }
  get slug(): Slug {
    return this._slug;
  }
  get position(): Position {
    return this._position;
  }
  get bodyRef(): ContentRef {
    return this._bodyRef;
  }
  get updatedBy(): Authorship {
    return this._updatedBy;
  }
  get deletedAt(): Instant | null {
    return this._deletedAt;
  }
  get isDeleted(): boolean {
    return this._deletedAt !== null;
  }
  /** The revision a caller must echo back as baseRevision (RN-AGT-005). */
  get revision(): string {
    return this._bodyRef.versionId;
  }

  retitle(title: NoteTitle, slug: Slug, by: Authorship): Result<void, DomainError> {
    if (this.isDeleted) return err(DomainError.notFound('This note is deleted'));
    this._title = title;
    this._slug = slug;
    this._updatedBy = by;
    this.record(
      'NoteUpdated',
      by,
      {
        vaultId: this._vaultId.value,
        noteId: this.id.value,
        folderId: this._folderId.value,
        title: title.value,
        slug: slug.value,
      },
      this._bodyRef,
    );
    return ok();
  }

  /**
   * If the content is byte-for-byte identical to the current one there is no
   * new revision, no event and no re-indexing (RN-KNW-028). The caller can
   * tell it was a no-op because no event was recorded.
   */
  replaceBody(ref: ContentRef, by: Authorship): Result<boolean, DomainError> {
    if (this.isDeleted) return err(DomainError.notFound('This note is deleted'));
    if (this._bodyRef.hasSameContentAs(ref)) return ok(false);

    this._bodyRef = ref;
    this._updatedBy = by;
    this.record(
      'NoteUpdated',
      by,
      {
        vaultId: this._vaultId.value,
        noteId: this.id.value,
        folderId: this._folderId.value,
        title: this._title.value,
        slug: this._slug.value,
      },
      ref,
    );
    return ok(true);
  }

  /**
   * A single write on this item: zero bytes in S3, and the vault META item is
   * not touched (PE8). The Position itself is computed by the use case, which
   * is the only layer that can see the siblings.
   */
  reorder(position: Position, by: Authorship): Result<void, DomainError> {
    if (this.isDeleted) return err(DomainError.notFound('This note is deleted'));
    this._position = position;
    this._updatedBy = by;
    this.record('NoteReordered', by, {
      vaultId: this._vaultId.value,
      noteId: this.id.value,
      folderId: this._folderId.value,
      position: position.value,
    });
    return ok();
  }

  /**
   * Moving preserves the NoteId, and with it the whole timeline of the note
   * (RN-KNW-023). Implementing it as delete plus create would lose the history
   * exactly where it matters.
   *
   * The slug arrives already resolved against the destination vault: the
   * conflict policy is applied by NoteRelocation, which is the domain service
   * that can see whether the slug is taken there (RN-KNW-022).
   */
  moveTo(
    destination: { vaultId: VaultId; folderId: FolderId; slug: Slug; position: Position },
    by: Authorship,
  ): Result<void, DomainError> {
    if (this.isDeleted) return err(DomainError.notFound('This note is deleted'));

    const fromVaultId = this._vaultId;
    const fromFolderId = this._folderId;
    if (fromVaultId.equals(destination.vaultId) && fromFolderId.equals(destination.folderId)) {
      return err(DomainError.validation('The note is already in that folder'));
    }

    this._vaultId = destination.vaultId;
    this._folderId = destination.folderId;
    this._slug = destination.slug;
    this._position = destination.position;
    this._updatedBy = by;
    this.record('NoteMoved', by, {
      noteId: this.id.value,
      fromVaultId: fromVaultId.value,
      fromFolderId: fromFolderId.value,
      toVaultId: destination.vaultId.value,
      toFolderId: destination.folderId.value,
      slug: destination.slug.value,
      position: destination.position.value,
    });
    return ok();
  }

  /**
   * Soft delete: the note leaves the listings and the search, the bodyRef stays
   * intact and the timeline keeps answering by NoteId (RN-KNW-029). The slug is
   * released back to the vault in the same transaction (RN-KNW-030).
   */
  delete(by: Authorship): Result<void, DomainError> {
    if (this.isDeleted) return err(DomainError.notFound('This note is already deleted'));
    this._deletedAt = by.at;
    this._updatedBy = by;
    this.record('NoteDeleted', by, {
      vaultId: this._vaultId.value,
      noteId: this.id.value,
      folderId: this._folderId.value,
      slug: this._slug.value,
    });
    return ok();
  }

  /** Restoring requires the slug to be free again (RN-KNW-030). */
  restore(by: Authorship): Result<void, DomainError> {
    if (!this.isDeleted) return err(DomainError.conflict('This note is not deleted'));
    this._deletedAt = null;
    this._updatedBy = by;
    this.record('NoteRestored', by, {
      vaultId: this._vaultId.value,
      noteId: this.id.value,
      folderId: this._folderId.value,
      slug: this._slug.value,
      position: this._position.value,
    });
    return ok();
  }

  get hasChanges(): boolean {
    return this.events.length > 0;
  }

  pullEvents(): DomainEvent[] {
    return this.events.splice(0, this.events.length);
  }

  private record(
    type: Parameters<typeof createEvent>[0]['type'],
    by: Authorship,
    payload: Record<string, unknown>,
    contentRef: ContentRef | null = null,
  ): void {
    this.events.push(
      createEvent({
        type,
        subscriptionId: this.subscriptionId,
        subject: 'NOTE',
        subjectId: this.id.value,
        authorship: by,
        payload,
        contentRef,
      }),
    );
  }
}
