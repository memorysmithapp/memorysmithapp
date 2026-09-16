/**
 * Where a note goes (RN-AGT-029). An anchor has to be a live note of the
 * folder, and the listing of a folder is an index that converges after a
 * write, so a note written a moment ago still anchors the next one.
 */

import { describe, expect, it } from 'vitest';
import { type FolderId, NoteId, Position, Role } from '@memorysmith/kernel';
import { CreateNote, ReorderNote } from '../src/application/notes.js';
import { Note } from '../src/domain/note/Note.js';
import type { Notebook } from '../src/domain/notebook/Notebook.js';
import {
  authorship,
  contentRef,
  expectErr,
  noteBody,
  notebookWithTree,
  unwrap,
  user,
} from './fixtures.js';

const ctx = { user, isOwner: true, role: Role.OWNER };

function noteIn(notebook: Notebook, folderId: FolderId, name: string, position: Position): Note {
  return unwrap(
    Note.create({
      id: NoteId.generate(),
      subscriptionId: notebook.subscriptionId,
      notebookId: notebook.id,
      folderId,
      body: noteBody(name),
      position,
      bodyRef: contentRef(),
      by: authorship(),
    }),
  );
}

/**
 * `indexed` is what the listing of the folder shows, `table` what the table
 * holds: a note can be in the second and not yet in the first.
 */
function dependencies(notebook: Notebook, notes: { indexed: Note[]; table: Note[] }) {
  const stored: string[] = [];
  const saved: Note[] = [];
  const deps = {
    notebooks: {
      findById: async () => notebook,
      save: async () => ({ ok: true as const, value: undefined }),
    },
    notes: {
      siblingOrder: async () =>
        notes.indexed.map((note) => ({ noteId: note.id, position: note.position })),
      findById: async (_notebook: unknown, id: NoteId) =>
        notes.table.find((note) => note.id.equals(id)) ?? null,
      // No name is taken in these cases: they are about where a note goes.
      findByName: async () => null,
      save: async (note: Note) => {
        saved.push(note);
        return { ok: true as const, value: undefined };
      },
    },
    content: {
      create: async () => {
        stored.push('create');
        return contentRef('b'.repeat(64), 10);
      },
    },
    storage: { current: async () => ({ usedBytes: 0, limitBytes: 1024 ** 3 }) },
  };
  return { stored, saved, deps: deps as unknown as ConstructorParameters<typeof CreateNote>[0] };
}

describe('placing a note after another', () => {
  it('anchors on a note the listing of the folder does not show yet', async () => {
    const { notebook, normas } = notebookWithTree();
    const folderId = unwrap(normas).id;
    const first = noteIn(notebook, folderId, 'Primeira', Position.first());
    const { saved, deps } = dependencies(notebook, { indexed: [], table: [first] });

    const created = await new CreateNote(deps).execute({
      ctx,
      notebookId: notebook.id,
      folderId,
      content: noteBody('Segunda'),
      afterNoteId: first.id,
      by: authorship(),
    });

    expect(unwrap(created).position.value > first.position.value).toBe(true);
    expect(saved).toHaveLength(1);
  });

  it('refuses an anchor that lives in another folder, and stores nothing', async () => {
    const { notebook, normas } = notebookWithTree();
    const folderId = unwrap(normas).id;
    const other = notebook.folders.childrenOf(null).find((folder) => !folder.id.equals(folderId));
    if (!other) throw new Error('The fixture holds two folders at the root');
    const elsewhere = noteIn(notebook, other.id, 'Achado', Position.first());
    const { stored, saved, deps } = dependencies(notebook, { indexed: [], table: [elsewhere] });

    const refused = await new CreateNote(deps).execute({
      ctx,
      notebookId: notebook.id,
      folderId,
      content: noteBody('Segunda'),
      afterNoteId: elsewhere.id,
      by: authorship(),
    });

    expect(expectErr(refused).code).toBe('VALIDATION');
    // Where it goes is decided before the content is stored.
    expect(stored).toEqual([]);
    expect(saved).toEqual([]);
  });

  it('answers a reordered note with the position it now has', async () => {
    const { notebook, normas } = notebookWithTree();
    const folderId = unwrap(normas).id;
    const first = noteIn(notebook, folderId, 'Primeira', Position.first());
    const second = noteIn(notebook, folderId, 'Segunda', Position.between(first.position, null));
    const { deps } = dependencies(notebook, { indexed: [first, second], table: [first, second] });

    const reordered = await new ReorderNote(
      deps as unknown as ConstructorParameters<typeof ReorderNote>[0],
    ).execute({
      ctx,
      notebookId: notebook.id,
      noteId: second.id,
      afterNoteId: null,
      by: authorship(),
    });

    expect(unwrap(reordered).position.value < first.position.value).toBe(true);
  });
});
