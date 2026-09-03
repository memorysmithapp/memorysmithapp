/**
 * DTOs of svc-knowledge, the core context (architecture-guide.md, 14.1).
 *
 * Two shapes deserve attention:
 *  - A folder DTO carries `hasTemplate`, not the template itself: the template
 *    is a Content Slot fetched on its own, and the tree is read far more often
 *    than the templates are.
 *  - A note DTO carries the `revision`, which is the ContentRef the caller must
 *    echo back as `baseRevision` on update (RN-AGT-005). Blind overwrite is not
 *    accepted in a vault that sustains auditing.
 */

import { z } from 'zod';
import {
  contentRefSchema,
  authorshipSchema,
  instantSchema,
  positionSchema,
  removalPolicySchema,
  roleSchema,
  slugConflictPolicySchema,
  slugSchema,
  ulidSchema,
} from '../common.js';

export const vaultSummarySchema = z.object({
  vaultId: ulidSchema,
  name: z.string(),
  slug: slugSchema,
  description: z.string(),
  noteCount: z.number().int().nonnegative(),
  hasGuidance: z.boolean(),
  updatedAt: instantSchema,
  /** min(subscription role, vault ceiling), owner above both (RN-ACC-011). */
  effectiveRole: roleSchema,
});

export const folderSchema = z.object({
  folderId: ulidSchema,
  parentFolderId: ulidSchema.nullable(),
  name: z.string(),
  slug: slugSchema,
  /** Mandatory, 1 to 500 characters: it is what steers the agent (RN-KNW-006). */
  description: z.string().min(1).max(500),
  position: positionSchema,
  hasTemplate: z.boolean(),
  noteCount: z.number().int().nonnegative(),
});

export const vaultDetailSchema = vaultSummarySchema.extend({
  folders: z.array(folderSchema),
  guidance: z.object({ content: z.string(), revision: contentRefSchema }).nullable(),
});

export const createVaultRequestSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).default(''),
});

export const renameVaultRequestSchema = z.object({
  name: z.string().min(1).max(120),
});

export const putContentRequestSchema = z.object({
  content: z.string().max(1_048_576),
  /**
   * The revision this write is based on, or null when the slot is still
   * empty. Blind overwrite is not accepted in a vault that sustains auditing:
   * the guidance is the most shared document of a vault and the likeliest to
   * be written by two hands at once, one on the web and one over MCP
   * (RN-KNW-034).
   */
  baseRevision: z.string().nullable(),
});

export const contentSchema = z.object({
  content: z.string(),
  revision: contentRefSchema,
});

export const createFolderRequestSchema = z.object({
  parentFolderId: ulidSchema.nullable().default(null),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  afterFolderId: ulidSchema.nullable().default(null),
});

export const patchFolderRequestSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().min(1).max(500).optional(),
  parentFolderId: ulidSchema.nullable().optional(),
});

export const reorderFolderRequestSchema = z.object({
  afterFolderId: ulidSchema.nullable(),
});

export const removeFolderRequestSchema = z.object({
  /** No implicit default: an explicit policy is required (RN-KNW-007). */
  policy: removalPolicySchema,
});

export const noteSummarySchema = z.object({
  noteId: ulidSchema,
  vaultId: ulidSchema,
  folderId: ulidSchema,
  title: z.string(),
  slug: slugSchema,
  position: positionSchema,
  bytes: z.number().int().nonnegative(),
  updatedAt: instantSchema,
  updatedBy: authorshipSchema,
});

export const noteSchema = noteSummarySchema.extend({
  content: z.string(),
  revision: contentRefSchema,
  createdBy: authorshipSchema,
  deletedAt: instantSchema.nullable(),
});

export const createNoteRequestSchema = z.object({
  folderId: ulidSchema,
  title: z.string().min(1).max(200),
  content: z.string().max(1_048_576),
  afterNoteId: ulidSchema.nullable().default(null),
});

export const updateNoteRequestSchema = z.object({
  content: z.string().max(1_048_576),
  /** The revision the edit was based on; divergence answers CONFLICT. */
  baseRevision: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
});

export const reorderNoteRequestSchema = z.object({
  afterNoteId: ulidSchema.nullable(),
});

export const moveNoteRequestSchema = z.object({
  toVaultId: ulidSchema.optional(),
  toFolderId: ulidSchema,
  /** Only a vault change can collide, since the slug is unique per vault. */
  onSlugConflict: slugConflictPolicySchema.default('REJECT'),
  afterNoteId: ulidSchema.nullable().default(null),
});

export type VaultSummaryDto = z.infer<typeof vaultSummarySchema>;
export type FolderDto = z.infer<typeof folderSchema>;
export type VaultDetailDto = z.infer<typeof vaultDetailSchema>;
export type ContentDto = z.infer<typeof contentSchema>;
export type NoteSummaryDto = z.infer<typeof noteSummarySchema>;
export type NoteDto = z.infer<typeof noteSchema>;
export type CreateVaultRequest = z.infer<typeof createVaultRequestSchema>;
export type RenameVaultRequest = z.infer<typeof renameVaultRequestSchema>;
export type PutContentRequest = z.infer<typeof putContentRequestSchema>;
export type CreateFolderRequest = z.infer<typeof createFolderRequestSchema>;
export type PatchFolderRequest = z.infer<typeof patchFolderRequestSchema>;
export type ReorderFolderRequest = z.infer<typeof reorderFolderRequestSchema>;
export type RemoveFolderRequest = z.infer<typeof removeFolderRequestSchema>;
export type CreateNoteRequest = z.infer<typeof createNoteRequestSchema>;
export type UpdateNoteRequest = z.infer<typeof updateNoteRequestSchema>;
export type ReorderNoteRequest = z.infer<typeof reorderNoteRequestSchema>;
export type MoveNoteRequest = z.infer<typeof moveNoteRequestSchema>;
