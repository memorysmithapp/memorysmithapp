/**
 * Vault: Aggregate Root of the Knowledge context.
 *
 * Consistency boundary: the vault and ITS WHOLE FOLDER TREE. Notes are a
 * separate aggregate on purpose (see Note.ts), because holding them here would
 * make creating a note load and lock the entire tree, and note writing is the
 * hot path the agent feeds the vault through.
 *
 * Authorship is a mandatory argument of every state-changing operation (PE6):
 * there is no anonymous mutation, because the method signature makes one
 * impossible, and that is what guarantees the emitted event always knows who
 * caused it.
 *
 * Guidance and Template are ContentRef pointers: the aggregate never carries
 * the Markdown itself (PP4, architecture-guide.md section 6.1).
 */

import {
  type Authorship,
  type ContentRef,
  createEvent,
  DomainError,
  err,
  FolderId,
  type Instant,
  ok,
  Role,
  Slug,
  type SubscriptionId,
  type VaultId,
  type VaultRoleLimit,
  type DomainEvent,
  type Result,
  type UserId,
} from '@memorysmith/kernel';
import { FolderTreePlacement } from '../services/FolderTreePlacement.js';
import {
  type FolderDescription,
  type FolderName,
  type RemovalPolicy,
  type ShortText,
  VAULT_LIMITS,
  type VaultName,
} from '../values.js';
import { Folder } from './Folder.js';
import { FolderTree } from './FolderTree.js';

export class Vault {
  private readonly events: DomainEvent[] = [];

  private constructor(
    readonly id: VaultId,
    readonly subscriptionId: SubscriptionId,
    private _name: VaultName,
    private _slug: Slug,
    private _description: ShortText,
    private _guidanceRef: ContentRef | null,
    private _folders: FolderTree,
    /** Per-user ceilings, loaded by the SAME Query that loaded the vault. */
    private readonly _limits: Map<string, VaultRoleLimit>,
    /**
     * Note counts per folder, maintained by the outbox relay OUTSIDE the user
     * transaction (architecture-guide.md, section 10.3). Eventually consistent
     * on purpose: the number guides the agent and the UI and takes part in no
     * invariant.
     */
    private readonly _noteCounts: Map<string, number>,
    private readonly _vaultNoteCount: number,
    private _version: number,
    readonly createdBy: Authorship,
    private _updatedAt: Instant,
    /** Set means soft-deleted: the vault is out of every listing, intact. */
    private _deletedAt: Instant | null,
  ) {}

  static create(input: {
    id: VaultId;
    subscriptionId: SubscriptionId;
    name: VaultName;
    description: ShortText;
    by: Authorship;
  }): Result<Vault, DomainError> {
    const slug = Slug.from(input.name.value);
    if (!slug.ok) return slug;

    const vault = new Vault(
      input.id,
      input.subscriptionId,
      input.name,
      slug.value,
      input.description,
      null,
      FolderTree.empty(),
      new Map(),
      new Map(),
      0,
      0,
      input.by,
      input.by.at,
      null,
    );
    vault.record('VaultCreated', 'VAULT', input.id.value, input.by, {
      vaultId: input.id.value,
      name: input.name.value,
      slug: slug.value.value,
      description: input.description.value,
    });
    return ok(vault);
  }

  /** Rehydration from storage. No event is recorded and no rule is re-run. */
  static rehydrate(input: {
    id: VaultId;
    subscriptionId: SubscriptionId;
    name: VaultName;
    slug: Slug;
    description: ShortText;
    guidanceRef: ContentRef | null;
    folders: Folder[];
    limits: Map<string, VaultRoleLimit>;
    noteCounts: Map<string, number>;
    vaultNoteCount: number;
    version: number;
    createdBy: Authorship;
    updatedAt: Instant;
    deletedAt: Instant | null;
  }): Vault {
    return new Vault(
      input.id,
      input.subscriptionId,
      input.name,
      input.slug,
      input.description,
      input.guidanceRef,
      FolderTree.fromFolders(input.folders),
      input.limits,
      input.noteCounts,
      input.vaultNoteCount,
      input.version,
      input.createdBy,
      input.updatedAt,
      input.deletedAt,
    );
  }

  // ---- Reads ---------------------------------------------------------------

  /** The version currently stored, which is what the optimistic lock expects. */
  get version(): number {
    return this._version;
  }

