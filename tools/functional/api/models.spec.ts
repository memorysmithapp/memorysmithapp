/**
 * Notebook models (#353, #431): a notebook of the run declared as a model by
 * its owner, read whole as it stands with the history of its changes, and
 * used to create a notebook, a copy the worker makes of it at that moment.
 */

import { eventually } from '../support/eventually.js';
import { expect, test } from './fixtures.js';

interface ModelDto {
  notebookId: string;
  objective: string;
  parameters: Array<{ name: string; required: boolean; default: unknown }>;
}

test.describe('a notebook model', () => {
  test('[route:PUT /portability/models/:v] [route:GET /portability/models/:v] [route:GET /portability/models] [route:GET /portability/models/:v/contents] [route:GET /portability/models/:v/history] [route:POST /portability/models/:v/notebooks] is declared, read whole as it stands with its history, and used to create a notebook', async ({
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

    const model = await owner.ok<ModelDto & Record<string, unknown>>(
      'GET',
      `/portability/models/${notebook.notebookId}`,
    );
    expect(model.parameters.map((each) => each.name)).toEqual(['case', 'due']);
    expect(model).not.toHaveProperty('versions');

    const listed = await owner.ok<{ models: Array<{ notebookId: string; name: string }> }>(
      'GET',
      '/portability/models',
    );
    expect(listed.models).toContainEqual(
      expect.objectContaining({ notebookId: notebook.notebookId, name: notebook.name }),
    );

    const contents = await owner.ok<{
      notebook: { name: string };
      folders: Array<{ folderId: string }>;
      notes: Array<{ noteId: string }>;
    }>('GET', `/portability/models/${notebook.notebookId}/contents`);
    expect(contents.notebook.name).toBe(notebook.name);
    expect(contents.folders.map((each) => each.folderId)).toEqual([notebook.folderId]);
    expect(contents.notes.map((each) => each.noteId)).toEqual([notebook.noteId]);

    // The history is the trail of the notebook, which follows a write within seconds.
    const history = await eventually(
      'the note of the notebook to reach the history of the model',
      () =>
        owner.ok<{
          changes: Array<{ type: string; subjectId: string; agent: string | null }>;
          truncated: boolean;
        }>('GET', `/portability/models/${notebook.notebookId}/history`),
      (each) => each.changes.some((change) => change.subjectId === notebook.noteId),
    );
    expect(history.truncated).toBe(false);

    // A notebook created from the model, its parameters filled in (#359).
    const refused = await owner.call<{ details?: { missing?: string[] } }>(
      'POST',
      `/portability/models/${notebook.notebookId}/notebooks`,
      { name: '', values: {} },
    );
    expect(refused.status).toBe(400);
    expect(refused.body.details?.missing).toEqual(['case']);
    const created = await owner.ok<{ transferId: string }>(
      'POST',
      `/portability/models/${notebook.notebookId}/notebooks`,
      { name: `${notebook.name} AE-01`, values: { case: 'AE-01' } },
    );
    const imported = await eventually(
      'the notebook to be created',
      () =>
        owner.ok<{ status: string; notebookId: string | null }>(
          'GET',
          `/portability/transfers/${created.transferId}`,
        ),
      (each) => each.status !== 'running',
    );
    expect(imported.status).toBe('ready');
    const copy = await owner.ok<{ name: string }>(
      'GET',
      `/knowledge/notebooks/${imported.notebookId}`,
    );
    expect(copy.name).toBe(`${notebook.name} AE-01`);
    await owner.call('DELETE', `/knowledge/notebooks/${imported.notebookId}`);
    await owner.call('DELETE', `/portability/transfers/${created.transferId}`);

    // Nothing of the model is kept besides its notebook: no export of it.
    const transfers = await owner.ok<{
      transfers: Array<{ kind: string; notebookId: string | null }>;
    }>('GET', '/portability/transfers');
    expect(
      transfers.transfers.some(
        (each) => each.kind === 'export' && each.notebookId === notebook.notebookId,
      ),
    ).toBe(false);
  });

  test('travels with its export: imported back, it is a model (#397)', async ({
    owner,
    notebook,
  }) => {
    await owner.ok('PUT', `/portability/models/${notebook.notebookId}`, {
      objective: 'Keep what a functional case finds',
      description: '',
      audience: '',
      parameters: [
        { name: 'case', description: '', example: 'AE-01', type: 'text', required: true },
      ],
      basedOn: null,
    });

    const started = await owner.ok<{ transferId: string }>(
      'POST',
      `/portability/notebooks/${notebook.notebookId}/export`,
    );
    const exported = await eventually(
      'the export to end',
      () => owner.ok<{ status: string }>('GET', `/portability/transfers/${started.transferId}`),
      (each) => each.status !== 'running',
    );
    expect(exported.status).toBe('ready');
    const { uploadKey } = await owner.ok<{ uploadKey: string }>(
      'POST',
      '/portability/imports/from-export',
      { transferId: started.transferId },
    );
    const applied = await owner.ok<{ transferId: string }>('POST', '/portability/imports/apply', {
      uploadKey,
      name: `${notebook.name} imported`,
    });
    const imported = await eventually(
      'the import to end',
      () =>
        owner.ok<{ status: string; notebookId: string | null }>(
          'GET',
          `/portability/transfers/${applied.transferId}`,
        ),
      (each) => each.status !== 'running',
    );
    expect(imported.status).toBe('ready');

    try {
      const model = await owner.ok<ModelDto>('GET', `/portability/models/${imported.notebookId}`);
      expect(model.objective).toBe('Keep what a functional case finds');
      expect(model.parameters.map((each) => each.name)).toEqual(['case']);
    } finally {
      await owner.call('DELETE', `/knowledge/notebooks/${imported.notebookId}`);
      await owner.call('DELETE', `/portability/transfers/${started.transferId}`);
      await owner.call('DELETE', `/portability/transfers/${applied.transferId}`);
    }
  });
});
