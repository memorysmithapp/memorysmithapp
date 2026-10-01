/**
 * Portability: a notebook leaves as one open document and comes back as the
 * same notebook (software-vision.md, section 12).
 *
 * The export is a JOB now (RN-PRT-019): the API records it and a worker builds
 * the archive, so every case here waits for the transfer to end rather than
 * reading a link out of the answer.
 */

import { createHash } from 'node:crypto';
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

interface PrintDto {
  printId: string;
  status: 'running' | 'ready' | 'failed';
  downloadUrl?: string;
  failure?: string;
}

/** Starts a print and waits for the renderer to make its file, or say why it did not. */
async function printed(api: Api, notebookId: string, noteId: string): Promise<PrintDto> {
  const started = await api.ok<PrintDto>(
    'POST',
    `/portability/notebooks/${notebookId}/notes/${noteId}/pdf`,
    { placement: 'end', tables: 'wrap', orientation: 'landscape', locale: 'pt_BR' },
  );
  expect(started.status).toBe('running');
  return eventually(
    'the print to end',
    () => api.ok<PrintDto>('GET', `/portability/prints/${started.printId}`),
    (print) => print.status !== 'running',
    // A cold renderer unpacks a browser before it opens the page.
    { timeoutMs: 180_000, intervalMs: 2_000 },
  );
}

