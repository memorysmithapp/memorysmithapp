/**
 * Notebook: Aggregate Root of the Knowledge context.
 *
 * Consistency boundary: the notebook and ITS WHOLE FOLDER TREE. Notes are a
 * separate aggregate on purpose (see Note.ts), because holding them here would
 * make creating a note load and lock the entire tree, and note writing is the
 * hot path the agent feeds the notebook through.
 *
 * Authorship is a mandatory argument of every state-changing operation (PE6):
 * there is no anonymous mutation, because the method signature makes one
 * impossible, and that is what guarantees the emitted event always knows who
 * caused it.
 *
 * The Guidance of the notebook and the Template of a folder are NOT here.
 * Each is an Aggregate Root of its own that names its parent (RN-KNW-044,
 * architecture-guide.md section 6.1), so writing one is not a tree mutation
 * and does not lock this aggregate. What stays here is what the tree has to
 * say about them: WHICH folders carry a template and whether the notebook has
 * a guidance, read in the same Query that loads the tree and taking part in no
 * invariant.
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
  type NotebookId,
  type NotebookRoleLimit,
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
  NOTEBOOK_LIMITS,
  type NotebookName,
} from '../values.js';
import { Folder } from './Folder.js';
import { FolderTree } from './FolderTree.js';

export class Notebook {
  private readonly events: DomainEvent[] = [];

  private constructor(
    readonly id: NotebookId,
    readonly subscriptionId: SubscriptionId,
    private _name: NotebookName,
    private _slug: Slug,
    private _description: ShortText,
    private _folders: FolderTree,
    /** Per-user ceilings, loaded by the SAME Query that loaded the notebook. */
    private readonly _limits: Map<string, NotebookRoleLimit>,
    /**
     * Note counts per folder, maintained by the outbox relay OUTSIDE the user
     * transaction (architecture-guide.md, section 10.3). Eventually consistent
     * on purpose: the number guides the agent and the UI and takes part in no
     * invariant.
     */
    private readonly _noteCounts: Map<string, number>,
    private readonly _notebookNoteCount: number,
    /**
     * Which folders carry a Template, and whether the notebook has a Guidance.
     * Both are read from the slot items that came back with the tree, and both
     * are read model: the aggregate answers them and never maintains them.
     */
    private readonly _templatedFolderIds: ReadonlySet<string>,
    private readonly _hasGuidance: boolean,
    private _version: number,
    readonly createdBy: Authorship,
    private _updatedAt: Instant,
    /** Set means soft-deleted: the notebook is out of every listing, intact. */
    private _deletedAt: Instant | null,
  ) {}

  static create(input: {
    id: NotebookId;
    subscriptionId: SubscriptionId;
    name: NotebookName;
    description: ShortText;
    by: Authorship;
  }): Result<Notebook, DomainError> {
    const slug = Slug.from(input.name.value);
    if (!slug.ok) return slug;

    const notebook = new Notebook(
      input.id,
      input.subscriptionId,
      input.name,
      slug.value,
      input.description,
      FolderTree.empty(),
      new Map(),
      new Map(),
      0,
      new Set(),
      false,
      0,
      input.by,
      input.by.at,
      null,
    );
    notebook.record('NotebookCreated', 'NOTEBOOK', input.id.value, input.by, {
      notebookId: input.id.value,
      name: input.name.value,
      slug: slug.value.value,
      description: input.description.value,
    });
    return ok(notebook);
  }

  /** Rehydration from storage. No event is recorded and no rule is re-run. */
  static rehydrate(input: {
    id: NotebookId;
    subscriptionId: SubscriptionId;
    name: NotebookName;
    slug: Slug;
    description: ShortText;
    folders: Folder[];
    limits: Map<string, NotebookRoleLimit>;
    noteCounts: Map<string, number>;
    notebookNoteCount: number;
    templatedFolderIds: ReadonlySet<string>;
    hasGuidance: boolean;
    version: number;
    createdBy: Authorship;
    updatedAt: Instant;
    deletedAt: Instant | null;
  }): Notebook {
    return new Notebook(
      input.id,
      input.subscriptionId,
      input.name,
      input.slug,
      input.description,
      FolderTree.fromFolders(input.folders),
      input.limits,
      input.noteCounts,
      input.notebookNoteCount,
      input.templatedFolderIds,
      input.hasGuidance,
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

  get name(): NotebookName {
    return this._name;
  }
  get slug(): Slug {
    return this._slug;
  }
  get description(): ShortText {
    return this._description;
  }
  /** Whether a Guidance exists for this notebook, as the tree query saw it. */
  get hasGuidance(): boolean {
    return this._hasGuidance;
  }
  /** Whether this folder carries a Template, as the tree query saw it. */
  hasTemplate(folderId: FolderId): boolean {
    return this._templatedFolderIds.has(folderId.value);
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

  /** The notebook-wide counter, kept in its own item so it is not a bottleneck. */
  get noteCount(): number {
    return this._notebookNoteCount;
  }

  /**
   * The ceiling of a member in this notebook, expressed as a role so that the
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

  // ---- Notebook-level mutations ----------------------------------------------

  rename(name: NotebookName, by: Authorship): Result<void, DomainError> {
    const slug = Slug.from(name.value);
    if (!slug.ok) return slug;
    this._name = name;
    this._slug = slug.value;
    this.touch(by.at);
    this.record('NotebookRenamed', 'NOTEBOOK', this.id.value, by, {
      notebookId: this.id.value,
      name: name.value,
      slug: slug.value.value,
    });
    return ok();
  }

  /**
   * Deleting is DEFINITIVE (RN-KNW-033), and this one write is the whole of
   * it: the notebook leaves every listing at once, and everything under it —
   * its folders, its notes, its Templates and its Guidance — becomes invalid
   * in the same instant without being written (RN-KNW-046). What is left is
   * purged in the background (RN-KNW-047), and nothing brings it back.
   *
   * The name goes back to being available immediately, because the notebook
   * that held it is never coming back to claim it.
   */
  delete(by: Authorship): Result<void, DomainError> {
    if (this.isDeleted) return err(DomainError.notFound('This notebook is already deleted'));
    this._deletedAt = by.at;
    this.touch(by.at);
    this.record('NotebookDeleted', 'NOTEBOOK', this.id.value, by, {
      notebookId: this.id.value,
      slug: this._slug.value,
      noteCount: this._notebookNoteCount,
    });
    return ok();
  }

  setRoleLimit(user: UserId, limit: NotebookRoleLimit, by: Authorship): Result<void, DomainError> {
    this._limits.set(user.value, limit);
    this.touch(by.at);
    this.record('NotebookRoleLimitSet', 'NOTEBOOK', this.id.value, by, {
      notebookId: this.id.value,
      userId: user.value,
      limit: limit.toString(),
    });
    return ok();
  }

  clearRoleLimit(user: UserId, by: Authorship): Result<void, DomainError> {
    if (!this._limits.delete(user.value)) {
      return err(DomainError.notFound('This member has no ceiling in this notebook'));
    }
    this.touch(by.at);
    this.record('NotebookRoleLimitCleared', 'NOTEBOOK', this.id.value, by, {
      notebookId: this.id.value,
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
    if (this._folders.size >= NOTEBOOK_LIMITS.maxFolders) {
      return err(
        DomainError.limitExceeded(`A notebook holds at most ${NOTEBOOK_LIMITS.maxFolders} folders`),
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
      notebookId: this.id.value,
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
    if (!folder) return err(DomainError.notFound('Folder not found in this notebook'));

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
      notebookId: this.id.value,
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
    if (!folder) return err(DomainError.notFound('Folder not found in this notebook'));
    folder.describe(description, by.at);
    this.touch(by.at);
    this.record('FolderDescribed', 'FOLDER', id.value, by, {
      notebookId: this.id.value,
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
    if (!folder) return err(DomainError.notFound('Folder not found in this notebook'));
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
      notebookId: this.id.value,
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
    if (!folder) return err(DomainError.notFound('Folder not found in this notebook'));

    const position = FolderTreePlacement.forReorder(this._folders, id, afterFolderId);
    if (!position.ok) return position;
    folder.reorder(position.value, by.at);
    this._folders = this._folders.withFolder(folder);
    this.touch(by.at);
    this.record('FolderReordered', 'FOLDER', id.value, by, {
      notebookId: this.id.value,
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
   *
   * With `CASCADE` this is ONE write and nothing under the folder is touched:
   * every note, every Template and every subfolder of the subtree becomes
   * invalid the instant the tree stops showing them (RN-KNW-046), and the
   * purge takes them afterwards. It used to delete the notes one by one inside
   * the request, which is why it was refused above two hundred of them
   * (RN-KNW-040, removed) and why a note written at the instant of the removal
   * survived live in a folder nothing showed.
   */
  removeFolder(
    id: FolderId,
    policy: RemovalPolicy,
    by: Authorship,
  ): Result<FolderId[], DomainError> {
    const folder = this._folders.get(id);
    if (!folder) return err(DomainError.notFound('Folder not found in this notebook'));

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
      notebookId: this.id.value,
      folderId: id.value,
      removedFolderIds: removed.map((each) => each.value),
      // What the counters said the subtree held. Nothing under the folder is
      // written, so no note event will ever say these notes are gone, and the
      // notebook counter has to drop by this number (section 10.3).
      noteCount: subtree.reduce((total, each) => total + this.noteCountOf(each.id), 0),
    });
    return ok(removed);
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
