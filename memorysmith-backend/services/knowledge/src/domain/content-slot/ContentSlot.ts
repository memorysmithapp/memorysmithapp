/**
 * ContentSlot: what a Guidance and a Template have in common, and the reason
 * both are Aggregate Roots of their own rather than fields of the tree
 * (RN-KNW-044).
 *
 * They used to be a `ContentRef` inside the `Notebook` aggregate: the guidance
 * on the `META` item, the template on the `FOLDER` item. Three things followed
 * from that, and all three were wrong. Neither could be deleted, because
 * nothing deletes a field. Writing either was a tree mutation, so replacing
 * the template of one folder locked the whole notebook and conflicted with
 * renaming another folder. And when the parent went, what they occupied stayed
 * on the storage count, because a field is not a unit anything can find.
 *
 * As an aggregate each one is locked on its own item, the way a note is
 * (architecture-guide.md, section 10.2): a write of it contends only with
 * another write of the same slot.
 *
 * What stays true is PP4: the aggregate carries a pointer and never the
 * Markdown. Whoever talks to the ContentStore is the use case.
 */

import {
  type Authorship,
  type ContentRef,
  createEvent,
  DomainError,
  err,
  type DomainEvent,
  type DomainEventType,
  type EventSubject,
  type FolderId,
  ok,
  type Result,
  type SubscriptionId,
  type NotebookId,
} from '@memorysmith/kernel';

/** Which role the slot plays, which is what decides the item that holds it. */
export type ContentSlotRole = 'GUIDANCE' | 'TEMPLATE';

export abstract class ContentSlot {
  protected readonly events: DomainEvent[] = [];

  protected constructor(
    readonly subscriptionId: SubscriptionId,
    readonly notebookId: NotebookId,
    protected _ref: ContentRef,
    readonly createdBy: Authorship,
    protected _updatedBy: Authorship,
    protected _version: number,
    protected _deleted = false,
  ) {}

  /** What this slot is, which is how the repository knows its key. */
  abstract get role(): ContentSlotRole;
  /** The folder a Template belongs to; a Guidance belongs to the notebook. */
  abstract get folderId(): FolderId | null;

  get ref(): ContentRef {
    return this._ref;
  }
  /** The revision a caller must echo back as baseRevision (RN-KNW-034). */
  get revision(): string {
    return this._ref.versionId;
  }
  get updatedBy(): Authorship {
    return this._updatedBy;
  }

  /** The version currently stored, which is what the optimistic lock expects. */
  get version(): number {
    return this._version;
  }

  /** Called by the repository after a successful write. */
  markPersisted(): void {
    this._version += 1;
  }

  /**
   * Receives a ContentRef that is ALREADY written (section 10.5). Identical
   * bytes are not a write: no new revision, no event and no reprojection
   * (RN-KNW-028), and the caller can tell because no event was recorded.
   */
  replace(ref: ContentRef, by: Authorship): Result<boolean, DomainError> {
    if (this._deleted) return err(slotNotFound(this.role));
    if (this._ref.hasSameContentAs(ref)) return ok(false);

    // What the subscription is storing changed by the difference between the
    // revision that was live and the one that now is. The superseded revision
    // stays in the store and stops being counted (RN-SUB-021).
    const delta = ref.bytes - this._ref.bytes;
    this._ref = ref;
    this._updatedBy = by;
    this.record(this.writtenEvent, by, ref, delta);
    return ok(true);
  }

  /**
   * Deleting the slot itself, which is what a field of its parent could never
   * be (RN-KNW-045). The folder or the notebook stays and simply stops having
   * one, and the bytes leave the storage count of the subscription.
   *
   * The event carries the reference that was live, because that is what says
   * WHICH content stopped being pointed at: the trail is the recovery index
   * (section 9.2) and nothing else would name the slot afterwards.
   */
  delete(by: Authorship): Result<void, DomainError> {
    if (this._deleted) return err(slotNotFound(this.role));
    this._deleted = true;
    this._updatedBy = by;
    this.record(this.deletedEvent, by, this._ref, -this._ref.bytes);
    return ok();
  }

  get isDeleted(): boolean {
    return this._deleted;
  }

  get hasChanges(): boolean {
    return this.events.length > 0;
  }

  pullEvents(): DomainEvent[] {
    return this.events.splice(0, this.events.length);
  }

  /** The event a write of this slot records; a Guidance and a Template differ. */
  protected abstract get writtenEvent(): DomainEventType;
  /** The event deleting it records, which declares the bytes it frees. */
  protected abstract get deletedEvent(): DomainEventType;
  /** Who the trail files this under: a Guidance is filed under its notebook. */
  protected abstract get subject(): EventSubject;
  protected abstract get subjectId(): string;
  protected abstract get payload(): Record<string, unknown>;

  protected record(
    type: DomainEventType,
    by: Authorship,
    contentRef: ContentRef | null,
    storageDelta: number,
    /**
     * What a write says beyond the slot it is about: `created` on the first
     * one, which is what the count of the space a subscription holds moves by
     * (#197), since a write that creates and one that replaces are both
     * recorded as the same event.
     */
    extra: Record<string, unknown> = {},
  ): void {
    this.events.push(
      createEvent({
        type,
        subscriptionId: this.subscriptionId,
        subject: this.subject,
        subjectId: this.subjectId,
        authorship: by,
        payload: { ...this.payload, ...extra },
        contentRef,
        storageDelta,
      }),
    );
  }
}

/** The one refusal both slots share: a write of content that is not there. */
export function slotNotFound(role: ContentSlotRole): DomainError {
  return role === 'GUIDANCE'
    ? DomainError.notFound('This notebook has no guidance')
    : DomainError.notFound('This folder has no template');
}
