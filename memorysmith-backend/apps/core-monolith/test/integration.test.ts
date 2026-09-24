/**
 * The full slice, over HTTP, across four contexts: a notebook is authored, the
 * events it produced feed the audit trail and the discovery projections, and
 * the reads come back through the API the UI and the connector use.
 *
 * This is what "the whole thing works" means before any of it is deployed.
 */

import { createZip, readZip } from '@memorysmith/svc-portability/adapters/zip';
import { beforeEach, describe, expect, it } from 'vitest';
import { noteLinksSchema, searchResultSchema } from '@memorysmith/contracts';
import { buildTestApp } from './wiring.js';

type App = ReturnType<typeof buildTestApp>;
let harness: App;
const TOKEN = 'token-owner';

async function call(
  path: string,
  init: { method?: string; body?: unknown; token?: string } = {},
): Promise<Response> {
  return harness.app.request(path, {
    method: init.method ?? 'GET',
    headers: {
      authorization: `Bearer ${init.token ?? TOKEN}`,
      'content-type': 'application/json',
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

/**
 * Starts an import and answers the transfer it produced. The harness runs the
 * worker inline, so the job has already ended when the call returns.
 */
async function imported_(
  uploadKey: string,
  name: string,
): Promise<{ transferId: string; notebookId: string; status: string; failure: string | null }> {
  const started = await call('/portability/imports/apply', {
    method: 'POST',
    body: { uploadKey, name },
  });
  const { transferId } = (await started.json()) as { transferId: string };
  return (await (await call(`/portability/transfers/${transferId}`)).json()) as {
    transferId: string;
    notebookId: string;
    status: string;
    failure: string | null;
  };
}

/** Drains what the writes published into the projections, as the bus would. */
async function drainEvents(): Promise<void> {
  const envelopes = harness.events.published.map((event) => ({
    eventId: event.eventId,
    type: event.type,
    occurredAt: event.occurredAt.toISOString(),
    subscriptionId: event.subscriptionId.value,
    subject: event.subject,
    subjectId: event.subjectId,
    authorship: event.authorship.toJSON(),
    contentRef: event.contentRef ? event.contentRef.toJSON() : null,
    payload: event.payload,
  }));

  await harness.auditConsumer.consume(envelopes);

  for (const event of harness.events.published) {
    const payload = event.payload as Record<string, string>;
    if (event.type === 'NotebookCreated') {
      await harness.projectStructure.onNotebook(
        String(payload['notebookId']),
        String(payload['name']),
      );
    }
    if (event.type === 'FolderAdded') {
      await harness.projectStructure.onFolder(String(payload['notebookId']), {
        folderId: String(payload['folderId']),
        name: String(payload['name']),
        description: String(payload['description']),
        parentFolderId: payload['parentFolderId'] ? String(payload['parentFolderId']) : null,
      });
    }
    if (event.type === 'NoteCreated' || event.type === 'NoteUpdated') {
      await harness.projectNote.onWritten({
        notebookId: String(payload['notebookId']),
        noteId: String(payload['noteId']),
        folderId: String(payload['folderId']),
        contentRef: event.contentRef
          ? { contentId: event.contentRef.contentId.value, versionId: event.contentRef.versionId }
          : null,
      });
      /**
       * Lexical search reads the note catalog, which in production is the
       * Knowledge context answering what it already holds. The harness stands
       * in for it here, or the search would answer over an empty index and
       * every assertion about it would be vacuous.
       */
      const notebookId = String(payload['notebookId']);
      const known = await harness.discovery.catalog.listNotes(notebookId);
      // The name travels on the event because the write read it from the
      // content, and the aliases come from the frontmatter of the same body.
      // Both are what a link resolves against (RN-DSC-041, RN-DSC-052).
      const name = payload['name'] === null ? '' : String(payload['name']);
      const entry = {
        noteId: String(payload['noteId']),
        name,
        aliases: [] as string[],
        folderId: String(payload['folderId']),
        folderName: '',
      };
      harness.discovery.catalog.set(notebookId, [
        ...known.filter((note) => note.noteId !== entry.noteId),
        entry,
      ]);
    }
  }
  harness.events.published.length = 0;
}

async function seed(): Promise<{
  notebookId: string;
  folderId: string;
  notes: Record<string, string>;
}> {
  const notebook = (await (
    await call('/knowledge/notebooks', {
      method: 'POST',
      body: {
        name: 'Normas e Legislacao',
        description: 'Texto normativo por artigo',
      },
    })
  ).json()) as { notebookId: string };

  const folder = (await (
    await call(`/knowledge/notebooks/${notebook.notebookId}/folders`, {
      method: 'POST',
      body: { name: 'Normas', description: 'Texto normativo por artigo. Uma norma por nota.' },
    })
  ).json()) as { folderId: string };

  const achado = (await (
    await call(`/knowledge/notebooks/${notebook.notebookId}/notes`, {
      method: 'POST',
      body: {
        folderId: folder.folderId,
        content:
          '---\nname: Achado 12\nmaturity: seed\nreviewed: false\n---\n\n# Achado 12\n\nFundamento: [[Lei 14.133]].',
      },
    })
  ).json()) as { noteId: string };

  const lei = (await (
    await call(`/knowledge/notebooks/${notebook.notebookId}/notes`, {
      method: 'POST',
      body: {
        folderId: folder.folderId,
        content:
          '---\nname: Lei 14.133\nmaturity: evergreen\nreviewed: true\n---\n\n# Lei 14.133\n\nArt. 75.',
      },
    })
  ).json()) as { noteId: string };

  await drainEvents();
  return {
    notebookId: notebook.notebookId,
    folderId: folder.folderId,
    notes: { achado: achado.noteId, lei: lei.noteId },
  };
}

beforeEach(async () => {
  harness = buildTestApp();
  harness.verifier.issue(TOKEN, { sub: 'user-owner', email: 'owner@example.com' });

  const created = await call('/access/subscriptions', { method: 'POST', body: {} });
  const { subscriptionId } = (await created.json()) as { subscriptionId: string };

  harness.verifier.issue('platform-token', {
    sub: 'platform-admin',
    email: 'admin@memorysmith.app',
    groups: ['platform-admin'],
  });
  await call(`/access/platform/subscriptions/${subscriptionId}/approve`, {
    method: 'POST',
    body: { status: 'active' },
    token: 'platform-token',
  });
  harness.verifier.issue(TOKEN, {
    sub: 'user-owner',
    email: 'owner@example.com',
    subscription_id: subscriptionId,
    subscription_status: 'active',
  });
});

describe('Discovery answers over the API', () => {
  it('resolves a link written before its target existed', async () => {
    const { notebookId, notes } = await seed();

    const backlinks = (await (
      await call(`/discovery/notebooks/${notebookId}/notes/${notes['lei']}/backlinks`)
    ).json()) as { backlinks: Array<{ noteId: string }> };

    // The link was pending when the achado was written and resolved on its own
    // when the lei was created (RN-DSC-004).
    expect(backlinks.backlinks.map((note) => note.noteId)).toEqual([notes['achado']]);
  });

  it('reads a note with the trail of its folder and where its links go', async () => {
    const { notebookId, notes } = await seed();

    const note = (await (
      await call(`/knowledge/notebooks/${notebookId}/notes/${notes['achado']}`)
    ).json()) as { folderTrail: string[] };
    expect(note.folderTrail).toEqual(['Normas']);

    // Parsed by the schema the contract publishes, so a field the route drops
    // is a failure here and not a consumer guessing (#186).
    const links = noteLinksSchema.parse(
      await (
        await call(`/discovery/notebooks/${notebookId}/notes/${notes['achado']}/links`)
      ).json(),
    );
    expect(links.links).toEqual([
      {
        target: 'Lei 14.133',
        kind: 'note',
        by: 'name',
        notes: [expect.objectContaining({ noteId: notes['lei'], folderTrail: ['Normas'] })],
      },
    ]);
  });

  it('walks the dependency tree from a note', async () => {
    const { notebookId, notes } = await seed();
    const tree = (await (
      await call(`/discovery/notebooks/${notebookId}/notes/${notes['achado']}/graph?depth=2`)
    ).json()) as { note: { noteId: string }; children: Array<{ note: { noteId: string } }> };

    expect(tree.note.noteId).toBe(notes['achado']);
    expect(tree.children.map((child) => child.note.noteId)).toEqual([notes['lei']]);
  });

  it('searches the body of the note, not only how it is named', async () => {
    /**
     * `Art. 75` is written in the body of one note and appears in no name, in
     * no folder name and in no facet. Finding it is the whole point of the
     * content index.
     */
    const { notebookId, notes } = await seed();
    // Read through the published schema: the route answered flat hits with no
    // name where the contract declares the note, and the connector printed
    // nothing for them.
    const byBody = searchResultSchema.parse(
      await (
        await call(`/discovery/notebooks/${notebookId}/search`, {
          method: 'POST',
          body: { query: 'Art. 75' },
        })
      ).json(),
    );

    expect(byBody.mode).toBe('lexical');
    expect(byBody.hits.map((hit) => hit.note.noteId)).toEqual([notes['lei']]);
    expect(byBody.hits[0]?.excerpt).toContain('Art. 75');
  });

  it('narrows the search with a field and with a facet of the notebook', async () => {
    const { notebookId, notes } = await seed();

    const byName = (await (
      await call(`/discovery/notebooks/${notebookId}/search`, {
        method: 'POST',
        body: { query: 'name:achado' },
      })
    ).json()) as { hits: Array<{ note: { noteId: string } }> };
    expect(byName.hits.map((hit) => hit.note.noteId)).toEqual([notes['achado']]);

    // `maturity` is frontmatter the notebook wrote, never a field the code knows.
    const byFacet = (await (
      await call(`/discovery/notebooks/${notebookId}/search`, {
        method: 'POST',
        body: { query: 'maturity:evergreen' },
      })
    ).json()) as { hits: Array<{ note: { noteId: string } }> };
    expect(byFacet.hits.map((hit) => hit.note.noteId)).toEqual([notes['lei']]);
  });

  it('refuses a query it cannot parse instead of answering with everything', async () => {
    const { notebookId } = await seed();
    const response = await call(`/discovery/notebooks/${notebookId}/search`, {
      method: 'POST',
      body: { query: '"nunca fecha' },
    });
    expect(response.status).toBe(400);
  });

  it('counts the curation facets of the notebook', async () => {
    const { notebookId } = await seed();
    const stats = (await (await call(`/discovery/notebooks/${notebookId}/facets`)).json()) as {
      noteCount: number;
      facets: Array<{ facet: string; values: Array<{ value: string; count: number }> }>;
    };

    expect(stats.noteCount).toBe(2);
    const maturity = stats.facets.find((facet) => facet.facet === 'maturity');
    expect(maturity?.values.map((value) => value.value).sort()).toEqual(['evergreen', 'seed']);
    const reviewed = stats.facets.find((facet) => facet.facet === 'reviewed');
    expect(reviewed?.values).toHaveLength(2);
  });

  it('answers 404 for a notebook of another subscription', async () => {
    const { notebookId } = await seed();
    harness.verifier.issue('token-b', { sub: 'user-b', email: 'b@example.com' });
    const other = await call('/access/subscriptions', {
      method: 'POST',
      body: {},
      token: 'token-b',
    });
    const { subscriptionId } = (await other.json()) as { subscriptionId: string };
    await call(`/access/platform/subscriptions/${subscriptionId}/approve`, {
      method: 'POST',
      body: { status: 'active' },
      token: 'platform-token',
    });
    harness.verifier.issue('token-b', {
      sub: 'user-b',
      email: 'b@example.com',
      subscription_id: subscriptionId,
      subscription_status: 'active',
    });

    const attempt = await call(`/discovery/notebooks/${notebookId}/facets`, { token: 'token-b' });
    expect(attempt.status).toBe(404);
  });
});

describe('Audit answers over the API', () => {
  it('serves the timeline of a note with authorship', async () => {
    const { notebookId, notes } = await seed();
    const history = (await (
      await call(`/audit/notebooks/${notebookId}/notes/${notes['lei']}/history`)
    ).json()) as {
      entries: Array<{ type: string; authorship: { userId: string; agent: unknown } }>;
    };

    expect(history.entries.map((entry) => entry.type)).toContain('NoteCreated');
    expect(history.entries[0]?.authorship.userId).toBe('user-owner');
    // Written through the UI, so no agent (section 12.1).
    expect(history.entries[0]?.authorship.agent).toBeNull();
  });

  it('records the whole authoring cycle, not only the notes', async () => {
    const { notebookId } = await seed();
    const activity = (await (await call(`/audit/notebooks/${notebookId}/activity`)).json()) as {
      entries: Array<{ type: string }>;
    };
    const types = activity.entries.map((entry) => entry.type);
    expect(types).toContain('NotebookCreated');
    expect(types).toContain('FolderAdded');
    expect(types).toContain('NoteCreated');
  });

  /**
   * The trail never forgets and the product stops answering about what somebody
   * deleted, from the instant of the deletion and not when the purge gets to it
   * a minute later (RN-KNW-046, RN-AUD-010). A deletion is ONE write on the unit
   * deleted, so a note under a removed folder carries no event of its own: what
   * says it is out of reach is the tree, which is why this is asked of
   * Knowledge (#146).
   */
  it('stops answering about a note the instant it is deleted, and keeps its entries in the trail', async () => {
    const { notebookId, notes } = await seed();
    const noteId = notes['lei'] ?? '';
    const at = new Date().toISOString();
    await call(`/knowledge/notebooks/${notebookId}/notes/${noteId}`, { method: 'DELETE' });
    await drainEvents();

    expect((await call(`/knowledge/notebooks/${notebookId}/notes/${noteId}`)).status).toBe(404);
    expect((await call(`/audit/notebooks/${notebookId}/notes/${noteId}/history`)).status).toBe(404);
    expect(
      (
        await call(
          `/audit/notebooks/${notebookId}/notes/${noteId}/revisions?asOf=${encodeURIComponent(at)}`,
        )
      ).status,
    ).toBe(404);

    // Appended and immutable: what is refused is serving them, never keeping them.
    const activity = (await (await call(`/audit/notebooks/${notebookId}/activity`)).json()) as {
      entries: Array<{ type: string }>;
    };
    expect(activity.entries.map((entry) => entry.type)).toContain('NoteDeleted');
  });

  it('stops answering about a note whose folder was removed, before any purge', async () => {
    const { notebookId, folderId, notes } = await seed();
    await call(`/knowledge/notebooks/${notebookId}/folders/${folderId}?policy=CASCADE`, {
      method: 'DELETE',
    });
    await drainEvents();

    expect(
      (await call(`/audit/notebooks/${notebookId}/notes/${notes['lei']}/history`)).status,
    ).toBe(404);
  });

  it('stops answering about a note whose notebook was deleted, before any purge', async () => {
    const { notebookId, notes } = await seed();
    await call(`/knowledge/notebooks/${notebookId}`, { method: 'DELETE' });
    await drainEvents();

    expect(
      (await call(`/audit/notebooks/${notebookId}/notes/${notes['lei']}/history`)).status,
    ).toBe(404);

    // The activity of the notebook still answers, deletion and all: that is the
    // one read of the trail a deletion does not take away (rule 6).
    const activity = (await (await call(`/audit/notebooks/${notebookId}/activity`)).json()) as {
      entries: Array<{ type: string }>;
    };
    expect(activity.entries.map((entry) => entry.type)).toContain('NotebookDeleted');
  });

  it('answers not found for a note addressed through a notebook that does not hold it', async () => {
    const { notes } = await seed();
    const other = (await (
      await call('/knowledge/notebooks', {
        method: 'POST',
        body: { name: 'Outro caderno', description: 'Nada a ver com a nota.' },
      })
    ).json()) as { notebookId: string };

    expect(
      (await call(`/audit/notebooks/${other.notebookId}/notes/${notes['lei']}/history`)).status,
    ).toBe(404);
    expect(
      (await call(`/audit/notebooks/01JBQ2X0000000000000000099/notes/${notes['lei']}/history`))
        .status,
    ).toBe(404);
  });
});

describe('Portability answers over the API', () => {
  /**
   * The export is a JOB (RN-PRT-019): the API records it and answers `202`,
   * and a worker builds the archive. The harness runs that worker inline, so
   * what the case reads next is the transfer the worker finished.
   */
  it('exports the notebook as one document, kept as a transfer of the person who asked', async () => {
    const { notebookId } = await seed();

    const started = await call(`/portability/notebooks/${notebookId}/export`, { method: 'POST' });
    expect(started.status).toBe(202);
    const { transferId } = (await started.json()) as { transferId: string };

    const transfer = (await (await call(`/portability/transfers/${transferId}`)).json()) as {
      kind: string;
      status: string;
      notebookId: string;
      total: number;
      bytes: number;
    };
    expect(transfer.kind).toBe('export');
    expect(transfer.status).toBe('ready');
    expect(transfer.total).toBe(2);
    expect(transfer.bytes).toBeGreaterThan(0);

    // The link is minted at the moment of the download and never stored: a
    // stored one would have expired by the time somebody came back to it.
    const link = (await (
      await call(`/portability/transfers/${transferId}/download`, { method: 'POST' })
    ).json()) as { downloadUrl: string };
    expect(link.downloadUrl).toContain('exports/');

    // Every key of this system begins with the subscription, this one too.
    const [key] = [...harness.archives.keys()];
    expect(key).toMatch(/^s\/[0-9A-HJKMNP-TV-Z]{26}\/exports\/[0-9A-HJKMNP-TV-Z]{26}\.notebook$/);

    // What came out is a real ZIP carrying ONE document (RN-PRT-009): the
    // local file header is its first bytes, and the only entry is the notebook.
    const archive = harness.archives.get(key ?? '') as Buffer;
    expect(archive.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    const inside = archive.toString('latin1');
    expect(inside).toContain('notebook.json');
    expect(inside).not.toContain('GUIDANCE.md');
    expect(inside).not.toContain('STRUCTURE.md');
  });

  /**
   * The trail of a notebook that keeps a file names a subject the archive had
   * never been asked to carry (#175). The document schema held a second,
   * hand-typed copy of the list of subjects, `FILE` was added to the canonical
   * one alone, and the export of the ordinary notebook — no selection, so the
   * whole history travels (RN-PRT-024) — was refused at serialisation with
   * zero bytes written.
   */
  it('exports a notebook that keeps a file, history and all', async () => {
    const { notebookId } = await seed();

    const kept = await call(`/knowledge/notebooks/${notebookId}/files`, {
      method: 'POST',
      body: {
        name: 'engelbart.png',
        description: 'A picture a note shows.',
        mimeType: 'image/png',
        tags: ['teste'],
        path: '/imagens',
        contentBase64: Buffer.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
          0x52,
        ]).toString('base64'),
      },
    });
    expect(kept.status).toBe(201);
    // The trail is a projection, and the harness drains the bus by hand.
    await drainEvents();

    const started = await call(`/portability/notebooks/${notebookId}/export`, { method: 'POST' });
    expect(started.status).toBe(202);
    const { transferId } = (await started.json()) as { transferId: string };

    const transfer = (await (await call(`/portability/transfers/${transferId}`)).json()) as {
      status: string;
      failure: string | null;
      bytes: number;
    };
    expect(transfer.failure).toBeNull();
    expect(transfer.status).toBe('ready');
    expect(transfer.bytes).toBeGreaterThan(0);

    const [exportKey] = [...harness.archives.keys()];
    const document = JSON.parse(
      readZip(harness.archives.get(exportKey ?? '') as Buffer)['notebook.json'] ?? '{}',
    ) as {
      files?: Array<{ name: string; mimeType: string; bytes: string }>;
      history?: { entries: Array<{ subject: string }> };
    };

    // The file travels (RN-PRT-025), and so does the entry that names it.
    expect(document.files?.map((file) => file.name)).toEqual(['engelbart.png']);
    expect(document.history?.entries.some((entry) => entry.subject === 'FILE')).toBe(true);
  });

  /**
   * The files are a species of the selection, chosen by NAME on both sides
   * (#176, RN-PRT-025). No identifier of a file travels in a document, so a
   * name is the only address the two halves of a transfer share — which is
   * also what makes an imported `![[name]]` find the file it always found.
   */
  it('carries the files a selection names, and leaves the rest of them behind', async () => {
    const { notebookId } = await seed();
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52,
    ]).toString('base64');

    for (const name of ['engelbart.png', 'esquema.png']) {
      const kept = await call(`/knowledge/notebooks/${notebookId}/files`, {
        method: 'POST',
        body: {
          name,
          description: '',
          mimeType: 'image/png',
          tags: [],
          path: '/',
          contentBase64: png,
        },
      });
      expect(kept.status).toBe(201);
    }

    const started = await call(`/portability/notebooks/${notebookId}/export`, {
      method: 'POST',
      body: {
        selection: {
          guidance: true,
          history: false,
          folders: [],
          templates: [],
          notes: [],
          files: ['esquema.png'],
        },
      },
    });
    expect(started.status).toBe(202);

    const [exportKey] = [...harness.archives.keys()];
    const document = JSON.parse(
      readZip(harness.archives.get(exportKey ?? '') as Buffer)['notebook.json'] ?? '{}',
    ) as { files?: Array<{ name: string }> };
    expect(document.files?.map((file) => file.name)).toEqual(['esquema.png']);
  });

  it('imports the files a selection names, by the name a note addresses them with', async () => {
    const { notebookId } = await seed();
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52,
    ]).toString('base64');
    for (const name of ['engelbart.png', 'esquema.png']) {
      await call(`/knowledge/notebooks/${notebookId}/files`, {
        method: 'POST',
        body: {
          name,
          description: '',
          mimeType: 'image/png',
          tags: [],
          path: '/',
          contentBase64: png,
        },
      });
    }

    // The whole notebook goes out, both files with it.
    const started = await call(`/portability/notebooks/${notebookId}/export`, {
      method: 'POST',
      body: {
        selection: { guidance: true, history: false, folders: [], templates: [], notes: [] },
      },
    });
    expect(started.status).toBe(202);
    const [exportKey] = [...harness.archives.keys()];
    const archive = harness.archives.get(exportKey ?? '') as Buffer;

    // And one of them comes back, chosen by name.
    const prepared = (await (await call('/portability/imports', { method: 'POST' })).json()) as {
      uploadKey: string;
    };
    harness.uploads.set(prepared.uploadKey, archive);
    const started2 = await call('/portability/imports/apply', {
      method: 'POST',
      body: {
        uploadKey: prepared.uploadKey,
        name: 'Normas e Legislacao (so um desenho)',
        selection: {
          guidance: true,
          history: false,
          folders: [],
          templates: [],
          notes: [],
          files: ['esquema.png'],
        },
      },
    });
    const { transferId } = (await started2.json()) as { transferId: string };
    const job = (await (await call(`/portability/transfers/${transferId}`)).json()) as {
      status: string;
      notebookId: string;
    };
    expect(job.status).toBe('ready');

    const kept = (await (await call(`/knowledge/notebooks/${job.notebookId}/files`)).json()) as {
      files: Array<{ name: string }>;
    };
    expect(kept.files.map((file) => file.name)).toEqual(['esquema.png']);
  });

  it('keeps the export until it is deleted, and destroys its bytes when it is', async () => {
    const { notebookId } = await seed();
    const started = await call(`/portability/notebooks/${notebookId}/export`, { method: 'POST' });
    const { transferId } = (await started.json()) as { transferId: string };

    const listed = (await (await call('/portability/transfers')).json()) as {
      transfers: Array<{ transferId: string; kind: string }>;
      keptBytes: number;
    };
    expect(listed.transfers.map((each) => each.transferId)).toEqual([transferId]);
    // A kept export occupies storage of the subscription (RN-SUB-021).
    expect(listed.keptBytes).toBeGreaterThan(0);

    expect((await call(`/portability/transfers/${transferId}`, { method: 'DELETE' })).status).toBe(
      204,
    );
    const after = (await (await call('/portability/transfers')).json()) as {
      transfers: unknown[];
      keptBytes: number;
    };
    expect(after.transfers).toEqual([]);
    expect(after.keptBytes).toBe(0);
    // The bytes are gone with it, by the exact revision the worker wrote.
    expect([...harness.archives.keys()]).toEqual([]);
  });

  it('survives the deletion of its notebook, because an export is a document', async () => {
    const { notebookId } = await seed();
    const started = await call(`/portability/notebooks/${notebookId}/export`, { method: 'POST' });
    const { transferId } = (await started.json()) as { transferId: string };

    await call(`/knowledge/notebooks/${notebookId}`, { method: 'DELETE' });

    // It is the one way back from a deletion by mistake (RN-PRT-020), so it
    // stays listed and stays downloadable.
    const transfer = (await (await call(`/portability/transfers/${transferId}`)).json()) as {
      status: string;
      notebookName: string;
    };
    expect(transfer.status).toBe('ready');
    expect(transfer.notebookName).toBe('Normas e Legislacao');
    expect(
      (await call(`/portability/transfers/${transferId}/download`, { method: 'POST' })).status,
    ).toBe(200);
  });

  it('is imported from where it is kept, and stays kept (#207)', async () => {
    const { notebookId } = await seed();
    const started = await call(`/portability/notebooks/${notebookId}/export`, { method: 'POST' });
    const { transferId } = (await started.json()) as { transferId: string };
    await call(`/knowledge/notebooks/${notebookId}`, { method: 'DELETE' });

    // The archive is copied to an upload where it is kept: nothing travels
    // down to the device and back up (RN-PRT-020).
    const copied = await call('/portability/imports/from-export', {
      method: 'POST',
      body: { transferId },
    });
    expect(copied.status).toBe(200);
    const { uploadKey } = (await copied.json()) as { uploadKey: string };
    // The key an ordinary upload gets, which `apply` takes unchanged.
    expect(uploadKey).toMatch(
      /^s\/[0-9A-HJKMNP-TV-Z]{26}\/imports\/[0-9A-HJKMNP-TV-Z]{26}\.notebook$/,
    );

    // The name is free again: the notebook that held it was deleted.
    const job = await imported_(uploadKey, 'Normas e Legislacao');
    expect(job.status).toBe('ready');
    expect(job.notebookId).not.toBe(notebookId);

    // The export is read, never consumed: still listed, still downloadable.
    expect(harness.archives.size).toBe(1);
    expect(
      (await call(`/portability/transfers/${transferId}/download`, { method: 'POST' })).status,
    ).toBe(200);
  });

  it('refuses to import an export the requester did not generate, as missing (#207)', async () => {
    const { notebookId } = await seed();
    const started = await call(`/portability/notebooks/${notebookId}/export`, { method: 'POST' });
    const { transferId } = (await started.json()) as { transferId: string };
    harness.verifier.issue('token-b', { sub: 'user-b', email: 'b@example.com' });
    const other = await call('/access/subscriptions', {
      method: 'POST',
      body: {},
      token: 'token-b',
    });
    const { subscriptionId } = (await other.json()) as { subscriptionId: string };
    await call(`/access/platform/subscriptions/${subscriptionId}/approve`, {
      method: 'POST',
      body: { status: 'active' },
      token: 'platform-token',
    });
    harness.verifier.issue('token-b', {
      sub: 'user-b',
      email: 'b@example.com',
      subscription_id: subscriptionId,
      subscription_status: 'active',
    });

    const attempt = await call('/portability/imports/from-export', {
      method: 'POST',
      body: { transferId },
      token: 'token-b',
    });
    // Rule 9: what the requester may not see answers as what does not exist.
    expect(attempt.status).toBe(404);
    expect(harness.uploads.size).toBe(0);
  });

  it('takes a .notebook back and writes the notebook it describes', async () => {
    // The round trip is the test (RN-PRT-012): a notebook exported and imported
    // comes back the same in everything the document carries.
    const { notebookId } = await seed();
    await call(`/portability/notebooks/${notebookId}/export`, { method: 'POST' });
    const [exportKey] = [...harness.archives.keys()];
    const archive = harness.archives.get(exportKey ?? '') as Buffer;

    const prepared = (await (await call('/portability/imports', { method: 'POST' })).json()) as {
      uploadKey: string;
      uploadUrl: string;
    };
    expect(prepared.uploadUrl).toContain(prepared.uploadKey);
    // Under the subscription prefix, like everything else (rule 1).
    expect(prepared.uploadKey).toMatch(
      /^s\/[0-9A-HJKMNP-TV-Z]{26}\/imports\/[0-9A-HJKMNP-TV-Z]{26}\.notebook$/,
    );
    harness.uploads.set(prepared.uploadKey, archive);

    const started = await call('/portability/imports/apply', {
      method: 'POST',
      // The subscription holds each notebook name once (RN-KNW-032), and this
      // document came from this very subscription: naming the copy is what
      // makes "the same file twice gives two notebooks" true without the server
      // inventing a suffix.
      body: { uploadKey: prepared.uploadKey, name: 'Normas e Legislacao (copia)' },
    });
    // An import is a JOB: the API records it and answers, and a worker writes
    // the notebook (RN-PRT-018). The harness runs that worker inline.
    expect(started.status).toBe(202);
    const { transferId } = (await started.json()) as { transferId: string };
    const job = (await (await call(`/portability/transfers/${transferId}`)).json()) as {
      notebookId: string;
      status: string;
      kind: string;
      done: number;
    };

    expect(job.kind).toBe('import');
    expect(job.status).toBe('ready');
    expect(job.done).toBe(2);
    // A new notebook, never the one it came from (RN-PRT-012).
    expect(job.notebookId).not.toBe(notebookId);
    // And the upload is discarded once the import ends.
    expect(harness.uploads.has(prepared.uploadKey)).toBe(false);

    const [original, imported] = await Promise.all(
      [notebookId, job.notebookId].map(
        async (id) =>
          (await (await call(`/knowledge/notebooks/${id}`)).json()) as {
            name: string;
            folders: Array<{ name: string; description: string; hasTemplate: boolean }>;
            guidance: { content: string } | null;
          },
      ),
    );

    expect(imported?.name).toBe('Normas e Legislacao (copia)');
    expect(imported?.guidance?.content).toBe(original?.guidance?.content);
    expect(imported?.folders.map((folder) => [folder.name, folder.description])).toEqual(
      original?.folders.map((folder) => [folder.name, folder.description]),
    );

    // Every body byte for byte, in the order the document carried.
    const bodies = async (id: string): Promise<string[]> => {
      const notes = (await (await call(`/knowledge/notebooks/${id}/notes`)).json()) as Array<{
        noteId: string;
      }>;
      return Promise.all(
        notes.map(
          async (note) =>
            (
              (await (await call(`/knowledge/notebooks/${id}/notes/${note.noteId}`)).json()) as {
                content: string;
              }
            ).content,
        ),
      );
    };
    expect(await bodies(job.notebookId)).toEqual(await bodies(notebookId));
  });

  /**
   * The round trip of a HISTORY (RN-PRT-022, RN-PRT-023). Deleting a notebook
   * takes its trail with it (RN-AUD-011), so an export that carries the history
   * is the only place it survives — and a history whose content cannot be read
   * says that something was written and never what, which is why the archive
   * carries the revisions its entries name.
   *
   * What proves it is `asOf`: reading a note of the IMPORTED notebook as it
   * stood before its last edit answers the body it had then, written into
   * another notebook, in another subscription's shape, by a person this
   * subscription never saw writing it.
   */
  it('carries the history of a notebook out and brings it back, readable by date', async () => {
    const { notebookId, notes } = await seed();
    const noteId = notes['lei'] ?? '';

    /**
     * The two writes have to land in different milliseconds, or there is no
     * instant that separates them and "as it stood before the edit" asks a
     * question with two answers. On this machine they always did; on the one
     * a build ran on they did not.
     */
    await new Promise((resolve) => setTimeout(resolve, 5));

    // A second revision, so the past and the present differ.
    const current = (await (
      await call(`/knowledge/notebooks/${notebookId}/notes/${noteId}`)
    ).json()) as { revision: { contentId: string; versionId: string } };
    const edited = await call(`/knowledge/notebooks/${notebookId}/notes/${noteId}`, {
      method: 'PUT',
      body: {
        content: '---\nname: Lei 14.133\n---\n\n# Lei 14.133\n\nArt. 75, com a redacao nova.',
        baseRevision: current.revision.versionId,
      },
    });
    expect(edited.status).toBe(200);
    await drainEvents();

    // The whole notebook, which carries its history (RN-PRT-024).
    const started = await call(`/portability/notebooks/${notebookId}/export`, { method: 'POST' });
    expect(started.status).toBe(202);
    const [exportKey] = [...harness.archives.keys()];
    const archive = harness.archives.get(exportKey ?? '') as Buffer;

    const prepared = (await (await call('/portability/imports', { method: 'POST' })).json()) as {
      uploadKey: string;
    };
    harness.uploads.set(prepared.uploadKey, archive);
    const job = await imported_(prepared.uploadKey, 'Normas e Legislacao (com historia)');
    expect(job.status).toBe('ready');

    const imported = (await (
      await call(`/knowledge/notebooks/${job.notebookId}/notes`)
    ).json()) as Array<{ noteId: string; name: string | null }>;
    const lei = imported.find((note) => note.name === 'Lei 14.133')?.noteId ?? '';
    expect(lei).not.toBe('');
    // A new notebook mints new identifiers, always (RN-PRT-013).
    expect(lei).not.toBe(noteId);

    /**
     * The entries came back as entries of this subscription, keeping the
     * person and the instant they carried, re-keyed onto the note this import
     * wrote.
     */
    const history = (await (
      await call(`/audit/notebooks/${job.notebookId}/notes/${lei}/history`)
    ).json()) as { entries: Array<{ type: string; occurredAt: string }> };
    expect(history.entries.map((entry) => entry.type)).toEqual(['NoteCreated', 'NoteUpdated']);

    /**
     * And the body as it stood before the edit, which is the whole point. The
     * date is read from the entry the archive brought, not from the clock of
     * the test: what is being asked is "as this history says it stood", and a
     * wall clock only approximates the instant the entry carries.
     */
    const created = history.entries[0]?.occurredAt ?? '';
    const past = (await (
      await call(
        `/audit/notebooks/${job.notebookId}/notes/${lei}/revisions?asOf=${encodeURIComponent(created)}`,
      )
    ).json()) as { content: string };
    expect(past.content).toContain('Art. 75.');
    expect(past.content).not.toContain('redacao nova');
  });

  /**
   * An export writes PART of a notebook, by the same shape a selection takes on
   * the way in (RN-PRT-017, RN-PRT-024). This is the design of a notebook and
   * nothing else: its Guidance, and not one note or history.
   */
  it('carries only what the selection asked for', async () => {
    const { notebookId } = await seed();
    await call(`/knowledge/notebooks/${notebookId}/guidance`, {
      method: 'PUT',
      body: { content: '# Como escrever aqui\n\nUma norma por nota.', baseRevision: null },
    });

    const started = await call(`/portability/notebooks/${notebookId}/export`, {
      method: 'POST',
      body: {
        selection: { guidance: true, history: false, folders: [], templates: [], notes: [] },
      },
    });
    expect(started.status).toBe(202);

    const [exportKey] = [...harness.archives.keys()];
    const document = JSON.parse(
      readZip(harness.archives.get(exportKey ?? '') as Buffer)['notebook.json'] ?? '{}',
    ) as {
      documentVersion: string;
      history?: unknown;
      notes: unknown[];
      folders: unknown[];
      notebook: { guidance: string | null };
    };
    expect(document.documentVersion).toBe('1.2');
    expect(document.history).toBeUndefined();
    expect(document.notes).toEqual([]);
    expect(document.folders).toEqual([]);
    expect(document.notebook.guidance).not.toBeNull();
  });

  it('issues the numbers of a folder once, and an import carries on from the last one', async () => {
    // RN-KNW-043, RN-PRT-016.
    const { notebookId, folderId, notes } = await seed();
    const numbers = `/knowledge/notebooks/${notebookId}/folders/${folderId}/numbers`;
    const issue = async (path = numbers) =>
      ((await (await call(path, { method: 'POST' })).json()) as { number: number }).number;

    expect([await issue(), await issue(), await issue()]).toEqual([1, 2, 3]);
    // Deleting a note gives no number back.
    await call(`/knowledge/notebooks/${notebookId}/notes/${notes['lei']}`, { method: 'DELETE' });
    expect(await issue()).toBe(4);
    for (let n = 5; n <= 42; n++) await issue();

    await call(`/portability/notebooks/${notebookId}/export`, { method: 'POST' });
    const [exportKey] = [...harness.archives.keys()];
    const prepared = (await (await call('/portability/imports', { method: 'POST' })).json()) as {
      uploadKey: string;
    };
    harness.uploads.set(prepared.uploadKey, harness.archives.get(exportKey ?? '') as Buffer);
    const job = await imported_(prepared.uploadKey, 'Normas e Legislacao (numerada)');

    const imported = (await (await call(`/knowledge/notebooks/${job.notebookId}`)).json()) as {
      folders: Array<{ folderId: string }>;
    };
    const importedFolder = imported.folders[0]?.folderId ?? '';
    expect(
      await issue(`/knowledge/notebooks/${job.notebookId}/folders/${importedFolder}/numbers`),
    ).toBe(43);
  });

  /**
   * An import is a job, so a refusal reaches the person as the END of that job
   * and not as the status of a request — and it reaches them as a CODE, because
   * the interface that shows it speaks two languages (RN-PRT-014, RN-PRT-018).
   */
  it('refuses a document it cannot read, and creates nothing', async () => {
    const before = (await (await call('/knowledge/notebooks')).json()) as unknown[];

    const prepared = (await (await call('/portability/imports', { method: 'POST' })).json()) as {
      uploadKey: string;
    };
    harness.uploads.set(prepared.uploadKey, Buffer.from('not a zip at all'));

    const job = await imported_(prepared.uploadKey, 'Nao vai nascer');
    expect(job.status).toBe('failed');
    expect(job.failure).toBe('NOT_AN_ARCHIVE');

    const after = (await (await call('/knowledge/notebooks')).json()) as unknown[];
    expect(after.length).toBe(before.length);
  });

  /**
   * The discard of the upload runs in a `finally`, so it used to REPLACE the
   * verdict of the import: a worker that could not delete the file wrote a
   * whole notebook and recorded the job as failed, pointing at nothing (#148).
   * The file is what the lifecycle rule of the bucket expires (RN-PRT-014);
   * the notebook is what the person asked for.
   */
  it('records the notebook it wrote, even when the upload cannot be discarded', async () => {
    const { notebookId } = await seed();
    await call(`/portability/notebooks/${notebookId}/export`, { method: 'POST' });
    const [exportKey] = [...harness.archives.keys()];
    const prepared = (await (await call('/portability/imports', { method: 'POST' })).json()) as {
      uploadKey: string;
    };
    harness.uploads.set(prepared.uploadKey, harness.archives.get(exportKey ?? '') as Buffer);

    harness.refuseDiscard(new Error('AccessDenied: not authorized to perform s3:DeleteObject'));
    try {
      const job = await imported_(prepared.uploadKey, 'Normas e Legislacao (apesar da limpeza)');
      expect(job.status).toBe('ready');
      expect(job.notebookId).not.toBe(notebookId);
      const written = (await (await call(`/knowledge/notebooks/${job.notebookId}`)).json()) as {
        name: string;
      };
      expect(written.name).toBe('Normas e Legislacao (apesar da limpeza)');
    } finally {
      harness.refuseDiscard(null);
    }
  });

  it('refuses an import with no name for the notebook it would create', async () => {
    // The name is given by whoever imports, because a subscription holds each
    // notebook name once (RN-KNW-032, RN-PRT-012).
    const prepared = (await (await call('/portability/imports', { method: 'POST' })).json()) as {
      uploadKey: string;
    };
    const refused = await call('/portability/imports/apply', {
      method: 'POST',
      body: { uploadKey: prepared.uploadKey },
    });
    expect(refused.status).toBe(400);
  });

  it('refuses a document with two notes of one name in one folder, and creates nothing', async () => {
    // RN-KNW-042 and RN-PRT-014: found before the first write, never on the
    // second note of the pair with half a notebook already written.
    const { notebookId } = await seed();
    await call(`/portability/notebooks/${notebookId}/export`, { method: 'POST' });
    const exported = harness.archives.get([...harness.archives.keys()][0] ?? '') as Buffer;
    const [entry, json] = Object.entries(readZip(exported))[0] as [string, string];
    const document = JSON.parse(json) as { notes: Array<{ noteId: string }> };
    const twin = { ...document.notes[0], noteId: '01JBQ2X00000000000000000TW' };
    document.notes.push(twin as { noteId: string });

    const prepared = (await (await call('/portability/imports', { method: 'POST' })).json()) as {
      uploadKey: string;
    };
    harness.uploads.set(
      prepared.uploadKey,
      createZip([{ path: entry, content: JSON.stringify(document) }], new Date()),
    );
    const before = (await (await call('/knowledge/notebooks')).json()) as unknown[];

    const job = await imported_(prepared.uploadKey, 'Normas com gemea');

    expect(job.status).toBe('failed');
    expect(job.failure).toBe('TWIN_NAMES');
    const after = (await (await call('/knowledge/notebooks')).json()) as unknown[];
    expect(after.length).toBe(before.length);
  });

  /**
   * The design of a notebook: its Guidance and the Template of a folder, and
   * not one note (RN-PRT-017). It is the most common thing to want out of a
   * notebook, and what the chooser asks for in its first tab (#156) — so what
   * arrives is asserted by content and not by a flag.
   */
  it('writes the Guidance and the Template a selection asked for, with their content', async () => {
    const { notebookId, folderId } = await seed();
    const guidance = '# Como escrever aqui\n\nUma norma por nota.';
    const template = '---\nname: \n---\n\n# \n\nArt. ';
    await call(`/knowledge/notebooks/${notebookId}/guidance`, {
      method: 'PUT',
      body: { content: guidance, baseRevision: null },
    });
    await call(`/knowledge/notebooks/${notebookId}/folders/${folderId}/template`, {
      method: 'PUT',
      body: { content: template, baseRevision: null },
    });

    await call(`/portability/notebooks/${notebookId}/export`, { method: 'POST' });
    const exported = harness.archives.get([...harness.archives.keys()][0] ?? '') as Buffer;
    const [entry, json] = Object.entries(readZip(exported))[0] as [string, string];
    const document = JSON.parse(json) as { folders: Array<{ folderId: string }> };

    const prepared = (await (await call('/portability/imports', { method: 'POST' })).json()) as {
      uploadKey: string;
    };
    harness.uploads.set(
      prepared.uploadKey,
      createZip([{ path: entry, content: json }], new Date()),
    );

    // The Guidance and the Template of that folder, and no note. The folder
    // itself is not named: a Template carries the folder it belongs to,
    // because there is nowhere else to write it (#156).
    const started = await call('/portability/imports/apply', {
      method: 'POST',
      body: {
        uploadKey: prepared.uploadKey,
        name: 'So o desenho',
        selection: {
          guidance: true,
          history: false,
          folders: [],
          templates: [document.folders[0]?.folderId],
          notes: [],
        },
      },
    });
    const { transferId } = (await started.json()) as { transferId: string };
    const job = (await (await call(`/portability/transfers/${transferId}`)).json()) as {
      notebookId: string;
      status: string;
    };
    expect(job.status).toBe('ready');

    const written = (await (await call(`/knowledge/notebooks/${job.notebookId}`)).json()) as {
      folders: Array<{ folderId: string; hasTemplate: boolean }>;
      guidance: { content: string } | null;
    };
    expect(written.guidance?.content).toBe(guidance);
    expect(written.folders).toHaveLength(1);
    expect(written.folders[0]?.hasTemplate).toBe(true);

    // By content, because `hasTemplate` says a slot exists and not what is in it.
    const carried = (await (
      await call(
        `/knowledge/notebooks/${job.notebookId}/folders/${written.folders[0]?.folderId}/template`,
      )
    ).json()) as { content: string };
    expect(carried.content).toBe(template);

    const notes = (await (
      await call(`/knowledge/notebooks/${job.notebookId}/notes`)
    ).json()) as unknown[];
    expect(notes).toHaveLength(0);
  });

  it('writes only what the selection asks for, and the folders above it as a path', async () => {
    // RN-PRT-017: a notebook is often wanted for its design rather than for
    // its notes, or for one folder of it.
    const { notebookId } = await seed();
    await call(`/portability/notebooks/${notebookId}/export`, { method: 'POST' });
    const exported = harness.archives.get([...harness.archives.keys()][0] ?? '') as Buffer;
    const [entry, json] = Object.entries(readZip(exported))[0] as [string, string];
    const document = JSON.parse(json) as {
      folders: Array<{ folderId: string }>;
      notes: Array<{ noteId: string }>;
    };

    const prepared = (await (await call('/portability/imports', { method: 'POST' })).json()) as {
      uploadKey: string;
    };
    harness.uploads.set(
      prepared.uploadKey,
      createZip([{ path: entry, content: JSON.stringify(document) }], new Date()),
    );

    // One note, and neither its folder nor the Guidance selected: the folder
    // is written as a PATH, so the note never arrives without it.
    const started = await call('/portability/imports/apply', {
      method: 'POST',
      body: {
        uploadKey: prepared.uploadKey,
        name: 'So uma nota',
        selection: {
          guidance: false,
          folders: [],
          templates: [],
          notes: [document.notes[0]?.noteId],
        },
      },
    });
    const { transferId } = (await started.json()) as { transferId: string };
    const job = (await (await call(`/portability/transfers/${transferId}`)).json()) as {
      notebookId: string;
      status: string;
    };
    expect(job.status).toBe('ready');

    const written = (await (await call(`/knowledge/notebooks/${job.notebookId}`)).json()) as {
      folders: Array<{ name: string; hasTemplate: boolean }>;
      guidance: { content: string } | null;
    };
    expect(written.guidance).toBeNull();
    expect(written.folders).toHaveLength(1);
    // A path carries the name and the description of the folder, and no
    // Template of its own.
    expect(written.folders[0]?.hasTemplate).toBe(false);
    const notes = (await (
      await call(`/knowledge/notebooks/${job.notebookId}/notes`)
    ).json()) as unknown[];
    expect(notes).toHaveLength(1);
  });

  it('imports the structure of a notebook and not one note of it', async () => {
    const { notebookId, folderId } = await seed();
    await call(`/knowledge/notebooks/${notebookId}/guidance`, {
      method: 'PUT',
      body: { content: '# Orientacao\n\nUma norma por nota.\n', baseRevision: null },
    });
    await call(`/knowledge/notebooks/${notebookId}/folders/${folderId}/template`, {
      method: 'PUT',
      body: { content: '## Norma\n\n## Fundamento\n', baseRevision: null },
    });
    await call(`/portability/notebooks/${notebookId}/export`, { method: 'POST' });
    const exported = harness.archives.get([...harness.archives.keys()][0] ?? '') as Buffer;
    const [entry, json] = Object.entries(readZip(exported))[0] as [string, string];
    const document = JSON.parse(json) as { folders: Array<{ folderId: string }> };

    const prepared = (await (await call('/portability/imports', { method: 'POST' })).json()) as {
      uploadKey: string;
    };
    harness.uploads.set(
      prepared.uploadKey,
      createZip([{ path: entry, content: JSON.stringify(document) }], new Date()),
    );
    const folders = document.folders.map((folder) => folder.folderId);

    const started = await call('/portability/imports/apply', {
      method: 'POST',
      body: {
        uploadKey: prepared.uploadKey,
        name: 'So a estrutura',
        selection: { guidance: true, folders, templates: folders, notes: [] },
      },
    });
    const { transferId } = (await started.json()) as { transferId: string };
    const job = (await (await call(`/portability/transfers/${transferId}`)).json()) as {
      notebookId: string;
    };

    const written = (await (await call(`/knowledge/notebooks/${job.notebookId}`)).json()) as {
      folders: Array<{ hasTemplate: boolean }>;
      guidance: { content: string } | null;
    };
    // The design of the notebook and none of its notes, which is how a notebook
    // is reused as the design of another (RN-PRT-017).
    expect(written.guidance).not.toBeNull();
    expect(written.folders[0]?.hasTemplate).toBe(true);
    const notes = (await (
      await call(`/knowledge/notebooks/${job.notebookId}/notes`)
    ).json()) as unknown[];
    expect(notes).toEqual([]);
  });

  it('answers 404 for an upload of another subscription', async () => {
    const refused = await call('/portability/imports/apply', {
      method: 'POST',
      body: {
        uploadKey: 's/01JBXR8Z5T7QK9M2N4P6R8S0T2/imports/01JBXR8Z5T7QK9M2N4P6R8S0T2.notebook',
      },
    });
    expect(refused.status).toBe(404);
  });

  it('answers 404 for a notebook this session cannot read', async () => {
    // A notebook that is not ours is indistinguishable from one that does not
    // exist: a 403 here would confirm it exists (rule 9).
    const response = await call('/portability/notebooks/01JBXR8Z5T7QK9M2N4P6R8S0T2/export', {
      method: 'POST',
    });
    expect(response.status).toBe(404);
  });
});

