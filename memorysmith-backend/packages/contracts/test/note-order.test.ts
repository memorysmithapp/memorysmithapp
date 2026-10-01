/**
 * The order of the notes of an alphabetical folder (#262), which the knowledge
 * service, the connector and the screen all read from here.
 */

import { describe, expect, it } from 'vitest';
import { compareByName, noteOrderOf, type NamedNote } from '../src/note-order.js';

const note = (name: string | null, noteId: string): NamedNote => ({ name, noteId });
const sorted = (notes: NamedNote[]) => [...notes].sort(compareByName).map((each) => each.name);

describe('the notes of an alphabetical folder', () => {
  it('compares numbers by value', () => {
    expect(sorted([note('Ata 10', 'a'), note('Ata 2', 'b'), note('Ata 1', 'c')])).toEqual([
      'Ata 1',
      'Ata 2',
      'Ata 10',
    ]);
  });

  it('lets neither case nor an accent decide the order on its own', () => {
    expect(sorted([note('órgão', 'a'), note('Ordem', 'b'), note('obra', 'c')])).toEqual([
      'obra',
      'Ordem',
      'órgão',
    ]);
  });

  it('puts a note with no name after every named one', () => {
    expect(sorted([note(null, 'a'), note('Zebra', 'b'), note('Abelha', 'c')])).toEqual([
      'Abelha',
      'Zebra',
      null,
    ]);
  });

  it('is total: equal names fall back to the exact name and then the identifier', () => {
    const ordered = [note('ata', 'b'), note('Ata', 'z'), note('Ata', 'a')].sort(compareByName);
    expect(ordered.map((each) => `${each.name}:${each.noteId}`)).toEqual([
      'Ata:a',
      'Ata:z',
      'ata:b',
    ]);
    expect(compareByName(note(null, 'a'), note(null, 'b'))).toBeLessThan(0);
  });
});

describe('the order a folder declares', () => {
  it('reads either order, and anything else as manual', () => {
    expect(noteOrderOf('alphabetical')).toBe('alphabetical');
    expect(noteOrderOf('manual')).toBe('manual');
    expect(noteOrderOf(undefined)).toBe('manual');
    expect(noteOrderOf('by-date')).toBe('manual');
  });
});
