import { beforeEach, describe, expect, it } from 'vitest';
import { extractLinks } from '../src/domain/LinkExtractor.js';
import { extractFacets, facetDelta } from '../src/domain/FacetExtractor.js';
import { normalize } from '../src/domain/SearchQuery.js';
import { DynamoContentIndex, DynamoFacetIndex, partsOf } from '../src/adapters/aws.js';
import {
  InMemoryContentIndex,
  InMemoryFacetIndex,
  InMemoryLinkGraph,
  InMemoryNoteCatalog,
  InMemoryProjectedVersions,
  InMemoryStructureProjection,
} from '../src/adapters/memory.js';
import { dispatch } from '../src/adapters/dispatch.js';
import { parseEvent } from '@memorysmith/contracts';
import {
  ProjectNote,
  ProjectStructure,
  type ContentReader,
} from '../src/application/projections.js';
import {
  Backlinks,
  GetFacetStats,
  RelatedNotes,
  SearchNotes,
  NotebookGraphQuery,
  NotebookHealth,
} from '../src/application/queries.js';

const NOTEBOOK = 'notebook-1';

describe('LinkExtractor: a target is a name', () => {
  it('reads both link forms, and only the Markdown one is touched', () => {
    // RN-DSC-043: a wikilink target is literal. The three tolerances — the
    // path, the extension, the percent escapes — belong to the other form.
    const links = extractLinks('Ver [[Lei 14.133]] e [o achado](../achados/Achado%2012.md).');
    expect(links.map((link) => link.name)).toEqual(['Lei 14.133', 'Achado 12']);
  });

  it('ignores path segments in the Markdown form deliberately', () => {
    // RN-DSC-001: the edge is between notes, not folders. Honouring the path
    // would break the link the moment the note changed folder.
    const links = extractLinks('[x](../../normas/2026/Lei%2014.133.md)');
    expect(links[0]?.name).toBe('Lei 14.133');
  });

  it('keeps a slash inside a wikilink, because a folder is not identity', () => {
    // The same characters, read literally: `Decisões/Índice` is a lookup for
    // a name that carries a slash.
    expect(extractLinks('[[Decisões/Índice]]')[0]?.name).toBe('Decisões/Índice');
    expect(extractLinks('[[Lei 14.133.md]]')[0]?.name).toBe('Lei 14.133.md');
  });

  it('drops the anchor from resolution and keeps it for display', () => {
    const links = extractLinks('[art](Lei%2014.133.md#Article%2075)');
    expect(links[0]?.name).toBe('Lei 14.133');
    expect(links[0]?.anchor).toBe('Article 75');
    // Literal in the wikilink, decoded in the Markdown form.
    expect(extractLinks('[[Lei 14.133#Article 75]]')[0]?.anchor).toBe('Article 75');
  });

  it('splits the anchor before decoding, so an encoded hash is not a delimiter', () => {
    // The order of the tolerances is normative: decoding first would split at
    // a `#` its author encoded precisely so it would not be one.
    expect(extractLinks('[x](C%23%20basics)')[0]).toEqual({
      name: 'C# basics',
      anchor: null,
      raw: 'C%23%20basics',
    });
  });

  it('leaves a malformed escape exactly as written, and never throws', () => {
    expect(extractLinks('[half](50%)')[0]?.name).toBe('50%');
  });

  it('treats a link with a scheme or host as external', () => {
    const links = extractLinks('[fora](https://example.com/x.md) e [mail](mailto:a@b.c)');
    expect(links).toHaveLength(0);
  });

  it('ignores links inside code blocks, which are examples', () => {
    const links = extractLinks('```\n[[nao-e-link]]\n```\nMas [[e-link]] conta.');
    expect(links.map((link) => link.name)).toEqual(['e-link']);
  });

  it('reads a wikilink with an alias, and the pipe never changes the target', () => {
    expect(extractLinks('[[Lei 14.133|a nova lei]]')[0]?.name).toBe('Lei 14.133');
  });
});

describe('FacetExtractor: classification by the shape of the value', () => {
  it('reads only the frontmatter block', () => {
    const facets = extractFacets('---\nmaturity: growing\n---\n\nmaturity: no corpo nao conta');
    expect(Object.keys(facets)).toEqual(['maturity']);
    expect(facets['maturity']?.values).toEqual(['growing']);
  });

  it('recognizes dates, booleans, short values and lists', () => {
    const facets = extractFacets(
      [
        '---',
        'created: 2026-03-12',
        'reviewed: true',
        'type: evidence',
        'tags: [alpha, beta]',
        '---',
      ].join('\n'),
    );
    expect(facets['created']?.kind).toBe('date');
    expect(facets['reviewed']?.kind).toBe('boolean');
    expect(facets['type']?.kind).toBe('enum');
    expect(facets['tags']?.kind).toBe('list');
    expect(facets['tags']?.values).toEqual(['alpha', 'beta']);
  });

  it('discards free text, which is not a category', () => {
    const long = 'x'.repeat(120);
    const facets = extractFacets(`---\nsummary: ${long}\ntype: nota\n---`);
    expect(facets['summary']).toBeUndefined();
    expect(facets['type']).toBeDefined();
  });

  it('reads a dash list too', () => {
    const facets = extractFacets('---\ntags:\n  - alpha\n  - beta\n---');
    expect(facets['tags']?.values).toEqual(['alpha', 'beta']);
  });

  it('classifies an inline list of one item as a list', () => {
    const facets = extractFacets('---\ntags: [contracts]\n---');
    expect(facets['tags']?.kind).toBe('list');
    expect(facets['tags']?.values).toEqual(['contracts']);
  });

  it('classifies a dash list of one item as a list', () => {
    const facets = extractFacets('---\ntags:\n  - contracts\n---');
    expect(facets['tags']?.kind).toBe('list');
  });

  it('keeps a scalar an enum, because the written form decides and not the count', () => {
    expect(extractFacets('---\ntags: contracts\n---')['tags']?.kind).toBe('enum');
  });

  it('does not change the kind of an attribute when a second value arrives', () => {
    const one = extractFacets('---\ntags: [contracts]\n---')['tags']?.kind;
    const two = extractFacets('---\ntags: [contracts, budget]\n---')['tags']?.kind;
    expect(one).toBe(two);
  });

  it('still discards a list whose items are prose', () => {
    const long = 'x'.repeat(41);
    expect(extractFacets(`---\nnotes: [${long}]\n---`)['notes']).toBeUndefined();
  });

  it('computes the delta between two portraits', () => {
    const before = extractFacets('---\nmaturity: seed\n---');
    const after = extractFacets('---\nmaturity: evergreen\n---');
    const delta = facetDelta(before, after);
    expect(delta).toEqual([
      { facet: 'maturity', value: 'seed', kind: 'enum', delta: -1 },
      { facet: 'maturity', value: 'evergreen', kind: 'enum', delta: 1 },
    ]);
  });
});

