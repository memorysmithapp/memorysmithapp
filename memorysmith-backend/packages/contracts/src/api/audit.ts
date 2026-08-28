/**
 * DTOs of svc-audit (architecture-guide.md, section 12).
 *
 * The timeline of a note is keyed by NoteId and survives the note changing
 * folder and vault (RN-AUD-004). A revision read is the pair (contentId,
 * versionId) carried by the event, resolved straight against S3: no query to
 * the Knowledge table is involved, because the present lives in mv-knowledge
 * and the past lives in mv-audit.
 */

import { z } from 'zod';
import { authorshipSchema, contentRefSchema, instantSchema, ulidSchema } from '../common.js';
import { domainEventTypeSchema, eventSubjectSchema } from '../events.js';

export const auditEntrySchema = z.object({
  eventId: ulidSchema,
  type: domainEventTypeSchema,
  subject: eventSubjectSchema,
  subjectId: z.string(),
  occurredAt: instantSchema,
  authorship: authorshipSchema,
  contentRef: contentRefSchema.nullable(),
  payload: z.record(z.string(), z.unknown()),
});

export const noteHistorySchema = z.object({
  noteId: ulidSchema,
  entries: z.array(auditEntrySchema),
});

export const revisionSchema = z.object({
  noteId: ulidSchema,
  occurredAt: instantSchema,
  authorship: authorshipSchema,
  contentRef: contentRefSchema,
  content: z.string(),
});

export const activityQuerySchema = z.object({
  from: instantSchema.optional(),
  to: instantSchema.optional(),
});

export const activitySchema = z.object({
  vaultId: ulidSchema,
  entries: z.array(auditEntrySchema),
});

export type AuditEntryDto = z.infer<typeof auditEntrySchema>;
export type NoteHistoryDto = z.infer<typeof noteHistorySchema>;
export type RevisionDto = z.infer<typeof revisionSchema>;
export type ActivityDto = z.infer<typeof activitySchema>;
export type ActivityQuery = z.infer<typeof activityQuerySchema>;