describe('Deleting a notebook takes it out of reach, for good', () => {
  it('removes it from every listing and from every context', async () => {
    const { notebookId, notes } = await seed();

    expect((await call(`/knowledge/notebooks/${notebookId}`, { method: 'DELETE' })).status).toBe(
      204,
    );

    // Out of the listing, and out of Knowledge, Discovery and Portability
    // alike: a deleted notebook answers like one that never existed (rule 9).
    const listed = (await (await call('/knowledge/notebooks')).json()) as Array<{
      notebookId: string;
    }>;
    expect(listed.map((notebook) => notebook.notebookId)).not.toContain(notebookId);
    expect((await call(`/knowledge/notebooks/${notebookId}`)).status).toBe(404);
    expect((await call(`/knowledge/notebooks/${notebookId}/notes/${notes['lei']}`)).status).toBe(
      404,
    );
    expect((await call(`/discovery/notebooks/${notebookId}/graph`)).status).toBe(404);
    expect(
      (await call(`/portability/notebooks/${notebookId}/export`, { method: 'POST' })).status,
    ).toBe(404);

    // The trail keeps every event of it, which is the one thing a deletion
    // does not take away (rule 6) — and it stops serving them note by note,
    // because what they point at is on its way to being destroyed (RN-AUD-010).
    await drainEvents();
    expect(
      (await call(`/audit/notebooks/${notebookId}/notes/${notes['lei']}/history`)).status,
    ).toBe(404);
    const activity = (await (await call(`/audit/notebooks/${notebookId}/activity`)).json()) as {
      entries: Array<{ type: string }>;
    };
    expect(activity.entries.map((entry) => entry.type)).toContain('NoteCreated');
  });

  it('frees the name at once, and gives it to nobody back', async () => {
    const { notebookId } = await seed();
    await call(`/knowledge/notebooks/${notebookId}`, { method: 'DELETE' });

    // The name is free the instant the notebook is deleted, because the
    // notebook that held it is never coming back to claim it (RN-KNW-033).
    const twin = await call('/knowledge/notebooks', {
      method: 'POST',
      body: { name: 'Normas e Legislacao', description: 'Outro' },
    });
    expect(twin.status).toBe(201);

    // There is no way back. The route that was the only one is gone.
    expect(
      (await call(`/knowledge/notebooks/${notebookId}/restore`, { method: 'POST' })).status,
    ).toBe(404);
  });

  it('records the deletion in the trail, with authorship', async () => {
    const { notebookId } = await seed();
    await call(`/knowledge/notebooks/${notebookId}`, { method: 'DELETE' });
    await drainEvents();

    const activity = (await (await call(`/audit/notebooks/${notebookId}/activity`)).json()) as {
      entries: Array<{ type: string; authorship: { userId: string } }>;
    };
    const deleted = activity.entries.find((entry) => entry.type === 'NotebookDeleted');
    expect(deleted?.authorship.userId).toBe('user-owner');
  });
});

