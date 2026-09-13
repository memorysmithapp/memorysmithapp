/**
 * The revision guard of the two Content Slots that are not notes (RN-KNW-034).
 *
 * Writing a note was already protected against blind overwrite by RN-AGT-005,
 * and the justification written there holds here with MORE force: the guidance
 * is the most shared document of a notebook and the one most likely to be written
 * by two hands at once, a person on the web and an agent over MCP. Whoever
 * wrote last used to win, in silence.
 */

import { describe, expect, it } from 'vitest';
import { Role, type ContentRef } from '@memorysmith/kernel';
import { PutGuidance } from '../src/application/notebooks.js';
import { PutTemplate } from '../src/application/folders.js';
import type { Notebook } from '../src/domain/notebook/Notebook.js';
import { authorship, contentRef, expectErr, unwrap, user, notebookWithTree } from './fixtures.js';

const ctx = { user, isOwner: true, role: Role.OWNER };

function deps(notebook: Notebook, stored = 'the current content') {
  return {
    notebooks: {
      findById: async () => notebook,
      listAll: async () => [notebook],
      findBySlug: async () => null,
      save: async () => ({ ok: true as const, value: undefined }),
    },
    content: {
      create: async (): Promise<ContentRef> => contentRef('b'.repeat(64), 10),
      overwrite: async (): Promise<ContentRef> => contentRef('c'.repeat(64), 10),
      read: async () => stored,
    },
    storage: {
      current: async () => ({ usedBytes: 0, limitBytes: 1024 ** 3 }),
    },
  } as unknown as ConstructorParameters<typeof PutGuidance>[0];
}

describe('guidance: the write echoes the revision it is based on', () => {
  it('accepts null when the notebook has no guidance yet', async () => {
    const { notebook } = notebookWithTree();

    const written = await new PutGuidance(deps(notebook)).execute({
      ctx,
      notebookId: notebook.id,
      content: '# Proposito',
      baseRevision: null,
      by: authorship(),
    });

    expect(written.ok).toBe(true);
  });

  it('refuses null when a guidance is already there', async () => {
    const { notebook } = notebookWithTree();
    unwrap(notebook.setGuidance(contentRef('a'.repeat(64), 20), authorship()));

    const refused = await new PutGuidance(deps(notebook)).execute({
      ctx,
      notebookId: notebook.id,
      content: '# Outro',
      baseRevision: null,
      by: authorship(),
    });

    expect(expectErr(refused).code).toBe('CONFLICT');
  });

  it('answers a divergence with the current content attached', async () => {
    const { notebook } = notebookWithTree();
    unwrap(notebook.setGuidance(contentRef('a'.repeat(64), 20), authorship()));

    const refused = await new PutGuidance(deps(notebook, 'what the other hand wrote')).execute({
      ctx,
      notebookId: notebook.id,
      content: '# Outro',
      baseRevision: 'a-revision-that-is-not-the-current-one',
      by: authorship(),
    });

    const error = expectErr(refused);
    expect(error.code).toBe('CONFLICT');
    // The caller chooses between redoing and merging, and cannot choose
    // without seeing what is there now.
    expect(JSON.stringify(error)).toContain('what the other hand wrote');
  });

  it('goes through when the revision matches', async () => {
    const { notebook } = notebookWithTree();
    const current = contentRef('a'.repeat(64), 20);
    unwrap(notebook.setGuidance(current, authorship()));

    const written = await new PutGuidance(deps(notebook)).execute({
      ctx,
      notebookId: notebook.id,
      content: '# Outro',
      baseRevision: current.versionId,
      by: authorship(),
    });

    expect(written.ok).toBe(true);
  });
});

describe('template: the same guard, for the same reason', () => {
  it('refuses a stale revision', async () => {
    const { notebook, normas } = notebookWithTree();
    const folderId = unwrap(normas).id;
    unwrap(notebook.attachTemplate(folderId, contentRef('a'.repeat(64), 20), authorship()));

    const refused = await new PutTemplate(deps(notebook)).execute({
      ctx,
      notebookId: notebook.id,
      folderId,
      content: '# Novo modelo',
      baseRevision: 'stale',
      by: authorship(),
    });

    expect(expectErr(refused).code).toBe('CONFLICT');
  });

  it('accepts null on a folder with no template yet', async () => {
    const { notebook, normas } = notebookWithTree();
    const folderId = unwrap(normas).id;

    const written = await new PutTemplate(deps(notebook)).execute({
      ctx,
      notebookId: notebook.id,
      folderId,
      content: '# Modelo',
      baseRevision: null,
      by: authorship(),
    });

    expect(written.ok).toBe(true);
  });
});
