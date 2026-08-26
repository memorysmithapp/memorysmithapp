/**
 * DTOs of svc-portability (architecture-guide.md, section 16).
 *
 * Export is where file names come back into existence: guidance becomes
 * README.md, template becomes TEMPLATE.md, and the order becomes a numeric
 * prefix, which is the only way a file system can carry it (RN-PRT-002).
 */

import { z } from 'zod';
import { instantSchema, ulidSchema } from '../common.js';

export const exportRequestSchema = z.object({
  vaultId: ulidSchema,
});

export const exportJobSchema = z.object({
  exportId: ulidSchema,
  vaultId: ulidSchema,
  status: z.enum(['pending', 'ready', 'failed']),
  requestedAt: instantSchema,
  /** Pre-signed and short-lived; present only once the job is ready. */
  downloadUrl: z.string().url().nullable(),
  expiresAt: instantSchema.nullable(),
  noteCount: z.number().int().nonnegative().nullable(),
  bytes: z.number().int().nonnegative().nullable(),
});

export type ExportRequest = z.infer<typeof exportRequestSchema>;
export type ExportJobDto = z.infer<typeof exportJobSchema>;
