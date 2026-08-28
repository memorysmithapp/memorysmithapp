/**
 * The wire shape of an error. The frontend maps it to a message in
 * shared/api/error-mapper.ts and covers the whole taxonomy of
 * architecture-guide.md section 15.
 *
 * FORBIDDEN arrives as 404 in every case but one, so the UI says "not found":
 * the interface cannot be more informative than the API, or the leak the 404
 * prevents comes back through the screen.
 */

import { z } from 'zod';

export const errorCodeSchema = z.enum([
  'VALIDATION',
  'NOT_FOUND',
  'FORBIDDEN',
  'CONFLICT',
  'PRECONDITION_FAILED',
  'LIMIT_EXCEEDED',
  'INTERNAL',
]);

export const apiErrorSchema = z.object({
  code: errorCodeSchema,
  message: z.string(),
  details: z.unknown().optional(),
});

export type ErrorCodeName = z.infer<typeof errorCodeSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