test.describe('a note as a PDF made by the server', () => {
  test('[route:POST /portability/notebooks/:v/notes/:n/pdf] [route:GET /portability/prints/:p] prints a note as the person who asked and answers the file on the files host, named after the note (#263)', async ({
    owner,
    notebook,
    state,
  }) => {
    test.setTimeout(240_000);
    const { noteId } = await owner.ok<{ noteId: string }>(
      'POST',
      `/knowledge/notebooks/${notebook.notebookId}/notes`,
      {
        folderId: notebook.folderId,
        content: '---\nname: Ata de reunião\nstatus: draft\n---\n\nWhat was decided.\n',
      },
    );
    const print = await printed(owner, notebook.notebookId, noteId);
    expect(print.failure ?? null).toBeNull();
    expect(print.status).toBe('ready');

    const link = new URL(print.downloadUrl ?? '');
    expect(link.host).toBe(`files.${new URL(state.surfaces.site).host}`);
    const downloaded = await fetch(link);
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers.get('content-type')).toBe('application/pdf');
    expect(downloaded.headers.get('content-disposition')).toMatch(
      /^attachment; filename="Ata de reuniao\.pdf"; filename\*=UTF-8''Ata%20de%20reuni%C3%A3o\.pdf$/,
    );
    const pdf = Buffer.from(await downloaded.arrayBuffer());
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    // The note, and a page of its own for its properties at the end, laid
    // sideways as it was asked.
    const text = pdf.toString('latin1');
    const box = /\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/.exec(text);
    expect(Number(box?.[1])).toBeGreaterThan(Number(box?.[2]));
    expect((text.match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(2);
  });

  test('[route:POST /portability/notebooks/:v/notes/:n/pdf] makes nothing of a note the notebook does not hold, and says why', async ({
    owner,
    notebook,
  }) => {
    test.setTimeout(240_000);
    const print = await printed(owner, notebook.notebookId, unknownId());
    expect(print.status).toBe('failed');
    expect(print.failure).toBe('NOT_FOUND');
    // A notebook the caller cannot read starts nothing at all.
    const refused = await owner.call(
      'POST',
      `/portability/notebooks/${unknownId()}/notes/${notebook.noteId}/pdf`,
      {},
    );
    expect(refused.status).toBe(404);
  });
});

test.describe('a notebook out and back in', () => {
  test('[route:POST /portability/notebooks/:v/export] [route:GET /portability/transfers/:t] [route:POST /portability/transfers/:t/download] [route:POST /portability/imports] [route:POST /portability/imports/apply] exports a notebook as a job and imports it back as the same notebook', async ({
    owner,
    notebook,
    state,
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
    // Answered on a host of the product, not on the name of the bucket (#255).
    expect(new URL(link.downloadUrl).host).toBe(`files.${new URL(state.surfaces.site).host}`);
    const downloaded = await fetch(link.downloadUrl);
    expect(downloaded.headers.get('content-disposition')).toMatch(/^attachment; filename="/);
    const archive = new Uint8Array(await downloaded.arrayBuffer());
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

  /**
   * The way back from a deletion without the archive passing through the
   * device: the kept export is copied to an upload where it is kept, and
   * applied like any upload (#207, RN-PRT-020).
   */
  test('[route:POST /portability/imports/from-export] imports a kept export from where it is kept, and it stays kept', async ({
    owner,
    other,
    notebook,
  }) => {
    const transfer = await exported(owner, notebook.notebookId);
    expect((await owner.call('DELETE', `/knowledge/notebooks/${notebook.notebookId}`)).status).toBe(
      204,
    );

    // Somebody else's export is a key that does not exist (rule 9), and so
    // is one that never existed.
    expect(
      (
        await other.call('POST', '/portability/imports/from-export', {
          transferId: transfer.transferId,
        })
      ).status,
    ).toBe(404);
    expect(
      (await owner.call('POST', '/portability/imports/from-export', { transferId: unknownId() }))
        .status,
    ).toBe(404);

    const upload = await owner.ok<{ uploadKey: string }>(
      'POST',
      '/portability/imports/from-export',
      { transferId: transfer.transferId },
    );
    const imported = await importedFrom(owner, upload.uploadKey, unique('From where it is kept'));
    expect(imported.status).toBe('ready');
    expect(imported.done).toBe(transfer.total);

    // Read and never consumed: the export is still kept, and still ready.
    const kept = await owner.ok<TransferDto>(
      'GET',
      `/portability/transfers/${transfer.transferId}`,
    );
    expect(kept.status).toBe('ready');
    expect(
      (await owner.call('POST', `/portability/transfers/${transfer.transferId}/download`)).status,
    ).toBe(200);

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

/**
 * A file kept whole, sent in parts (#240, RN-PRT-027). The case that matters
 * most is the first: a plain PUT to the address the product signed, which is
 * what an agent's script does, and which the SDK's default checksum would
 * have made the store refuse.
 */
test.describe('a file sent in parts', () => {
  const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

  /** A PNG signature followed by bytes enough to need more than one part. */
  function picture(size: number): Buffer {
    const bytes = Buffer.alloc(size);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
    for (let index = 8; index < size; index += 1) bytes[index] = (index * 31) % 251;
    return bytes;
  }

  interface Status {
    transfer: TransferDto & { fileName: string | null; upload?: { received: number[] } };
    missing: number[];
    targets: Array<{ part: number; url: string }>;
  }

  test('[route:POST /portability/uploads] [route:GET /portability/uploads/:t] [route:POST /portability/uploads/:t/finish] keeps a file whose parts were PUT to their addresses, byte for byte', async ({
    owner,
    notebook,
  }) => {
    const whole = picture(9 * 1024 * 1024);
    const name = unique('whole picture');
    const started = await owner.ok<Status>('POST', '/portability/uploads', {
      notebookId: notebook.notebookId,
      name,
      mimeType: 'image/png',
      purpose: 'A picture kept whole by a functional case',
      size: whole.length,
      sha256: sha(whole),
      transport: 'url',
    });
    expect(started.transfer.kind).toBe('agent');
    expect(started.targets.map((each) => each.part)).toEqual([1, 2]);

    const partSize = 8 * 1024 * 1024;
    for (const target of started.targets) {
      const put = await fetch(target.url, {
        method: 'PUT',
        body: whole.subarray((target.part - 1) * partSize, target.part * partSize),
      });
      expect(put.status, await put.text()).toBe(200);
    }
    const status = await owner.ok<Status>(
      'GET',
      `/portability/uploads/${started.transfer.transferId}`,
    );
    expect(status.missing).toEqual([]);

    const kept = await owner.ok<{ fileId: string; name: string; bytes: number }>(
      'POST',
      `/portability/uploads/${started.transfer.transferId}/finish`,
    );
    expect(kept).toMatchObject({ name, bytes: whole.length });

    // What the notebook serves is what was sent, byte for byte.
    const link = await owner.ok<{ downloadUrl: string }>(
      'GET',
      `/knowledge/notebooks/${notebook.notebookId}/files/${kept.fileId}/link`,
    );
    const served = new Uint8Array(await (await fetch(link.downloadUrl)).arrayBuffer());
    expect(sha(served)).toBe(sha(whole));

    // Ready means gone from Transfers: the file is what it was for (RN-PRT-028).
    const listed = await owner.ok<{ transfers: TransferDto[] }>('GET', '/portability/transfers');
    expect(listed.transfers.map((each) => each.transferId)).not.toContain(
      started.transfer.transferId,
    );
  });

  test('[route:PUT /portability/uploads/:t/parts/:n] [route:GET /portability/uploads] refuses an inline part its hash does not match, and keeps the file once every part arrived', async ({
    owner,
    other,
    notebook,
  }) => {
    const whole = picture(3000);
    const partSize = 2048;
    const started = await owner.ok<Status>('POST', '/portability/uploads', {
      notebookId: notebook.notebookId,
      name: unique('inline picture'),
      mimeType: 'image/png',
      purpose: 'A picture sent inline by a functional case',
      size: whole.length,
      sha256: sha(whole),
      transport: 'inline',
      partSize,
    });
    const id = started.transfer.transferId;

    const first = whole.subarray(0, partSize);
    const typo = Buffer.from(first);
    typo[99] = (typo[99] ?? 0) ^ 0xff;
    const refused = await owner.call('PUT', `/portability/uploads/${id}/parts/1`, {
      sha256: sha(first),
      contentBase64: typo.toString('base64'),
    });
    expect(refused.status).toBe(400);

    // The open uploads list it, with the hash it is found again by, and only
    // for whoever started it (RN-PRT-020).
    const open = await owner.ok<{ transfers: Array<{ transferId: string }> }>(
      'GET',
      `/portability/uploads?notebookId=${notebook.notebookId}`,
    );
    expect(open.transfers.map((each) => each.transferId)).toContain(id);
    expect((await other.call('GET', `/portability/uploads/${id}`)).status).toBe(404);

    for (const part of [1, 2]) {
      const bytes = whole.subarray((part - 1) * partSize, part * partSize);
      await owner.ok('PUT', `/portability/uploads/${id}/parts/${part}`, {
        sha256: sha(bytes),
        contentBase64: bytes.toString('base64'),
      });
    }
    const kept = await owner.ok<{ bytes: number }>('POST', `/portability/uploads/${id}/finish`);
    expect(kept.bytes).toBe(whole.length);
  });

  test('[route:POST /portability/uploads/:t/link] outlives its notebook, and finishes in the one it is linked to', async ({
    owner,
    notebook,
  }) => {
    const whole = picture(1500);
    const started = await owner.ok<Status>('POST', '/portability/uploads', {
      notebookId: notebook.notebookId,
      name: unique('orphan picture'),
      mimeType: 'image/png',
      purpose: 'A picture whose notebook goes away',
      size: whole.length,
      sha256: sha(whole),
      transport: 'inline',
      partSize: 1024,
    });
    const id = started.transfer.transferId;
    for (const part of [1, 2]) {
      const bytes = whole.subarray((part - 1) * 1024, part * 1024);
      await owner.ok('PUT', `/portability/uploads/${id}/parts/${part}`, {
        sha256: sha(bytes),
        contentBase64: bytes.toString('base64'),
      });
    }
    expect((await owner.call('DELETE', `/knowledge/notebooks/${notebook.notebookId}`)).status).toBe(
      204,
    );
    expect((await owner.call('POST', `/portability/uploads/${id}/finish`)).status).toBe(404);

    const other = await owner.ok<{ notebookId: string }>('POST', '/knowledge/notebooks', {
      name: unique('Where it lands'),
      description: 'The notebook an upload is linked to.',
    });
    await owner.ok('POST', `/portability/uploads/${id}/link`, { notebookId: other.notebookId });
    const kept = await owner.ok<{ notebookId: string }>(
      'POST',
      `/portability/uploads/${id}/finish`,
    );
    expect(kept.notebookId).toBe(other.notebookId);
    await owner.call('DELETE', `/knowledge/notebooks/${other.notebookId}`);
  });

  /**
   * A file an agent asks the person for (#253, RN-PRT-030): made of the upload
   * the agent could not finish, and kept by the person under its name.
   */
  test('[route:POST /portability/requests] turns an upload nobody could finish into a request, which the person fulfils under its name', async ({
    owner,
    notebook,
  }) => {
    const whole = picture(3000);
    const name = unique('requested picture');
    const started = await owner.ok<Status>('POST', '/portability/uploads', {
      notebookId: notebook.notebookId,
      name,
      mimeType: 'image/png',
      purpose: 'A picture an agent could not send',
      size: whole.length,
      sha256: sha(whole),
      transport: 'url',
    });
    const request = await owner.ok<TransferDto & { fileName: string | null }>(
      'POST',
      '/portability/requests',
      { fromUpload: started.transfer.transferId },
    );
    expect(request).toMatchObject({ kind: 'request', fileName: name });
    const listed = await owner.ok<{ transfers: TransferDto[] }>('GET', '/portability/transfers');
    expect(listed.transfers.map((each) => each.transferId)).not.toContain(
      started.transfer.transferId,
    );

    const fulfilling = await owner.ok<Status>('POST', '/portability/uploads', {
      request: request.transferId,
      notebookId: notebook.notebookId,
      name: 'what the disk calls it.png',
      mimeType: 'image/png',
      purpose: 'Kept by the person',
      size: whole.length,
      sha256: sha(whole),
      transport: 'inline',
      partSize: 2048,
    });
    for (const part of [1, 2]) {
      const bytes = whole.subarray((part - 1) * 2048, part * 2048);
      await owner.ok(
        'PUT',
        `/portability/uploads/${fulfilling.transfer.transferId}/parts/${part}`,
        {
          sha256: sha(bytes),
          contentBase64: bytes.toString('base64'),
        },
      );
    }
    const kept = await owner.ok<{ name: string }>(
      'POST',
      `/portability/uploads/${fulfilling.transfer.transferId}/finish`,
    );
    expect(kept.name).toBe(name);
    const after = await owner.ok<{ transfers: TransferDto[] }>('GET', '/portability/transfers');
    expect(after.transfers.map((each) => each.transferId)).not.toContain(request.transferId);
  });
});
