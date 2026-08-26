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
  'OwnershipTransferred',
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
