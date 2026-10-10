/**
 * Moving a note to another folder of its notebook (#265, RN-KNW-057): the
 * folders the dialog offers, the tree the moment the move is done, what a
 * refusal says, and the dialog itself in both locales.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { TFunction } from 'i18next';
import { ApiError } from '../../shared/api/error-mapper';
import type { FolderNode, NotebookStructure } from '../../shared/types/api';
import { folderChoices, moveRefusal, movedInto } from './move';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  } as Storage;
}

vi.stubGlobal('localStorage', memoryStorage());

const NOTEBOOK = '01J8X2K9QZ3M4N5P6R7S8T9V0A';

function folder(
  id: string,
  name: string,
  notes: Array<[string, string | null]>,
  extra: Partial<FolderNode> = {},
): FolderNode {
  return {
    id,
    parentId: null,
    name,
    slug: name.toLowerCase(),
    description: '',
    position: 0,
    noteOrder: 'manual',
    hasTemplate: false,
    noteCount: notes.length,
    notes: notes.map(([noteId, noteName]) => ({ id: noteId, name: noteName, folderId: id })),
    children: [],
    ...extra,
  };
}

const proposals = folder('F1', 'Proposals', [
  ['N1', 'Script 1'],
  ['N2', 'Script 2'],
]);
const made = folder('F2', 'Made', [
  ['N3', 'Script 0'],
  ['N4', 'Script 9'],
]);
const minutes = folder('F3', 'Minutes', [['N5', 'Ata 10']], {
  noteOrder: 'alphabetical',
  children: [folder('F4', '2026', [], { parentId: 'F3' })],
});

const structure: NotebookStructure = {
  notebook: { id: NOTEBOOK } as NotebookStructure['notebook'],
  guidance: null,
  guidanceRevision: null,
  effectiveRole: 'OWNER',
  folders: [proposals, made, minutes],
};

const t = ((key: string, values?: Record<string, string>) =>
  `${key}${values ? ` ${JSON.stringify(values)}` : ''}`) as unknown as TFunction;

describe('the folders a note may move to', () => {
  it('are every folder of the notebook, in the order of the tree, named by their trail', () => {
    const choices = folderChoices(structure.folders);
    expect(choices.map((each) => each.label)).toEqual([
      'Proposals',
      'Made',
      'Minutes',
      'Minutes / 2026',
    ]);
    expect(choices.map((each) => each.depth)).toEqual([0, 0, 0, 1]);
  });
});

describe('the tree the moment a move is done', () => {
  const notesOf = (tree: NotebookStructure, id: string) =>
    folderChoices(tree.folders)
      .find((each) => each.id === id)
      ?.notes.map((note) => note.id);

  it('takes the note out of its folder and puts it right after the note chosen', () => {
    const after = movedInto(structure, 'N1', 'F2', 'N3');
    expect(notesOf(after, 'F1')).toEqual(['N2']);
    expect(notesOf(after, 'F2')).toEqual(['N3', 'N1', 'N4']);
    expect(after.folders[0]?.noteCount).toBe(1);
    expect(after.folders[1]?.noteCount).toBe(3);
  });

  it('puts it last without an anchor, and by its name in a folder ordered by name', () => {
    expect(notesOf(movedInto(structure, 'N1', 'F2', null), 'F2')).toEqual(['N3', 'N4', 'N1']);
    // By name, Ata 10 comes before Script 1 whatever the anchor said.
    expect(notesOf(movedInto(structure, 'N1', 'F3', 'N5'), 'F3')).toEqual(['N5', 'N1']);
    const ata2 = movedInto(
      { ...structure, folders: [folder('F1', 'P', [['N9', 'Ata 2']]), minutes] },
      'N9',
      'F3',
      null,
    );
    expect(notesOf(ata2, 'F3')).toEqual(['N9', 'N5']);
  });

  it('leaves the tree as it was when the note is not in it', () => {
    expect(movedInto(structure, 'NX', 'F2', null)).toBe(structure);
  });
});

describe('what a refused move says', () => {
  it('names the note that holds the name in the destination', () => {
    const refusal = moveRefusal(
      new ApiError('CONFLICT', 'A note of this folder is already named "Script 1"', 409, {
        code: 'ALREADY_EXISTS',
        noteId: 'N7',
        name: 'Script 1',
      }),
      t,
      'Made',
    );
    expect(refusal.holder).toBe('N7');
    expect(refusal.message).toContain('move.nameTaken');
    expect(refusal.message).toContain('Script 1');
    expect(refusal.message).toContain('Made');
  });

  it('says whose notebook it is when the notebook is read-only for this person', () => {
    const refusal = moveRefusal(
      new ApiError('FORBIDDEN', 'Shared by owner@example.com for reading', 403),
      t,
      'Made',
    );
    expect(refusal).toEqual({ message: 'Shared by owner@example.com for reading', holder: null });
  });
});

const LOADING_THE_BUNDLE_MS = 30_000;

let draw: (
  locale: 'en_US' | 'pt_BR',
  note: { id: string; folderId: string },
  refusal?: { message: string; holder: string | null },
  folders?: FolderNode[],
) => Promise<string>;

beforeAll(async () => {
  const i18n = (await import('../../i18n')).default;
  const { MoveNoteForm } = await import('./MoveNote');
  draw = async (locale, note, refusal, folders = structure.folders) => {
    await i18n.changeLanguage(locale);
    return renderToStaticMarkup(
      <MemoryRouter>
        <MoveNoteForm
          notebookId={NOTEBOOK}
          note={note}
          folders={folderChoices(folders)}
          busy={false}
          refusal={refusal ?? null}
          onSubmit={() => undefined}
          onCancel={() => undefined}
        />
      </MemoryRouter>,
    );
  };
}, LOADING_THE_BUNDLE_MS);

describe('the dialog that moves a note', () => {
  it('says beforehand that the links keep working, in pt_BR', async () => {
    const html = await draw('pt_BR', { id: 'N1', folderId: 'F1' });
    expect(html).toContain('um link encontra uma nota pelo nome');
    expect(html).toContain('Proposals (onde está)');
    expect(html).toContain('Mover');
  });

  it('offers every other folder, the one it is in disabled, and where in a folder kept by hand', async () => {
    const html = await draw('en_US', { id: 'N1', folderId: 'F1' });
    expect(html).toContain('a link finds a note by its name');
    expect(html).toMatch(/<option value="F1" disabled="">Proposals \(where it is\)<\/option>/);
    // The first other folder is chosen, and it is kept by hand: where in it.
    expect(html).toContain('Where in the folder');
    expect(html).toContain('After Script 0');
    expect(html).toContain('At the end');
  });

  it('asks no place in a folder ordered by name, and says why', async () => {
    const html = await draw('en_US', { id: 'N1', folderId: 'F1' }, undefined, [proposals, minutes]);
    expect(html).toContain('This folder orders its notes by name');
    expect(html).not.toContain('Where in the folder');
  });

  it('shows a refusal in the dialog, with the note that holds the name', async () => {
    const html = await draw(
      'en_US',
      { id: 'N1', folderId: 'F1' },
      { message: 'Made already holds a note named Script 1.', holder: 'N7' },
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('Made already holds a note named Script 1.');
    expect(html).toContain(`/notebooks/${NOTEBOOK.toLowerCase()}/notes/n7`);
    expect(html).toContain('Open that note');
  });
});
