/**
 * Knowledge: notebooks, the Guidance, folders, Templates, notes and the role
 * limit of a notebook (software-vision.md, section 9; architecture-guide.md,
 * sections 9 and 10).
 */

import type { Api } from '../support/api.js';
import { eventually } from '../support/eventually.js';
import { expect, test, unique, type NotebookFixture } from './fixtures.js';

interface ContentRef {
  contentId: string;
  versionId: string;
}

interface Note {
  noteId: string;
  folderId: string;
  name: string | null;
  content: string;
  revision: ContentRef;
}

interface Folder {
  folderId: string;
  parentFolderId: string | null;
  name: string;
  position: string;
}

const notebookPath = (notebook: NotebookFixture) => `/knowledge/notebooks/${notebook.notebookId}`;
const foldersPath = (notebook: NotebookFixture) => `${notebookPath(notebook)}/folders`;
const notesPath = (notebook: NotebookFixture) => `${notebookPath(notebook)}/notes`;

const createFolder = (api: Api, notebook: NotebookFixture, name: string) =>
  api.ok<Folder>('POST', foldersPath(notebook), { name, description: `Where ${name} are kept.` });

test.describe('notebooks', () => {
  test('[route:POST /knowledge/notebooks] [route:GET /knowledge/notebooks] creates a notebook, lists it, and refuses a second one under the same name', async ({
    owner,
  }) => {
    const name = unique('Created');
    const created = await owner.call<{ notebookId: string; name: string }>(
      'POST',
      '/knowledge/notebooks',
      { name, description: 'Created by a functional case.' },
    );
    expect(created.status).toBe(201);
    expect(created.body.name).toBe(name);

    const listed = await owner.ok<Array<{ notebookId: string }>>('GET', '/knowledge/notebooks');
    expect(listed.map((each) => each.notebookId)).toContain(created.body.notebookId);
    expect((await owner.call('POST', '/knowledge/notebooks', { name })).status).toBe(409);
  });

  test('[route:GET /knowledge/notebooks/:v] [route:PATCH /knowledge/notebooks/:v] reads a notebook with its folders, and renames it', async ({
    owner,
    notebook,
  }) => {
    const detail = await owner.ok<{ folders: Folder[] }>('GET', notebookPath(notebook));
    expect(detail.folders.map((folder) => folder.folderId)).toContain(notebook.folderId);

    const renamed = unique('Renamed');
    expect((await owner.call('PATCH', notebookPath(notebook), { name: renamed })).status).toBe(204);
    expect((await owner.ok<{ name: string }>('GET', notebookPath(notebook))).name).toBe(renamed);
  });

  test('[route:DELETE /knowledge/notebooks/:v] [route:POST /knowledge/notebooks/:v/restore] deletes a notebook out of sight and restores it whole', async ({
    owner,
    notebook,
  }) => {
    expect((await owner.call('DELETE', notebookPath(notebook))).status).toBe(204);
    expect((await owner.call('GET', notebookPath(notebook))).status).toBe(404);
    expect((await owner.call('POST', `${notebookPath(notebook)}/restore`)).status).toBe(204);

    const restored = await owner.ok<{ folders: Folder[] }>('GET', notebookPath(notebook));
    expect(restored.folders.map((folder) => folder.folderId)).toEqual([notebook.folderId]);
  });

  test('[route:GET /knowledge/notebooks/:v/context] serves the notebook as an agent reads it before writing', async ({
    owner,
    notebook,
  }) => {
    const answer = await owner.call<string>('GET', `${notebookPath(notebook)}/context`);

    expect(answer.status).toBe(200);
    expect(answer.headers.get('content-type')).toContain('text/markdown');
    expect(answer.body.startsWith(`# Notebook: ${notebook.name}`)).toBe(true);
    expect(answer.body).toContain('## Structure');
    expect(answer.body).toContain(notebook.folderId);
  });

  test('[route:PUT /knowledge/notebooks/:v/guidance] writes the Guidance on the revision it saw, and refuses a write that saw an older one', async ({
    owner,
    notebook,
  }) => {
    const path = `${notebookPath(notebook)}/guidance`;
    const first = await owner.ok<{ revision: ContentRef }>('PUT', path, {
      content: '# Guidance\n\nWrite one finding per note.\n',
      baseRevision: null,
    });
    const second = await owner.call('PUT', path, {
      content: '# Guidance\n\nWrite one finding per note, and link it to its evidence.\n',
      baseRevision: first.revision.versionId,
    });
    const stale = await owner.call<{ code: string }>('PUT', path, {
      content: '# Guidance\n\nA write that saw nothing after the first.\n',
      baseRevision: first.revision.versionId,
    });

    expect(second.status).toBe(200);
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('CONFLICT');
  });
});

