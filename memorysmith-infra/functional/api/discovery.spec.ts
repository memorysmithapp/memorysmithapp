/**
 * Discovery: the graph, backlinks, the resolution of a link, the health of a
 * notebook, facets and search (software-vision.md, section 10;
 * architecture-guide.md, section 11). Every one of them is projected from the
 * events of a write, so every case asks again until the projection shows it,
 * up to the target of section 18.
 */

import type { Api } from '../support/api.js';
import { eventually } from '../support/eventually.js';
import { expect, test, type NotebookFixture } from './fixtures.js';

interface NoteRef {
  noteId: string;
  name: string | null;
}

/** Two notes that link, a link to a note nobody wrote, and attributes to filter on. */
async function writeLinkedNotes(owner: Api, notebook: NotebookFixture) {
  const word = `quartzite${Date.now().toString(36)}`;
  const write = (content: string) =>
    owner.ok<{ noteId: string }>('POST', `/knowledge/notebooks/${notebook.notebookId}/notes`, {
      folderId: notebook.folderId,
      content,
    });
  const beta = await write(`---\nname: Beta\nkind: evidence\n---\n\nThe ${word} evidence.\n`);
  const alpha = await write(
    '---\nname: Alpha\nkind: claim\n---\n\nSupported by [[Beta]], and by [[Gamma]], which nobody wrote.\n',
  );
  return { alpha: alpha.noteId, beta: beta.noteId, word };
}

const discovery = (notebook: NotebookFixture) => `/discovery/notebooks/${notebook.notebookId}`;

test.describe('the graph of a notebook', () => {
  test('[route:GET /discovery/notebooks/:v/graph] draws every note and the edge a link makes', async ({
    owner,
    notebook,
  }) => {
    const { alpha, beta } = await writeLinkedNotes(owner, notebook);

    const graph = await eventually(
      'the edge from Alpha to Beta',
      () =>
        owner.ok<{
          nodes: NoteRef[];
          edges: Array<[number, number]>;
          pending: Array<{ targetName: string }>;
        }>('GET', `${discovery(notebook)}/graph`),
      (answer) => {
        const from = answer.nodes.findIndex((node) => node.noteId === alpha);
        const to = answer.nodes.findIndex((node) => node.noteId === beta);
        return answer.edges.some(([a, b]) => a === from && b === to);
      },
    );
    expect(graph.pending.map((link) => link.targetName)).toContain('Gamma');
  });

  test('[route:GET /discovery/notebooks/:v/notes/:n/graph] draws the neighbourhood of one note', async ({
    owner,
    notebook,
  }) => {
    const { alpha, beta } = await writeLinkedNotes(owner, notebook);

    await eventually(
      'Beta beside Alpha',
      () =>
        owner.call<{ note: NoteRef; children: Array<{ note: NoteRef }> }>(
          'GET',
          `${discovery(notebook)}/notes/${alpha}/graph?depth=1`,
        ),
      (answer) =>
        answer.status === 200 &&
        answer.body.note.noteId === alpha &&
        answer.body.children.some((child) => child.note.noteId === beta),
    );
  });

  test('[route:GET /discovery/notebooks/:v/notes/:n/backlinks] names the notes that link to a note', async ({
    owner,
    notebook,
  }) => {
    const { alpha, beta } = await writeLinkedNotes(owner, notebook);

    await eventually(
      'Alpha among the backlinks of Beta',
      () =>
        owner.ok<{ backlinks: NoteRef[] }>('GET', `${discovery(notebook)}/notes/${beta}/backlinks`),
      (answer) => answer.backlinks.some((note) => note.noteId === alpha),
    );
  });

  test('[route:GET /discovery/notebooks/:v/links/:target] resolves a link by the name a note states', async ({
    owner,
    notebook,
  }) => {
    const { beta } = await writeLinkedNotes(owner, notebook);

    const resolved = await eventually(
      'the link to Beta resolved',
      () =>
        owner.ok<{ kind: string; by: string | null; notes: NoteRef[] }>(
          'GET',
          `${discovery(notebook)}/links/${encodeURIComponent('Beta')}`,
        ),
      (answer) => answer.kind === 'note',
    );
    expect(resolved.by).toBe('name');
    expect(resolved.notes.map((note) => note.noteId)).toEqual([beta]);
  });

  test('[route:GET /discovery/notebooks/:v/health] reports the link to a note nobody wrote', async ({
    owner,
    notebook,
  }) => {
    const { alpha } = await writeLinkedNotes(owner, notebook);

    await eventually(
      'the broken link to Gamma',
      () =>
        owner.ok<{ brokenLinks: Array<{ fromNote: NoteRef; targetName: string }> }>(
          'GET',
          `${discovery(notebook)}/health`,
        ),
      (answer) =>
        answer.brokenLinks.some(
          (link) => link.targetName === 'Gamma' && link.fromNote.noteId === alpha,
        ),
    );
  });
});

test.describe('facets and search', () => {
  test('[route:GET /discovery/notebooks/:v/facets] counts the values of an attribute the notes declare', async ({
    owner,
    notebook,
  }) => {
    await writeLinkedNotes(owner, notebook);

    await eventually(
      'the facet kind with both values',
      () =>
        owner.ok<{ facets: Array<{ facet: string; values: Array<{ value: string }> }> }>(
          'GET',
          `${discovery(notebook)}/facets`,
        ),
      (answer) => {
        const values = answer.facets.find((facet) => facet.facet === 'kind')?.values ?? [];
        return ['claim', 'evidence'].every((value) => values.some((each) => each.value === value));
      },
    );
  });

  test('[route:POST /discovery/notebooks/:v/search] finds a note by a word of its body, and filters by an attribute', async ({
    owner,
    notebook,
  }) => {
    const { beta, word } = await writeLinkedNotes(owner, notebook);
    const search = (query: string) =>
      owner.ok<{ hits: Array<{ noteId: string }> }>('POST', `${discovery(notebook)}/search`, {
        query,
      });

    await eventually(
      `the note carrying ${word}`,
      () => search(word),
      (answer) => answer.hits.some((hit) => hit.noteId === beta),
    );
    const filtered = await search(`${word} kind:claim`);
    expect(filtered.hits).toEqual([]);
  });
});
