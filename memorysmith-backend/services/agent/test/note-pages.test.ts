/**
 * The index of a notebook in pages (RN-AGT-031). A listing of 811 notes
 * answered 465 KB and the client refused to show it.
 */

import { describe, expect, it } from 'vitest';
import { pageOf } from '../src/mcp/note-pages.js';

const note = (noteId: string, folderId: string, position: string) => ({
  noteId,
  name: `Nota ${noteId}`,
  folderId,
  position,
  // What the route answers besides the index, and what an agent never needs.
  bytes: 4096,
  updatedAt: '2026-09-16T00:00:00.000Z',
  updatedBy: { userId: 'u', agent: { clientId: 'https://x', clientName: 'x' } },
});

describe('the index of a notebook, in pages', () => {
  it('reads the whole notebook by following the cursor, in the defined order, with no note twice', () => {
    // Folder B comes first in the tree, although its identifier sorts after A.
    const notes = [
      ...Array.from({ length: 7 }, (_, index) => note(`A${index}`, 'FA', `a${index}`)),
      ...Array.from({ length: 5 }, (_, index) => note(`B${index}`, 'FB', `a${index}`)),
    ];
    const order = ['FB', 'FA'];

    const read: string[] = [];
    let cursor: string | undefined;
    for (let round = 0; round < 10; round++) {
      const page = pageOf(notes, order, { limit: 4, ...(cursor ? { cursor } : {}) });
      read.push(...page.notes.map((each) => each.noteId));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }

    expect(read).toEqual(['B0', 'B1', 'B2', 'B3', 'B4', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6']);
  });

  it('carries the four fields of an index, and nothing else', () => {
    const page = pageOf([note('A0', 'FA', 'a0')], ['FA'], {});
    expect(Object.keys(page.notes[0] ?? {}).sort()).toEqual([
      'folderId',
      'name',
      'noteId',
      'position',
    ]);
    expect(page.nextCursor).toBeNull();
  });

  it('neither repeats nor skips a note when one is written between two pages', () => {
    const before = [note('A1', 'FA', 'b'), note('A2', 'FA', 'd'), note('A3', 'FA', 'f')];
    const first = pageOf(before, ['FA'], { limit: 2 });
    // A note lands before the end of the first page while the agent reads it.
    const after = [...before, note('A0', 'FA', 'a')];
    const second = pageOf(after, ['FA'], { limit: 2, cursor: first.nextCursor ?? '' });

    expect(first.notes.map((each) => each.noteId)).toEqual(['A1', 'A2']);
    expect(second.notes.map((each) => each.noteId)).toEqual(['A3']);
  });

  it('refuses a cursor it never answered, saying how to start over', () => {
    expect(() => pageOf([], [], { cursor: 'not-a-cursor' })).toThrow('without a cursor');
  });
});