test.describe('folders', () => {
  test('[route:POST /knowledge/notebooks/:v/folders] creates a folder inside another, and never one without a description', async ({
    owner,
    notebook,
  }) => {
    const child = await owner.call<Folder>('POST', foldersPath(notebook), {
      name: 'Details',
      description: 'The detail of a finding.',
      parentFolderId: notebook.folderId,
    });
    const bare = await owner.call('POST', foldersPath(notebook), { name: 'Bare', description: '' });

    expect(child.status).toBe(201);
    expect(child.body.parentFolderId).toBe(notebook.folderId);
    expect(bare.status).toBe(400);
  });

  test('[route:PATCH /knowledge/notebooks/:v/folders/:f] [route:POST /knowledge/notebooks/:v/folders/:f/reorder] renames a folder and puts another after it', async ({
    owner,
    notebook,
  }) => {
    const second = await createFolder(owner, notebook, 'Questions');
    const renamed = await owner.call('PATCH', `${foldersPath(notebook)}/${second.folderId}`, {
      name: 'Open questions',
    });
    const reordered = await owner.call(
      'POST',
      `${foldersPath(notebook)}/${notebook.folderId}/reorder`,
      { afterFolderId: second.folderId },
    );
    const afterItself = await owner.call(
      'POST',
      `${foldersPath(notebook)}/${second.folderId}/reorder`,
      { afterFolderId: second.folderId },
    );

    expect(renamed.status).toBe(204);
    expect(reordered.status).toBe(204);
    expect(afterItself.status).toBe(400);
    const roots = (await owner.ok<{ folders: Folder[] }>('GET', notebookPath(notebook))).folders
      .filter((folder) => folder.parentFolderId === null)
      .sort((a, b) => (String(a.position) < String(b.position) ? -1 : 1));
    expect(roots.map((folder) => folder.name)).toEqual(['Open questions', 'Findings']);
  });

  test('[route:DELETE /knowledge/notebooks/:v/folders/:f] deletes a folder only under the policy it was given', async ({
    owner,
    notebook,
  }) => {
    const path = `${foldersPath(notebook)}/${notebook.folderId}`;

    // Whether a folder holds notes is read from its counter, which the outbox
    // relay keeps after the write and not inside it (architecture-guide.md,
    // section 10.3). The note of the fixture was written a moment ago, so the
    // refusal is asked for once the folder counts it, as the design promises.
    await eventually(
      'the note of the fixture counted in its folder',
      () =>
        owner.ok<{ folders: Array<Folder & { noteCount: number }> }>('GET', notebookPath(notebook)),
      (detail) =>
        (detail.folders.find((folder) => folder.folderId === notebook.folderId)?.noteCount ?? 0) >
        0,
    );
    expect((await owner.call('DELETE', path)).status).toBe(412);
    expect((await owner.call('DELETE', `${path}?policy=REJECT_IF_NOT_EMPTY`)).status).toBe(409);
    const removed = await owner.call<{ removedFolderIds: string[] }>(
      'DELETE',
      `${path}?policy=CASCADE`,
    );
    expect(removed.status).toBe(200);
    expect(removed.body.removedFolderIds).toContain(notebook.folderId);
    // The note of the folder went with it, and has nowhere to come back to
    // (RN-KNW-040, RN-KNW-041).
    expect(
      (await owner.call('POST', `${notesPath(notebook)}/${notebook.noteId}/restore`)).status,
    ).toBe(409);
  });

  test('[route:PUT /knowledge/notebooks/:v/folders/:f/template] [route:GET /knowledge/notebooks/:v/folders/:f/template] writes the Template of a folder and reads it back', async ({
    owner,
    notebook,
  }) => {
    const path = `${foldersPath(notebook)}/${notebook.folderId}/template`;
    const template = '---\nname:\n---\n\n## Finding\n\n## Evidence\n';

    const written = await owner.ok<{ revision: ContentRef }>('PUT', path, {
      content: template,
      baseRevision: null,
    });
    const read = await owner.ok<{
      content: string | null;
      folderName: string;
      revision: ContentRef;
    }>('GET', path);
    expect(read.content).toBe(template);
    expect(read.folderName).toBe('Findings');
    // The revision the next write echoes back, which the interface reads: its
    // absence is what broke the page of Templates.
    expect(read.revision.versionId).toBe(written.revision.versionId);
  });
});

