/**
 * What a write is allowed to be validated against (#154).
 *
 * Every operation of this context loads the notebook first, to authorize it and
 * to check it — a folder exists, a name is free, a ceiling allows it. The
 * aggregate is assembled from the items of one partition, and a store that has
 * not caught up answers it **without the folder written a moment ago**: the
 * write is then refused with a `404` naming a folder that exists. The Functional
 * stage of staging caught exactly that, on `create_folder` followed by
 * `create_note`, which is the sequence an agent performs most.
 *
 * So a write asks for the newest state and a read does not. The race cannot be
 * forced in a test, so what is asserted is the seam: which one each use case
 * asks for.
 */

import { describe, expect, it } from 'vitest';
import { Role } from '@memorysmith/kernel';
import { CreateFolder } from '../src/application/folders.js';
import { GetNotebook } from '../src/application/notebooks.js';
import type { Notebook } from '../src/domain/notebook/Notebook.js';
import { authorship, notebookWithTree, user } from './fixtures.js';

const ctx = { user, isOwner: true, role: Role.OWNER };

/** Records what each load asked for, and answers the same notebook. */
function repositoryRecording(notebook: Notebook, asked: Array<'read' | 'write'>) {
  return {
    notebooks: {
      findById: async (_id: unknown, options?: { for: 'read' | 'write' }) => {
        asked.push(options?.for ?? 'read');
        return notebook;
      },
      listAll: async () => [notebook],
      findBySlug: async () => null,
      save: async () => ({ ok: true as const, value: undefined }),
    },
    slots: {
      findGuidance: async () => null,
      findTemplate: async () => null,
      listTemplates: async () => [],
      save: async () => ({ ok: true as const, value: undefined }),
    },
  };
}

describe('the state a use case is validated against', () => {
  it('is the newest one when the use case writes', async () => {
    const { notebook } = notebookWithTree();
    const asked: Array<'read' | 'write'> = [];

    const written = await new CreateFolder(repositoryRecording(notebook, asked) as never).execute({
      ctx,
      notebookId: notebook.id,
      parentFolderId: null,
      name: 'Decisoes',
      description: 'Decisoes do tribunal, uma por nota.',
      afterFolderId: null,
      by: authorship(),
    });

    expect(written.ok).toBe(true);
    expect(asked).toEqual(['write']);
  });

  it('is whatever the store has settled on when it only reads', async () => {
    // A listing or a page a fraction of a second behind is what eventual
    // consistency is for, and it costs half.
    const { notebook } = notebookWithTree();
    const asked: Array<'read' | 'write'> = [];

    const read = await new GetNotebook(repositoryRecording(notebook, asked) as never).execute({
      ctx,
      notebookId: notebook.id,
    });

    expect(read.ok).toBe(true);
    expect(asked).toEqual(['read']);
  });
});
