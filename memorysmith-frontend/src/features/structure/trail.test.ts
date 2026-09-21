/**
 * What an identifier in an address reaches.
 *
 * The address carries identifiers alone (RN-DSC-045), so the folder trail a
 * breadcrumb shows is read from the structure, by identifier, and never from
 * the path. That is what makes an address survive a rename and a move — the
 * two things that used to break it (RN-DSC-057).
 */

import { describe, expect, it } from 'vitest';
import { folderTrailForNote, folderTrailOf, subtreeNoteCount } from './trail';
import { identifierOf } from '../../shared/api/note-address';
import type { FolderNode, NoteSummary } from '../../shared/types/api';

const DECISIONS = '01J8X2K9QZ3M4N5P6R7S8T9VD1';
const YEAR = '01J8X2K9QZ3M4N5P6R7S8T9VD2';
const EMPTY = '01J8X2K9QZ3M4N5P6R7S8T9VE1';
const LEI = '01J8X2K9QZ3M4N5P6R7S8T9V0W';
const ART = '01J8X2K9QZ3M4N5P6R7S8T9V0X';

function note(id: string, name: string, folderId: string): NoteSummary {
  return { id, name, folderId };
}

function folder(
  id: string,
  name: string,
  notes: NoteSummary[],
  children: FolderNode[] = [],
): FolderNode {
  return {
    id,
    parentId: null,
    name,
    slug: name.toLowerCase(),
    description: 'a folder',
    position: 1,
    hasTemplate: false,
    noteCount: notes.length,
    notes,
    children,
  };
}

const folders: FolderNode[] = [
  folder(
    DECISIONS,
    'Decisions',
    [note(LEI, 'Lei 14.133', DECISIONS)],
    [folder(YEAR, '2026', [note(ART, 'Article 75', YEAR)])],
  ),
  folder(EMPTY, 'Empty', []),
];

const names = (trail: FolderNode[]): string[] => trail.map((each) => each.name);

describe('a folder is reached by its identifier', () => {
  it('gives the trail from the root down to a nested folder', () => {
    expect(names(folderTrailOf(folders, YEAR))).toEqual(['Decisions', '2026']);
    expect(names(folderTrailOf(folders, EMPTY))).toEqual(['Empty']);
  });

  it('still reaches a folder after it was renamed', () => {
    const renamed = [{ ...folders[0]!, name: 'Rulings' }, folders[1]!];
    expect(names(folderTrailOf(renamed, DECISIONS))).toEqual(['Rulings']);
  });

  it('reaches nothing for an identifier the tree does not hold', () => {
    expect(folderTrailOf(folders, '01J8X2K9QZ3M4N5P6R7S8T9VZZ')).toEqual([]);
  });

  it('reaches nothing for a note identifier, which is not a folder', () => {
    expect(folderTrailOf(folders, LEI)).toEqual([]);
  });
});

describe('a note is reached by its identifier, wherever it is', () => {
  it('gives the folders above a note', () => {
    expect(names(folderTrailForNote(folders, LEI))).toEqual(['Decisions']);
    expect(names(folderTrailForNote(folders, ART))).toEqual(['Decisions', '2026']);
  });

  it('follows a note that was moved, because the address never named its folder', () => {
    const moved = [
      folder(DECISIONS, 'Decisions', [], [folder(YEAR, '2026', [note(ART, 'Article 75', YEAR)])]),
      folder(EMPTY, 'Empty', [note(LEI, 'Lei 14.133', EMPTY)]),
    ];
    expect(names(folderTrailForNote(moved, LEI))).toEqual(['Empty']);
  });

  it('reaches the same note from an identifier written in either case', () => {
    const lower = identifierOf(LEI.toLowerCase());
    const upper = identifierOf(LEI);
    expect(lower).toBe(upper);
    expect(names(folderTrailForNote(folders, lower ?? ''))).toEqual(['Decisions']);
  });

  it('reaches nothing from a segment that is not an identifier', () => {
    expect(identifierOf('lei-14133--01j8x2k9qz3m4n5p6r7s8t9v0w')).toBeNull();
  });
});

describe('the notes of a folder and of its whole subtree', () => {
  it('sums three levels deep, so a folder holding its notes below is not empty', () => {
    const leaf = { ...folder('01J8X2K9QZ3M4N5P6R7S8T9VL3', 'leaf', []), noteCount: 20 };
    const middle = { ...folder('01J8X2K9QZ3M4N5P6R7S8T9VL2', 'middle', [], [leaf]), noteCount: 6 };
    const top = folder('01J8X2K9QZ3M4N5P6R7S8T9VL1', 'top', [], [middle]);

    expect(top.noteCount).toBe(0);
    expect(subtreeNoteCount(top)).toBe(26);
    expect(subtreeNoteCount(middle)).toBe(26);
    expect(subtreeNoteCount(folder(EMPTY, 'empty', []))).toBe(0);
  });
});
