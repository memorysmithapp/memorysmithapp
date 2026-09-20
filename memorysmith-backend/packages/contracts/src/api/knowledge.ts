/**
 * DTOs of svc-knowledge, the core context (architecture-guide.md, 14.1).
 *
 * Two shapes deserve attention:
 *  - A folder DTO carries `hasTemplate`, not the template itself: the template
 *    is a Content Slot fetched on its own, and the tree is read far more often
 *    than the templates are.
 *  - A note DTO carries the `revision`, which is the ContentRef the caller must
 *    echo back as `baseRevision` on update (RN-AGT-005). Blind overwrite is not
 *    accepted in a notebook that sustains auditing.
 */

import { z } from 'zod';
import {
  contentRefSchema,
  authorshipSchema,
  instantSchema,
  positionSchema,
  removalPolicySchema,
  roleSchema,
  sha256Schema,
  slugSchema,
  ulidSchema,
} from '../common.js';

export const notebookSummarySchema = z.object({
  notebookId: ulidSchema,
  name: z.string(),
  slug: slugSchema,
  description: z.string(),
  noteCount: z.number().int().nonnegative(),
  hasGuidance: z.boolean(),
  updatedAt: instantSchema,
  /** min(subscription role, notebook ceiling), owner above both (RN-ACC-011). */
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

export const notebookDetailSchema = notebookSummarySchema.extend({
  folders: z.array(folderSchema),
  guidance: z.object({ content: z.string(), revision: contentRefSchema }).nullable(),
});

export const createNotebookRequestSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).default(''),
});

export const renameNotebookRequestSchema = z.object({
  name: z.string().min(1).max(120),
});

export const putContentRequestSchema = z.object({
  content: z.string().max(1_048_576),
  /**
   * The revision this write is based on, or null when the slot is still
   * empty. Blind overwrite is not accepted in a notebook that sustains auditing:
   * the guidance is the most shared document of a notebook and the likeliest to
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
  notebookId: ulidSchema,
  folderId: ulidSchema,
  /**
   * The `name:` the frontmatter states (§5.3), and `null` when the note has
   * none a link could use (RN-KNW-036). A surface that shows a name has to say
   * so rather than draw an empty string.
   */
  name: z.string().min(1).nullable(),
  position: positionSchema,
  bytes: z.number().int().nonnegative(),
  updatedAt: instantSchema,
  updatedBy: authorshipSchema,
});

/** The number a folder issued, once and never again (RN-KNW-043). */
export const folderNumberSchema = z.object({ number: z.number().int().positive() });

export const noteSchema = noteSummarySchema.extend({
  content: z.string(),
  revision: contentRefSchema,
  createdBy: authorshipSchema,
  deletedAt: instantSchema.nullable(),
  /**
   * The names of the folders from the root down to the one the note lives in
   * (RN-AGT-033). Where the note is, never what identifies it. Answered by the
   * read of one note; a write answers the note without it.
   */
  folderTrail: z.array(z.string()).optional(),
});

/**
 * A note is created from its content and nothing else: the name is the
 * `name:` its frontmatter states, and nothing else names it (RN-AGT-024). A
 * name its folder already holds is refused with ALREADY_EXISTS, naming the note
 * that holds it (RN-KNW-042).
 */
export const createNoteRequestSchema = z.object({
  folderId: ulidSchema,
  content: z.string().max(1_048_576),
  afterNoteId: ulidSchema.nullable().default(null),
});

/**
 * There is no name here either, and no route that renames a note: a note is
 * renamed by editing its content (RN-KNW-038).
 */
export const updateNoteRequestSchema = z.object({
  content: z.string().max(1_048_576),
  /** The revision the edit was based on; divergence answers CONFLICT. */
  baseRevision: z.string().min(1),
});

export const reorderNoteRequestSchema = z.object({
  afterNoteId: ulidSchema.nullable(),
});

/**
 * A move carries no policy (RN-KNW-022, removed): a destination folder that
 * already holds the name of the note refuses it, and any other accepts it
 * (RN-KNW-042).
 */
export const moveNoteRequestSchema = z.object({
  toNotebookId: ulidSchema.optional(),
  toFolderId: ulidSchema,
  afterNoteId: ulidSchema.nullable().default(null),
});

/**
 * A file a notebook keeps (#166, RN-KNW-048).
 *
 * The NAME addresses it — a note reaches it with `![[name]]`, wherever it sits
 * — and the PATH organises it, written like a path of a filesystem and
 * created by writing a file into it. Neither the path nor the extension takes
 * part in identity, and a notebook holds one file of each name (RN-KNW-049).
 */
export const notebookFileSchema = z.object({
  fileId: ulidSchema,
  name: z.string().min(1).max(512),
  description: z.string().max(500),
  mimeType: z.string().min(1).max(255),
  tags: z.array(z.string().min(1).max(40)).max(20),
  /** `/pasta/subpasta`, normalised, `/` for a file that sits at the root. */
  path: z.string().max(1024),
  bytes: z.number().int().nonnegative(),
  sha256: sha256Schema,
  updatedAt: instantSchema,
  authorship: authorshipSchema,
});

/**
 * Keeping a file through the API or the connector: the bytes travel inline,
 * base64, because an agent that has to perform an HTTP PUT of its own is an
 * agent that cannot keep a file at all. What is above the ceiling is refused
 * saying what the ceiling is, and never truncated.
 */
export const createFileRequestSchema = z.object({
  name: z.string().min(1).max(512),
  description: z.string().max(500).default(''),
  mimeType: z.string().min(1).max(255),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  path: z.string().max(1024).default('/'),
  contentBase64: z.string().min(1),
});

export const fileListSchema = z.object({ files: z.array(notebookFileSchema) });

export type NotebookFileDto = z.infer<typeof notebookFileSchema>;
export type CreateFileRequest = z.infer<typeof createFileRequestSchema>;
export type FileListDto = z.infer<typeof fileListSchema>;

export type NotebookSummaryDto = z.infer<typeof notebookSummarySchema>;
export type FolderDto = z.infer<typeof folderSchema>;
export type NotebookDetailDto = z.infer<typeof notebookDetailSchema>;
export type ContentDto = z.infer<typeof contentSchema>;
export type NoteSummaryDto = z.infer<typeof noteSummarySchema>;
export type NoteDto = z.infer<typeof noteSchema>;
export type FolderNumberDto = z.infer<typeof folderNumberSchema>;
export type CreateNotebookRequest = z.infer<typeof createNotebookRequestSchema>;
export type RenameNotebookRequest = z.infer<typeof renameNotebookRequestSchema>;
export type PutContentRequest = z.infer<typeof putContentRequestSchema>;
export type CreateFolderRequest = z.infer<typeof createFolderRequestSchema>;
export type PatchFolderRequest = z.infer<typeof patchFolderRequestSchema>;
export type ReorderFolderRequest = z.infer<typeof reorderFolderRequestSchema>;
export type RemoveFolderRequest = z.infer<typeof removeFolderRequestSchema>;
export type CreateNoteRequest = z.infer<typeof createNoteRequestSchema>;
export type UpdateNoteRequest = z.infer<typeof updateNoteRequestSchema>;
export type ReorderNoteRequest = z.infer<typeof reorderNoteRequestSchema>;
export type MoveNoteRequest = z.infer<typeof moveNoteRequestSchema>;
