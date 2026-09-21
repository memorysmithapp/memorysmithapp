/**
 * Template: the suggested layout of the notes of one folder, and an Aggregate
 * Root of its own (RN-KNW-044).
 *
 * A folder holds zero or one, guaranteed by the key of the item and not by a
 * check the aggregate runs: the template of a folder has exactly one address.
 *
 * It names its folder the way a `Note` names its own (section 6.2), which is
 * what lets writing it be a single item write instead of a tree mutation.
 */

import type {
  Authorship,
  ContentRef,
  DomainEventType,
  EventSubject,
  FolderId,
  SubscriptionId,
  NotebookId,
} from '@memorysmith/kernel';
import { ContentSlot, type ContentSlotRole } from './ContentSlot.js';

export class Template extends ContentSlot {
  private constructor(
    subscriptionId: SubscriptionId,
    notebookId: NotebookId,
    private readonly _folderId: FolderId,
    ref: ContentRef,
    createdBy: Authorship,
    updatedBy: Authorship,
    version: number,
  ) {
    super(subscriptionId, notebookId, ref, createdBy, updatedBy, version);
  }

  /** The first template a folder ever gets; all of it is new content. */
  static create(input: {
    subscriptionId: SubscriptionId;
    notebookId: NotebookId;
    folderId: FolderId;
    ref: ContentRef;
    by: Authorship;
  }): Template {
    const template = new Template(
      input.subscriptionId,
      input.notebookId,
      input.folderId,
      input.ref,
      input.by,
      input.by,
      0,
    );
    template.record('TemplateUpdated', input.by, input.ref, input.ref.bytes);
    return template;
  }

  /** Rehydration from storage; no event is recorded and no rule is re-run. */
  static rehydrate(input: {
    subscriptionId: SubscriptionId;
    notebookId: NotebookId;
    folderId: FolderId;
    ref: ContentRef;
    createdBy: Authorship;
    updatedBy: Authorship;
    version: number;
  }): Template {
    return new Template(
      input.subscriptionId,
      input.notebookId,
      input.folderId,
      input.ref,
      input.createdBy,
      input.updatedBy,
      input.version,
    );
  }

  get role(): ContentSlotRole {
    return 'TEMPLATE';
  }

  get folderId(): FolderId {
    return this._folderId;
  }

  protected get writtenEvent(): DomainEventType {
    return 'TemplateUpdated';
  }

  protected get deletedEvent(): DomainEventType {
    return 'TemplateDeleted';
  }

  /** Filed under the folder, which is the subject the trail answers about. */
  protected get subject(): EventSubject {
    return 'FOLDER';
  }

  protected get subjectId(): string {
    return this._folderId.value;
  }

  protected get payload(): Record<string, unknown> {
    return { notebookId: this.notebookId.value, folderId: this._folderId.value };
  }
}