  /**
   * Called by the repository after a successful write. Keeping the counter
   * here, rather than in the repository, is what lets the same aggregate be
   * saved twice in one request without the second write guessing wrong.
   */
  markPersisted(): void {
    this._version += 1;
  }

  get name(): VaultName {
    return this._name;
  }
  get slug(): Slug {
    return this._slug;
  }
  get description(): ShortText {
    return this._description;
  }
  get guidanceRef(): ContentRef | null {
    return this._guidanceRef;
  }
  get hasGuidance(): boolean {
    return this._guidanceRef !== null;
  }
  get folders(): FolderTree {
    return this._folders;
  }
  get updatedAt(): Instant {
    return this._updatedAt;
  }
  get deletedAt(): Instant | null {
    return this._deletedAt;
  }
  get isDeleted(): boolean {
    return this._deletedAt !== null;
  }

  noteCountOf(folderId: FolderId): number {
    return this._noteCounts.get(folderId.value) ?? 0;
  }

  /** The vault-wide counter, kept in its own item so it is not a bottleneck. */
  get noteCount(): number {
    return this._vaultNoteCount;
  }

  /**
   * The ceiling of a member in this vault, expressed as a role so that the
   * authorization decision is a single min(). No ceiling yields OWNER, which
   * is the identity element of that min: absent a ceiling, nothing demotes
   * (RN-ACC-011, RN-ACC-013).
   */
  limitFor(user: UserId): Role {
    return this._limits.has(user.value) ? Role.VIEWER : Role.OWNER;
  }

  hasLimitFor(user: UserId): boolean {
    return this._limits.has(user.value);
  }

  /** The members currently under a ceiling, for the persistence diff. */
  get limitedUserIds(): string[] {
    return [...this._limits.keys()];
  }

  // ---- Vault-level mutations ----------------------------------------------

  rename(name: VaultName, by: Authorship): Result<void, DomainError> {
    const slug = Slug.from(name.value);
    if (!slug.ok) return slug;
    this._name = name;
    this._slug = slug.value;
    this.touch(by.at);
    this.record('VaultRenamed', 'VAULT', this.id.value, by, {
      vaultId: this.id.value,
      name: name.value,
      slug: slug.value.value,
    });
    return ok();
  }

  /**
   * Soft delete, the same promise deleting a note makes (rule 8, RN-KNW-033):
   * the vault leaves every listing and NOT ONE BYTE is destroyed. The folders,
   * the notes and every revision they point at stay exactly where they were,
   * which is what makes this reversible and what keeps the audit trail
   * readable afterwards. Destroying content remains an administrative act with
   * its own port and its own event (RN-AUD-007).
   *
   * The slug goes back to being available, exactly as a deleted note frees
   * its own (RN-KNW-030), so restoring requires it to be free again.
   */
  delete(by: Authorship): Result<void, DomainError> {
    if (this.isDeleted) return err(DomainError.notFound('This vault is already deleted'));
    this._deletedAt = by.at;
    this.touch(by.at);
    this.record('VaultDeleted', 'VAULT', this.id.value, by, {
      vaultId: this.id.value,
      slug: this._slug.value,
      noteCount: this._vaultNoteCount,
    });
    return ok();
  }

  restore(by: Authorship): Result<void, DomainError> {
    if (!this.isDeleted) return err(DomainError.conflict('This vault is not deleted'));
    this._deletedAt = null;
    this.touch(by.at);
    this.record('VaultRestored', 'VAULT', this.id.value, by, {
      vaultId: this.id.value,
      slug: this._slug.value,
    });
    return ok();
  }

  /**
   * Receives a ContentRef that is ALREADY written: whoever talks to the
   * ContentStore is the use case, never the aggregate (section 10.5).
   */
  setGuidance(ref: ContentRef, by: Authorship): Result<void, DomainError> {
    if (this._guidanceRef?.hasSameContentAs(ref)) {
      // Byte-for-byte identical content: no new revision, no event (RN-KNW-028).
      return ok();
    }
    // A guidance replaces the previous one, so what is stored grows only by
    // the difference; the first one ever set grows by all of it.
    const delta = ref.bytes - (this._guidanceRef?.bytes ?? 0);
    this._guidanceRef = ref;
    this.touch(by.at);
    this.record(
      'GuidanceUpdated',
      'VAULT',
      this.id.value,
      by,
      { vaultId: this.id.value },
      ref,
      delta,
    );
    return ok();
  }

