import { beforeEach, describe, expect, it } from 'vitest';
import { extractLinks } from '../src/domain/LinkExtractor.js';
import { chunkNote } from '../src/domain/Chunker.js';
import { extractFacets, facetDelta } from '../src/domain/FacetExtractor.js';
import {
  FakeEmbedder,
  InMemoryFacetIndex,
  InMemoryLinkGraph,
  InMemoryNoteCatalog,
  InMemoryStructureProjection,
  InMemoryVectorIndex,
} from '../src/adapters/memory.js';
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
  VaultGraphQuery,
  VaultHealth,
} from '../src/application/queries.js';

const VAULT = 'vault-1';

describe('LinkExtractor: universal syntax only', () => {
  it('reads both link forms and normalizes the target', () => {
    const links = extractLinks('Ver [[Lei 14.133]] e [o achado](../achados/achado-12.md).');
    expect(links.map((link) => link.slug)).toEqual(['lei-14133', 'achado-12']);
  });

  it('ignores path segments deliberately', () => {
    // RN-DSC-001: the edge is between notes, not folders. Honouring the path
    // would break the link the moment the note changed folder.
    const links = extractLinks('[x](../../normas/2026/lei-14133.md)');
    expect(links[0]?.slug).toBe('lei-14133');
  });

  it('drops the anchor from resolution and keeps it for display', () => {
    const links = extractLinks('[art](lei-14133.md#art-75)');
    expect(links[0]?.slug).toBe('lei-14133');
    expect(links[0]?.anchor).toBe('art-75');
  });

  it('treats a link with a scheme or host as external', () => {
    const links = extractLinks('[fora](https://example.com/x.md) e [mail](mailto:a@b.c)');
    expect(links).toHaveLength(0);
  });

  it('ignores links inside code blocks, which are examples', () => {
    const links = extractLinks('```\n[[nao-e-link]]\n```\nMas [[e-link]] conta.');
    expect(links.map((link) => link.slug)).toEqual(['e-link']);
  });

  it('reads a wikilink with an alias', () => {
    expect(extractLinks('[[lei-14133|a nova lei]]')[0]?.slug).toBe('lei-14133');
  });
});

