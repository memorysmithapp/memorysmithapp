/**
 * DTOs of svc-audit (architecture-guide.md, section 12).
 *
 * The timeline of a note is keyed by NoteId and survives the note changing
 * folder and notebook (RN-AUD-004). A revision read is the pair (contentId,
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
  /**
   * The line its author left about the change (RN-AUD-012), or null when the
   * write carried none. It is drawn out of the payload rather than left in it
   * because it is the one thing of an entry a PERSON wrote, and a reader of
   * the history should not have to know which key it sits under.
   */
  message: z.string().nullable(),
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
  notebookId: ulidSchema,
  entries: z.array(auditEntrySchema),
});

export type AuditEntryDto = z.infer<typeof auditEntrySchema>;
export type NoteHistoryDto = z.infer<typeof noteHistorySchema>;
export type RevisionDto = z.infer<typeof revisionSchema>;
export type ActivityDto = z.infer<typeof activitySchema>;
export type ActivityQuery = z.infer<typeof activityQuerySchema>;
