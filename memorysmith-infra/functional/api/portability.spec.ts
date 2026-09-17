/**
 * Portability: a notebook leaves as one open document and comes back as the
 * same notebook (software-vision.md, section 12).
 *
 * The export is a JOB now (RN-PRT-019): the API records it and a worker builds
 * the archive, so every case here waits for the transfer to end rather than
 * reading a link out of the answer.
 */

import { eventually } from '../support/eventually.js';
import type { Api } from '../support/api.js';
import { expect, test, unique, unknownId } from './fixtures.js';

interface TransferDto {
  transferId: string;
  kind: 'export' | 'import';
  status: 'running' | 'ready' | 'failed' | 'cancelled';
  notebookId: string | null;
  notebookName: string;
  done: number;
  total: number;
  bytes: number;
}

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

/** Starts an export and waits for the worker to finish it. */
async function exported(api: Api, notebookId: string): Promise<TransferDto> {
  const started = await api.ok<TransferDto>('POST', `/portability/notebooks/${notebookId}/export`);
  expect(started.status).toBe('running');
  return eventually(
    'the export to end',
    () => api.ok<TransferDto>('GET', `/portability/transfers/${started.transferId}`),
    (transfer) => transfer.status !== 'running',
  );
}

test.describe('a notebook out and back in', () => {
  test('[route:POST /portability/notebooks/:v/export] [route:GET /portability/transfers/:t] [route:POST /portability/transfers/:t/download] [route:POST /portability/imports] [route:POST /portability/imports/apply] exports a notebook as a job and imports it back as the same notebook', async ({
    owner,
    notebook,
  }) => {
    await owner.ok('POST', `/knowledge/notebooks/${notebook.notebookId}/notes`, {
      folderId: notebook.folderId,
      content:
        '---\nname: Linked finding\ntags: [portable]\n---\n\nIt links to [[First finding]].\n',
    });

    const transfer = await exported(owner, notebook.notebookId);
    expect(transfer.status).toBe('ready');
    expect(transfer.bytes).toBeGreaterThan(0);
    expect(transfer.done).toBe(transfer.total);

    // The link is minted at the moment of the download and never stored, so a
    // transfer can be downloaded again days later (RN-PRT-019).
    const link = await owner.ok<{ downloadUrl: string }>(
      'POST',
      `/portability/transfers/${transfer.transferId}/download`,
    );
    const archive = new Uint8Array(await (await fetch(link.downloadUrl)).arrayBuffer());
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
    expect(imported.noteCount).toBe(transfer.total);
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

test.describe('the transfers of a person', () => {
  test('[route:GET /portability/transfers] [route:DELETE /portability/transfers/:t] keeps an export until it is deleted, and nobody else ever sees it', async ({
    owner,
    other,
    notebook,
  }) => {
    const transfer = await exported(owner, notebook.notebookId);

    const listed = await owner.ok<{ transfers: TransferDto[]; keptBytes: number }>(
      'GET',
      '/portability/transfers',
    );
    expect(listed.transfers.map((each) => each.transferId)).toContain(transfer.transferId);
    // A kept export occupies storage of the subscription (RN-SUB-021).
    expect(listed.keptBytes).toBeGreaterThanOrEqual(transfer.bytes);

    /**
     * Another member of the subscription may see less of that notebook, so a
     * listing must never carry somebody else's transfer, and addressing one
     * directly is a key that does not exist (RN-PRT-020, rule 9).
     */
    const theirs = await other.ok<{ transfers: TransferDto[] }>('GET', '/portability/transfers');
    expect(theirs.transfers.map((each) => each.transferId)).not.toContain(transfer.transferId);
    expect((await other.call('GET', `/portability/transfers/${transfer.transferId}`)).status).toBe(
      404,
    );
    expect(
      (await other.call('DELETE', `/portability/transfers/${transfer.transferId}`)).status,
    ).toBe(404);

    // Deleting destroys the bytes and takes them out of the quota with them.
    expect(
      (await owner.call('DELETE', `/portability/transfers/${transfer.transferId}`)).status,
    ).toBe(204);
    const after = await owner.ok<{ transfers: TransferDto[]; keptBytes: number }>(
      'GET',
      '/portability/transfers',
    );
    expect(after.transfers.map((each) => each.transferId)).not.toContain(transfer.transferId);
    expect(after.keptBytes).toBe(listed.keptBytes - transfer.bytes);
    expect(
      (await owner.call('POST', `/portability/transfers/${transfer.transferId}/download`)).status,
    ).toBe(404);
  });

  test('survives the deletion of its notebook, and imports it back', async ({
    owner,
    notebook,
  }) => {
    const transfer = await exported(owner, notebook.notebookId);
    expect((await owner.call('DELETE', `/knowledge/notebooks/${notebook.notebookId}`)).status).toBe(
      204,
    );

    // An export is a document and not a part of the notebook, so it stays —
    // and it is the one way back from a deletion by mistake (RN-PRT-020).
    const link = await owner.ok<{ downloadUrl: string }>(
      'POST',
      `/portability/transfers/${transfer.transferId}/download`,
    );
    const archive = new Uint8Array(await (await fetch(link.downloadUrl)).arrayBuffer());
    const upload = await owner.ok<{ uploadKey: string; uploadUrl: string }>(
      'POST',
      '/portability/imports',
    );
    await fetch(upload.uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': 'application/zip' },
      body: archive,
    });
    const imported = await owner.ok<{ notebookId: string; noteCount: number }>(
      'POST',
      '/portability/imports/apply',
      { uploadKey: upload.uploadKey, name: unique('Back from the dead') },
    );
    expect(imported.noteCount).toBe(transfer.total);

    await owner.call('DELETE', `/portability/transfers/${transfer.transferId}`);
  });

  test('answers not found for a transfer that never existed', async ({ owner }) => {
    expect((await owner.call('GET', `/portability/transfers/${unknownId()}`)).status).toBe(404);
  });
});
