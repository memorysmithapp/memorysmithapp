/**
 * The signature the messages of the pool carry (RN-ACC-017). What these cases
 * protect is that the PNG a message shows is the lockup of the brand book as it
 * is now, and not a drawing the brand has since moved on from.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  bytesHash,
  drawingHash,
  EMAIL_LOCKUP,
  type EmailLockupRecord,
} from '../commands/lib/email-lockup.js';
import { REPOSITORY_ROOT } from '../commands/lib/repository.js';

const read = (path: string): Buffer => readFileSync(join(REPOSITORY_ROOT, path));

describe('the signature of the messages of the pool', () => {
  const record = JSON.parse(read(EMAIL_LOCKUP.record).toString('utf8')) as EmailLockupRecord;

  it('was rendered from the lockup as it is now: render it again when the lockup changes', () => {
    expect(record.sourceSha256).toBe(drawingHash(read(EMAIL_LOCKUP.source).toString('utf8')));
  });

  it('is the PNG the site serves, at the width a message shows it', () => {
    expect(bytesHash(read(EMAIL_LOCKUP.png))).toBe(record.pngSha256);
    expect(record.width).toBe(EMAIL_LOCKUP.width);
    expect(record.height).toBe(32);
  });
});
