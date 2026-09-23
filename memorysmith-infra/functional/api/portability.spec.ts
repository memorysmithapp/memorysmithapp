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
  failure: string | null;
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

/**
 * Starts an import and waits for the worker to finish it. An import is a JOB
 * like an export (RN-PRT-018): `apply` records it and answers the transfer,
 * and what it wrote is read off that record when it ends.
 */
async function importedFrom(api: Api, uploadKey: string, name: string): Promise<TransferDto> {
  const started = await api.ok<TransferDto>('POST', '/portability/imports/apply', {
    uploadKey,
    name,
  });
  return eventually(
    'the import to end',
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

    const imported = await importedFrom(owner, upload.uploadKey, unique('Imported'));
    expect(imported.status).toBe('ready');
    expect(imported.done).toBe(transfer.total);
    expect(await bodiesOf(owner, imported.notebookId ?? '')).toEqual(
      await bodiesOf(owner, notebook.notebookId),
    );

    /**
     * An upload is applied once: it is discarded when the import ends,
     * whichever way it ended (RN-PRT-014). Applying it again is accepted as a
     * JOB — the API records it and answers, and nothing is read until the
     * worker runs (RN-PRT-018) — and that job ends refused, naming what it
     * could not find.
     */
    const again = await importedFrom(owner, upload.uploadKey, unique('Twice'));
    expect(again.status).toBe('failed');
    expect(again.failure).toBe('NOT_FOUND');
  });
  test('carries the files of the notebook out and back in, by name', async ({
    owner,
    notebook,
  }) => {
    /**
     * The smallest real PNG there is, kept under a name with NO EXTENSION, so
     * what comes back is proved to travel by its type and never by its name
     * (RN-PRT-025, RN-KNW-050).
     */
    const png =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const name = unique('A picture');
    await owner.ok('POST', `/knowledge/notebooks/${notebook.notebookId}/files`, {
      name,
      description: 'Kept by a functional case',
      mimeType: 'image/png',
      tags: ['portable'],
      path: '/evidence',
      contentBase64: png,
    });
    // And a note that shows it, so what the round trip has to preserve is the
    // reference as much as the bytes.
    await owner.ok('POST', `/knowledge/notebooks/${notebook.notebookId}/notes`, {
      folderId: notebook.folderId,
      content: `---\nname: ${unique('Shows the picture')}\n---\n\n![[${name}]]\n`,
    });

    const transfer = await exported(owner, notebook.notebookId);
    expect(transfer.status).toBe('ready');
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
    const imported = await importedFrom(owner, upload.uploadKey, unique('With files'));
    expect(imported.status).toBe('ready');

    const { files } = await owner.ok<{
      files: Array<{ name: string; mimeType: string; path: string; tags: string[]; bytes: number }>;
    }>('GET', `/knowledge/notebooks/${imported.notebookId ?? ''}/files`);
    const brought = files.find((file) => file.name === name);
    expect(brought, 'the file came back under its name').toBeDefined();
    expect(brought?.mimeType).toBe('image/png');
    expect(brought?.path).toBe('/evidence');
    expect(brought?.tags).toEqual(['portable']);
    // The bytes, not a placeholder: an archive whose pictures live somewhere
    // else is not an archive.
    expect(brought?.bytes).toBeGreaterThan(0);
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
    const imported = await importedFrom(owner, upload.uploadKey, unique('Back from the dead'));
    expect(imported.status).toBe('ready');
    expect(imported.done).toBe(transfer.total);

    await owner.call('DELETE', `/portability/transfers/${transfer.transferId}`);
  });

  test('answers not found for a transfer that never existed', async ({ owner }) => {
    expect((await owner.call('GET', `/portability/transfers/${unknownId()}`)).status).toBe(404);
  });

  /**
   * Cancelling an import takes the notebook it had started back down whole,
   * which frees its name (RN-PRT-018, RN-PRT-014). An import of this size ends
   * in a moment, so the case asserts the invariant of whichever branch it
   * lands in: cancelled in time leaves no notebook at all, and already ended
   * leaves the notebook the import wrote.
   */
  test('[route:POST /portability/transfers/:t/cancel] cancels an import, and what it had started goes with it', async ({
    owner,
    notebook,
  }) => {
    const transfer = await exported(owner, notebook.notebookId);
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

    const name = unique('Cancelled');
    const started = await owner.ok<{ transferId: string }>('POST', '/portability/imports/apply', {
      uploadKey: upload.uploadKey,
      name,
    });
    const cancelled = await owner.call(
      'POST',
      `/portability/transfers/${started.transferId}/cancel`,
    );
    expect([200, 409]).toContain(cancelled.status);

    const ended = await eventually(
      'the import to end',
      () =>
        owner.ok<{ status: string; notebookId: string | null }>(
          'GET',
          `/portability/transfers/${started.transferId}`,
        ),
      (each) => each.status !== 'running',
    );
    /**
     * The listing is answered from an index, which settles a moment after the
     * write: a notebook taken down by a cancel can still be in it. What the
     * case asks is what the transfer ended as, so it waits for the listing to
     * agree with that rather than reading it once.
     */
    const written = await eventually(
      'the listing to settle',
      async () => {
        const notebooks = await owner.ok<Array<{ name: string; notebookId: string }>>(
          'GET',
          '/knowledge/notebooks',
        );
        return notebooks.filter((each) => each.name === name);
      },
      (found) => (ended.status === 'cancelled' ? found.length === 0 : found.length === 1),
    );

    if (ended.status === 'cancelled') {
      // Nothing was kept, and the name is free at once (RN-KNW-033).
      expect(written).toEqual([]);
      const twin = await owner.call<{ notebookId: string }>('POST', '/knowledge/notebooks', {
        name,
        description: 'The name is free again.',
      });
      expect(twin.status).toBe(201);
      await owner.call('DELETE', `/knowledge/notebooks/${twin.body.notebookId}`);
    } else {
      expect(ended.status).toBe('ready');
      expect(written).toHaveLength(1);
      await owner.call('DELETE', `/knowledge/notebooks/${written[0]?.notebookId}`);
    }

    await owner.call('DELETE', `/portability/transfers/${transfer.transferId}`);
  });
});