describe('The projections, driven by events', () => {
  let graph: InMemoryLinkGraph;
  let facets: InMemoryFacetIndex;
  let index: InMemoryContentIndex;
  let structure: InMemoryStructureProjection;
  let catalog: InMemoryNoteCatalog;
  let content: Map<string, string>;
  let project: ProjectNote;

  const reader: ContentReader = {
    read: async (ref) => content.get(`${ref.contentId}#${ref.versionId}`) ?? '',
  };

  beforeEach(async () => {
    graph = new InMemoryLinkGraph();
    facets = new InMemoryFacetIndex();
    index = new InMemoryContentIndex();
    structure = new InMemoryStructureProjection();
    catalog = new InMemoryNoteCatalog();
    content = new Map();
    project = new ProjectNote({
      graph,
      facets,
      index,
      structure,
      content: reader,
      versions: new InMemoryProjectedVersions(),
    });

    const structureProjector = new ProjectStructure(structure);
    await structureProjector.onNotebook(NOTEBOOK, 'Normas e Legislacao');
    await structureProjector.onFolder(NOTEBOOK, {
      folderId: 'f1',
      name: 'Normas',
      description: 'Texto normativo por artigo',
      parentFolderId: null,
    });
  });

  /**
   * The name is not passed in: the projector reads it from the markdown, the
   * way the write did (RN-KNW-035). A note that is meant to be findable by
   * name says its name in its content, which is what a real one does.
   */
  async function write(input: { noteId: string; markdown: string }): Promise<void> {
    const ref = { contentId: `c-${input.noteId}`, versionId: `v-${content.size + 1}` };
    content.set(`${ref.contentId}#${ref.versionId}`, input.markdown);
    await project.onWritten({
      notebookId: NOTEBOOK,
      noteId: input.noteId,
      folderId: 'f1',
      contentRef: ref,
    });
  }

  it('resolves a pending link when the target note is finally created', async () => {
    await write({ noteId: 'n1', markdown: '# Achado 12\n\nFundamento: [[Lei 14.133]].' });
    // The target does not exist yet, so the link waits instead of vanishing.
    expect(await graph.backlinks(NOTEBOOK, 'n2')).toHaveLength(0);
    expect(await graph.pending(NOTEBOOK)).toHaveLength(1);

    await write({ noteId: 'n2', markdown: '---\nname: Lei 14.133\n---\n' });

    const backlinks = await graph.backlinks(NOTEBOOK, 'n2');
    expect(backlinks.map((note) => note.noteId)).toEqual(['n1']);
    expect(await graph.pending(NOTEBOOK)).toHaveLength(0);
  });

  it('returns backlinks to pending when the target note is deleted', async () => {
    await write({ noteId: 'n2', markdown: '---\nname: Lei 14.133\n---\n' });
    await write({ noteId: 'n1', markdown: '# Achado 12\n\nFundamento: [[Lei 14.133]].' });
    expect(await graph.backlinks(NOTEBOOK, 'n2')).toHaveLength(1);

    await project.onDeleted({
      notebookId: NOTEBOOK,
      noteId: 'n2',
      folderId: 'f1',
      contentRef: null,
    });

    // RN-DSC-005: the edge is gone and the link is pending again.
    expect(await graph.backlinks(NOTEBOOK, 'n2')).toHaveLength(0);
    expect((await graph.pending(NOTEBOOK)).map((link) => link.targetName)).toEqual(['Lei 14.133']);
  });

  it('makes two edges out of one link when two notes carry the name', async () => {
    // RN-DSC-042: never the first one, because there is no order to appeal to.
    await write({ noteId: 'n1', markdown: '---\nname: Índice\n---\n\nUm.' });
    await write({ noteId: 'n2', markdown: '---\nname: Índice\n---\n\nOutro.' });
    await write({ noteId: 'n3', markdown: '# Achado\n\nVer [[Índice]].' });

    expect((await graph.backlinks(NOTEBOOK, 'n1')).map((note) => note.noteId)).toEqual(['n3']);
    expect((await graph.backlinks(NOTEBOOK, 'n2')).map((note) => note.noteId)).toEqual(['n3']);
  });

  it('lets an alias catch a target no name matched', async () => {
    // RN-DSC-052: the alias fills an empty, and only an empty.
    await write({ noteId: 'n1', markdown: '# Achado\n\nVer [[RPO]].' });
    expect(await graph.pending(NOTEBOOK)).toHaveLength(1);

    await write({
      noteId: 'n2',
      markdown: '---\naliases: [RPO]\n---\n\n# Recovery Point Objective\n',
    });

    expect((await graph.backlinks(NOTEBOOK, 'n2')).map((note) => note.noteId)).toEqual(['n1']);
    expect(await graph.pending(NOTEBOOK)).toHaveLength(0);
  });

  it('takes the edge back the day a note carries that name, and gives it again', async () => {
    // RN-DSC-053, the price of step 8: resolution is not monotonic. Writing a
    // note DESTROYS an edge in a third note, whose own bytes did not change.
    await write({ noteId: 'n1', markdown: '# Achado\n\nVer [[RPO]].' });
    await write({ noteId: 'n2', markdown: '---\naliases: [RPO]\n---\n\n# Objetivo de ponto\n' });
    expect((await graph.backlinks(NOTEBOOK, 'n2')).map((note) => note.noteId)).toEqual(['n1']);

    // A note named exactly RPO arrives, and the name wins.
    await write({ noteId: 'n3', markdown: '---\nname: RPO\n---\n\nA nota que se chama assim.' });
    expect(await graph.backlinks(NOTEBOOK, 'n2')).toHaveLength(0);
    expect((await graph.backlinks(NOTEBOOK, 'n3')).map((note) => note.noteId)).toEqual(['n1']);

    // And it goes back when that note is deleted, because the alias is still
    // there, waiting, in a note nobody touched either time.
    await project.onDeleted({
      notebookId: NOTEBOOK,
      noteId: 'n3',
      folderId: 'f1',
      contentRef: null,
    });
    expect((await graph.backlinks(NOTEBOOK, 'n2')).map((note) => note.noteId)).toEqual(['n1']);
  });

  it('never lets an alias take a link a name already matched', async () => {
    await write({ noteId: 'n1', markdown: '---\nname: Lei 14.133\n---\n\nA geral.' });
    await write({ noteId: 'n2', markdown: '---\naliases: [Lei 14.133]\n---\n\n# Outra nota\n' });
    await write({ noteId: 'n3', markdown: '# Achado\n\nVer [[Lei 14.133]].' });

    expect((await graph.backlinks(NOTEBOOK, 'n1')).map((note) => note.noteId)).toEqual(['n3']);
    expect(await graph.backlinks(NOTEBOOK, 'n2')).toHaveLength(0);
  });

  it('prunes everything in the origin notebook on a cross-notebook move', async () => {
    // RN-DSC-006: there is no link between notebooks.
    content.set('c1#v1', '# Nota\n\n[[outra]]');
    await project.onWritten({
      notebookId: NOTEBOOK,
      noteId: 'n1',
      folderId: 'f1',
      contentRef: { contentId: 'c1', versionId: 'v1' },
    });
    await structure.upsertNotebook('notebook-2', 'Outro');
    await structure.upsertFolder('notebook-2', {
      folderId: 'f9',
      name: 'Destino',
      description: 'Destino',
      parentFolderId: null,
    });

    await project.onMoved({
      notebookId: 'notebook-2',
      fromNotebookId: NOTEBOOK,
      noteId: 'n1',
      folderId: 'f9',
      contentRef: { contentId: 'c1', versionId: 'v1' },
    });

    expect(await graph.backlinks(NOTEBOOK, 'n1')).toHaveLength(0);
  });

  it('counts facets and withdraws the portrait when the note goes', async () => {
    await write({ noteId: 'n1', markdown: '---\nmaturity: seed\nreviewed: false\n---\n\n# Nota' });
    await write({ noteId: 'n2', markdown: '---\nmaturity: seed\nreviewed: true\n---\n\n# Outra' });

    const stats = await new GetFacetStats({ graph, facets, catalog, content: index }).execute({
      notebookId: NOTEBOOK,
    });
    expect(stats.ok).toBe(true);
    if (!stats.ok) return;
    const maturity = stats.value.facets.find((facet) => facet.facet === 'maturity');
    expect(maturity?.values).toEqual([{ value: 'seed', count: 2 }]);

    await project.onDeleted({
      notebookId: NOTEBOOK,
      noteId: 'n1',
      folderId: 'f1',
      contentRef: null,
    });
    const afterDeletion = await facets.notebookFacetStats(NOTEBOOK);
    expect(afterDeletion.facets.find((facet) => facet.facet === 'maturity')?.values).toEqual([
      { value: 'seed', count: 1 },
    ]);
  });

  it('drops an attribute that reveals itself as free text by cardinality', async () => {
    // RN-DSC-024: this is what keeps `source` from becoming a statistic,
    // without any exclusion list in the code.
    for (let index = 0; index < 45; index++) {
      await write({
        noteId: `n${index}`,
        markdown: `---\nsource: doc-${index}\nmaturity: seed\n---\n\n# Nota`,
      });
    }
    const stats = await facets.notebookFacetStats(NOTEBOOK);
    const source = stats.facets.find((facet) => facet.facet === 'source');
    expect(source?.discarded).toBe(true);
    expect(source?.values).toEqual([]);
    // The well-behaved attribute is untouched.
    expect(stats.facets.find((facet) => facet.facet === 'maturity')?.values).toEqual([
      { value: 'seed', count: 45 },
    ]);
  });
});

