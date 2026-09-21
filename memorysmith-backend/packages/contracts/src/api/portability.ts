/**
 * DTOs of svc-portability (architecture-guide.md, section 16).
 *
 * Export is where file names come back into existence: guidance becomes
 * GUIDANCE.md, the annotated tree becomes STRUCTURE.md next to it, template
 * becomes TEMPLATE.md, and the order becomes a numeric prefix, which is the
 * only way a file system can carry it (RN-PRT-002).
 */

import { z } from 'zod';
import { instantSchema, ulidSchema } from '../common.js';

/**
 * What part of a notebook a transfer carries — **in both directions**
 * (RN-PRT-017 on the way in, RN-PRT-024 on the way out).
 *
 * A notebook is often wanted for its DESIGN — its Guidance, its folders and
 * their Templates — rather than for its notes, or for one folder of it, and the
 * only way used to be importing everything and deleting by hand. The
 * identifiers are the ones the document carries: they are internal references,
 * and every identifier the import writes is minted anew (RN-PRT-013).
 *
 * A folder that is not selected but holds something that is gets written **as a
 * path**: its name and its description, and nothing else of its own, so a note
 * never arrives without the folder it lives in. Omitting the selection
 * altogether imports the whole document.
 */
export const transferSelectionSchema = z.object({
  guidance: z.boolean(),
  /** Whether the history the archive carries comes back (RN-PRT-023). */
  history: z.boolean().optional(),
  folders: z.array(ulidSchema),
  /** The folders whose Template is written, a subset of the folders above. */
  templates: z.array(ulidSchema),
  notes: z.array(ulidSchema),
  /**
   * The files the transfer carries, **by name** (#176, RN-PRT-025).
   *
   * Not by identifier, and not because it would be inconvenient: no identifier
   * of a file travels in a document, so an import has nothing else to choose
   * by — and a name is what a file is addressed by everywhere else in this
   * product, which is what makes an imported `![[name]]` find what it always
   * found. The two sides therefore choose the same way, which the other four
   * species cannot do.
   *
   * Absent means every file, which is what an archive written before this
   * carried and what almost everyone wants.
   */
  files: z.array(z.string().min(1).max(512)).optional(),
});

export type TransferSelection = z.infer<typeof transferSelectionSchema>;

export const exportRequestSchema = z.object({
  notebookId: ulidSchema,
  /**
   * What the archive carries, absent for the whole notebook (RN-PRT-024). The
   * history is one item of it: it is where a history is made to survive on
   * purpose, since deleting a notebook takes its trail with it (RN-AUD-011),
   * and it makes the archive larger — a kept export counts towards the storage
   * of the plan (RN-SUB-021).
   */
  selection: transferSelectionSchema.nullish(),
});

/**
 * A transfer: a notebook on its way out or a document on its way in, as a job
 * with a status (RN-PRT-018, RN-PRT-019). Both used to run inside the request
 * that asked for them, and the function behind the API stops at 29 seconds.
 */
export const transferSchema = z.object({
  transferId: ulidSchema,
  kind: z.enum(['export', 'import']),
  status: z.enum(['running', 'ready', 'failed', 'cancelled']),
  notebookId: ulidSchema.nullable(),
  /** The name of the notebook AS IT WAS: an export survives its notebook. */
  notebookName: z.string(),
  requestedAt: instantSchema,
  finishedAt: instantSchema.nullable(),
  /** Notes read for an export, notes written for an import. */
  done: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
  /** A code the interface turns into words in the language of the person. */
  failure: z.string().nullable(),
  /**
   * The file this transfer is about: the one an import came from, as the
   * person chose it, and the one an export saves as, named after its notebook.
   * `null` on an import recorded before a file name was kept (#155).
   */
  fileName: z.string().nullable(),
});

export const transferListSchema = z.object({
  transfers: z.array(transferSchema),
  /** What the kept exports of the subscription occupy (RN-SUB-021). */
  keptBytes: z.number().int().nonnegative(),
});

/** Issued at the moment of each download, and never stored (RN-PRT-019). */
export const downloadLinkSchema = z.object({
  downloadUrl: z.string().url(),
  expiresAt: instantSchema,
});

export type ExportRequest = z.infer<typeof exportRequestSchema>;
export type TransferDto = z.infer<typeof transferSchema>;
export type TransferListDto = z.infer<typeof transferListSchema>;
export type DownloadLinkDto = z.infer<typeof downloadLinkSchema>;
