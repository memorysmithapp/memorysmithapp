/**
 * Event contracts, validated on BOTH sides: the producer before publishing and
 * the consumer before projecting (architecture-guide.md, section 19). An event
 * shape that only one side knows is how a projection starts lying quietly.
 *
 * The envelope always carries the subscriptionId and the Authorship, and every
 * content-changing event carries the COMPLETE ContentRef, which is what makes
 * the audit trail a sufficient recovery index (sections 6.6, 9.2, 12.3).
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
  notebookRoleLimitSchema,
} from './common.js';

export const eventSubjectSchema = z.enum([
  'SUBSCRIPTION',
  'WORKSPACE',
  'MEMBER',
  'NOTEBOOK',
  'FOLDER',
  'NOTE',
  // What a notebook keeps beside its notes: bytes with a name (#166).
  'FILE',
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
  // Retired in 0.6.0 with the invitation of a member; kept so an event already
  // written stays parseable, like WorkspaceCreated.
  'MemberInvited',
  'MemberJoined',
  'MemberRoleChanged',
  'MemberRemoved',
  'NotebookRoleLimitSet',
  'NotebookRoleLimitCleared',
  // Knowledge
  'NotebookCreated',
  'NotebookRenamed',
  'NotebookDeleted',
  // Retired in 0.6.0 with restoring, which lost its object when deleting
  // became definitive; kept so an event already written stays parseable.
  'NotebookRestored',
  // What the purge destroyed, one event per unit (RN-KNW-047, RN-AUD-010).
  'NotebookPurged',
  'GuidancePurged',
  'TemplatePurged',
  'NotePurged',
  'GuidanceUpdated',
  'GuidanceDeleted',
  'FolderAdded',
  'FolderRenamed',
  'FolderDescribed',
  'FolderMoved',
  'FolderReordered',
  'FolderRemoved',
  'TemplateUpdated',
  'TemplateDeleted',
  // A file of a notebook, kept and deleted. There is no update: bytes are
  // replaced by keeping them again under the same name (#166).
  'FileKept',
  'FileDeleted',
  'NoteCreated',
  'NoteUpdated',
  'NoteReordered',
  'NoteMoved',
  'NoteDeleted',
  // Retired in 0.6.0 with restoring; kept so the trail stays parseable.
  'NoteRestored',
  // Discovery
  'NoteLinksResolved',
  'NoteIndexed',
  'LinkBroken',
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
  /**
   * Bytes of live content added or released by this event, which is what the
   * storage counter is built from (RN-SUB-021). Optional on the wire so an
   * envelope written before the counter existed still parses: the audit trail
   * is append-only, and an event already written has to stay readable.
   */
  storageDelta: z.number().int().default(0),
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

export const notebookRoleLimitPayload = z.object({
  notebookId: ulidSchema,
  userId: userIdSchema,
  limit: notebookRoleLimitSchema.optional(),
});

export const notebookCreatedPayload = z.object({
  notebookId: ulidSchema,
  name: z.string().min(1),
  slug: slugSchema,
  description: z.string(),
});

export const notebookRenamedPayload = z.object({
  notebookId: ulidSchema,
  name: z.string().min(1),
  slug: slugSchema,
});

/**
 * Deleting a notebook is REVERSIBLE and destroys no byte, exactly as deleting a
 * note is (RN-KNW-033): the notebook leaves every listing, its slug goes back to
 * being available, and the content it points at is untouched.
 */
export const notebookDeletedPayload = z.object({
  notebookId: ulidSchema,
  slug: slugSchema,
  noteCount: z.number().int().nonnegative(),
});

export const notebookRestoredPayload = z.object({
  notebookId: ulidSchema,
  slug: slugSchema,
});

/**
 * `created` says the write brought the slot into existence rather than
 * replacing it, which is what the count of the space a subscription holds
 * moves by (#197). Optional so an event written before it stays parseable.
 */
const slotCreatedSchema = z.boolean().optional();

export const guidanceUpdatedPayload = z.object({
  notebookId: ulidSchema,
  created: slotCreatedSchema,
});

