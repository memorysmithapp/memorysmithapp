/**
 * Event contracts, validated on BOTH sides: the producer before publishing and
 * the consumer before projecting (architecture-guide.md, section 19). An event
 * shape that only one side knows is how a projection starts lying quietly.
 *
 * The envelope always carries the subscriptionId and the Authorship, and every
 * content-changing event carries the COMPLETE ContentRef, which is what makes
 * the audit trail a sufficient recovery index (sections 6.5, 9.2, 12.3).
 */

import { z } from 'zod';
import {
  authorshipSchema,
  contentRefSchema,
  instantSchema,
  membershipRoleSchema,
  positionSchema,
  slugSchema,
  storageQuotaSchema,
  subscriptionStatusSchema,
  subscriptionTypeSchema,
  ulidSchema,
  userIdSchema,
  vaultRoleLimitSchema,
} from './common.js';

export const eventSubjectSchema = z.enum([
  'SUBSCRIPTION',
  'WORKSPACE',
  'MEMBER',
  'VAULT',
  'FOLDER',
  'NOTE',
]);

export const domainEventTypeSchema = z.enum([
  // Access
  'SubscriptionRequested',
  'SubscriptionApproved',
  'SubscriptionRejected',
  'SubscriptionSuspended',
  'SubscriptionReactivated',
  'SubscriptionCanceled',
  'SubscriptionStatusSet',
  'SubscriptionPlanChanged',
  'OwnershipTransferred',
  'WorkspaceCreated',
  'MemberInvited',
  'MemberJoined',
  'MemberRoleChanged',
  'MemberRemoved',
  'VaultRoleLimitSet',
  'VaultRoleLimitCleared',
  // Knowledge
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
  // Discovery
  'NoteLinksResolved',
  'NoteIndexed',
  'LinkBroken',
  // Admin
  'ContentErased',
]);

/** The envelope every event travels in, on the outbox and on the bus. */
export const eventEnvelopeSchema = z.object({
  eventId: ulidSchema,
  type: domainEventTypeSchema,
  occurredAt: instantSchema,
  subscriptionId: ulidSchema,
  subject: eventSubjectSchema,
  subjectId: z.string().min(1),
  authorship: authorshipSchema,
  contentRef: contentRefSchema.nullable(),
  payload: z.record(z.string(), z.unknown()),
});

// ---- Payloads ---------------------------------------------------------------

export const subscriptionRequestedPayload = z.object({
  ownerId: userIdSchema,
  ownerEmail: z.string().email(),
  status: subscriptionStatusSchema,
  type: subscriptionTypeSchema,
  quota: storageQuotaSchema,
});

export const subscriptionStatusChangedPayload = z.object({
  from: subscriptionStatusSchema,
  to: subscriptionStatusSchema,
  reviewedBy: userIdSchema.optional(),
  reason: z.string().optional(),
});

/**
 * The status was set directly by the platform, without walking the transition
 * machine. `from` and `to` may be any pair, including one the machine forbids,
 * which is exactly why this is not a SubscriptionApproved.
 */
export const subscriptionStatusSetPayload = z.object({
  from: subscriptionStatusSchema,
  to: subscriptionStatusSchema,
  reviewedBy: userIdSchema.optional(),
});

export const subscriptionPlanChangedPayload = z.object({
  from: z.object({ type: subscriptionTypeSchema, quota: storageQuotaSchema }),
  to: z.object({ type: subscriptionTypeSchema, quota: storageQuotaSchema }),
  reviewedBy: userIdSchema.optional(),
});

export const ownershipTransferredPayload = z.object({
  fromUserId: userIdSchema,
  toUserId: userIdSchema,
});

/** Retired with the workspace level; kept so the trail stays parseable. */
export const workspaceCreatedPayload = z.object({
  workspaceId: ulidSchema,
  name: z.string().min(1),
  slug: slugSchema,
  isDefault: z.boolean(),
});

export const memberInvitedPayload = z.object({
  inviteeEmail: z.string().email(),
  role: membershipRoleSchema,
  expiresAt: instantSchema,
});

export const memberJoinedPayload = z.object({
  userId: userIdSchema,
  role: membershipRoleSchema,
});

export const memberRoleChangedPayload = z.object({
  userId: userIdSchema,
  from: membershipRoleSchema,
  to: membershipRoleSchema,
});

export const memberRemovedPayload = z.object({
  userId: userIdSchema,
});

export const vaultRoleLimitPayload = z.object({
  vaultId: ulidSchema,
  userId: userIdSchema,
  limit: vaultRoleLimitSchema.optional(),
});

export const vaultCreatedPayload = z.object({
  vaultId: ulidSchema,
  name: z.string().min(1),
  slug: slugSchema,
  description: z.string(),
});

export const vaultRenamedPayload = z.object({
  vaultId: ulidSchema,
  name: z.string().min(1),
  slug: slugSchema,
});

export const guidanceUpdatedPayload = z.object({
  vaultId: ulidSchema,
});

export const folderAddedPayload = z.object({
  vaultId: ulidSchema,
  folderId: ulidSchema,
  parentFolderId: ulidSchema.nullable(),
  name: z.string().min(1),
  slug: slugSchema,
  description: z.string().min(1).max(500),
  position: positionSchema,
});

export const folderRenamedPayload = z.object({
  vaultId: ulidSchema,
  folderId: ulidSchema,
  name: z.string().min(1),
  slug: slugSchema,
});