  setRoleLimit(user: UserId, limit: VaultRoleLimit, by: Authorship): Result<void, DomainError> {
    this._limits.set(user.value, limit);
    this.touch(by.at);
    this.record('VaultRoleLimitSet', 'VAULT', this.id.value, by, {
      vaultId: this.id.value,
      userId: user.value,
      limit: limit.toString(),
    });
    return ok();
  }

  clearRoleLimit(user: UserId, by: Authorship): Result<void, DomainError> {
    if (!this._limits.delete(user.value)) {
      return err(DomainError.notFound('This member has no ceiling in this vault'));
    }
    this.touch(by.at);
    this.record('VaultRoleLimitCleared', 'VAULT', this.id.value, by, {
      vaultId: this.id.value,
      userId: user.value,
    });
    return ok();
  }

  // ---- Folder mutations ----------------------------------------------------

  addFolder(
    parentFolderId: FolderId | null,
    name: FolderName,
    description: FolderDescription,
    afterFolderId: FolderId | null,
    by: Authorship,
  ): Result<Folder, DomainError> {
    if (this._folders.size >= VAULT_LIMITS.maxFolders) {
      return err(
        DomainError.limitExceeded(`A vault holds at most ${VAULT_LIMITS.maxFolders} folders`),
      );
    }
    const slug = Slug.from(name.value);
    if (!slug.ok) return slug;
    // I1: the slug is unique among siblings (RN-KNW-002).
    if (this._folders.hasSiblingSlug(parentFolderId, slug.value.value)) {
      return err(
        DomainError.conflict(`A sibling folder already uses the slug "${slug.value.value}"`),
      );
    }
    // I2 and the existence of the parent are the placement service's business.
    const placement = FolderTreePlacement.forNewFolder(
      this._folders,
      parentFolderId,
      afterFolderId,
    );
    if (!placement.ok) return placement;

    const folder = Folder.create({
      id: FolderId.generate(),
      parentFolderId,
      name,
      slug: slug.value,
      description,
      position: placement.value.position,
      createdBy: by,
    });
    this._folders = this._folders.withFolder(folder);
    this.touch(by.at);
    this.record('FolderAdded', 'FOLDER', folder.id.value, by, {
      vaultId: this.id.value,
      folderId: folder.id.value,
      parentFolderId: parentFolderId?.value ?? null,
      name: name.value,
      slug: folder.slug.value,
      description: description.value,
      position: folder.position.value,
    });
    return ok(folder);
  }

  renameFolder(id: FolderId, name: FolderName, by: Authorship): Result<void, DomainError> {
    const folder = this._folders.get(id);
    if (!folder) return err(DomainError.notFound('Folder not found in this vault'));

    const slug = Slug.from(name.value);
    if (!slug.ok) return slug;
    if (this._folders.hasSiblingSlug(folder.parentFolderId, slug.value.value, id)) {
      return err(
        DomainError.conflict(`A sibling folder already uses the slug "${slug.value.value}"`),
      );
    }
    folder.rename(name, slug.value, by.at);
    this.touch(by.at);
    this.record('FolderRenamed', 'FOLDER', id.value, by, {
      vaultId: this.id.value,
      folderId: id.value,
      name: name.value,
      slug: slug.value.value,
    });
    return ok();
  }

  describeFolder(
    id: FolderId,
    description: FolderDescription,
    by: Authorship,
  ): Result<void, DomainError> {
    const folder = this._folders.get(id);
    if (!folder) return err(DomainError.notFound('Folder not found in this vault'));
    folder.describe(description, by.at);
    this.touch(by.at);
    this.record('FolderDescribed', 'FOLDER', id.value, by, {
      vaultId: this.id.value,
      folderId: id.value,
      description: description.value,
    });
    return ok();
  }

