/**
 * Deleting a folder (#350): what the confirmation says the folder holds, at
 * every depth, which decides whether it asks the person to tick that they
 * understood.
 */

import { describe, expect, it } from 'vitest';
import type { FolderNode } from '../../shared/types/api';
import { contentsOf } from './DeleteFolder';

function folder(id: string, notes: number, children: FolderNode[] = []): FolderNode {
  return {
    id,
    parentId: null,
    name: id,
    slug: id,
    description: `What ${id} holds.`,
    position: 0,
    noteOrder: 'manual',
    hasTemplate: false,
    noteCount: notes,
    notes: Array.from({ length: notes }, (_unused, index) => ({
      id: `${id}-${index}`,
      name: `Note ${index}`,
      folderId: id,
    })),
    children,
  };
}

describe('what a folder about to be deleted holds', () => {
  it('counts the notes and the folders at every depth', () => {
    const tree = folder('a', 2, [folder('b', 1, [folder('c', 3)]), folder('d', 0)]);
    expect(contentsOf(tree)).toEqual({ notes: 6, folders: 3 });
  });

  it('is nothing for an empty folder, which asks for no box to be ticked', () => {
    expect(contentsOf(folder('empty', 0))).toEqual({ notes: 0, folders: 0 });
  });
});