describe('Chunker: the context prefix is what decides quality', () => {
  const context = {
    vaultName: 'Pesquisa de Produto',
    folderPath: ['Evidence'],
    folderDescription: 'Fatos observados em campo',
    noteTitle: 'Capacities de ativo customizado',
  };

  it('cuts at headings and prefixes each chunk with where it came from', () => {
    const chunks = chunkNote(
      '# Contexto\n\nO limite e 200 por conta.\n\n## Consequencia\n\nPrecisa de fila.',
      context,
    );
    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.section).toBe('Contexto');
    // The loose chunk would be unrecoverable; the prefixed one is findable.
    expect(chunks[0]?.embedded).toContain(
      'Pesquisa de Produto > Evidence > Fatos observados em campo > Capacities de ativo customizado > Contexto',
    );
    expect(chunks[0]?.text).toBe('O limite e 200 por conta.');
  });

  it('drops the frontmatter, which is the facet projector business', () => {
    const chunks = chunkNote('---\nmaturity: seed\n---\n\n# T\n\nCorpo.', context);
    expect(chunks[0]?.text).not.toContain('maturity');
  });

  it('gives an empty note one chunk, because its title is content', () => {
    const chunks = chunkNote('', context);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.embedded).toContain('Capacities de ativo customizado');
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
  let vectors: InMemoryVectorIndex;
  let facets: InMemoryFacetIndex;
  let structure: InMemoryStructureProjection;
  let catalog: InMemoryNoteCatalog;
  let content: Map<string, string>;
  let project: ProjectNote;

  const reader: ContentReader = {
    read: async (ref) => content.get(`${ref.contentId}#${ref.versionId}`) ?? '',
  };

  beforeEach(async () => {
    graph = new InMemoryLinkGraph();
    vectors = new InMemoryVectorIndex();
    facets = new InMemoryFacetIndex();
    structure = new InMemoryStructureProjection();
    catalog = new InMemoryNoteCatalog();
    content = new Map();
    project = new ProjectNote({
      graph,
      vectors,
      facets,
      structure,
      content: reader,
      embedder: new FakeEmbedder(),
    });

    const structureProjector = new ProjectStructure(structure);
    await structureProjector.onVault(VAULT, 'Normas e Legislacao');
    await structureProjector.onFolder(VAULT, {
      folderId: 'f1',
      name: 'Normas',
      description: 'Texto normativo por artigo',
      parentFolderId: null,
    });
  });

  async function write(input: {
    noteId: string;
    title: string;
    slug: string;
    markdown: string;
  }): Promise<void> {
    const ref = { contentId: `c-${input.noteId}`, versionId: `v-${content.size + 1}` };
    content.set(`${ref.contentId}#${ref.versionId}`, input.markdown);
    await project.onWritten({
      vaultId: VAULT,
      noteId: input.noteId,
      folderId: 'f1',
      title: input.title,
      slug: input.slug,
      contentRef: ref,
    });
  }

  it('resolves a pending link when the target note is finally created', async () => {
    await write({
      noteId: 'n1',
      title: 'Achado 12',
      slug: 'achado-12',
      markdown: 'Fundamento: [[lei-14133]].',
    });
    // The target does not exist yet, so the link waits instead of vanishing.
    expect(await graph.backlinks(VAULT, 'n2')).toHaveLength(0);
    expect(await graph.broken(VAULT)).toHaveLength(1);

    await write({ noteId: 'n2', title: 'Lei 14.133', slug: 'lei-14133', markdown: '# Lei' });

    const backlinks = await graph.backlinks(VAULT, 'n2');
    expect(backlinks.map((note) => note.noteId)).toEqual(['n1']);
    expect(await graph.broken(VAULT)).toHaveLength(0);
  });

  it('returns backlinks to pending when the target note is deleted', async () => {
    await write({ noteId: 'n2', title: 'Lei 14.133', slug: 'lei-14133', markdown: '# Lei' });
    await write({
      noteId: 'n1',
      title: 'Achado 12',
      slug: 'achado-12',
      markdown: 'Fundamento: [[lei-14133]].',
    });
    expect(await graph.backlinks(VAULT, 'n2')).toHaveLength(1);

    await project.onDeleted({
      vaultId: VAULT,
      noteId: 'n2',
      folderId: 'f1',
      title: 'Lei 14.133',
      slug: 'lei-14133',
      contentRef: null,
    });

    // RN-DSC-005: the edge is gone and the link is pending again.
    expect(await graph.backlinks(VAULT, 'n2')).toHaveLength(0);
    expect((await graph.broken(VAULT)).map((link) => link.targetSlug)).toEqual(['lei-14133']);
  });

  it('takes the vectors of a deleted note out immediately', async () => {
    // RN-DSC-013: what leaves the listing leaves the search, because content
    // that was deleted and keeps being returned is a privacy problem.
    await write({ noteId: 'n1', title: 'Lei', slug: 'lei', markdown: '# Lei\n\nArt. 75.' });
    const before = await new SearchNotes({
      graph,
      vectors,
      facets,
      catalog,
      embedder: new FakeEmbedder(),
    }).execute({ vaultId: VAULT, query: 'Art. 75', mode: 'semantic' });
    expect(before.ok && before.value.length).toBeGreaterThan(0);

    await project.onDeleted({
      vaultId: VAULT,
      noteId: 'n1',
      folderId: 'f1',
      title: 'Lei',
      slug: 'lei',
      contentRef: null,
    });
    const after = await new SearchNotes({
      graph,
      vectors,
      facets,
      catalog,
      embedder: new FakeEmbedder(),
    }).execute({ vaultId: VAULT, query: 'Art. 75', mode: 'semantic' });
    expect(after.ok && after.value).toEqual([]);
  });

  it('re-embeds only the chunks whose hash changed', async () => {
    let embeddedTexts = 0;
    const counting = {
      embed: async (texts: string[]) => {
        embeddedTexts += texts.length;
        return new FakeEmbedder().embed(texts);
      },
    };
    const projector = new ProjectNote({
      graph,
      vectors,
      facets,
      structure,
      content: reader,
      embedder: counting,
    });

    const first = { contentId: 'c1', versionId: 'v1' };
    content.set('c1#v1', '# A\n\nUm.\n\n# B\n\nDois.');
    await projector.onWritten({
      vaultId: VAULT,
      noteId: 'n1',
      folderId: 'f1',
      title: 'Nota',
      slug: 'nota',
      contentRef: first,
    });
    expect(embeddedTexts).toBe(2);

    // Only the second section changed.
    content.set('c1#v2', '# A\n\nUm.\n\n# B\n\nDois, revisado.');
    await projector.onWritten({
      vaultId: VAULT,
      noteId: 'n1',
      folderId: 'f1',
      title: 'Nota',
      slug: 'nota',
      contentRef: { contentId: 'c1', versionId: 'v2' },
    });
    expect(embeddedTexts).toBe(3);
  });

  it('reindexes a note that moved folder, because the prefix changed', async () => {
    // RN-DSC-012: the folder is part of the embedded text, so a move
    // invalidates the vectors even though the words did not change.
    await structure.upsertFolder(VAULT, {
      folderId: 'f2',
      name: 'Achados',
      description: 'Achados de auditoria',
      parentFolderId: null,
    });
    content.set('c1#v1', '# Nota\n\nCorpo.');
    await project.onWritten({
      vaultId: VAULT,
      noteId: 'n1',
      folderId: 'f1',
      title: 'Nota',
      slug: 'nota',
      contentRef: { contentId: 'c1', versionId: 'v1' },
    });
    const before = await vectors.hashesOf(VAULT, 'n1');

    await project.onMoved({
      vaultId: VAULT,
      fromVaultId: VAULT,
      noteId: 'n1',
      folderId: 'f2',
      title: 'Nota',
      slug: 'nota',
      contentRef: { contentId: 'c1', versionId: 'v1' },
    });
    const after = await vectors.hashesOf(VAULT, 'n1');
    expect(after.get(0)).not.toBe(before.get(0));
  });

  it('prunes everything in the origin vault on a cross-vault move', async () => {
    // RN-DSC-006: there is no link between vaults.
    content.set('c1#v1', '# Nota\n\n[[outra]]');
    await project.onWritten({
      vaultId: VAULT,
      noteId: 'n1',
      folderId: 'f1',
      title: 'Nota',
      slug: 'nota',
      contentRef: { contentId: 'c1', versionId: 'v1' },
    });
    await structure.upsertVault('vault-2', 'Outro');
    await structure.upsertFolder('vault-2', {
      folderId: 'f9',
      name: 'Destino',
      description: 'Destino',
      parentFolderId: null,
    });

    await project.onMoved({
      vaultId: 'vault-2',
      fromVaultId: VAULT,
      noteId: 'n1',
      folderId: 'f9',
      title: 'Nota',
      slug: 'nota',
      contentRef: { contentId: 'c1', versionId: 'v1' },
    });

    expect(await graph.backlinks(VAULT, 'n1')).toHaveLength(0);
    expect(await vectors.hashesOf(VAULT, 'n1')).toEqual(new Map());
    expect((await vectors.hashesOf('vault-2', 'n1')).size).toBeGreaterThan(0);
  });

  it('counts facets and withdraws the portrait when the note goes', async () => {
    await write({
      noteId: 'n1',
      title: 'Nota',
      slug: 'nota',
      markdown: '---\nmaturity: seed\nreviewed: false\n---\n\n# Nota',
    });
    await write({
      noteId: 'n2',
      title: 'Outra',
      slug: 'outra',
      markdown: '---\nmaturity: seed\nreviewed: true\n---\n\n# Outra',
    });

    const stats = await new GetFacetStats({
      graph,
      vectors,
      facets,
      catalog,
      embedder: new FakeEmbedder(),
    }).execute({ vaultId: VAULT });
    expect(stats.ok).toBe(true);
    if (!stats.ok) return;
    const maturity = stats.value.facets.find((facet) => facet.facet === 'maturity');
    expect(maturity?.values).toEqual([{ value: 'seed', count: 2 }]);

    await project.onDeleted({
      vaultId: VAULT,
      noteId: 'n1',
      folderId: 'f1',
      title: 'Nota',
      slug: 'nota',
      contentRef: null,
    });
    const afterDeletion = await facets.vaultFacetStats(VAULT);
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
        title: `Nota ${index}`,
        slug: `nota-${index}`,
        markdown: `---\nsource: doc-${index}\nmaturity: seed\n---\n\n# Nota`,
      });
    }
    const stats = await facets.vaultFacetStats(VAULT);
    const source = stats.facets.find((facet) => facet.facet === 'source');
    expect(source?.discarded).toBe(true);
    expect(source?.values).toEqual([]);
    // The well-behaved attribute is untouched.
    expect(stats.facets.find((facet) => facet.facet === 'maturity')?.values).toEqual([
      { value: 'seed', count: 45 },
    ]);
  });
});