/**
 * #141: the projections follow the note whatever order its events arrive in.
 * Every event here goes through the contract and the dispatch the Lambda uses,
 * shaped as the relay publishes it: the move that emptied a note was hidden by
 * a test that built the event by hand, with a reference the real one lacked.
 */
describe('The projections follow the newest note, in any order', () => {
  const SUBSCRIPTION = '01JBQ2X0000000000000000SBS';
  const NB = '01JBQ2X00000000000000000NB';
  const OTHER_NB = '01JBQ2X0000000000000000NB2';
  const FOLDER = '01JBQ2X00000000000000000F1';
  const MOVED_TO = '01JBQ2X00000000000000000F2';
  const NOTE = '01JBQ2X00000000000000000N1';
  const CONTENT = '01JBQ2X00000000000000000C1';

  let index: InMemoryContentIndex;
  let graph: InMemoryLinkGraph;
  let facets: InMemoryFacetIndex;
  let structure: InMemoryStructureProjection;
  let bodies: Map<string, string>;
  let projectors: { note: ProjectNote; structure: ProjectStructure };

  beforeEach(async () => {
    index = new InMemoryContentIndex();
    graph = new InMemoryLinkGraph();
    facets = new InMemoryFacetIndex();
    structure = new InMemoryStructureProjection();
    bodies = new Map();
    projectors = {
      note: new ProjectNote({
        graph,
        facets,
        index,
        structure,
        versions: new InMemoryProjectedVersions(),
        content: { read: async (ref) => bodies.get(ref.versionId) ?? '' },
      }),
      structure: new ProjectStructure(structure),
    };
  });

  let sequence = 0;
  /** An envelope as the relay publishes it, through the same contract. */
  function envelope(
    type: string,
    payload: Record<string, unknown>,
    revision: string | null,
  ): ReturnType<typeof parseEvent> {
    sequence += 1;
    return parseEvent({
      eventId: `01JBQ2X0000000000000${String(sequence).padStart(6, '0')}`,
      type,
      occurredAt: '2026-09-16T10:00:00.000Z',
      subscriptionId: SUBSCRIPTION,
      subject: 'NOTE',
      subjectId: NOTE,
      authorship: { userId: 'user-1', agent: null, at: '2026-09-16T10:00:00.000Z' },
      contentRef: revision
        ? { contentId: CONTENT, versionId: revision, sha256: 'a'.repeat(64), bytes: 10 }
        : null,
      storageDelta: 0,
      payload,
    });
  }

  const written = (version: number, revision: string, text: string) => {
    bodies.set(
      revision,
      `---
name: Nota
---

${text}
`,
    );
    return envelope(
      version === 1 ? 'NoteCreated' : 'NoteUpdated',
      {
        notebookId: NB,
        noteId: NOTE,
        folderId: FOLDER,
        name: 'Nota',
        ...(version === 1 ? { position: 'a0' } : {}),
        version,
      },
      revision,
    );
  };

  const indexed = async (notebookId = NB) =>
    (await index.scanNotebook(notebookId)).find((note) => note.noteId === NOTE);

  it('finds a moved note by its words, in its new folder', async () => {
    await dispatch(projectors, written(1, 'v1', 'palavra rara'));
    await dispatch(
      projectors,
      envelope(
        'NoteMoved',
        {
          noteId: NOTE,
          fromNotebookId: NB,
          fromFolderId: FOLDER,
          toNotebookId: NB,
          toFolderId: MOVED_TO,
          position: 'a0',
          version: 2,
        },
        'v1',
      ),
    );

    const note = await indexed();
    expect(note?.folderId).toBe(MOVED_TO);
    expect(note?.normalized).toContain('palavra rara');
    expect(note?.name).toBe('nota');
  });

  it('keeps a note moved to another notebook findable there, and nowhere else', async () => {
    await dispatch(projectors, written(1, 'v1', 'palavra rara'));
    await dispatch(
      projectors,
      envelope(
        'NoteMoved',
        {
          noteId: NOTE,
          fromNotebookId: NB,
          fromFolderId: FOLDER,
          toNotebookId: OTHER_NB,
          toFolderId: MOVED_TO,
          position: 'a0',
          version: 2,
        },
        'v1',
      ),
    );

    expect(await indexed(NB)).toBeUndefined();
    expect((await indexed(OTHER_NB))?.normalized).toContain('palavra rara');
  });

  it('leaves the newer text in place when an older event arrives late', async () => {
    const older = written(2, 'v2', 'texto antigo');
    const newer = written(3, 'v3', 'texto novo');

    await dispatch(projectors, written(1, 'v1', 'primeiro'));
    await dispatch(projectors, newer);
    await dispatch(projectors, older);

    const note = await indexed();
    expect(note?.normalized).toContain('texto novo');
    expect(note?.normalized).not.toContain('antigo');
  });

  it('changes nothing when the same event is delivered twice', async () => {
    const event = written(1, 'v1', 'uma vez');
    await dispatch(projectors, event);
    bodies.set('v1', 'content changed behind the back of the projector');

    await dispatch(projectors, event);

    expect((await indexed())?.normalized).toContain('uma vez');
  });

  it('never projects a note again once it was deleted, whatever arrives after', async () => {
    await dispatch(projectors, written(1, 'v1', 'antes'));
    await dispatch(
      projectors,
      envelope('NoteDeleted', { notebookId: NB, noteId: NOTE, folderId: FOLDER, version: 3 }, null),
    );
    await dispatch(projectors, written(2, 'v2', 'atrasado'));

    expect(await indexed()).toBeUndefined();
  });
});

