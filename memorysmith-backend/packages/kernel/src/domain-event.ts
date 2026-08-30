/**
 * Domain events (architecture-guide.md, section 6.5).
 *
 * Every event carries the subscriptionId and the Authorship. Content events
 * carry the COMPLETE ContentRef - contentId, versionId, sha256 and bytes - and
 * not just the versionId: that is what turns the audit trail into a recovery
 * index sufficient to rebuild the mapping between DynamoDB and S3 from scratch
 * (sections 9.2 and 12.3).
 *
 * Events are published through the transactional outbox (section 10.4), so
 * adding a consumer never touches the core.
 */

import type { Authorship } from './authorship.js';
import type { ContentRef } from './content-ref.js';
import type { SubscriptionId } from './ids.js';
import type { Instant } from './instant.js';
import { ulid } from './ulid.js';

export const ACCESS_EVENT_TYPES = [
  'SubscriptionRequested',
  'SubscriptionApproved',
  'SubscriptionRejected',
  'SubscriptionSuspended',
  'SubscriptionReactivated',
  'SubscriptionCanceled',
  /**
   * The platform set the status DIRECTLY, without walking the transition
   * machine, and the plan of a subscription changed. Both are administrative
   * acts of the platform surface (software-vision.md, section 4.6), and both
   * are events of their own precisely because they did not go through the
   * ordinary path: the trail has to say which one it was.
   */
  'SubscriptionStatusSet',
  'SubscriptionPlanChanged',
  'OwnershipTransferred',
  /**
   * RETIRED with the workspace level (software-vision.md, section 4.3). It
   * stays in the list for the same reason a retired RN code is never reused:
   * the audit trail is append-only, and an event already written has to stay
   * parseable forever.
   */
  'WorkspaceCreated',
  'MemberInvited',
  'MemberJoined',
  'MemberRoleChanged',
  'MemberRemoved',
  'VaultRoleLimitSet',
  'VaultRoleLimitCleared',
] as const;

export const KNOWLEDGE_EVENT_TYPES = [
  'VaultCreated',
  'VaultRenamed',
  'VaultDeleted',
  'VaultRestored',
  'GuidanceUpdated',
  'FolderAdded',
  'FolderRenamed',
  'FolderDescribed',
  'FolderMoved',
  'FolderReordered',
  'FolderRemoved',
  'TemplateUpdated',
  'NoteCreated',
  'NoteUpdated',
  'NoteReordered',
  'NoteMoved',
  'NoteDeleted',
  'NoteRestored',
] as const;

export const DISCOVERY_EVENT_TYPES = ['NoteLinksResolved', 'NoteIndexed', 'LinkBroken'] as const;

/** The only event that records destruction of content (RN-AUD-007). */
export const ADMIN_EVENT_TYPES = ['ContentErased'] as const;

export const DOMAIN_EVENT_TYPES = [
  ...ACCESS_EVENT_TYPES,
  ...KNOWLEDGE_EVENT_TYPES,
  ...DISCOVERY_EVENT_TYPES,
  ...ADMIN_EVENT_TYPES,
] as const;

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number];

/**
 * The audit trail is keyed BY SUBJECT, not by vault, which is what makes the
 * timeline of a note survive it moving folder and vault (section 12.2).
 */
export type EventSubject = 'SUBSCRIPTION' | 'WORKSPACE' | 'MEMBER' | 'VAULT' | 'FOLDER' | 'NOTE';

export interface DomainEvent<TPayload = Record<string, unknown>> {
  /** ULID: orders the outbox and the audit sort key by generation time. */
  readonly eventId: string;
  readonly type: DomainEventType;
  readonly occurredAt: Instant;
  readonly subscriptionId: SubscriptionId;
  readonly subject: EventSubject;
  readonly subjectId: string;
  readonly authorship: Authorship;
  /** Present on every event that changed content (RN-AUD-003). */
  readonly contentRef: ContentRef | null;
  /**
   * How many bytes of LIVE content this event added (positive) or released
   * (negative), which is what the storage counter of the subscription is built
   * from (RN-SUB-021).
   *
   * The aggregate declares it instead of the counter deriving it from the
   * event type, because the type does not carry the answer: `NoteUpdated` is
   * emitted both by a retitle, which changes no content and moves nothing, and
   * by a new body, which moves the difference between two revisions. Only the
   * aggregate knows which of the two just happened.
   *
   * It counts LIVE content: the current revision of every note that is not
   * deleted, plus each guidance and template. Superseded revisions still exist
   * in the store, and are deliberately not counted (see RN-SUB-021 for why).
   */
  readonly storageDelta: number;
  readonly payload: TPayload;
}

export function createEvent<TPayload extends Record<string, unknown>>(input: {
  type: DomainEventType;
  subscriptionId: SubscriptionId;
  subject: EventSubject;
  subjectId: string;
  authorship: Authorship;
  payload: TPayload;
  contentRef?: ContentRef | null;
  storageDelta?: number;
  occurredAt?: Instant;
}): DomainEvent<TPayload> {
  return {
    eventId: ulid(),
    type: input.type,
    occurredAt: input.occurredAt ?? input.authorship.at,
    subscriptionId: input.subscriptionId,
    subject: input.subject,
    subjectId: input.subjectId,
    authorship: input.authorship,
    contentRef: input.contentRef ?? null,
    // Zero by default, so an event that moves no content says so by saying
    // nothing: renaming, reordering and moving are all storage-neutral.
    storageDelta: input.storageDelta ?? 0,
    payload: input.payload,
  };
}

/**
 * The outbound port every aggregate mutation ends at. The production adapter
 * writes into the outbox inside the SAME transaction as the state change; the
 * test adapter records in memory.
 */
export interface EventPublisher {
  publish(events: DomainEvent[]): Promise<void>;
}