describe('Discovery queries', () => {
  let deps: {
    graph: InMemoryLinkGraph;
    vectors: InMemoryVectorIndex;
    facets: InMemoryFacetIndex;
    catalog: InMemoryNoteCatalog;
    embedder: FakeEmbedder;
  };

  beforeEach(async () => {
    const graph = new InMemoryLinkGraph();
    const notes = [
      {
        noteId: 'n1',
        title: 'Achado 12',
        slug: 'achado-12',
        folderId: 'f1',
        folderName: 'Achados',
      },
      {
        noteId: 'n2',
        title: 'Lei 14.133',
        slug: 'lei-14133',
        folderId: 'f2',
        folderName: 'Normas',
      },
      {
        noteId: 'n3',
        title: 'Portaria 9',
        slug: 'portaria-9',
        folderId: 'f2',
        folderName: 'Normas',
      },
      {
        noteId: 'n4',
        title: 'Nota solta',
        slug: 'nota-solta',
        folderId: 'f1',
        folderName: 'Achados',
      },
    ];
    await graph.replaceOutgoing(VAULT, notes[1] as never, []);
    await graph.replaceOutgoing(VAULT, notes[2] as never, []);
    await graph.replaceOutgoing(VAULT, notes[0] as never, [
      { slug: 'lei-14133', anchor: null },
      { slug: 'portaria-9', anchor: null },
    ]);
    await graph.replaceOutgoing(VAULT, notes[3] as never, []);

    const catalog = new InMemoryNoteCatalog();
    catalog.set(VAULT, notes);
    deps = {
      graph,
      catalog,
      vectors: new InMemoryVectorIndex(),
      facets: new InMemoryFacetIndex(),
      embedder: new FakeEmbedder(),
    };
  });

  it('walks the dependency tree with a depth cap', async () => {
    const tree = await new RelatedNotes(deps).execute({ vaultId: VAULT, noteId: 'n1', depth: 2 });
    expect(tree.ok).toBe(true);
    if (!tree.ok) return;
    expect(tree.value.note.noteId).toBe('n1');
    expect(tree.value.children.map((child) => child.note.slug).sort()).toEqual([
      'lei-14133',
      'portaria-9',
    ]);
  });

  it('caps the depth at three even when more is asked for', async () => {
    const tree = await new RelatedNotes(deps).execute({ vaultId: VAULT, noteId: 'n1', depth: 99 });
    expect(tree.ok).toBe(true);
  });

  it('lists who points at a note', async () => {
    const found = await new Backlinks(deps).execute({ vaultId: VAULT, noteId: 'n2' });
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.value.map((note) => note.noteId)).toEqual(['n1']);
  });

  it('draws the whole vault as nodes and index pairs', async () => {
    const drawn = await new VaultGraphQuery(deps).execute({ vaultId: VAULT });
    expect(drawn.ok).toBe(true);
    if (!drawn.ok) return;

    // Every edge indexes a node that is really there. A dangling index is the
    // one failure the drawing cannot survive.
    for (const [from, to] of drawn.value.edges) {
      expect(drawn.value.nodes[from]).toBeDefined();
      expect(drawn.value.nodes[to]).toBeDefined();
    }
    expect(drawn.value.nodes.map((note) => note.slug)).toContain('nota-solta');
    expect(drawn.value.truncated).toBe(false);

    // The edge n1 -> n2 of the fixture survives the round trip as indexes.
    const n1 = drawn.value.nodes.findIndex((note) => note.noteId === 'n1');
    const n2 = drawn.value.nodes.findIndex((note) => note.noteId === 'n2');
    expect(drawn.value.edges).toContainEqual([n1, n2]);
  });

  it('keeps an unresolved link in the graph instead of dropping it', async () => {
    await deps.graph.replaceOutgoing(
      VAULT,
      { noteId: 'n9', title: 'Aponta para o futuro', slug: 'aponta', folderId: 'f1' },
      [{ slug: 'ainda-nao-existe', anchor: null }],
    );

    const drawn = await new VaultGraphQuery(deps).execute({ vaultId: VAULT });
    expect(drawn.ok).toBe(true);
    if (!drawn.ok) return;

    const from = drawn.value.nodes.findIndex((note) => note.noteId === 'n9');
    expect(drawn.value.pending).toContainEqual({ from, targetSlug: 'ainda-nao-existe' });
  });

  it('reports broken links and orphan notes', async () => {
    const health = await new VaultHealth(deps).execute({ vaultId: VAULT });
    expect(health.ok).toBe(true);
    if (!health.ok) return;
    expect(health.value.orphans.map((note) => note.slug)).toEqual(['nota-solta']);
  });

  it('searches lexically over title and folder', async () => {
    const found = await new SearchNotes(deps).execute({
      vaultId: VAULT,
      query: 'lei 14133',
      mode: 'lexical',
    });
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.value[0]?.noteId).toBe('n2');
  });

  it('refuses an empty query', async () => {
    const refused = await new SearchNotes(deps).execute({
      vaultId: VAULT,
      query: '   ',
      mode: 'lexical',
    });
    expect(refused.ok).toBe(false);
  });
});