describe('Discovery queries', () => {
  let deps: {
    graph: InMemoryLinkGraph;
    facets: InMemoryFacetIndex;
    catalog: InMemoryNoteCatalog;
    content: InMemoryContentIndex;
  };

  beforeEach(async () => {
    const graph = new InMemoryLinkGraph();
    const notes = [
      {
        noteId: 'n1',
        name: 'Achado 12',
        aliases: [],
        folderId: 'f1',
        folderName: 'Achados',
      },
      {
        noteId: 'n2',
        name: 'Lei 14.133',
        aliases: [],
        folderId: 'f2',
        folderName: 'Normas',
      },
      {
        noteId: 'n3',
        name: 'Portaria 9',
        aliases: [],
        folderId: 'f2',
        folderName: 'Normas',
      },
      {
        noteId: 'n4',
        name: 'Nota solta',
        aliases: [],
        folderId: 'f1',
        folderName: 'Achados',
      },
    ];
    await graph.replaceOutgoing(NOTEBOOK, notes[1] as never, []);
    await graph.replaceOutgoing(NOTEBOOK, notes[2] as never, []);
    await graph.replaceOutgoing(NOTEBOOK, notes[0] as never, [
      { name: 'Lei 14.133', anchor: null },
      { name: 'Portaria 9', anchor: null },
    ]);
    await graph.replaceOutgoing(NOTEBOOK, notes[3] as never, []);

    const catalog = new InMemoryNoteCatalog();
    catalog.set(NOTEBOOK, notes);
    const content = new InMemoryContentIndex();
    /**
     * The body is what makes this a content search: `xpto010101` appears in
     * one note and nowhere else, in no name and in no facet.
     */
    const bodies: Record<string, string> = {
      n1: '# Achado 12\n\nO contrato passou do prazo. Ver a lei.',
      n2: '# Lei 14.133\n\n## Vigência\n\nArt. 75. Contratação direta com xpto010101.',
      n3: '# Portaria 9\n\nRegulamenta o prazo interno.',
      n4: '# Nota solta\n\nSem ligação com nada.',
    };
    for (const note of notes) {
      const body = bodies[note.noteId] ?? '';
      await content.replaceNote(NOTEBOOK, {
        noteId: note.noteId,
        name: normalize(note.name),
        folderId: note.folderId,
        folderName: normalize(note.folderName),
        sections: [...body.matchAll(/^#{1,6}\s+(.*)$/gm)].map((m) => normalize(m[1] ?? '')),
        normalized: normalize(body),
        original: body,
        facets: note.noteId === 'n2' ? { maturity: ['evergreen'] } : { maturity: ['seed'] },
      });
    }
    deps = { graph, catalog, facets: new InMemoryFacetIndex(), content };
  });

  it('walks the dependency tree with a depth cap', async () => {
    const tree = await new RelatedNotes(deps).execute({
      notebookId: NOTEBOOK,
      noteId: 'n1',
      depth: 2,
    });
    expect(tree.ok).toBe(true);
    if (!tree.ok) return;
    expect(tree.value.note.noteId).toBe('n1');
    expect(tree.value.children.map((child) => child.note.name).sort()).toEqual([
      'Lei 14.133',
      'Portaria 9',
    ]);
  });

  it('caps the depth at three even when more is asked for', async () => {
    const tree = await new RelatedNotes(deps).execute({
      notebookId: NOTEBOOK,
      noteId: 'n1',
      depth: 99,
    });
    expect(tree.ok).toBe(true);
  });

  it('lists who points at a note', async () => {
    const found = await new Backlinks(deps).execute({ notebookId: NOTEBOOK, noteId: 'n2' });
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.value.map((note) => note.noteId)).toEqual(['n1']);
  });

  it('draws the whole notebook as nodes and index pairs', async () => {
    const drawn = await new NotebookGraphQuery(deps).execute({ notebookId: NOTEBOOK });
    expect(drawn.ok).toBe(true);
    if (!drawn.ok) return;

    // Every edge indexes a node that is really there. A dangling index is the
    // one failure the drawing cannot survive.
    for (const [from, to] of drawn.value.edges) {
      expect(drawn.value.nodes[from]).toBeDefined();
      expect(drawn.value.nodes[to]).toBeDefined();
    }
    expect(drawn.value.nodes.map((note) => note.name)).toContain('Nota solta');
    expect(drawn.value.truncated).toBe(false);

    // The edge n1 -> n2 of the fixture survives the round trip as indexes.
    const n1 = drawn.value.nodes.findIndex((note) => note.noteId === 'n1');
    const n2 = drawn.value.nodes.findIndex((note) => note.noteId === 'n2');
    expect(drawn.value.edges).toContainEqual([n1, n2]);
  });

  it('hands each node the portrait of its own note, so the view can color by it', async () => {
    // The extractor classified by shape; nothing here knows what `maturity`
    // means. What the graph promises is only that the node carries what the
    // note says about itself, and `{}` when it says nothing.
    await deps.facets.replaceFacets(NOTEBOOK, 'n1', {
      maturity: { facet: 'maturity', kind: 'enum', values: ['seed'] },
      tags: { facet: 'tags', kind: 'list', values: ['contrato', 'prazo'] },
    });
    await deps.facets.replaceFacets(NOTEBOOK, 'n2', {
      maturity: { facet: 'maturity', kind: 'enum', values: ['evergreen'] },
    });

    const drawn = await new NotebookGraphQuery(deps).execute({ notebookId: NOTEBOOK });
    expect(drawn.ok).toBe(true);
    if (!drawn.ok) return;

    const byId = new Map(drawn.value.nodes.map((note) => [note.noteId, note]));
    expect(byId.get('n1')?.facets).toEqual({
      maturity: ['seed'],
      tags: ['contrato', 'prazo'],
    });
    expect(byId.get('n2')?.facets).toEqual({ maturity: ['evergreen'] });
    // A note with no frontmatter is drawn like any other, not left out.
    expect(byId.get('n4')?.facets).toEqual({});
  });

  it('draws one node per note and never one per name', async () => {
    // RN-DSC-047: two notes called `Índice` are two nodes, both labelled with
    // it, and a link into that name leaves one note as two edges. Collapsing
    // them would draw one and silently lose the other.
    const graph = new InMemoryLinkGraph();
    const both = [
      { noteId: 'i1', name: 'Índice', aliases: [], folderId: 'f1' },
      { noteId: 'i2', name: 'Índice', aliases: [], folderId: 'f2' },
    ];
    for (const note of both) await graph.replaceOutgoing(NOTEBOOK, note, []);
    await graph.replaceOutgoing(
      NOTEBOOK,
      { noteId: 'n9', name: 'Achado', aliases: [], folderId: 'f1' },
      [{ name: 'Índice', anchor: null }],
    );

    const drawn = await graph.wholeGraph(NOTEBOOK);
    expect(drawn.nodes.filter((node) => node.name === 'Índice')).toHaveLength(2);
    expect(drawn.edges).toHaveLength(2);
    expect(drawn.pending).toHaveLength(0);
    // And each of the two is reachable on its own, by its identifier.
    expect(new Set(drawn.edges.map(([, to]) => drawn.nodes[to]?.noteId))).toEqual(
      new Set(['i1', 'i2']),
    );
  });

  it('draws an edge found by alias like any other, and two aliases as two edges', async () => {
    const graph = new InMemoryLinkGraph();
    const holders = [
      { noteId: 'a1', name: 'Primeira', aliases: ['RPO'], folderId: 'f1' },
      { noteId: 'a2', name: 'Segunda', aliases: ['RPO'], folderId: 'f2' },
    ];
    for (const note of holders) await graph.replaceOutgoing(NOTEBOOK, note, []);
    await graph.replaceOutgoing(
      NOTEBOOK,
      { noteId: 'n9', name: 'Achado', aliases: [], folderId: 'f1' },
      [{ name: 'RPO', anchor: null }],
    );

    const drawn = await graph.wholeGraph(NOTEBOOK);
    // §5.4 makes no distinction between an edge found by a name and one found
    // by an alias, not even by counting.
    expect(drawn.edges).toHaveLength(2);
    expect(drawn.pending).toHaveLength(0);
  });

  it('keeps an unresolved link in the graph instead of dropping it', async () => {
    await deps.graph.replaceOutgoing(
      NOTEBOOK,
      { noteId: 'n9', name: 'Aponta para o futuro', aliases: [], folderId: 'f1' },
      [{ name: 'ainda-nao-existe', anchor: null }],
    );

    const drawn = await new NotebookGraphQuery(deps).execute({ notebookId: NOTEBOOK });
    expect(drawn.ok).toBe(true);
    if (!drawn.ok) return;

    const from = drawn.value.nodes.findIndex((note) => note.noteId === 'n9');
    expect(drawn.value.pending).toContainEqual({ from, targetName: 'ainda-nao-existe' });
  });

  it('reports broken links and orphan notes', async () => {
    const health = await new NotebookHealth(deps).execute({ notebookId: NOTEBOOK });
    expect(health.ok).toBe(true);
    if (!health.ok) return;
    expect(health.value.orphans.map((note) => note.name)).toEqual(['Nota solta']);
  });

  it('searches over the name', async () => {
    const found = await new SearchNotes(deps).execute({
      notebookId: NOTEBOOK,
      query: 'lei 14.133',
    });
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.value[0]?.note.noteId).toBe('n2');
    // The hit names the note, which is what an agent searching reads.
    expect(found.value[0]?.note.name).toBe('Lei 14.133');
  });

  it('refuses an interval over an attribute this notebook does not hold as a date', async () => {
    /**
     * Whether an attribute is a date is a fact about the NOTEBOOK, so it cannot
     * be decided while parsing and it is decided here, once, with the notebook in
     * hand (RN-DSC-034). It is refused rather than answered empty: an empty
     * result reads as "there is nothing filed under that", and this means "the
     * question has no answer", which is the difference between fixing the
     * query and doubting the notebook.
     */
    const refused = await new SearchNotes(deps).execute({
      notebookId: NOTEBOOK,
      query: 'maturity:>=evergreen',
    });

    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.error.message).toContain('maturity');
  });

  it('matches the text as written, punctuation included', async () => {
    /**
     * Deliberate: the match is a substring of what the author typed, so
     * `14.133` is found by `14.133` and not by `14133`. The previous search
     * ran over slugs, where `slugify` folded the dot between digits away; this
     * one runs over prose, and inventing separators the author did not write
     * would make the result impossible to explain.
     */
    const exact = await new SearchNotes(deps).execute({ notebookId: NOTEBOOK, query: '14.133' });
    expect(exact.ok && exact.value.map((hit) => hit.note.noteId)).toEqual(['n2']);

    const without = await new SearchNotes(deps).execute({ notebookId: NOTEBOOK, query: '14133' });
    expect(without.ok && without.value).toEqual([]);
  });

  it('finds a word that exists only in the body of one note', async () => {
    // The behaviour a notebook user expects: write a word, find the note.
    const found = await new SearchNotes(deps).execute({
      notebookId: NOTEBOOK,
      query: 'xpto010101',
    });
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.value.map((hit) => hit.note.noteId)).toEqual(['n2']);
  });

  it('cites the section the match fell under, and shows the passage', async () => {
    const found = await new SearchNotes(deps).execute({
      notebookId: NOTEBOOK,
      query: 'xpto010101',
    });
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.value[0]?.section).toBe(normalize('Vigência'));
    // The excerpt comes from the text as written, accents intact.
    expect(found.value[0]?.excerpt).toContain('xpto010101');
    expect(found.value[0]?.excerpt).toContain('Contratação');
  });

  it('narrows a body term with a facet the notebook declared', async () => {
    const withFacet = await new SearchNotes(deps).execute({
      notebookId: NOTEBOOK,
      query: 'prazo maturity:seed',
    });
    expect(withFacet.ok).toBe(true);
    if (!withFacet.ok) return;
    expect(withFacet.value.map((hit) => hit.note.noteId).sort()).toEqual(['n1', 'n3']);
  });

  it('excludes with a negation', async () => {
    const found = await new SearchNotes(deps).execute({
      notebookId: NOTEBOOK,
      query: 'prazo -portaria',
    });
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.value.map((hit) => hit.note.noteId)).toEqual(['n1']);
  });

  it('does not search the frontmatter as if it were prose', async () => {
    // RN-DSC-018: frontmatter belongs to the facet projector. If it leaked
    // into the body every note would match its own metadata.
    const found = await new SearchNotes(deps).execute({ notebookId: NOTEBOOK, query: 'maturity' });
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.value).toEqual([]);
  });

  it('refuses an empty query', async () => {
    const refused = await new SearchNotes(deps).execute({
      notebookId: NOTEBOOK,
      query: '   ',
    });
    expect(refused.ok).toBe(false);
  });
});

