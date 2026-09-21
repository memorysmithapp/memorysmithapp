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

  test('[route:DELETE /knowledge/notebooks/:v] deletes a notebook for good, with everything under it', async ({
    owner,
    notebook,
  }) => {
    expect((await owner.call('DELETE', notebookPath(notebook))).status).toBe(204);

    // Not found, at once, everywhere under it: the notebook, its notes and the
    // route that used to bring it back (RN-KNW-033, RN-KNW-046).
    expect((await owner.call('GET', notebookPath(notebook))).status).toBe(404);
    expect((await owner.call('GET', `${notesPath(notebook)}/${notebook.noteId}`)).status).toBe(404);
    expect((await owner.call('POST', `${notebookPath(notebook)}/restore`)).status).toBe(404);
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

  test('[route:DELETE /knowledge/notebooks/:v/guidance] deletes the Guidance, and the notebook stays', async ({
    owner,
    notebook,
  }) => {
    const path = `${notebookPath(notebook)}/guidance`;
    await owner.ok<{ revision: ContentRef }>('PUT', path, {
      content: '# Guidance\n\nWritten so it can be deleted.\n',
      baseRevision: null,
    });

    expect((await owner.call('DELETE', path)).status).toBe(204);

    // The notebook is still there and simply says nothing any more
    // (RN-KNW-045). Deleting one used to be impossible: the only way out was
    // to delete the notebook that held it.
    const detail = await owner.ok<{ guidance: unknown; hasGuidance: boolean }>(
      'GET',
      notebookPath(notebook),
    );
    expect(detail.guidance).toBeNull();
    expect(detail.hasGuidance).toBe(false);
    // A second deletion has nothing to delete.
    expect((await owner.call('DELETE', path)).status).toBe(404);
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
    expect(reordered.status).toBe(200);
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
    // Nothing under the folder was written, and nothing under it is reachable:
    // the note answers as not found, and so does its folder (RN-KNW-046).
    expect((await owner.call('GET', `${notesPath(notebook)}/${notebook.noteId}`)).status).toBe(404);
    expect(
      (await owner.call('GET', `${notesPath(notebook)}?folderId=${notebook.folderId}`)).status,
    ).toBe(404);
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

  test('[route:POST /knowledge/notebooks/:v/folders/:f/numbers] issues the numbers of a folder, each once', async ({
    owner,
    notebook,
  }) => {
    const path = `${foldersPath(notebook)}/${notebook.folderId}/numbers`;
    const issued = await Promise.all(
      Array.from({ length: 5 }, () => owner.ok<{ number: number }>('POST', path)),
    );
    // RN-KNW-043: five requests at once, five distinct numbers from 1.
    expect(issued.map((each) => each.number).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    expect((await owner.ok<{ number: number }>('POST', path)).number).toBe(6);
  });

  test('[route:DELETE /knowledge/notebooks/:v/folders/:f/template] deletes the Template, and the folder stays', async ({
    owner,
    notebook,
  }) => {
    const path = `${foldersPath(notebook)}/${notebook.folderId}/template`;
    await owner.ok<{ revision: ContentRef }>('PUT', path, {
      content: '---\nname:\n---\n\n## Written so it can be deleted\n',
      baseRevision: null,
    });

    expect((await owner.call('DELETE', path)).status).toBe(204);

    const read = await owner.ok<{ content: string | null }>('GET', path);
    expect(read.content).toBeNull();
    // The folder survives its Template, which is what makes each of them a
    // unit of its own (RN-KNW-044, RN-KNW-045).
    const detail = await owner.ok<{ folders: Array<Folder & { hasTemplate: boolean }> }>(
      'GET',
      notebookPath(notebook),
    );
    const folder = detail.folders.find((each) => each.folderId === notebook.folderId);
    expect(folder?.name).toBe('Findings');
    expect(folder?.hasTemplate).toBe(false);
    expect((await owner.call('DELETE', path)).status).toBe(404);
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
    const word = unique('moved')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const later = await owner.ok<Note>('POST', notesPath(notebook), {
      folderId: notebook.folderId,
      content: `---\nname: Later finding\n---\n\nIt says ${word}.\n`,
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

    expect(reordered.status).toBe(200);
    expect(moved.status).toBe(200);
    expect(moved.body.folderId).toBe(archive.folderId);

    // A moved note is still found by its words, in its new folder: the move
    // used to be projected as an empty note (#141).
    const found = await eventually(
      'the moved note found by its words, in its new folder',
      () =>
        owner.ok<{ hits: Array<{ note: { noteId: string; folderId: string } }> }>(
          'POST',
          `/discovery/notebooks/${notebook.notebookId}/search`,
          { query: word },
        ),
      (answer) =>
        answer.hits.some(
          (hit) => hit.note.noteId === later.noteId && hit.note.folderId === archive.folderId,
        ),
    );
    expect(found.hits.map((hit) => hit.note.noteId)).toContain(later.noteId);
  });

  test('[route:DELETE /knowledge/notebooks/:v/notes/:n] deletes a note out of every listing, for good', async ({
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

    // Deleting a note twice is deleting one that is not there (RN-KNW-029),
    // and the route that brought one back is gone.
    expect((await owner.call('DELETE', path)).status).toBe(404);
    expect((await owner.call('POST', `${path}/restore`)).status).toBe(404);
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

/**
 * What a notebook keeps beside its notes (#166).
 *
 * The extension of a name decides nothing here: a file is named whatever it
 * was called, and the TYPE is what says how it is drawn, whether it may be
 * kept at all and what comes back when it is asked for.
 */
test.describe('the files of a notebook', () => {
  /** A PNG of one pixel: what is read is the signature, not the picture. */
  const PNG = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  ]).toString('base64');
  const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n').toString('base64');

  interface NotebookFile {
    fileId: string;
    name: string;
    mimeType: string;
    path: string;
    tags: string[];
    bytes: number;
  }

  test('[route:POST /knowledge/notebooks/:v/files] [route:GET /knowledge/notebooks/:v/files] keeps a file under a name with no extension and lists it', async ({
    owner,
    notebook,
  }) => {
    const name = unique('esquema de blocos');
    const kept = await owner.ok<NotebookFile>('POST', `${notebookPath(notebook)}/files`, {
      name,
      description: 'O desenho que a nota da arquitetura mostra',
      mimeType: 'image/png',
      tags: ['arquitetura'],
      path: '/desenhos/arquitetura',
      contentBase64: PNG,
    });
    expect(kept.name).toBe(name);
    expect(kept.mimeType).toBe('image/png');
    expect(kept.path).toBe('/desenhos/arquitetura');
    expect(kept.bytes).toBeGreaterThan(0);

    const listed = await owner.ok<{ files: NotebookFile[] }>(
      'GET',
      `${notebookPath(notebook)}/files`,
    );
    expect(listed.files.map((file) => file.name)).toContain(name);

    // The type is checked against the bytes, so a page kept as a picture is
    // refused before a byte is stored.
    const lying = await owner.call('POST', `${notebookPath(notebook)}/files`, {
      name: unique('inocente'),
      mimeType: 'image/png',
      contentBase64: Buffer.from('<!doctype html><script>alert(1)</script>').toString('base64'),
    });
    expect(lying.status).toBe(400);

    // And a type that is not on the list is refused naming what is.
    const unsupported = await owner.call('POST', `${notebookPath(notebook)}/files`, {
      name: unique('planilha antiga'),
      mimeType: 'application/vnd.ms-excel',
      contentBase64: PDF,
    });
    expect(unsupported.status).toBe(400);
  });

  test('[route:GET /knowledge/notebooks/:v/files/:f/link] [route:DELETE /knowledge/notebooks/:v/files/:f] answers a link a browser follows, and deleting is definitive', async ({
    owner,
    notebook,
  }) => {
    const name = unique('relatorio');
    const kept = await owner.ok<NotebookFile>('POST', `${notebookPath(notebook)}/files`, {
      name,
      mimeType: 'application/pdf',
      contentBase64: PDF,
    });

    const link = await owner.ok<{ url: string; expiresAt: string }>(
      'GET',
      `${notebookPath(notebook)}/files/${kept.fileId}/link`,
    );
    // It points at the object store and not at the API, which is what lets an
    // <img> follow it and what keeps a file somebody uploaded out of the
    // origin the product runs in.
    expect(link.url).toContain('http');
    expect(Date.parse(link.expiresAt)).toBeGreaterThan(Date.now());

    const fetched = await fetch(link.url);
    expect(fetched.status).toBe(200);
    expect(fetched.headers.get('content-type')).toContain('application/pdf');

    const deleted = await owner.call('DELETE', `${notebookPath(notebook)}/files/${kept.fileId}`);
    expect(deleted.status).toBe(204);

    const gone = await owner.call('GET', `${notebookPath(notebook)}/files/${kept.fileId}/link`);
    expect(gone.status).toBe(404);

    // The name is free again, which is what deleting definitively means.
    await owner.ok<NotebookFile>('POST', `${notebookPath(notebook)}/files`, {
      name,
      mimeType: 'image/png',
      contentBase64: PNG,
    });
  });
});