  moveFolder(
    id: FolderId,
    newParentFolderId: FolderId | null,
    afterFolderId: FolderId | null,
    by: Authorship,
  ): Result<void, DomainError> {
    const folder = this._folders.get(id);
    if (!folder) return err(DomainError.notFound('Folder not found in this vault'));
    if (this._folders.hasSiblingSlug(newParentFolderId, folder.slug.value, id)) {
      return err(
        DomainError.conflict(`A sibling folder already uses the slug "${folder.slug.value}"`),
      );
    }
    // I2 and I3, subtree included, live in the placement service.
    const placement = FolderTreePlacement.forMove(
      this._folders,
      id,
      newParentFolderId,
      afterFolderId,
    );
    if (!placement.ok) return placement;

    const fromParent = folder.parentFolderId;
    folder.moveTo(newParentFolderId, placement.value.position, by.at);
    this._folders = this._folders.withFolder(folder);
    this.touch(by.at);
    this.record('FolderMoved', 'FOLDER', id.value, by, {
      vaultId: this.id.value,
      folderId: id.value,
      fromParentFolderId: fromParent?.value ?? null,
      toParentFolderId: newParentFolderId?.value ?? null,
      position: folder.position.value,
    });
    return ok();
  }

  /** A single write on the moved item, whatever the number of siblings. */
  reorderFolder(
    id: FolderId,
    afterFolderId: FolderId | null,
    by: Authorship,
  ): Result<void, DomainError> {
    const folder = this._folders.get(id);
    if (!folder) return err(DomainError.notFound('Folder not found in this vault'));

    const position = FolderTreePlacement.forReorder(this._folders, id, afterFolderId);
    if (!position.ok) return position;
    folder.reorder(position.value, by.at);
    this._folders = this._folders.withFolder(folder);
    this.touch(by.at);
    this.record('FolderReordered', 'FOLDER', id.value, by, {
      vaultId: this.id.value,
      folderId: id.value,
      position: folder.position.value,
    });
    return ok();
  }

  /**
   * Removing a folder that holds folders or notes requires an explicit policy
   * (RN-KNW-007, I5). "Holds notes" is answered by the eventually consistent
   * counters that arrived with the aggregate, which is deliberate: the rule is
   * eventual consistency, not a transactional invariant (section 6.2).
   */
  removeFolder(
    id: FolderId,
    policy: RemovalPolicy,
    by: Authorship,
  ): Result<FolderId[], DomainError> {
    const folder = this._folders.get(id);
    if (!folder) return err(DomainError.notFound('Folder not found in this vault'));

    const descendants = this._folders.descendantsOf(id);
    const subtree = [folder, ...descendants];
    const holdsNotes = subtree.some((each) => this.noteCountOf(each.id) > 0);

    if (!policy.cascades && (descendants.length > 0 || holdsNotes)) {
      return err(
        DomainError.conflict('This folder is not empty; removing it requires the CASCADE policy', {
          folders: descendants.length,
          notes: subtree.reduce((total, each) => total + this.noteCountOf(each.id), 0),
        }),
      );
    }

    const removed = subtree.map((each) => each.id);
    this._folders = this._folders.without(removed);
    this.touch(by.at);
    this.record('FolderRemoved', 'FOLDER', id.value, by, {
      vaultId: this.id.value,
      folderId: id.value,
      removedFolderIds: removed.map((each) => each.value),
    });
    return ok(removed);
  }

  attachTemplate(id: FolderId, ref: ContentRef, by: Authorship): Result<void, DomainError> {
    const folder = this._folders.get(id);
    if (!folder) return err(DomainError.notFound('Folder not found in this vault'));
    if (folder.templateRef?.hasSameContentAs(ref)) return ok();

    const delta = ref.bytes - (folder.templateRef?.bytes ?? 0);
    folder.attachTemplate(ref, by.at);
    this._folders = this._folders.withFolder(folder);
    this.touch(by.at);
    this.record(
      'TemplateUpdated',
      'FOLDER',
      id.value,
      by,
      { vaultId: this.id.value, folderId: id.value },
      ref,
      delta,
    );
    return ok();
  }

  // ---- Events --------------------------------------------------------------

  get hasChanges(): boolean {
    return this.events.length > 0;
  }

  pullEvents(): DomainEvent[] {
    return this.events.splice(0, this.events.length);
  }

  private touch(at: Instant): void {
    this._updatedAt = at;
  }

  private record(
    type: Parameters<typeof createEvent>[0]['type'],
    subject: Parameters<typeof createEvent>[0]['subject'],
    subjectId: string,
    by: Authorship,
    payload: Record<string, unknown>,
    contentRef: ContentRef | null = null,
    storageDelta = 0,
  ): void {
    this.events.push(
      createEvent({
        type,
        subscriptionId: this.subscriptionId,
        subject,
        subjectId,
        authorship: by,
        payload,
        contentRef,
        storageDelta,
      }),
    );
  }
}
