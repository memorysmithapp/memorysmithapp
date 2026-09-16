/**
 * The `.notebook` document: a whole notebook as one JSON file, which is what the
 * product hands over and what it takes back (RN-PRT-009).
 *
 * The export used to be a zip of `.md` files, and it was a **one-way door**:
 * everything the product knows that a folder of files cannot hold was dropped
 * at it — the identity of a note, its fractional position, the description of
 * a folder, the Guidance, the Template, when each thing was written. Restoring
 * a backup, moving a notebook between environments and seeding an account were
 * none of them served, which is why the deploy script rebuilt a notebook by
 * replaying API calls over a tree of files.
 *
 * **Nothing derived is stored** (RN-PRT-010). No name, no slug, no numeric
 * prefix: the name of a note is read from its body — the `name:` of its
 * frontmatter — wherever it is needed, here as everywhere else. Two sources of
 * truth for what a note is called is the defect this cycle exists to end.
 *
 * **The cost is stated rather than hidden.** RN-PRT-001 promised only `.md`
 * files, readable with no parser, and that promise is spent: reading a note
 * out of the archive now takes a JSON parser. What is kept is what made the
 * promise worth making — the format is open and specified, every body is
 * plain-text Markdown, and no part of the document is encoded, escaped beyond
 * JSON or obfuscated (RN-PRT-011). What is lost is unzipping the archive
 * straight into a vault editor, and turning the document back into a tree of
 * `.md` files is a conversion this product does not perform.
 */

import { z } from 'zod';
import { instantSchema, positionSchema, ulidSchema } from '../common.js';

/**
 * The version of the DOCUMENT, which is not the version of the product. It says
 * what shape the reader will find, and it is the one field an importer must
 * read before anything else. The document declares no version of the Markdown
 * its bodies are written in: that notation follows the version of the product
 * that wrote it (RN-PRT-011).
 */
export const NOTEBOOK_DOCUMENT_VERSION = '1.0';

export const documentFolderSchema = z.object({
  folderId: ulidSchema,
  parentFolderId: ulidSchema.nullable(),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  /** The fractional key that orders it among its siblings, kept as written. */
  position: positionSchema,
  /** The Template of this folder, as Markdown, or `null` when it has none. */
  template: z.string().nullable(),
  /**
   * The last number this folder issued (RN-KNW-043), absent for a folder that
   * issued none. An import restores it, so the notebook brought back never
   * issues a number its notes already carry (RN-PRT-016).
   */
  lastNumber: z.number().int().positive().optional(),
});

export const documentNoteSchema = z.object({
  noteId: ulidSchema,
  folderId: ulidSchema,
  position: positionSchema,
  createdAt: instantSchema,
  updatedAt: instantSchema,
  /**
   * The body, byte for byte, frontmatter included. There is no name beside
   * it: the name is read from these bytes (RN-PRT-010).
   */
  body: z.string(),
});

export const notebookDocumentSchema = z.object({
  /** The shape of this document. Read before anything else. */
  documentVersion: z.literal(NOTEBOOK_DOCUMENT_VERSION),
  exportedAt: instantSchema,
  notebook: z.object({
    name: z.string().min(1).max(120),
    description: z.string().max(500),
    /** The Guidance as written, or `null` when the notebook has none. */
    guidance: z.string().nullable(),
  }),
  folders: z.array(documentFolderSchema),
  notes: z.array(documentNoteSchema),
});

export type NotebookDocument = z.infer<typeof notebookDocumentSchema>;
export type DocumentFolder = z.infer<typeof documentFolderSchema>;
export type DocumentNote = z.infer<typeof documentNoteSchema>;

/** The one file inside the `.notebook` container. */
export const NOTEBOOK_DOCUMENT_ENTRY = 'notebook.json';
