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
 * How the parts of an upload travel (RN-PRT-027). `url` is a signed address per
 * part, which a script PUTs from the disk, so the bytes never pass through the
 * model; `inline` is base64 in the call, for an agent with no network, whose
 * every byte the model types — and whose every part therefore carries a hash.
 */
export const uploadTransportSchema = z.enum(['url', 'inline']);

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/, 'a SHA-256 in lowercase hex');

/**
 * What an upload of an agent says about itself (RN-PRT-027, RN-PRT-028). The
 * platform is not declared by the agent: it is the connector the token was
 * handed to, as every write of a connector records it (RN-AGT-001).
 */
export const transferUploadSchema = z.object({
  mimeType: z.string(),
  /** What the file is for, in the words of the agent, which becomes its description. */
  purpose: z.string(),
  /** The connector that started it, or `null` when a person did. */
  platform: z.string().nullable(),
  transport: uploadTransportSchema,
  sha256: sha256Schema,
  partSize: z.number().int().positive(),
  partCount: z.number().int().positive(),
  /** The parts the store holds, by number, from 1. */
  received: z.array(z.number().int().positive()),
  /** When the last part arrived, or `null` while none has. */
  lastPartAt: instantSchema.nullable(),
  /** The request of the person this upload fulfils, when it does (RN-PRT-030). */
  fulfils: ulidSchema.nullable().optional(),
});

/**
 * A file an agent asked the person for instead of sending it (#253,
 * RN-PRT-030). Its name is the `fileName` of the transfer. The size and hash
 * are what the agent knows of the file, shown as a reference and never
 * enforced: what an agent knows may be a copy its client reduced.
 */
export const transferRequestSchema = z.object({
  mimeType: z.string(),
  description: z.string(),
  purpose: z.string(),
  tags: z.array(z.string()),
  path: z.string(),
  /** The connector that asked. */
  platform: z.string().nullable(),
  expectedSize: z.number().int().nonnegative().nullable(),
  expectedSha256: z.string().nullable(),
});

/**
 * Asking the person for a file (RN-PRT-030), from nothing — the notebook, the
 * name, the type and what it is for — or from an upload the agent could not
 * finish, which the request replaces: its parts are thrown away and the room it
 * reserved given back.
 */
export const requestFileRequestSchema = z.object({
  notebookId: ulidSchema.optional(),
  name: z.string().min(1).max(512).optional(),
  description: z.string().max(500).optional(),
  mimeType: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  path: z.string().optional(),
  purpose: z.string().min(1).max(500).optional(),
  size: z.number().int().positive().optional(),
  sha256: sha256Schema.optional(),
  fromUpload: ulidSchema.optional(),
});

/**
 * A transfer: a notebook on its way out, a document on its way in, or a file
 * an agent is sending in parts, as a job with a status (RN-PRT-018,
 * RN-PRT-019, RN-PRT-028). The first two used to run inside the request that
 * asked for them, and the function behind the API stops at 29 seconds.
 */
export const transferSchema = z.object({
  transferId: ulidSchema,
  kind: z.enum(['export', 'import', 'agent', 'request']),
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
  /** What an upload of an agent is and how far it got; absent on the other kinds. */
  upload: transferUploadSchema.optional(),
  /** The file an agent asked the person for; only on a request (RN-PRT-030). */
  request: transferRequestSchema.optional(),
});

export const transferListSchema = z.object({
  transfers: z.array(transferSchema),
  /** What the kept exports of the subscription occupy (RN-SUB-021). */
  keptBytes: z.number().int().nonnegative(),
  /** What the open uploads reserve, as in transit (RN-SUB-025). */
  transitBytes: z.number().int().nonnegative(),
});

/**
 * Starts an upload in parts (RN-PRT-027). The size and the hash of the whole
 * are declared before a byte travels: the size reserves the room (RN-SUB-025)
 * and the hash is what the finish holds the bytes to.
 */
export const beginUploadRequestSchema = z.object({
  notebookId: ulidSchema,
  name: z.string().min(1).max(512),
  description: z.string().max(500).optional(),
  mimeType: z.string().min(1),
  tags: z.array(z.string()).optional(),
  path: z.string().optional(),
  purpose: z.string().min(1).max(500),
  size: z.number().int().positive(),
  sha256: sha256Schema,
  transport: uploadTransportSchema,
  /** Inline only: the bytes of every part but the last. */
  partSize: z.number().int().positive().optional(),
  /**
   * The request of the person this upload fulfils (RN-PRT-030): the file is
   * kept under the name and in the notebook the request names.
   */
  request: ulidSchema.optional(),
});