/**
 * The Guidance of a notebook was deleted, and the notebook stays (RN-KNW-045).
 * The envelope carries the `ContentRef` that was live and a negative
 * `storageDelta`: the bytes leave the count of the subscription, and the trail
 * keeps naming the content nothing points at any more.
 */
export const guidanceDeletedPayload = z.object({
  notebookId: ulidSchema,
});

export const folderAddedPayload = z.object({
  notebookId: ulidSchema,
  folderId: ulidSchema,
  parentFolderId: ulidSchema.nullable(),
  name: z.string().min(1),
  slug: slugSchema,
  description: z.string().min(1).max(500),
  position: positionSchema,
});

export const folderRenamedPayload = z.object({
  notebookId: ulidSchema,
  folderId: ulidSchema,
  name: z.string().min(1),
  slug: slugSchema,
});

export const folderDescribedPayload = z.object({
  notebookId: ulidSchema,
  folderId: ulidSchema,
  description: z.string().min(1).max(500),
});

export const folderMovedPayload = z.object({
  notebookId: ulidSchema,
  folderId: ulidSchema,
  fromParentFolderId: ulidSchema.nullable(),
  toParentFolderId: ulidSchema.nullable(),
  position: positionSchema,
});

export const folderReorderedPayload = z.object({
  notebookId: ulidSchema,
  folderId: ulidSchema,
  position: positionSchema,
});

/**
 * `noteCount` is what the counters of the removed subtree said at the moment
 * of the removal (§10.3). It is there because the notebook counter has to drop
 * by it: nothing under the folder is written, so no note event will say so.
 * Eventually consistent in, eventually consistent out.
 */
export const folderRemovedPayload = z.object({
  notebookId: ulidSchema,
  folderId: ulidSchema,
  removedFolderIds: z.array(ulidSchema),
  noteCount: z.number().int().nonnegative().optional(),
});

export const templateUpdatedPayload = z.object({
  notebookId: ulidSchema,
  folderId: ulidSchema,
  created: slotCreatedSchema,
});

/** The Template of a folder was deleted, and the folder stays (RN-KNW-045). */
export const templateDeletedPayload = z.object({
  notebookId: ulidSchema,
  folderId: ulidSchema,
});

/**
 * The purge destroyed a unit: every revision of its content in the store, and
 * its item in the table (RN-KNW-047). The envelope carries the `ContentRef`
 * that was live, so the trail keeps naming what stopped existing, and a
 * `storageDelta` that is negative only when those bytes were still counted —
 * a unit deleted on its own freed them at the deletion, and freeing them
 * twice would make the counter of the subscription lie.
 */
/**
 * What the counters of the space of a subscription move by when a unit is
 * purged (#197): `live` says the unit was still counted when the purge found
 * it — invalidated by its parent rather than deleted on its own — and
 * `revisions` how many revisions of its content the purge destroyed. Both are
 * optional so an event written before them stays parseable.
 */
const purgedUnitShape = {
  live: z.boolean().optional(),
  revisions: z.number().int().nonnegative().optional(),
};

export const notePurgedPayload = z.object({
  notebookId: ulidSchema,
  noteId: ulidSchema,
  folderId: ulidSchema,
  ...purgedUnitShape,
});

export const templatePurgedPayload = z.object({
  notebookId: ulidSchema,
  folderId: ulidSchema,
  ...purgedUnitShape,
});

export const guidancePurgedPayload = z.object({
  notebookId: ulidSchema,
  ...purgedUnitShape,
});

/**
 * The last event of a notebook: nothing of it is left in any table.
 * `folderCount` is how many folders the tree still held, which no
 * `FolderRemoved` will ever say are gone (#197).
 */
export const notebookPurgedPayload = z.object({
  notebookId: ulidSchema,
  folderCount: z.number().int().nonnegative().optional(),
});

/**
 * The name is the `name:` the frontmatter of the content states (§5.3), and
 * it is `null` when the note has none a link could use (RN-KNW-036). It travels
 * here because a projector has to show a note before it has read its body, and
 * it carries no slug: a note is addressed by its identifier, and what a link
 * resolves against is the name itself.
 */
/**
 * The version of the note the write produced, which only grows. Every note
 * event carries it, because the bus promises delivery and not order: it is what
 * a projection compares to leave an older event delivered late without effect.
 * Optional only so an event written before it existed stays parseable.
 */