export const folderDescribedPayload = z.object({
  vaultId: ulidSchema,
  folderId: ulidSchema,
  description: z.string().min(1).max(500),
});

export const folderMovedPayload = z.object({
  vaultId: ulidSchema,
  folderId: ulidSchema,
  fromParentFolderId: ulidSchema.nullable(),
  toParentFolderId: ulidSchema.nullable(),
  position: positionSchema,
});

export const folderReorderedPayload = z.object({
  vaultId: ulidSchema,
  folderId: ulidSchema,
  position: positionSchema,
});

export const folderRemovedPayload = z.object({
  vaultId: ulidSchema,
  folderId: ulidSchema,
  removedFolderIds: z.array(ulidSchema),
});

export const templateUpdatedPayload = z.object({
  vaultId: ulidSchema,
  folderId: ulidSchema,
});

export const noteCreatedPayload = z.object({
  vaultId: ulidSchema,
  noteId: ulidSchema,
  folderId: ulidSchema,
  title: z.string().min(1),
  slug: slugSchema,
  position: positionSchema,
});

export const noteUpdatedPayload = z.object({
  vaultId: ulidSchema,
  noteId: ulidSchema,
  folderId: ulidSchema,
  title: z.string().min(1),
  slug: slugSchema,
});

export const noteReorderedPayload = z.object({
  vaultId: ulidSchema,
  noteId: ulidSchema,
  folderId: ulidSchema,
  position: positionSchema,
});

/** Carries BOTH sides, because whoever consumes it needs both (section 6.5). */
export const noteMovedPayload = z.object({
  noteId: ulidSchema,
  fromVaultId: ulidSchema,
  fromFolderId: ulidSchema,
  toVaultId: ulidSchema,
  toFolderId: ulidSchema,
  slug: slugSchema,
  position: positionSchema,
});

export const noteDeletedPayload = z.object({
  vaultId: ulidSchema,
  noteId: ulidSchema,
  folderId: ulidSchema,
  slug: slugSchema,
});

export const noteRestoredPayload = z.object({
  vaultId: ulidSchema,
  noteId: ulidSchema,
  folderId: ulidSchema,
  slug: slugSchema,
  position: positionSchema,
});

export const noteLinksResolvedPayload = z.object({
  vaultId: ulidSchema,
  noteId: ulidSchema,
  resolved: z.array(z.object({ toNoteId: ulidSchema, slug: slugSchema })),
  pending: z.array(slugSchema),
});

export const noteIndexedPayload = z.object({
  vaultId: ulidSchema,
  noteId: ulidSchema,
  chunkCount: z.number().int().nonnegative(),
});

export const linkBrokenPayload = z.object({
  vaultId: ulidSchema,
  fromNoteId: ulidSchema,
  slug: slugSchema,
});

export const contentErasedPayload = z.object({
  contentId: ulidSchema,
  reason: z.string().min(1),
});

/** Payload schema per event type, for validation on both ends of the bus. */
export const eventPayloadSchemas = {
  SubscriptionRequested: subscriptionRequestedPayload,
  SubscriptionApproved: subscriptionStatusChangedPayload,
  SubscriptionRejected: subscriptionStatusChangedPayload,
  SubscriptionSuspended: subscriptionStatusChangedPayload,
  SubscriptionReactivated: subscriptionStatusChangedPayload,
  SubscriptionCanceled: subscriptionStatusChangedPayload,
  SubscriptionStatusSet: subscriptionStatusSetPayload,
  SubscriptionPlanChanged: subscriptionPlanChangedPayload,
  OwnershipTransferred: ownershipTransferredPayload,
  WorkspaceCreated: workspaceCreatedPayload,
  MemberInvited: memberInvitedPayload,
  MemberJoined: memberJoinedPayload,
  MemberRoleChanged: memberRoleChangedPayload,
  MemberRemoved: memberRemovedPayload,
  VaultRoleLimitSet: vaultRoleLimitPayload,
  VaultRoleLimitCleared: vaultRoleLimitPayload,
  VaultCreated: vaultCreatedPayload,
  VaultRenamed: vaultRenamedPayload,
  GuidanceUpdated: guidanceUpdatedPayload,
  FolderAdded: folderAddedPayload,
  FolderRenamed: folderRenamedPayload,
  FolderDescribed: folderDescribedPayload,
  FolderMoved: folderMovedPayload,
  FolderReordered: folderReorderedPayload,
  FolderRemoved: folderRemovedPayload,
  TemplateUpdated: templateUpdatedPayload,
  NoteCreated: noteCreatedPayload,
  NoteUpdated: noteUpdatedPayload,
  NoteReordered: noteReorderedPayload,
  NoteMoved: noteMovedPayload,
  NoteDeleted: noteDeletedPayload,
  NoteRestored: noteRestoredPayload,
  NoteLinksResolved: noteLinksResolvedPayload,
  NoteIndexed: noteIndexedPayload,
  LinkBroken: linkBrokenPayload,
  ContentErased: contentErasedPayload,
} as const;

export type DomainEventTypeName = z.infer<typeof domainEventTypeSchema>;
export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;

/**
 * Validates an envelope AND its payload against the schema of its own type.
 * Consumers call this before projecting; producers call it before publishing.
 */
export function parseEvent(raw: unknown): EventEnvelope {
  const envelope = eventEnvelopeSchema.parse(raw);
  const payloadSchema = eventPayloadSchemas[envelope.type];
  payloadSchema.parse(envelope.payload);
  return envelope;
}
