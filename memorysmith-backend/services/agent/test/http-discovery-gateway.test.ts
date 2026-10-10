/**
 * The Discovery seam of the connector, fed answers built to the published
 * schemas. The tool tests fake these adapters with the shape the tools want, so
 * only a case like these proves the route and the tool meet: related_notes
 * printed "- undefined (undefined)" on staging while every other test passed.
 */

import {
  backlinksSchema,
  graphNodeSchema,
  noteLinksSchema,
  notebookHealthSchema,
  notebookNamesSchema,
  previewSchema,
  searchResultSchema,
} from '@memorysmith/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpDiscoveryGateway, HttpKnowledgeGateway } from '../src/adapters/http-gateways.js';
import type { AgentCaller } from '../src/mcp/gateway.js';

const caller = {
  userId: 'user-1',
  subscriptionId: '01JBQ2X0000000000000000000',
  bearerToken: 'access.jwt',
} as AgentCaller;

const FOLDER = '01JBQ2X000000000000000F001';
const FINDING = '01JBQ2X000000000000000N001';
const LAW = '01JBQ2X000000000000000N002';
const UNNAMED = '01JBQ2X000000000000000N003';

const ref = (noteId: string, name: string) => ({ noteId, name, aliases: [], folderId: FOLDER });

function apiAnswering(body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the connector reads Discovery as the contracts publish it', () => {
  it('names every note of the tree related_notes prints', async () => {
    apiAnswering(
      graphNodeSchema.parse({
        note: ref(FINDING, 'Achado 12'),
        depth: 0,
        children: [{ note: ref(LAW, 'Lei 14.133'), depth: 1, children: [] }],
      }),
    );

    const tree = await new HttpDiscoveryGateway('https://api.example.com').relatedNotes(caller, {
      notebookId: 'notebook',
      noteId: FINDING,
    });

    expect(tree).toEqual({
      noteId: FINDING,
      name: 'Achado 12',
      depth: 0,
      folderId: FOLDER,
      children: [{ noteId: LAW, name: 'Lei 14.133', folderId: FOLDER, depth: 1, children: [] }],
    });
  });

  it('names what points at a note, and says a note with no name has none', async () => {
    apiAnswering(
      backlinksSchema.parse({
        note: ref(LAW, 'Lei 14.133'),
        backlinks: [ref(FINDING, 'Achado 12'), ref(UNNAMED, '')],
      }),
    );

    const found = await new HttpDiscoveryGateway('https://api.example.com').backlinks(
      caller,
      'notebook',
      LAW,
    );

    expect(found).toEqual([
      { noteId: FINDING, name: 'Achado 12', folderId: FOLDER },
      { noteId: UNNAMED, name: null, folderId: FOLDER },
    ]);
  });

  it('names the note of every search hit', async () => {
    apiAnswering(
      searchResultSchema.parse({
        mode: 'lexical',
        hits: [{ note: ref(LAW, 'Lei 14.133'), section: 'Vigência', excerpt: 'Art. 75', score: 2 }],
      }),
    );

    const hits = await new HttpKnowledgeGateway('https://api.example.com').searchNotes(
      caller,
      'notebook',
      'Art. 75',
    );

    expect(hits).toEqual([
      {
        noteId: LAW,
        name: 'Lei 14.133',
        folderId: FOLDER,
        section: 'Vigência',
        excerpt: 'Art. 75',
        score: 2,
      },
    ]);
  });

  it('reads a note with the trail of its folder and where each of its links goes', async () => {
    const OTHER = '01JBQ2X000000000000000F002';
    const TWIN = '01JBQ2X000000000000000N004';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const body = url.endsWith('/links')
          ? noteLinksSchema.parse({
              links: [
                {
                  target: 'Lei 14.133',
                  kind: 'note',
                  by: 'name',
                  notes: [
                    { ...ref(LAW, 'Lei 14.133'), folderTrail: ['Normas', 'Federais'] },
                    { ...ref(TWIN, 'Lei 14.133'), folderId: OTHER, folderTrail: ['Rascunhos'] },
                  ],
                },
                { target: 'Portaria 9', kind: 'pending', by: null, notes: [] },
                // A file the notebook keeps: no edge, and not nothing (#166).
                { target: 'esquema de blocos', kind: 'attachment', by: null, notes: [] },
              ],
            })
          : {
              noteId: FINDING,
              name: 'Achado 12',
              folderId: FOLDER,
              folderTrail: ['Achados', '2026'],
              position: 'a0',
              content: 'Ver [[Lei 14.133]] e [[Portaria 9]].',
              revision: { versionId: 'v1' },
              updatedAt: '2026-09-16T00:00:00.000Z',
            };
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    const note = await new HttpKnowledgeGateway('https://api.example.com').readNote(
      caller,
      'notebook',
      FINDING,
    );

    expect(note.folder).toEqual(['Achados', '2026']);
    // The body is what was written, links and all (RN-AGT-015).
    expect(note.content).toBe('Ver [[Lei 14.133]] e [[Portaria 9]].');
    expect(note.links).toEqual([
      {
        target: 'Lei 14.133',
        resolvedBy: 'name',
        notes: [
          { noteId: LAW, name: 'Lei 14.133', folder: ['Normas', 'Federais'] },
          { noteId: TWIN, name: 'Lei 14.133', folder: ['Rascunhos'] },
        ],
      },
      { target: 'Portaria 9', resolvedBy: 'pending', notes: [] },
      { target: 'esquema de blocos', resolvedBy: 'attachment', notes: [] },
    ]);
  });
});

