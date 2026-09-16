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
import {
  ContentId,
  ContentRef,
  type FolderId,
  NoteId,
  Position,
  Role,
  sha256Hex,
} from '@memorysmith/kernel';
import { PutGuidance } from '../src/application/notebooks.js';
import { PutTemplate } from '../src/application/folders.js';
import { UpdateNote } from '../src/application/notes.js';
import { Note } from '../src/domain/note/Note.js';
import { Guidance } from '../src/domain/content-slot/Guidance.js';
import { Template } from '../src/domain/content-slot/Template.js';
import type { Notebook } from '../src/domain/notebook/Notebook.js';
import { authorship, contentRef, expectErr, unwrap, user, notebookWithTree } from './fixtures.js';

const ctx = { user, isOwner: true, role: Role.OWNER };

/**
 * The Guidance and the Template are aggregates of their own (RN-KNW-044), so a
 * test states what the slot repository answers instead of putting a pointer
 * inside the notebook.
 */
function deps(
  notebook: Notebook,
  stored = 'the current content',
  inForce: { guidance?: ContentRef; template?: ContentRef } = {},
) {
  return {
    notebooks: {
      findById: async () => notebook,
      listAll: async () => [notebook],
      findBySlug: async () => null,
      save: async () => ({ ok: true as const, value: undefined }),
    },
    slots: {
      findGuidance: async () =>
        inForce.guidance
          ? Guidance.rehydrate({
              subscriptionId: notebook.subscriptionId,
              notebookId: notebook.id,
              ref: inForce.guidance,
              createdBy: authorship(),
              updatedBy: authorship(),
              version: 1,
            })
          : null,
      findTemplate: async (_notebookId: unknown, folderId: FolderId) =>
        inForce.template
          ? Template.rehydrate({
              subscriptionId: notebook.subscriptionId,
              notebookId: notebook.id,
              folderId,
              ref: inForce.template,
              createdBy: authorship(),
              updatedBy: authorship(),
              version: 1,
            })
          : null,
      listTemplates: async () => [],
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

    const refused = await new PutGuidance(
      deps(notebook, 'the current content', { guidance: contentRef('a'.repeat(64), 20) }),
    ).execute({
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

    const refused = await new PutGuidance(
      deps(notebook, 'what the other hand wrote', { guidance: contentRef('a'.repeat(64), 20) }),
    ).execute({
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

    const written = await new PutGuidance(
      deps(notebook, 'the current content', { guidance: current }),
    ).execute({
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

    const refused = await new PutTemplate(
      deps(notebook, 'the current content', { template: contentRef('a'.repeat(64), 20) }),
    ).execute({
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

/**
 * RN-KNW-028, down to the store. Identical bytes used to produce no event and
 * move no pointer, and still stored a new version of the whole body that
 * nothing referenced; for a Guidance and a Template the write then answered
 * that version, which the pointer never took, so the next write based on it
 * was refused as a conflict.
 */
describe('identical bytes: nothing reaches the store', () => {
  const body = '---\nname: Modelo de norma\n---\n\n# Artigo\n';

  function refOf(markdown: string): ContentRef {
    return unwrap(
      ContentRef.create({
        contentId: ContentId.generate(),
        versionId: 'v-in-force',
        sha256: sha256Hex(markdown),
        bytes: Buffer.byteLength(markdown, 'utf8'),
      }),
    );
  }

  /** The dependencies of a write, with a store that counts what reaches it. */
  function counting(
    notebook: Notebook,
    inForce: { guidance?: ContentRef; template?: ContentRef } = {},
    extra: Record<string, unknown> = {},
  ) {
    const writes: string[] = [];
    const dependencies = {
      ...(deps(notebook, body, inForce) as unknown as Record<string, unknown>),
      ...extra,
      content: {
        create: async (): Promise<ContentRef> => {
          writes.push('create');
          return contentRef('b'.repeat(64), 10);
        },
        overwrite: async (): Promise<ContentRef> => {
          writes.push('overwrite');
          return contentRef('c'.repeat(64), 10);
        },
        read: async () => body,
      },
    };
    return { writes, dependencies };
  }

  it('a Guidance sent again writes nothing, and answers the revision in force', async () => {
    const { notebook } = notebookWithTree();
    const inForce = refOf(body);
    const { writes, dependencies } = counting(notebook, { guidance: inForce });

    const written = await new PutGuidance(
      dependencies as unknown as ConstructorParameters<typeof PutGuidance>[0],
    ).execute({
      ctx,
      notebookId: notebook.id,
      content: body,
      baseRevision: inForce.versionId,
      by: authorship(),
    });

    expect(unwrap(written).equals(inForce)).toBe(true);
    expect(writes).toEqual([]);
  });

  it('a Template sent again writes nothing, and answers the revision in force', async () => {
    const { notebook, normas } = notebookWithTree();
    const folderId = unwrap(normas).id;
    const inForce = refOf(body);
    const { writes, dependencies } = counting(notebook, { template: inForce });

    const written = await new PutTemplate(
      dependencies as unknown as ConstructorParameters<typeof PutTemplate>[0],
    ).execute({
      ctx,
      notebookId: notebook.id,
      folderId,
      content: body,
      baseRevision: inForce.versionId,
      by: authorship(),
    });

    expect(unwrap(written).equals(inForce)).toBe(true);
    expect(writes).toEqual([]);
  });

  it('identical bytes on a stale revision are still a conflict', async () => {
    const { notebook } = notebookWithTree();
    const { writes, dependencies } = counting(notebook, { guidance: refOf(body) });

    const refused = await new PutGuidance(
      dependencies as unknown as ConstructorParameters<typeof PutGuidance>[0],
    ).execute({
      ctx,
      notebookId: notebook.id,
      content: body,
      baseRevision: 'a-revision-somebody-else-replaced',
      by: authorship(),
    });

    expect(expectErr(refused).code).toBe('CONFLICT');
    expect(writes).toEqual([]);
  });

  it('a note sent again writes nothing and saves nothing, and answers as it is', async () => {
    const { notebook, normas } = notebookWithTree();
    const note = unwrap(
      Note.create({
        id: NoteId.generate(),
        subscriptionId: notebook.subscriptionId,
        notebookId: notebook.id,
        folderId: unwrap(normas).id,
        body,
        position: Position.first(),
        bodyRef: refOf(body),
        by: authorship(),
      }),
    );
    const saved: Note[] = [];
    const { writes, dependencies } = counting(
      notebook,
      {},
      {
        notes: {
          findById: async () => note,
          save: async (each: Note) => {
            saved.push(each);
            return { ok: true as const, value: undefined };
          },
        },
      },
    );

    const updated = await new UpdateNote(
      dependencies as unknown as ConstructorParameters<typeof UpdateNote>[0],
    ).execute({
      ctx,
      notebookId: notebook.id,
      noteId: note.id,
      content: body,
      baseRevision: note.revision,
      by: authorship(),
    });

    expect(unwrap(updated).revision).toBe(note.revision);
    expect(writes).toEqual([]);
    expect(saved).toEqual([]);
  });
});
