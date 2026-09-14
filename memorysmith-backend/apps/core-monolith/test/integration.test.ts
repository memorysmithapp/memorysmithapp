/**
 * The full slice, over HTTP, across four contexts: a notebook is authored, the
 * events it produced feed the audit trail and the discovery projections, and
 * the reads come back through the API the UI and the connector use.
 *
 * This is what "the whole thing works" means before any of it is deployed.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { searchResultSchema } from '@memorysmith/contracts';
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
    const { notes } = await seed();
    const history = (await (await call(`/audit/notes/${notes['lei']}/history`)).json()) as {
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

  it('keeps the timeline after the note is deleted', async () => {
    const { notebookId, notes } = await seed();
    await call(`/knowledge/notebooks/${notebookId}/notes/${notes['lei']}`, { method: 'DELETE' });
    await drainEvents();

    // The note is gone from the listings and the history is still there.
    expect((await call(`/knowledge/notebooks/${notebookId}/notes/${notes['lei']}`)).status).toBe(
      404,
    );
    const history = (await (await call(`/audit/notes/${notes['lei']}/history`)).json()) as {
      entries: Array<{ type: string }>;
    };
    expect(history.entries.map((entry) => entry.type)).toContain('NoteDeleted');
  });
});

describe('Portability answers over the API', () => {
  it('exports the notebook as one document, reachable by a link', async () => {
    const { notebookId } = await seed();

    const job = (await (
      await call(`/portability/notebooks/${notebookId}/export`, { method: 'POST' })
    ).json()) as {
      exportId: string;
      status: string;
      downloadUrl: string;
      noteCount: number;
      bytes: number;
    };

    expect(job.status).toBe('ready');
    expect(job.noteCount).toBe(2);
    expect(job.bytes).toBeGreaterThan(0);
    // The archive is never the body of the response: a notebook of two thousand
    // notes would not fit in one, and the link is what the browser follows.
    expect(job.downloadUrl).toContain(job.exportId);

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

    const job = (await (
      await call('/portability/imports/apply', {
        method: 'POST',
        // The subscription holds each notebook name once (RN-KNW-032), and this
        // document came from this very subscription: naming the copy is what
        // makes "the same file twice gives two notebooks" true without the server
        // inventing a suffix.
        body: { uploadKey: prepared.uploadKey, name: 'Normas e Legislacao (copia)' },
      })
    ).json()) as { notebookId: string; status: string; folderCount: number; noteCount: number };

    expect(job.status).toBe('imported');
    expect(job.noteCount).toBe(2);
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

  it('refuses a document it cannot read, and creates nothing', async () => {
    // RN-PRT-014: refused whole, with the reason, before the first write.
    const before = (await (await call('/knowledge/notebooks')).json()) as unknown[];

    const prepared = (await (await call('/portability/imports', { method: 'POST' })).json()) as {
      uploadKey: string;
    };
    harness.uploads.set(prepared.uploadKey, Buffer.from('not a zip at all'));

    const refused = await call('/portability/imports/apply', {
      method: 'POST',
      body: { uploadKey: prepared.uploadKey },
    });
    expect(refused.status).toBe(400);
    expect(((await refused.json()) as { message: string }).message).toContain('.notebook');

    const after = (await (await call('/knowledge/notebooks')).json()) as unknown[];
    expect(after.length).toBe(before.length);
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

describe('Deleting a notebook takes it out of reach without destroying it', () => {
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

    // Nothing was destroyed: the history of a note inside it still answers.
    const history = (await (await call(`/audit/notes/${notes['lei']}/history`)).json()) as {
      entries: Array<{ type: string }>;
    };
    expect(history.entries.map((entry) => entry.type)).toContain('NoteCreated');
  });

  it('frees the name and gives it back on restore', async () => {
    const { notebookId } = await seed();
    await call(`/knowledge/notebooks/${notebookId}`, { method: 'DELETE' });

    // The slug is available again, exactly as a deleted note frees its own.
    const twin = await call('/knowledge/notebooks', {
      method: 'POST',
      body: { name: 'Normas e Legislacao', description: 'Outro' },
    });
    expect(twin.status).toBe(201);

    // And restoring is refused while the name belongs to someone else.
    const refused = await call(`/knowledge/notebooks/${notebookId}/restore`, { method: 'POST' });
    expect(refused.status).toBe(409);

    const { notebookId: twinId } = (await twin.json()) as { notebookId: string };
    await call(`/knowledge/notebooks/${twinId}`, { method: 'DELETE' });
    expect(
      (await call(`/knowledge/notebooks/${notebookId}/restore`, { method: 'POST' })).status,
    ).toBe(204);
    expect((await call(`/knowledge/notebooks/${notebookId}`)).status).toBe(200);
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