/** Where the parts that are missing go, on an upload by URL. */
export const uploadPartTargetSchema = z.object({
  part: z.number().int().positive(),
  url: z.string().url(),
});

/** An upload and what is left of it, with an address for every missing part by URL. */
export const uploadStatusSchema = z.object({
  transfer: transferSchema,
  missing: z.array(z.number().int().positive()),
  /** Empty on an inline upload, whose parts travel in the call. */
  targets: z.array(uploadPartTargetSchema),
  expiresAt: instantSchema.nullable(),
});

/** One inline part, with the hash of its own bytes (RN-PRT-027). */
export const uploadPartRequestSchema = z.object({
  sha256: sha256Schema,
  contentBase64: z.string().min(1),
});

/** A transfer of an agent pointed at another notebook, when its own is unavailable (RN-PRT-029). */
export const linkUploadRequestSchema = z.object({
  notebookId: ulidSchema,
});

/** What a finished upload became: a file of the notebook, by the name a note addresses. */
export const finishedUploadSchema = z.object({
  fileId: ulidSchema,
  notebookId: ulidSchema,
  name: z.string(),
  bytes: z.number().int().nonnegative(),
});

/** Issued at the moment of each download, and never stored (RN-PRT-019). */
export const downloadLinkSchema = z.object({
  downloadUrl: z.string().url(),
  expiresAt: instantSchema,
});

/**
 * Importing from a kept export instead of a file on the machine (#207): the
 * kept object is copied server-side to a fresh upload key, and the answer is
 * the same key `POST /portability/imports` answers, which `apply` takes as
 * it takes an uploaded file. Only the requester's own ready exports qualify
 * (RN-PRT-020); anything else answers 404.
 */
export const importFromExportRequestSchema = z.object({
  transferId: ulidSchema,
});

export const importUploadSchema = z.object({
  uploadKey: z.string().min(1),
});

/**
 * A note downloaded as a PDF made by the server (#263, RN-PRT-031): the
 * choices of the print tab, and the language the page is drawn in. The answer
 * is the print, which is polled until its file is ready.
 */
export const printRequestSchema = z.object({
  placement: z.enum(['cover', 'end', 'none']).default('cover'),
  tables: z.enum(['wrap', 'shrink']).default('wrap'),
  orientation: z.enum(['portrait', 'landscape']).default('portrait'),
  locale: z.enum(['en_US', 'pt_BR']).default('en_US'),
});

export const printSchema = z.object({
  printId: ulidSchema,
  status: z.enum(['running', 'ready', 'failed']),
  /** Issued when it is ready, at the moment it is asked for, and never stored. */
  downloadUrl: z.string().url().optional(),
  expiresAt: instantSchema.optional(),
  /** Why there is no file: NOT_FOUND, SESSION, TIMED_OUT or FAILED. */
  failure: z.string().optional(),
});

export type ExportRequest = z.infer<typeof exportRequestSchema>;
export type ImportFromExportRequest = z.infer<typeof importFromExportRequestSchema>;
export type ImportUploadDto = z.infer<typeof importUploadSchema>;
export type TransferDto = z.infer<typeof transferSchema>;
export type TransferListDto = z.infer<typeof transferListSchema>;
export type DownloadLinkDto = z.infer<typeof downloadLinkSchema>;
export type TransferUploadDto = z.infer<typeof transferUploadSchema>;
export type UploadTransport = z.infer<typeof uploadTransportSchema>;
export type BeginUploadRequest = z.infer<typeof beginUploadRequestSchema>;
export type UploadStatusDto = z.infer<typeof uploadStatusSchema>;
export type UploadPartRequest = z.infer<typeof uploadPartRequestSchema>;
export type LinkUploadRequest = z.infer<typeof linkUploadRequestSchema>;
export type FinishedUploadDto = z.infer<typeof finishedUploadSchema>;
export type TransferRequestDto = z.infer<typeof transferRequestSchema>;
export type RequestFileRequest = z.infer<typeof requestFileRequestSchema>;
export type PrintRequest = z.infer<typeof printRequestSchema>;
export type PrintDto = z.infer<typeof printSchema>;
