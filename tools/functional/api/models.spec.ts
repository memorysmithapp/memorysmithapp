/**
 * Notebook models (#353): a notebook of the run declared as a model by its
 * owner, frozen into a version the worker builds, read whole, and deleted.
 */

import { eventually } from '../support/eventually.js';
import { expect, test } from './fixtures.js';

interface ModelDto {
  notebookId: string;
  objective: string;
  parameters: Array<{ name: string; required: boolean; default: unknown }>;
  versions: Array<{ number: number; status: string; changelog: string }>;
}

test.describe('a notebook model', () => {
  test('[route:PUT /portability/models/:v] [route:GET /portability/models/:v] [route:GET /portability/models] [route:POST /portability/models/:v/versions] [route:GET /portability/models/:v/versions/:n] [route:DELETE /portability/models/:v/versions/:n] is declared, versioned, read whole and its version deleted', async ({
    owner,
    notebook,
  }) => {
    const declared = await owner.call('PUT', `/portability/models/${notebook.notebookId}`, {
      objective: 'Keep what a functional case finds',
      description: 'One finding per note',
      audience: 'The functional suite',
      parameters: [
        { name: 'case', description: 'The case', example: 'AE-01', type: 'text', required: true },
        {
          name: 'due',
          description: 'When it is due',
          example: '2026-12-01',
          type: 'date',
          required: false,
          default: '2026-12-01',
        },
      ],
      basedOn: null,
    });
    expect(declared.status).toBe(200);

    const started = await owner.ok<{ number: number; status: string }>(
      'POST',
      `/portability/models/${notebook.notebookId}/versions`,
      { changelog: 'The first version' },
    );
    expect(started.number).toBe(1);

    // The worker builds the snapshot, as it builds an export.
    const model = await eventually(
      'the version to be built',
      () => owner.ok<ModelDto>('GET', `/portability/models/${notebook.notebookId}`),
      (each) => each.versions[0]?.status !== 'running',
    );
    expect(model.versions).toEqual([
      expect.objectContaining({ number: 1, status: 'ready', changelog: 'The first version' }),
    ]);
    expect(model.parameters.map((each) => each.name)).toEqual(['case', 'due']);

    const listed = await owner.ok<{ models: Array<{ notebookId: string; name: string }> }>(
      'GET',
      '/portability/models',
    );
    expect(listed.models).toContainEqual(
      expect.objectContaining({ notebookId: notebook.notebookId, name: notebook.name }),
    );

    const view = await owner.ok<{
      version: { number: number };
      notebook: { name: string };
      folders: Array<{ folderId: string }>;
      notes: Array<{ noteId: string }>;
    }>('GET', `/portability/models/${notebook.notebookId}/versions/1`);
    expect(view.version.number).toBe(1);
    expect(view.notebook.name).toBe(notebook.name);
    expect(view.folders.map((each) => each.folderId)).toEqual([notebook.folderId]);
    expect(view.notes.map((each) => each.noteId)).toEqual([notebook.noteId]);

    // A version is not one of the person's transfers to look after.
    const transfers = await owner.ok<{ transfers: Array<{ notebookId: string | null }> }>(
      'GET',
      '/portability/transfers',
    );
    expect(transfers.transfers.some((each) => each.notebookId === notebook.notebookId)).toBe(false);

    expect(
      (await owner.call('DELETE', `/portability/models/${notebook.notebookId}/versions/1`)).status,
    ).toBe(204);
    const after = await owner.ok<ModelDto>('GET', `/portability/models/${notebook.notebookId}`);
    expect(after.versions).toEqual([]);
  });
});