describe('A portrait is split into parts, and never read half', () => {
  /** A table that applies what the index writes and answers its queries. */
  function tableOf() {
    const rows = new Map<string, Record<string, unknown>>();
    const db = {
      send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
        const input = command.input;
        switch (command.constructor.name) {
          case 'PutCommand': {
            const item = input['Item'] as Record<string, unknown>;
            rows.set(String(item['SK']), item);
            return {};
          }
          case 'DeleteCommand':
            rows.delete(String((input['Key'] as { SK: string }).SK));
            return {};
          case 'BatchWriteCommand': {
            const requests = Object.values(input['RequestItems'] as object)[0] as Array<
              Record<string, { Item?: Record<string, unknown>; Key?: { SK: string } }>
            >;
            for (const request of requests) {
              if (request['PutRequest']?.Item) {
                rows.set(String(request['PutRequest'].Item['SK']), request['PutRequest'].Item);
              }
              if (request['DeleteRequest']?.Key) rows.delete(request['DeleteRequest'].Key.SK);
            }
            return {};
          }
          case 'QueryCommand': {
            const prefix = (input['ExpressionAttributeValues'] as Record<string, string>)[
              ':prefix'
            ];
            return {
              Items: [...rows.values()]
                .filter((item) => String(item['SK']).startsWith(prefix ?? ''))
                .sort((a, b) => String(a['SK']).localeCompare(String(b['SK']))),
            };
          }
          default:
            throw new Error(`Unexpected command ${command.constructor.name}`);
        }
      },
    };
    return { rows, index: new DynamoContentIndex({ value: 'SUB' } as never, db as never, 't') };
  }

  const portrait = (noteId: string, body: string) => ({
    noteId,
    name: 'nota',
    folderId: 'f1',
    folderName: 'pasta',
    sections: [],
    normalized: normalize(body),
    original: body,
    facets: {},
  });

  it('cuts a body into parts that join back into the body, surrogate pairs whole', () => {
    const body = `${'a'.repeat(9)}😀${'b'.repeat(10)}`;
    const parts = partsOf(body, 10);
    expect(parts.join('')).toBe(body);
    for (const part of parts) expect(part.length).toBeLessThanOrEqual(10);
  });

  it('reads back a body of many parts whole, and drops the parts it replaced', async () => {
    const { rows, index } = tableOf();
    const large = 'palavra '.repeat(40_000);
    await index.replaceNote(NOTEBOOK, portrait('n1', large));
    await index.replaceNote(NOTEBOOK, portrait('n1', `${large}fim`));

    const [read] = await index.scanNotebook(NOTEBOOK);
    expect(read?.original).toBe(`${large}fim`);
    const generations = new Set(
      [...rows.keys()].filter((sk) => sk.startsWith('TEXT#n1#')).map((sk) => sk.split('#')[2]),
    );
    expect(generations.size).toBe(1);
  });

  it('never answers a note whose parts are not all there', async () => {
    const { rows, index } = tableOf();
    await index.replaceNote(NOTEBOOK, portrait('n1', 'palavra '.repeat(40_000)));
    const one = [...rows.keys()].find((sk) => sk.startsWith('TEXT#n1#'));
    rows.delete(one ?? '');

    expect(await index.scanNotebook(NOTEBOOK)).toEqual([]);
  });

  it('removes every part of a note', async () => {
    const { rows, index } = tableOf();
    await index.replaceNote(NOTEBOOK, portrait('n1', 'palavra '.repeat(40_000)));
    await index.removeNote(NOTEBOOK, 'n1');
    expect(rows.size).toBe(0);
  });
});

