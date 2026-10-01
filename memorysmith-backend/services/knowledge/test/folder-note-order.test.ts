/**
 * A folder declares how its notes are ordered: by hand, or by name (#262,
 * RN-KNW-056).
 */

import { describe, expect, it } from 'vitest';
import { NoteId, Position, Role, type FolderId } from '@memorysmith/kernel';
import { ListNotes, ReorderNote } from '../src/application/notes.js';
import { CreateFolder, PatchFolder } from '../src/application/folders.js';
import { Note } from '../src/domain/note/Note.js';
import type { Notebook } from '../src/domain/notebook/Notebook.js';
import { composeNotebookContext } from '../src/domain/services/NotebookContextComposer.js';
import { inFolderOrder } from '../src/adapters/inbound/http/presenters.js';
import {
  authorship,
  contentRef,
  expectErr,
  folderDescription,
  folderName,
  noteBody,
  notebookWithTree,
  unwrap,
} from './fixtures.js';
import { user } from './fixtures.js';

const ctx = { user, isOwner: true, role: Role.OWNER };

function noteIn(notebook: Notebook, folderId: FolderId, name: string | null, position: Position) {
  return unwrap(
    Note.create({
      id: NoteId.generate(),
      subscriptionId: notebook.subscriptionId,
      notebookId: notebook.id,
      folderId,
      body: name === null ? 'No name here.\n' : noteBody(name),
      position,
      bodyRef: contentRef(),
      by: authorship(),
    }),
  );
}

function notebookDeps(notebook: Notebook, notes: Note[] = []) {
  let saves = 0;
  const deps = {
    notebooks: {
      findById: async () => notebook,
      save: async () => {
        saves += 1;
        return { ok: true as const, value: undefined };
      },
    },
    notes: {
      listByFolder: async (_notebook: unknown, folderId: FolderId) =>
        notes.filter((note) => note.folderId.equals(folderId)),
      listByNotebook: async () => notes,
      findById: async (_notebook: unknown, id: NoteId) =>
        notes.find((note) => note.id.equals(id)) ?? null,
      siblingOrder: async () => notes.map((note) => ({ noteId: note.id, position: note.position })),
      save: async () => ({ ok: true as const, value: undefined }),
    },
    storage: { current: async () => ({ usedBytes: 0, limitBytes: 1024 ** 3 }) },
  };
  return { deps: deps as never, saves: () => saves };
}

describe('the order a folder declares for its notes', () => {
  it('is manual for a folder that says nothing, and records nothing for it', () => {
    const { notebook, normas } = notebookWithTree();
    expect(unwrap(normas).noteOrder).toBe('manual');
    expect(notebook.pullEvents()).toHaveLength(0);
  });

  it('is born alphabetical when asked, and the trail says so', async () => {
    const { notebook } = notebookWithTree();
    const { deps } = notebookDeps(notebook);
    const created = await new CreateFolder(deps).execute({
      ctx,
      notebookId: notebook.id,
      parentFolderId: null,
      name: 'Atas',
      description: 'Uma ata por reunião.',
      afterFolderId: null,
      noteOrder: 'alphabetical',
      by: authorship(),
    });
    expect(unwrap(created).noteOrder).toBe('alphabetical');
    const types = notebook.pullEvents().map((event) => event.type);
    expect(types).toEqual(['FolderAdded', 'FolderNotesOrdered']);
  });

  it('refuses an order that is neither of the two', async () => {
    const { notebook } = notebookWithTree();
    const { deps } = notebookDeps(notebook);
    const created = await new CreateFolder(deps).execute({
      ctx,
      notebookId: notebook.id,
      parentFolderId: null,
      name: 'Atas',
      description: 'Uma ata por reunião.',
      afterFolderId: null,
      noteOrder: 'by-date',
      by: authorship(),
    });
    expect(expectErr(created).code).toBe('VALIDATION');
  });

  it('changes through the patch of a folder, and changes nothing when it is already so', async () => {
    const { notebook, normas } = notebookWithTree();
    const folderId = unwrap(normas).id;
    const { deps, saves } = notebookDeps(notebook);
    const patch = (noteOrder: string) =>
      new PatchFolder(deps).execute({
        ctx,
        notebookId: notebook.id,
        folderId,
        noteOrder,
        by: authorship(),
      });

    unwrap(await patch('alphabetical'));
    expect(notebook.folders.get(folderId)?.noteOrder).toBe('alphabetical');
    expect(notebook.pullEvents().map((event) => event.type)).toEqual(['FolderNotesOrdered']);
    expect(saves()).toBe(1);

    unwrap(await patch('alphabetical'));
    expect(saves()).toBe(1);
  });

  it('is said in the Notebook Context only where it is not the default', () => {
    const { notebook, normas } = notebookWithTree();
    const folderId = unwrap(normas).id;
    unwrap(notebook.orderFolderNotes(folderId, 'alphabetical', authorship()));
    const context = composeNotebookContext({ notebook, guidance: null, reservedVocabulary: [] });
    expect(context).toMatch(/\*\*Normas\*\* `[^`]+`: .*notes ordered by name\)/);
    expect(context.match(/notes ordered by name/g)).toHaveLength(1);
  });
});

describe('the notes of a folder ordered by name', () => {
  it('are listed by name, a note with no name last, while a manual folder keeps its order', async () => {
    const { notebook, normas } = notebookWithTree();
    const atas = unwrap(
      notebook.addFolder(
        null,
        folderName('Atas'),
        folderDescription('Uma ata por reunião.'),
        null,
        authorship(),
        'alphabetical',
      ),
    );
    const normasId = unwrap(normas).id;
    let position = Position.first();
    const next = () => (position = Position.between(position, null));
    const notes = [
      noteIn(notebook, atas.id, 'Ata 10', next()),
      noteIn(notebook, atas.id, null, next()),
      noteIn(notebook, atas.id, 'Ata 2', next()),
      noteIn(notebook, normasId, 'Zeta', next()),
      noteIn(notebook, normasId, 'Alfa', next()),
    ];
    const { deps } = notebookDeps(notebook, notes);

    const whole = unwrap(await new ListNotes(deps).execute({ ctx, notebookId: notebook.id }));
    const names = (folderId: FolderId) =>
      inFolderOrder(whole)
        .filter((note) => note.folderId.equals(folderId))
        .map((note) => note.name);
    expect(names(atas.id)).toEqual(['Ata 2', 'Ata 10', null]);
    expect(names(normasId)).toEqual(['Zeta', 'Alfa']);

    const one = unwrap(
      await new ListNotes(deps).execute({ ctx, notebookId: notebook.id, folderId: atas.id }),
    );
    expect(inFolderOrder(one).map((note) => note.name)).toEqual(['Ata 2', 'Ata 10', null]);
  });

  it('have no place of their own to be moved to', async () => {
    const { notebook } = notebookWithTree();
    const atas = unwrap(
      notebook.addFolder(
        null,
        folderName('Atas'),
        folderDescription('Uma ata por reunião.'),
        null,
        authorship(),
        'alphabetical',
      ),
    );
    const first = noteIn(notebook, atas.id, 'Ata 1', Position.first());
    const second = noteIn(notebook, atas.id, 'Ata 2', Position.between(Position.first(), null));
    const { deps } = notebookDeps(notebook, [first, second]);
    const moved = await new ReorderNote(deps).execute({
      ctx,
      notebookId: notebook.id,
      noteId: second.id,
      afterNoteId: null,
      by: authorship(),
    });
    const error = expectErr(moved);
    expect(error.code).toBe('PRECONDITION_FAILED');
    expect(error.message).toContain('orders its notes by name');
  });
});