describe('a move reaches the route the core publishes, and reads the note back (#265)', () => {
  it('posts the destination and the anchor, and answers the note where it now is, without its body', async () => {
    const DESTINATION = '01JBQ2X000000000000000F002';
    const calls: Array<{ url: string; method: string; body: unknown }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({
          url,
          method: init?.method ?? 'GET',
          body: init?.body ? JSON.parse(String(init.body)) : null,
        });
        const body = url.endsWith('/move')
          ? {
              noteId: FINDING,
              name: 'Achado 12',
              folderId: DESTINATION,
              position: 'a1',
              updatedAt: '2026-09-16T00:00:00.000Z',
            }
          : {
              noteId: FINDING,
              name: 'Achado 12',
              folderId: DESTINATION,
              folderTrail: ['Publicados'],
              position: 'a1',
              content: 'O corpo, que o movimento não escreveu.',
              revision: { versionId: 'v7' },
              updatedAt: '2026-09-16T00:00:00.000Z',
            };
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    const moved = await new HttpKnowledgeGateway('https://api.example.com').moveNote(caller, {
      notebookId: 'notebook',
      noteId: FINDING,
      folderId: DESTINATION,
      afterNoteId: LAW,
    });

    expect(calls[0]).toEqual({
      url: `https://api.example.com/knowledge/notebooks/notebook/notes/${FINDING}/move`,
      method: 'POST',
      body: { toFolderId: DESTINATION, afterNoteId: LAW },
    });
    expect(moved).toEqual({
      noteId: FINDING,
      name: 'Achado 12',
      folderId: DESTINATION,
      folder: ['Publicados'],
      position: 'a1',
      revision: 'v7',
      updatedAt: '2026-09-16T00:00:00.000Z',
    });
  });
});

describe('the sweep of a notebook reads its pending links beside its names (#217)', () => {
  it('flags the pending link that almost reaches a note, and leaves the one on purpose', async () => {
    const SESSION = '01JBQ2X000000000000000N010';
    const ORION = '01JBQ2X000000000000000N011';
    const health = notebookHealthSchema.parse({
      orphans: [ref(ORION, 'M42 Orion Nebula')],
      pendingLinks: [
        { fromNote: ref(SESSION, 'Session 1'), targetName: 'M42' },
        { fromNote: ref(SESSION, 'Session 1'), targetName: 'M81 Bodes Galaxy' },
        // One target linked twice from one note is one note that links to it.
        { fromNote: ref(SESSION, 'Session 1'), targetName: 'M81 Bodes Galaxy' },
      ],
    });
    const names = notebookNamesSchema.parse({
      notes: [ref(SESSION, 'Session 1'), ref(ORION, 'M42 Orion Nebula')],
      attachments: [],
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (url: string) =>
          new Response(JSON.stringify(String(url).endsWith('/health') ? health : names), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    );

    const check = await new HttpDiscoveryGateway('https://api.example.com').checkNotebook(
      caller,
      'notebook',
    );

    expect(check.pending).toEqual([
      {
        target: 'M42',
        from: [{ noteId: SESSION, name: 'Session 1', folderId: FOLDER }],
        likelyMeant: { name: 'M42 Orion Nebula', kind: 'note', noteId: ORION },
      },
      {
        target: 'M81 Bodes Galaxy',
        from: [{ noteId: SESSION, name: 'Session 1', folderId: FOLDER }],
        likelyMeant: null,
      },
    ]);
    expect(check.orphans).toEqual([{ noteId: ORION, name: 'M42 Orion Nebula', folderId: FOLDER }]);
  });
});

describe('the connector reads a preview as the contracts publish it (#260)', () => {
  it('starts one on the notebook it draws in, and reads its image back', async () => {
    const ready = previewSchema.parse({
      previewId: '01JBQ2X000000000000000PV01',
      status: 'ready',
      image: {
        mimeType: 'image/png',
        base64: 'iVBORw0KGgo=',
        width: 760,
        height: 420,
        drawnHeight: 420,
        cut: false,
      },
    });
    apiAnswering({ previewId: ready.previewId, status: 'running' });
    const gateway = new HttpKnowledgeGateway('https://api.example.com');
    const started = await gateway.startPreview(caller, {
      notebookId: '01JBQ2X000000000000000V001',
      content: '# Draft',
      folderId: FOLDER,
    });
    expect(started.previewId).toBe(ready.previewId);
    const [address, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(address).toBe(
      'https://api.example.com/portability/notebooks/01JBQ2X000000000000000V001/previews',
    );
    expect(JSON.parse(String(init?.body))).toEqual({ content: '# Draft', folderId: FOLDER });

    apiAnswering(ready);
    expect(await gateway.getPreview(caller, ready.previewId)).toEqual(ready);
  });
});