describe('The scan walks every page, which is the whole correctness of it', () => {
  /**
   * The search this one replaced answered from the first megabyte of a Query
   * and dropped the rest without a word. In a notebook at the declared ceiling
   * that meant deciding over a fraction of the content while looking exactly
   * like a search that had read all of it.
   *
   * A fake DynamoDB that hands back pages proves the adapter keeps asking.
   */
  it('keeps following LastEvaluatedKey until the notebook is exhausted', async () => {
    const PAGES = 9;
    const perPage = 40;
    let sent = 0;

    const db = {
      send: async (command: { input: Record<string, unknown> }) => {
        const start = (command.input['ExclusiveStartKey'] as { at?: number } | undefined)?.at ?? 0;
        sent++;
        const page = Array.from({ length: perPage }, (_, offset) => ({
          noteId: `n${start + offset}`,
          name: 'nota',
          folderId: 'f1',
          folderName: 'pasta',
          sections: [],
          normalized: 'corpo',
          original: 'corpo',
          facets: {},
        }));
        const next = start + perPage;
        return {
          Items: page,
          ...(next < PAGES * perPage ? { LastEvaluatedKey: { at: next } } : {}),
        };
      },
    };

    const index = new DynamoContentIndex(
      { value: '01JBQ2X0000000000000000000' } as never,
      db as never,
      'mv-discovery',
    );

    const notes = await index.scanNotebook(NOTEBOOK);

    expect(sent).toBe(PAGES);
    expect(notes).toHaveLength(PAGES * perPage);
    // The last note of the last page is present: nothing was cut short.
    expect(notes[notes.length - 1]?.noteId).toBe(`n${PAGES * perPage - 1}`);
  });
});

