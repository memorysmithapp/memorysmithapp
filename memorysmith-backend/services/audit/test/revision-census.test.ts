/**
 * How many revisions a subscription keeps, read off the trail (RN-SUB-024).
 *
 * The trail names every revision a write produced, and every content a purge
 * destroyed; what is kept is the first less the second. A census that counted
 * a revision twice — a move names the revision it carries — or kept counting
 * one the purge destroyed would be a number that looks right and is not.
 */

import { describe, expect, it } from 'vitest';
import { census, tally } from '../src/adapters/outbound/DynamoRevisionCensus.js';

const A = '01SUBAAA';
const B = '01SUBBBB';

function entry(subscriptionId: string, type: string, contentId: string, versionId: string) {
  return {
    entity: 'AUDIT',
    subscriptionId,
    type,
    contentRef: { contentId, versionId, sha256: 'a'.repeat(64), bytes: 1 },
  };
}

function count(items: Record<string, unknown>[]): Map<string, number> {
  const written = new Map<string, Set<string>>();
  const destroyed = new Map<string, Set<string>>();
  for (const item of items) census(written, destroyed, item);
  return tally(written, destroyed);
}

describe('the census of revisions', () => {
  it('counts each revision a write produced once, per subscription', () => {
    expect(
      count([
        entry(A, 'NoteCreated', 'c1', 'v1'),
        entry(A, 'NoteUpdated', 'c1', 'v2'),
        // A move carries the revision it moved, and makes no new one.
        entry(A, 'NoteMoved', 'c1', 'v2'),
        entry(A, 'GuidanceUpdated', 'g1', 'v1'),
        entry(A, 'TemplateUpdated', 't1', 'v1'),
        entry(B, 'NoteCreated', 'c9', 'v1'),
      ]),
    ).toEqual(
      new Map([
        [A, 4],
        [B, 1],
      ]),
    );
  });

  it('leaves out every revision of a content the purge destroyed', () => {
    expect(
      count([
        entry(A, 'NoteCreated', 'c1', 'v1'),
        entry(A, 'NoteUpdated', 'c1', 'v2'),
        entry(A, 'NoteCreated', 'c2', 'v1'),
        entry(A, 'NotePurged', 'c1', 'v2'),
      ]),
    ).toEqual(new Map([[A, 1]]));
  });

  it('ignores what is not an entry, or names no content', () => {
    expect(
      count([
        { entity: 'CLOSED', subscriptionId: A },
        { entity: 'AUDIT', subscriptionId: A, type: 'NoteDeleted', contentRef: null },
        entry(A, 'NoteCreated', 'c1', 'v1'),
      ]),
    ).toEqual(new Map([[A, 1]]));
  });
});
