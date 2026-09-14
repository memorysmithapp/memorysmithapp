/**
 * The Discovery seam of the connector, fed answers built to the published
 * schemas. The tool tests fake these adapters with the shape the tools want, so
 * only a case like these proves the route and the tool meet: related_notes
 * printed "- undefined (undefined)" on staging while every other test passed.
 */

import { backlinksSchema, graphNodeSchema, searchResultSchema } from '@memorysmith/contracts';
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
      children: [{ noteId: LAW, name: 'Lei 14.133', depth: 1, children: [] }],
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
      { noteId: LAW, name: 'Lei 14.133', section: 'Vigência', excerpt: 'Art. 75', score: 2 },
    ]);
  });
});
