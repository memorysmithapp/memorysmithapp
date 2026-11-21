/** How many links reach each note and how many it makes (#517). */

import { describe, expect, it } from 'vitest';
import { countDegrees } from '../src/domain/Degrees.js';

describe('the degrees of the notes of a notebook (#517)', () => {
  it('counts each edge once at each end', () => {
    const degrees = countDegrees([
      { fromNoteId: 'a', toNoteId: 'b' },
      { fromNoteId: 'a', toNoteId: 'c' },
      { fromNoteId: 'b', toNoteId: 'c' },
    ]);
    expect(Object.fromEntries(degrees)).toEqual({
      a: { backlinks: 0, links: 2 },
      b: { backlinks: 1, links: 1 },
      c: { backlinks: 2, links: 0 },
    });
  });
});