test.describe('notes', () => {
  test('[route:POST /knowledge/notebooks/:v/notes] [route:GET /knowledge/notebooks/:v/notes] writes a note named by its frontmatter, and one with no name at all', async ({
    owner,
    notebook,
  }) => {
    const named = await owner.call<Note>('POST', notesPath(notebook), {
      folderId: notebook.folderId,
      content: '---\nname: Second finding\n---\n\nIt states its name.\n',
    });
    const unnamed = await owner.call<Note>('POST', notesPath(notebook), {
      folderId: notebook.folderId,
      content: 'No frontmatter names this note, and it is written all the same.\n',
    });

    expect(named.status).toBe(201);
    expect(named.body.name).toBe('Second finding');
    expect(unnamed.status).toBe(201);
    expect(unnamed.body.name).toBeNull();
    const listed = await owner.ok<Note[]>(
      'GET',
      `${notesPath(notebook)}?folderId=${notebook.folderId}`,
    );
    expect(listed.map((note) => note.noteId)).toEqual(
      expect.arrayContaining([notebook.noteId, named.body.noteId, unnamed.body.noteId]),
    );
  });

  test('[route:GET /knowledge/notebooks/:v/notes/:n] [route:PUT /knowledge/notebooks/:v/notes/:n] chains two writes on the revision each one returned, and refuses one that saw neither', async ({
    owner,
    notebook,
  }) => {
    // The defect this guards: the second tick of a checklist conflicted with the
    // first, because the client kept the revision it had loaded with.
    const path = `${notesPath(notebook)}/${notebook.noteId}`;
    const loaded = await owner.ok<Note>('GET', path);
    const ticked = await owner.ok<Note>('PUT', path, {
      content: `${loaded.content}\n- [x] first\n- [ ] second\n`,
      baseRevision: loaded.revision.versionId,
    });
    const again = await owner.call<Note>('PUT', path, {
      content: ticked.content.replace('- [ ] second', '- [x] second'),
      baseRevision: ticked.revision.versionId,
    });
    const stale = await owner.call<{ code: string }>('PUT', path, {
      content: 'A write that saw neither.\n',
      baseRevision: loaded.revision.versionId,
    });

    expect(again.status).toBe(200);
    expect(stale.status).toBe(409);
    expect((await owner.ok<Note>('GET', path)).content).toContain('- [x] second');
  });

  test('[route:POST /knowledge/notebooks/:v/notes/:n/reorder] [route:POST /knowledge/notebooks/:v/notes/:n/move] puts a note after another, and moves one to another folder', async ({
    owner,
    notebook,
  }) => {
    const later = await owner.ok<Note>('POST', notesPath(notebook), {
      folderId: notebook.folderId,
      content: '---\nname: Later finding\n---\n',
    });
    const reordered = await owner.call(
      'POST',
      `${notesPath(notebook)}/${notebook.noteId}/reorder`,
      { afterNoteId: later.noteId },
    );
    const archive = await createFolder(owner, notebook, 'Archive');
    const moved = await owner.call<Note>('POST', `${notesPath(notebook)}/${later.noteId}/move`, {
      toFolderId: archive.folderId,
    });

    expect(reordered.status).toBe(204);
    expect(moved.status).toBe(200);
    expect(moved.body.folderId).toBe(archive.folderId);
  });

  test('[route:DELETE /knowledge/notebooks/:v/notes/:n] [route:POST /knowledge/notebooks/:v/notes/:n/restore] deletes a note out of every listing, and restores it', async ({
    owner,
    notebook,
  }) => {
    const path = `${notesPath(notebook)}/${notebook.noteId}`;

    expect((await owner.call('DELETE', path)).status).toBe(204);
    expect((await owner.call('GET', path)).status).toBe(404);
    const listed = await owner.ok<Note[]>(
      'GET',
      `${notesPath(notebook)}?folderId=${notebook.folderId}`,
    );
    expect(listed.map((note) => note.noteId)).not.toContain(notebook.noteId);

    expect((await owner.call('POST', `${path}/restore`)).status).toBe(204);
    expect((await owner.call('GET', path)).status).toBe(200);
    expect((await owner.call('POST', `${path}/restore`)).status).toBe(409);
  });
});

test.describe('the role limit of a notebook', () => {
  test('[route:PUT /knowledge/notebooks/:v/limits/:user] [route:DELETE /knowledge/notebooks/:v/limits/:user] lowers a role in one notebook, and never raises one', async ({
    owner,
    other,
    notebook,
  }) => {
    const { user } = await other.ok<{ user: { userId: string } }>('GET', '/access/session');
    const path = `${notebookPath(notebook)}/limits/${user.userId}`;

    expect((await owner.call('PUT', path, { limit: 'EDITOR' })).status).toBe(400);
    expect((await owner.call('PUT', path, { limit: 'VIEWER' })).status).toBe(204);
    expect((await owner.call('DELETE', path)).status).toBe(204);
    expect((await owner.call('DELETE', path)).status).toBe(404);
  });
});
