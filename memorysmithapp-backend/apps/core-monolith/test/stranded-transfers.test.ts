/**
 * What an export or an import the worker never ended leaves in the bucket
 * (#483): found by its key past the safety age, and nothing else.
 */

import { describe, expect, it } from 'vitest';
import { strandedAmong } from '../src/stranded-transfers.js';

const NOW = new Date('2026-11-17T12:00:00Z');
const OLD = new Date('2026-11-15T12:00:00Z');
const CUTOFF = new Date(NOW.getTime() - 24 * 3_600_000);

describe('what a transfer the worker never ended leaves', () => {
  it('is the multipart upload of an export, never one of an upload in parts', () => {
    const found = strandedAmong(
      [
        { key: 's/S1/exports/01ABC.notebook', uploadId: 'a', initiated: OLD },
        // An agent's upload in parts: open with no deadline (RN-PRT-028).
        { key: 's/S1/uploads/01UP/whole', uploadId: 'b', initiated: OLD },
        // An export still young may be running.
        { key: 's/S1/exports/01NEW.notebook', uploadId: 'c', initiated: NOW },
      ],
      [],
      CUTOFF,
    );
    expect(found.exports.map((each) => each.uploadId)).toEqual(['a']);
  });

  it('is the file entry an import staged, never a part, a whole or a kept file', () => {
    const found = strandedAmong(
      [],
      [
        { key: 's/S1/uploads/01IM/entries/3', bytes: 10, lastModified: OLD },
        { key: 's/S1/uploads/01UP/whole', bytes: 10, lastModified: OLD },
        { key: 's/S1/uploads/01UP/part-1', bytes: 10, lastModified: OLD },
        { key: 's/S1/f/01CONTENT', bytes: 10, lastModified: OLD },
        { key: 's/S1/uploads/01IM/entries/4', bytes: 10, lastModified: NOW },
      ],
      CUTOFF,
    );
    expect(found.entries.map((each) => each.key)).toEqual(['s/S1/uploads/01IM/entries/3']);
  });
});