describe('The facet projection writes every counter and reads every page', () => {
  const SUBSCRIPTION = { value: '01JBQ2X0000000000000000000' } as never;
  const TABLE = 'mv-discovery';

  /** A fake DynamoDB that tells the three commands apart by their input. */
  function fakeDb(pages: Array<Record<string, unknown>[]> = [[]]) {
    const transactions: Array<Record<string, unknown>[]> = [];
    let queried = 0;
    const db = {
      send: async (command: { input: Record<string, unknown> }) => {
        const input = command.input;
        if (input['TransactItems']) {
          transactions.push(input['TransactItems'] as Record<string, unknown>[]);
          return {};
        }
        if (input['KeyConditionExpression']) {
          const at = (input['ExclusiveStartKey'] as { at?: number } | undefined)?.at ?? 0;
          queried++;
          return {
            Items: pages[at] ?? [],
            ...(at + 1 < pages.length ? { LastEvaluatedKey: { at: at + 1 } } : {}),
          };
        }
        return { Item: undefined }; // the GetCommand for the previous portrait
      },
    };
    return { db, transactions, pages: () => queried };
  }

  it('splits the counters across transactions instead of dropping the tail', async () => {
    // A TransactWriteItems carries 100 items. The adapter used to send the
    // portrait plus the first 90 deltas and discard the rest in silence, and
    // the loss was permanent: the next write of that note computes its delta
    // against the portrait already stored and finds nothing owing.
    const VALUES = 250;
    const { db, transactions } = fakeDb();
    const index = new DynamoFacetIndex(SUBSCRIPTION, db as never, TABLE);

    await index.replaceFacets(NOTEBOOK, 'note-1', {
      tags: {
        facet: 'tags',
        kind: 'list',
        values: Array.from({ length: VALUES }, (_, at) => `t${at}`),
      },
    });

    for (const batch of transactions) expect(batch.length).toBeLessThanOrEqual(100);
    const puts = transactions.flat().filter((item) => 'Put' in item);
    const updates = transactions.flat().filter((item) => 'Update' in item);
    expect(puts).toHaveLength(1); // one portrait, in the first transaction
    expect(transactions[0]?.[0]).toBe(puts[0]);
    expect(updates).toHaveLength(VALUES); // and every counter it moved
    const touched = new Set(
      updates.map((item) => String((item as { Update: { Key: { SK: string } } }).Update.Key.SK)),
    );
    expect(touched.size).toBe(VALUES);
    expect(touched.has(`STAT#tags#t${VALUES - 1}`)).toBe(true);
  });

  it('reads the portrait of every note, not of the first page', async () => {
    // The graph colours a note by the portrait this query returns. A first
    // page answer would paint an attribute on the notes that fitted and leave
    // the others bare, which reads as a notebook where half the notes forgot
    // their own frontmatter.
    const pages = [
      [{ noteId: 'n1', facets: { type: { facet: 'type', kind: 'enum', values: ['nota'] } } }],
      [{ noteId: 'n2', facets: { type: { facet: 'type', kind: 'enum', values: ['guia'] } } }],
      [{ noteId: 'n3', facets: { type: { facet: 'type', kind: 'enum', values: ['guia'] } } }],
    ];
    const { db, pages: queried } = fakeDb(pages);
    const index = new DynamoFacetIndex(SUBSCRIPTION, db as never, TABLE);

    const portraits = await index.notebookNoteFacets(NOTEBOOK);

    expect(queried()).toBe(3);
    expect([...portraits.keys()]).toEqual(['n1', 'n2', 'n3']);
    expect(portraits.get('n3')?.['type']).toEqual(['guia']);
  });
});

