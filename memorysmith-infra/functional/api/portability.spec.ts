/**
 * Portability: a notebook leaves as one open document and comes back as the
 * same notebook (software-vision.md, section 12).
 */

import type { Api } from '../support/api.js';
import { expect, test, unique } from './fixtures.js';

/** The body of every note of a notebook, in an order that ignores identifiers. */
async function bodiesOf(api: Api, notebookId: string): Promise<string[]> {
  const notes = await api.ok<Array<{ noteId: string }>>(
    'GET',
    `/knowledge/notebooks/${notebookId}/notes`,
  );
  const bodies = await Promise.all(
    notes.map((note) =>
      api.ok<{ content: string }>('GET', `/knowledge/notebooks/${notebookId}/notes/${note.noteId}`),
    ),
  );
  return bodies.map((note) => note.content).sort();
}

test.describe('a notebook out and back in', () => {
  test('[route:POST /portability/notebooks/:v/export] [route:POST /portability/imports] [route:POST /portability/imports/apply] exports a notebook and imports it back as the same notebook', async ({
    owner,
    notebook,
  }) => {
    await owner.ok('POST', `/knowledge/notebooks/${notebook.notebookId}/notes`, {
      folderId: notebook.folderId,
      content:
        '---\nname: Linked finding\ntags: [portable]\n---\n\nIt links to [[First finding]].\n',
    });

    const exported = await owner.ok<{ downloadUrl: string; noteCount: number }>(
      'POST',
      `/portability/notebooks/${notebook.notebookId}/export`,
    );
    const archive = new Uint8Array(await (await fetch(exported.downloadUrl)).arrayBuffer());
    expect(Buffer.from(archive.subarray(0, 2)).toString('latin1')).toBe('PK');

    const upload = await owner.ok<{ uploadKey: string; uploadUrl: string }>(
      'POST',
      '/portability/imports',
    );
    const put = await fetch(upload.uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': 'application/zip' },
      body: archive,
    });
    expect(put.ok).toBe(true);

    const imported = await owner.ok<{ notebookId: string; noteCount: number; folderCount: number }>(
      'POST',
      '/portability/imports/apply',
      { uploadKey: upload.uploadKey, name: unique('Imported') },
    );
    expect(imported.noteCount).toBe(exported.noteCount);
    expect(await bodiesOf(owner, imported.notebookId)).toEqual(
      await bodiesOf(owner, notebook.notebookId),
    );

    // An upload is applied once: it is deleted after any attempt.
    const again = await owner.call('POST', '/portability/imports/apply', {
      uploadKey: upload.uploadKey,
      name: unique('Twice'),
    });
    expect(again.status).toBe(404);
  });
});