const noteVersionSchema = z.number().int().positive().optional();

/**
 * A file a notebook keeps, kept and deleted (#166). There is no `FileUpdated`:
 * bytes are replaced by keeping them again under the same name, which is a
 * `FileKept` of its own with the content reference of the new bytes.
 */
export const fileKeptPayload = z.object({
  notebookId: ulidSchema,
  fileId: ulidSchema,
  name: z.string().min(1),
  mimeType: z.string().min(1),
  path: z.string(),
});

export const fileDeletedPayload = fileKeptPayload;

export const noteCreatedPayload = z.object({
  notebookId: ulidSchema,
  noteId: ulidSchema,
  folderId: ulidSchema,
  name: z.string().min(1).nullable(),
  position: positionSchema,
  version: noteVersionSchema,
});

export const noteUpdatedPayload = z.object({
  notebookId: ulidSchema,
  noteId: ulidSchema,
  folderId: ulidSchema,
  name: z.string().min(1).nullable(),
  version: noteVersionSchema,
});

export const noteReorderedPayload = z.object({
  notebookId: ulidSchema,
  noteId: ulidSchema,
  folderId: ulidSchema,
  position: positionSchema,
  version: noteVersionSchema,
});

/** Carries BOTH sides, because whoever consumes it needs both (section 6.6). */
export const noteMovedPayload = z.object({
  noteId: ulidSchema,
  fromNotebookId: ulidSchema,
  fromFolderId: ulidSchema,
  toNotebookId: ulidSchema,
  toFolderId: ulidSchema,
  position: positionSchema,
  version: noteVersionSchema,
});

export const noteDeletedPayload = z.object({
  notebookId: ulidSchema,
  noteId: ulidSchema,
  folderId: ulidSchema,
  version: noteVersionSchema,
});

export const noteRestoredPayload = z.object({
  notebookId: ulidSchema,
  noteId: ulidSchema,
  folderId: ulidSchema,
  position: positionSchema,
});

export const noteLinksResolvedPayload = z.object({
  notebookId: ulidSchema,
  noteId: ulidSchema,
  resolved: z.array(z.object({ toNoteId: ulidSchema, slug: slugSchema })),
  pending: z.array(slugSchema),
});

export const noteIndexedPayload = z.object({
  notebookId: ulidSchema,
  noteId: ulidSchema,
  chunkCount: z.number().int().nonnegative(),
});

export const linkBrokenPayload = z.object({
  notebookId: ulidSchema,
  fromNoteId: ulidSchema,
  slug: slugSchema,
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
  NotebookRoleLimitSet: notebookRoleLimitPayload,
  NotebookRoleLimitCleared: notebookRoleLimitPayload,
  NotebookCreated: notebookCreatedPayload,
  NotebookRenamed: notebookRenamedPayload,
  NotebookDeleted: notebookDeletedPayload,
  NotebookRestored: notebookRestoredPayload,
  GuidanceUpdated: guidanceUpdatedPayload,
  GuidanceDeleted: guidanceDeletedPayload,
  FolderAdded: folderAddedPayload,
  FolderRenamed: folderRenamedPayload,
  FolderDescribed: folderDescribedPayload,
  FolderMoved: folderMovedPayload,
  FolderReordered: folderReorderedPayload,
  FolderRemoved: folderRemovedPayload,
  TemplateUpdated: templateUpdatedPayload,
  TemplateDeleted: templateDeletedPayload,
  NotePurged: notePurgedPayload,
  TemplatePurged: templatePurgedPayload,
  GuidancePurged: guidancePurgedPayload,
  NotebookPurged: notebookPurgedPayload,
  FileKept: fileKeptPayload,
  FileDeleted: fileDeletedPayload,
  NoteCreated: noteCreatedPayload,
  NoteUpdated: noteUpdatedPayload,
  NoteReordered: noteReorderedPayload,
  NoteMoved: noteMovedPayload,
  NoteDeleted: noteDeletedPayload,
  NoteRestored: noteRestoredPayload,
  NoteLinksResolved: noteLinksResolvedPayload,
  NoteIndexed: noteIndexedPayload,
  LinkBroken: linkBrokenPayload,
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
