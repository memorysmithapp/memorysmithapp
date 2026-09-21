/**
 * Guidance: the document that declares how a notebook wants to be written,
 * and an Aggregate Root of its own (RN-KNW-044).
 *
 * A notebook holds zero or one, and the key of the item is what guarantees the
 * one: there is no second place a guidance of this notebook could live.
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

export class Guidance extends ContentSlot {
  /**
   * The first guidance a notebook ever gets. The whole of it is new content,
   * so the event declares all of its bytes (RN-SUB-021).
   */
  static create(input: {
    subscriptionId: SubscriptionId;
    notebookId: NotebookId;
    ref: ContentRef;
    by: Authorship;
  }): Guidance {
    const guidance = new Guidance(
      input.subscriptionId,
      input.notebookId,
      input.ref,
      input.by,
      input.by,
      0,
    );
    guidance.record('GuidanceUpdated', input.by, input.ref, input.ref.bytes);
    return guidance;
  }

  /** Rehydration from storage; no event is recorded and no rule is re-run. */
  static rehydrate(input: {
    subscriptionId: SubscriptionId;
    notebookId: NotebookId;
    ref: ContentRef;
    createdBy: Authorship;
    updatedBy: Authorship;
    version: number;
  }): Guidance {
    return new Guidance(
      input.subscriptionId,
      input.notebookId,
      input.ref,
      input.createdBy,
      input.updatedBy,
      input.version,
    );
  }

  get role(): ContentSlotRole {
    return 'GUIDANCE';
  }

  get folderId(): FolderId | null {
    return null;
  }

  protected get writtenEvent(): DomainEventType {
    return 'GuidanceUpdated';
  }

  protected get deletedEvent(): DomainEventType {
    return 'GuidanceDeleted';
  }

  protected get subject(): EventSubject {
    return 'NOTEBOOK';
  }

  protected get subjectId(): string {
    return this.notebookId.value;
  }

  protected get payload(): Record<string, unknown> {
    return { notebookId: this.notebookId.value };
  }
}
