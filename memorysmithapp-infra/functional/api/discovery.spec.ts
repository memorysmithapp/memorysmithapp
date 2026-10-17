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

  test('[route:GET /discovery/notebooks/:v/notes/:n/links] says where every link of a note goes', async ({
    owner,
    notebook,
  }) => {
    const { alpha, beta } = await writeLinkedNotes(owner, notebook);

    const found = await eventually(
      'Beta among the targets of Alpha',
      () =>
        owner.ok<{
          links: Array<{
            target: string;
            by: string | null;
            kind?: string;
            notes: Array<NoteRef & { folderTrail: string[] }>;
          }>;
        }>('GET', `${discovery(notebook)}/notes/${alpha}/links`),
      (answer) => answer.links.some((link) => link.notes.some((note) => note.noteId === beta)),
    );
    const toBeta = found.links.find((link) => link.target === 'Beta');
    expect(toBeta?.by).toBe('name');
    expect(toBeta?.notes[0]?.folderTrail.length).toBeGreaterThan(0);
    // A target nothing reaches says so, and names no note (#186).
    expect(found.links.find((link) => link.target === 'Gamma')).toEqual({
      target: 'Gamma',
      by: null,
      kind: 'pending',
      notes: [],
    });
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

  test('[route:GET /discovery/notebooks/:v/names] answers the name of each note and its spellings', async ({
    owner,
    notebook,
  }) => {
    const { beta } = await writeLinkedNotes(owner, notebook);
    await owner.ok<{ noteId: string }>(
      'POST',
      `/knowledge/notebooks/${notebook.notebookId}/notes`,
      {
        folderId: notebook.folderId,
        content: '---\nname: Delta\naliases: [Quarta nota]\n---\n\nIt is also called that.\n',
      },
    );

    /**
     * What a reading surface draws a link by: an alias is read by this context
     * and by no other, so the tree the page is drawn from cannot carry one
     * (rule 5, RN-DSC-046).
     */
    const answer = await eventually(
      'Delta among the names, with the spelling it declares',
      () =>
        owner.ok<{ notes: Array<NoteRef & { aliases: string[] }> }>(
          'GET',
          `${discovery(notebook)}/names`,
        ),
      (found) => found.notes.some((note) => note.aliases.includes('Quarta nota')),
    );
    expect(answer.notes.map((note) => note.noteId)).toContain(beta);
  });

  /**
   * The shape that lost a note every link it had (#163): a name and a spelling
   * of the SAME note, which is how anybody writes about a source they quote.
   * The edge is keyed by the pair it joins, so both targets built one key, and
   * a batch carrying a key twice is refused whole.
   */
  test('[route:GET /discovery/notebooks/:v/notes/:n/links] keeps every link when two targets reach one note', async ({
    owner,
    notebook,
  }) => {
    const write = (content: string) =>
      owner.ok<{ noteId: string }>('POST', `/knowledge/notebooks/${notebook.notebookId}/notes`, {
        folderId: notebook.folderId,
        content,
      });

    const source = await write('---\nname: Fonte\naliases: [A fonte]\n---\n\nThe source.\n');
    const other = await write('---\nname: Outra\n---\n\nAnother note.\n');
    const citing = await write(
      '---\nname: Citando\n---\n\nBy name [[Fonte]], by spelling [[A fonte]], and [[Outra]].\n',
    );

    const found = await eventually(
      'the three links of Citando',
      () =>
        owner.ok<{
          links: Array<{ target: string; by: string | null; notes: NoteRef[] }>;
        }>('GET', `${discovery(notebook)}/notes/${citing.noteId}/links`),
      // What the case asserts is that both notes are reached, and the name of
      // each is projected on its own: waiting for two links answered the
      // moment one target had resolved and the other was still pending. The
      // source is reached by its alias and by its name, each projected on its
      // own, so the case also waits for the name to hold the pair.
      (answer) =>
        [source.noteId, other.noteId].every((noteId) =>
          answer.links.some((link) => link.notes.some((note) => note.noteId === noteId)),
        ) &&
        answer.links.some(
          (link) => link.by === 'name' && link.notes.some((note) => note.noteId === source.noteId),
        ),
    );

    // One edge per pair, and the pair a NAME reaches is not the alias's to
    // hold (RN-DSC-053): the target reads as the name.
    const toSource = found.links.find((link) =>
      link.notes.some((note) => note.noteId === source.noteId),
    );
    expect(toSource?.by).toBe('name');
    expect(
      found.links.some((link) => link.notes.some((note) => note.noteId === other.noteId)),
    ).toBe(true);

    // And the note it quotes says so back, once.
    const backlinks = await owner.ok<{ backlinks: NoteRef[] }>(
      'GET',
      `${discovery(notebook)}/notes/${source.noteId}/backlinks`,
    );
    expect(backlinks.backlinks.filter((note) => note.noteId === citing.noteId)).toHaveLength(1);
  });

  test('[route:GET /discovery/notebooks/:v/health] reports the link to a note nobody wrote', async ({
    owner,
    notebook,
  }) => {
    const { alpha } = await writeLinkedNotes(owner, notebook);

    // A link to a name nobody carries yet is pending, and reported once under
    // that name (RN-DSC-004); nothing in a notebook is broken.
    const health = await eventually(
      'the pending link to Gamma',
      () =>
        owner.ok<
          Record<string, unknown> & {
            pendingLinks: Array<{ fromNote: NoteRef; targetName: string }>;
          }
        >('GET', `${discovery(notebook)}/health`),
      (answer) =>
        answer.pendingLinks.some(
          (link) => link.targetName === 'Gamma' && link.fromNote.noteId === alpha,
        ),
    );
    expect(health).not.toHaveProperty('brokenLinks');
  });

  /**
   * A file is shown by the notes that embed it or draw it as an image by path,
   * and by no plain link (#305, #307, RN-DSC-065, RN-DSC-066).
   */
  test('[route:GET /discovery/notebooks/:v/attachments] lists each kept file with the notes that show it', async ({
    owner,
    notebook,
  }) => {
    const png =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const keep = (name: string) =>
      owner.ok('POST', `/knowledge/notebooks/${notebook.notebookId}/files`, {
        name,
        description: 'Kept by a functional case',
        mimeType: 'image/png',
        contentBase64: png,
      });
    const write = (content: string) =>
      owner.ok<{ noteId: string }>('POST', `/knowledge/notebooks/${notebook.notebookId}/notes`, {
        folderId: notebook.folderId,
        content,
      });
    await keep('curva final.png');
    await keep('nunca mostrada.png');
    const drawn = await write(
      '---\nname: Desenha\n---\n\n![Curva|50%](../assets/curva%20final.png)\n\n![Falta](falta.png)\n',
    );
    const embedded = await write('---\nname: Embute\n---\n\n![[curva final.png]]\n');
    await write('---\nname: Só cita\n---\n\nVer [[nunca mostrada.png]].\n');

    type Uses = { attachments: Array<{ name: string; notes: NoteRef[] }> };
    const answer = await eventually(
      'both notes showing curva final.png',
      () => owner.ok<Uses>('GET', `${discovery(notebook)}/attachments`),
      (found) =>
        found.attachments.find((each) => each.name === 'curva final.png')?.notes.length === 2,
    );
    const shown = (name: string) =>
      answer.attachments
        .find((each) => each.name === name)
        ?.notes.map((note) => note.noteId)
        .sort();
    expect(shown('curva final.png')).toEqual([drawn.noteId, embedded.noteId].sort());
    // A plain link names a note, never a file (§5.8).
    expect(shown('nunca mostrada.png')).toEqual([]);

    // The image of a file the notebook does not keep is pending, as an embed of one is.
    const health = await owner.ok<{
      pendingLinks: Array<{ fromNote: NoteRef; targetName: string }>;
      unshownFiles: string[];
    }>('GET', `${discovery(notebook)}/health`);
    expect(health.pendingLinks).toContainEqual(
      expect.objectContaining({ targetName: 'falta.png' }),
    );
    expect(health.unshownFiles).toEqual(['nunca mostrada.png']);
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
      owner.ok<{ hits: Array<{ note: { noteId: string; name: string } }> }>(
        'POST',
        `${discovery(notebook)}/search`,
        { query },
      );

    const found = await eventually(
      `the note carrying ${word}`,
      () => search(word),
      (answer) => answer.hits.some((hit) => hit.note.noteId === beta),
    );
    expect(found.hits.find((hit) => hit.note.noteId === beta)?.note.name).toBe('Beta');
    const filtered = await search(`${word} kind:claim`);
    expect(filtered.hits).toEqual([]);
  });
});
