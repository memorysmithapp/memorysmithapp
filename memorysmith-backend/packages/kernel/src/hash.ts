/**
 * Content hashing, the one primitive several contexts need and none of them
 * should implement twice: the Knowledge context to decide whether a write
 * produced a new revision (RN-KNW-028), and the Discovery context to decide
 * which chunks have to be embedded again.
 *
 * It sits in the kernel rather than in a service because it carries no rule of
 * its own, and it uses the standard library of the runtime, which is not
 * infrastructure: the boundary PE1 draws is around the AWS SDK and frameworks,
 * not around Node itself.
 */

import { createHash } from 'node:crypto';

export function sha256Hex(value: string | Uint8Array): string {
  return createHash('sha256')
    .update(typeof value === 'string' ? Buffer.from(value, 'utf8') : value)
    .digest('hex');
}