/**
 * The storage quota of the plan, over HTTP (RN-SUB-019, RN-SUB-021).
 *
 * The counter is maintained by the relay in production; here the harness moves
 * it with the same deltas the events declare, which is the same arithmetic on
 * the same numbers.
 */
describe('The plan limits how much a subscription can store', () => {
  it('refuses a write that would cross the line, and says what the numbers are', async () => {
    const { notebookId, folderId } = await seed();
    harness.storage.record(harness.events.published);

    // A ceiling just above what is already stored: enough for a short note,
    // not for a long one.
    harness.storage.limitBytes = harness.storage.usedBytes + 200;

    const refused = await call(`/knowledge/notebooks/${notebookId}/notes`, {
      method: 'POST',
      body: { folderId, content: 'x'.repeat(500) },
    });
    expect(refused.status).toBe(413);
    const body = (await refused.json()) as { code: string; details?: Record<string, number> };
    expect(body.code).toBe('LIMIT_EXCEEDED');
    expect(body.details).toMatchObject({ limitBytes: harness.storage.limitBytes });

    // And nothing was written: the check runs before the content reaches the
    // store, so a refused write leaves no orphan revision behind.
    const listed = (await (
      await call(`/knowledge/notebooks/${notebookId}/notes?folderId=${folderId}`)
    ).json()) as Array<{ name: string }>;
    expect(listed.map((note) => note.name)).not.toContain('Nota longa');
  });

  it('still admits the writes that get you back under it', async () => {
    const { notebookId, folderId, notes } = await seed();
    harness.storage.record(harness.events.published);
    harness.storage.limitBytes = 1; // hopelessly over

    const read = (await (
      await call(`/knowledge/notebooks/${notebookId}/notes/${notes['lei']}`)
    ).json()) as { revision: { versionId: string } };

    // Shortening a note is admitted, and so is deleting one: being over the
    // limit must not trap someone inside it.
    const shortened = await call(`/knowledge/notebooks/${notebookId}/notes/${notes['lei']}`, {
      method: 'PUT',
      body: { content: 'Curta.', baseRevision: read.revision.versionId },
    });
    expect(shortened.status).toBe(200);
    expect(
      (
        await call(`/knowledge/notebooks/${notebookId}/notes/${notes['achado']}`, {
          method: 'DELETE',
        })
      ).status,
    ).toBe(204);

    // Growing one is not.
    const grown = await call(`/knowledge/notebooks/${notebookId}/notes`, {
      method: 'POST',
      body: { folderId, content: 'y'.repeat(100) },
    });
    expect(grown.status).toBe(413);
  });
});
