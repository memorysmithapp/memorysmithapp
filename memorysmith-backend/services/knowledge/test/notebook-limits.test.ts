/**
 * The product limits of software-vision.md, section 14, exercised where they
 * are enforced: the use case, not the aggregate.
 *
 * They exist as tests because a declared limit that nothing verifies is a
 * number in a document. `maxFolders` and `maxDepth` are covered in
 * notebook.test.ts, on the aggregate that owns them; the two here belong to
 * CreateNote and had no test at all.
 *
 * Beside them, the one precondition of CreateNote no repository enforces: that
 * the folder belongs to the notebook, read before the write because a note
 * transaction includes no item but the note's own.
 */

import { describe, expect, it } from 'vitest';
import { Role, type ContentRef } from '@memorysmith/kernel';
import { RemoveFolder } from '../src/application/folders.js';
import { CreateNote } from '../src/application/notes.js';
import { NOTEBOOK_LIMITS } from '../src/domain/values.js';
import type { Note } from '../src/domain/note/Note.js';
import type { Notebook } from '../src/domain/notebook/Notebook.js';
import {
  authorship,
  contentRef,
  expectErr,
  rehydratedNotebookWithNotes,
  unwrap,
  user,
} from './fixtures.js';

const ctx = { user, isOwner: true, role: Role.OWNER };

/**
 * The smallest set of doubles CreateNote can run on. Everything answers the
 * happy path, so a refusal in a test below can only have come from the limit
 * under test.
 */
function deps(notebook: Notebook) {
  return {
    notebooks: {
      findById: async () => notebook,
      listAll: async () => [notebook],
      save: async () => ({ ok: true as const, value: undefined }),
    },
    notes: {
      findById: async () => null,
      listByFolder: async () => [] as Note[],
      listByNotebook: async () => [] as Note[],
      siblingOrder: async () => [],
      save: async () => ({ ok: true as const, value: undefined }),
      saveMoved: async () => ({ ok: true as const, value: undefined }),
    },
    content: {
      create: async (): Promise<ContentRef> => contentRef(),
      overwrite: async (): Promise<ContentRef> => contentRef(),
      read: async () => '',
    },
    storage: {
      current: async () => ({ usedBytes: 0, limitBytes: 1024 ** 3 }),
    },
  } as unknown as ConstructorParameters<typeof CreateNote>[0];
}

describe('notebook limits', () => {
  it('accepts a note past two thousand, because a notebook has no ceiling of notes', async () => {
    // RN-KNW-010: the ceiling existed to bound the scan of the search, and it
    // refused writes in a notebook doing its job. The storage quota is the bound.
    const { notebook, folderId } = rehydratedNotebookWithNotes(5000);

    const created = await new CreateNote(deps(notebook)).execute({
      ctx,
      notebookId: notebook.id,
      folderId,
      content: '# Uma nota a mais',
      afterNoteId: null,
      by: authorship(),
    });

    expect(created.ok).toBe(true);
  });

  it('refuses a body over 1 MB, before anything is written to the store', async () => {
    const { notebook, folderId } = rehydratedNotebookWithNotes(1);

    const refused = await new CreateNote(deps(notebook)).execute({
      ctx,
      notebookId: notebook.id,
      folderId,
      content: 'a'.repeat(NOTEBOOK_LIMITS.maxNoteBytes + 1),
      afterNoteId: null,
      by: authorship(),
    });

    const error = expectErr(refused);
    expect(error.code).toBe('LIMIT_EXCEEDED');
    expect(error.message).toContain('1 MB');
  });

  it('measures the body in bytes and not in characters', async () => {
    const { notebook, folderId } = rehydratedNotebookWithNotes(1);
    // Each of these costs two bytes in UTF-8, so half the ceiling in
    // characters is exactly the ceiling in bytes, plus one to cross it.
    const content = 'é'.repeat(NOTEBOOK_LIMITS.maxNoteBytes / 2 + 1);

    const refused = await new CreateNote(deps(notebook)).execute({
      ctx,
      notebookId: notebook.id,
      folderId,
      content,
      afterNoteId: null,
      by: authorship(),
    });

    expect(content.length).toBeLessThan(NOTEBOOK_LIMITS.maxNoteBytes);
    expect(expectErr(refused).code).toBe('LIMIT_EXCEEDED');
  });
});

describe('removing a folder', () => {
  it('is one write, whatever the subtree holds', async () => {
    // RN-KNW-040 is removed: a CASCADE writes nothing under the folder, so
    // there is no number of notes it could be refused for. What it does write
    // is the tree, once.
    const { notebook, folderId } = rehydratedNotebookWithNotes(5000);
    const writes: string[] = [];
    const cascade = new RemoveFolder({
      ...deps(notebook),
      notebooks: {
        findById: async () => notebook,
        listAll: async () => [notebook],
        save: async () => {
          writes.push('notebook');
          return { ok: true as const, value: undefined };
        },
      },
    } as unknown as ConstructorParameters<typeof RemoveFolder>[0]);

    const removed = await cascade.execute({
      ctx,
      notebookId: notebook.id,
      folderId,
      policy: 'CASCADE',
      by: authorship(),
    });

    expect(unwrap(removed).map((id: { value: string }) => id.value)).toEqual([folderId.value]);
    expect(writes).toEqual(['notebook']);
  });
});

describe('where a note may be written', () => {
  it('refuses a folder the notebook does not hold, which no repository checks (architecture-guide.md, section 10.2)', async () => {
    const { notebook } = rehydratedNotebookWithNotes(1);
    const { folderId: elsewhere } = rehydratedNotebookWithNotes(1);

    const refused = await new CreateNote(deps(notebook)).execute({
      ctx,
      notebookId: notebook.id,
      folderId: elsewhere,
      content: '---\nname: Órfã\n---\n\nCorpo.',
      afterNoteId: null,
      by: authorship(),
    });

    const error = expectErr(refused);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toContain('Folder');
  });
});