describe('The facet projection tries again a transaction DynamoDB cancelled', () => {
  const SUBSCRIPTION = { value: '01JBQ2X0000000000000000000' } as never;
  const TABLE = 'mv-discovery';

  interface Portrait {
    ConditionExpression: string;
    ExpressionAttributeValues?: Record<string, unknown>;
    Item: Record<string, unknown>;
  }

  /**
   * A table holding at most one portrait, whose first `refusals` transactions
   * are cancelled the way DynamoDB cancels one whose item another transaction
   * holds in flight.
   */
  function contendedDb(refusals: number, stored?: Record<string, unknown>) {
    const reads: Record<string, unknown>[] = [];
    const transactions: Record<string, unknown>[][] = [];
    const pauses: number[] = [];
    const db = {
      send: async (command: { input: Record<string, unknown> }) => {
        const input = command.input;
        if (input['TransactItems']) {
          transactions.push(input['TransactItems'] as Record<string, unknown>[]);
          if (transactions.length <= refusals) {
            throw Object.assign(new Error('Transaction cancelled [TransactionConflict]'), {
              name: 'TransactionCanceledException',
            });
          }
          return {};
        }
        if (input['KeyConditionExpression']) return { Items: [] };
        reads.push(input);
        return { Item: stored };
      },
    };
    const index = new DynamoFacetIndex(SUBSCRIPTION, db as never, TABLE, async (milliseconds) => {
      pauses.push(milliseconds);
    });
    const portraitOf = (at: number) =>
      (transactions[at]?.[0] as { Put: Portrait } | undefined)?.Put;
    return { index, reads, transactions, pauses, portraitOf };
  }

  it('reads the portrait again and writes once the transaction goes through', async () => {
    // Two notes sharing a value move one counter, and staging cancelled one of
    // their transactions: the projector failed its whole batch, and every note
    // in it waited the six minutes of the queue to be projected again.
    const { index, reads, transactions, pauses, portraitOf } = contendedDb(2);

    await index.replaceFacets(NOTEBOOK, 'note-1', {
      maturity: { facet: 'maturity', kind: 'enum', values: ['growing'] },
    });

    expect(transactions).toHaveLength(3);
    expect(pauses).toHaveLength(2);
    expect(reads).toHaveLength(3);
    for (const read of reads) expect(read['ConsistentRead']).toBe(true);
    expect(portraitOf(2)?.ConditionExpression).toBe('attribute_not_exists(SK)');
    expect(portraitOf(2)?.Item['revision']).toBe(1);
  });

  it('writes a portrait only over the revision it read', async () => {
    const { index, transactions, portraitOf } = contendedDb(0, {
      facets: { maturity: { facet: 'maturity', kind: 'enum', values: ['growing'] } },
      revision: 3,
    });

    await index.replaceFacets(NOTEBOOK, 'note-1', {
      maturity: { facet: 'maturity', kind: 'enum', values: ['evergreen'] },
    });

    expect(portraitOf(0)?.ConditionExpression).toBe('#revision = :revision');
    expect(portraitOf(0)?.ExpressionAttributeValues?.[':revision']).toBe(3);
    expect(portraitOf(0)?.Item['revision']).toBe(4);
    // The portrait, growing counted down and evergreen counted up.
    expect(transactions[0]).toHaveLength(3);
  });

  it('fails once the transaction is still cancelled at the last attempt', async () => {
    const { index, transactions, pauses } = contendedDb(Number.POSITIVE_INFINITY);

    await expect(
      index.replaceFacets(NOTEBOOK, 'note-1', {
        maturity: { facet: 'maturity', kind: 'enum', values: ['growing'] },
      }),
    ).rejects.toMatchObject({ name: 'TransactionCanceledException' });
    expect(transactions).toHaveLength(5);
    expect(pauses).toHaveLength(4);
  });
});
