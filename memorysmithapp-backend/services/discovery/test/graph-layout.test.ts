/**
 * What a projected write costs Discovery (#327, #328), over a table in memory.
 *
 * A note write used to read the whole notebook to resolve one note's targets,
 * and to write every item of the note again whether or not it changed. Here
 * the adapters are held to reading what one note needs and writing what
 * changed, and to answering exactly what reading and writing everything
 * answered. The same is held against DynamoDB in the adapter tests.
 */

import { describe, expect, it } from 'vitest';
import {
  DynamoContentIndex,
  DynamoFacetIndex,
  DynamoLinkGraph,
  DynamoProjectedVersions,
  DynamoStructureProjection,
} from '../src/adapters/aws.js';
import { ProjectNote } from '../src/application/projections.js';
import { normalize } from '../src/domain/SearchQuery.js';
import type { LinkTarget, NoteRef } from '../src/domain/ports.js';
import { describeAttachmentForms } from './attachment-forms.js';
import { dynamoTable } from './dynamo-table.js';
import { LEGACY_NOTE, answersOf, playScenario, sharedKeys } from './graph-scenario.js';

const SUBSCRIPTION = { value: 'SUB' } as never;
const NOTEBOOK = 'notebook-1';
const PK = `S#SUB#NOTEBOOK#${NOTEBOOK}`;

const ref = (noteId: string, name: string, aliases: string[] = []): NoteRef => ({
  noteId,
  name,
  aliases,
  folderId: 'f1',
});
const link = (name: string): LinkTarget => ({ name, anchor: null, form: 'link' });

/** Two graphs over two tables: one in the layout of 0.13, one in the layout of #328. */
function twoLayouts() {
  const legacy = dynamoTable();
  legacy.seed({ PK, ...LEGACY_NOTE });
  const indexed = dynamoTable();
  return {
    legacy: { ...legacy, graph: new DynamoLinkGraph(SUBSCRIPTION, legacy.db as never, 't') },
    indexed: { ...indexed, graph: new DynamoLinkGraph(SUBSCRIPTION, indexed.db as never, 't') },
  };
}

describe('The link graph answers the same whether it reads the note or the notebook (#327, #328)', () => {
  it('answers the same after every step of one history, and holds the same items', async () => {
    const { legacy, indexed } = twoLayouts();
    const seen: Array<{ step: string; legacy: unknown; indexed: unknown }> = [];

    const legacySteps: unknown[] = [];
    await playScenario(legacy.graph, NOTEBOOK, async () => {
      legacySteps.push(await answersOf(legacy.graph, NOTEBOOK));
    });
    let at = 0;
    await playScenario(indexed.graph, NOTEBOOK, async (step) => {
      seen.push({
        step,
        legacy: legacySteps[at],
        indexed: await answersOf(indexed.graph, NOTEBOOK),
      });
      at += 1;
    });

    expect(seen.length).toBeGreaterThan(5);
    for (const each of seen)
      expect({ step: each.step, ...{ answer: each.indexed } }).toEqual({
        step: each.step,
        answer: each.legacy,
      });
    expect(sharedKeys(indexed.keysOf(PK))).toEqual(sharedKeys(legacy.keysOf(PK)));
    // The one partition holds the layout of #328 and the other never did.
    expect(indexed.keysOf(PK)).toContain('GRAPH');
    expect(legacy.keysOf(PK)).not.toContain('GRAPH');
  });

  it('mirrors every target item under the note that wrote it, and nothing else', async () => {
    const { indexed } = twoLayouts();
    await playScenario(indexed.graph, NOTEBOOK, async () => undefined);

    const keys = indexed.keysOf(PK);
    const targets = keys.filter((sk) => /^(PENDING|IMAGE|ALIAS)#/.test(sk));
    const mirrors = keys.filter((sk) => sk.startsWith('FROM#'));
    expect(mirrors.map((sk) => sk.replace(/^FROM#[^#]+#/, '')).sort()).toEqual([...targets].sort());
  });

  it('rebuilds a partition of 0.13 into the layout of #328, as it rebuilds one already in it', async () => {
    const { legacy, indexed } = twoLayouts();
    await playScenario(legacy.graph, NOTEBOOK, async () => undefined);
    await playScenario(indexed.graph, NOTEBOOK, async () => undefined);

    // What `LinkReprojection.apply` does, in the order it does it, with the
    // targets each note's content holds at the end of the history.
    const targets: Record<string, LinkTarget[]> = {
      n1: [
        link('Lei 14.133'),
        link('LGL'),
        { name: 'curva.png', anchor: null, form: 'embed' },
        { name: 'capa.jpg', anchor: null, form: 'image' },
        link('Ninguém ainda'),
        link('Decreto'),
        { name: 'capa.jpg', anchor: null, form: 'embed' },
      ],
      n3: [link('Achado')],
      n4: [link('Descoberta')],
    };
    for (const { graph } of [legacy, indexed]) {
      const notes = (await graph.notesOf(NOTEBOOK)).filter((note) => note.noteId !== 'n0');
      await graph.forgetLinks(NOTEBOOK);
      await graph.seedNotes(NOTEBOOK, notes);
      await graph.markIndexed(NOTEBOOK);
      await graph.seedAttachments(NOTEBOOK, await graph.attachmentsOf(NOTEBOOK));
      for (const note of notes) {
        await graph.replaceOutgoing(NOTEBOOK, note, targets[note.noteId] ?? []);
      }
    }

    expect(await answersOf(legacy.graph, NOTEBOOK)).toEqual(
      await answersOf(indexed.graph, NOTEBOOK),
    );
    expect(sharedKeys(legacy.keysOf(PK))).toEqual(sharedKeys(indexed.keysOf(PK)));
    // The note of 0.13 that kept the partition from being marked is gone with
    // the seeding, and every spelling of every note is indexed.
    const keys = legacy.keysOf(PK).filter((sk) => /^(NAME#|FROM#|GRAPH)/.test(sk));
    expect(keys).toEqual(indexed.keysOf(PK).filter((sk) => /^(NAME#|FROM#|GRAPH)/.test(sk)));
    expect(keys).toContain('NAME#Descoberta#n1');
  });
});

describe('A projected write reads what one note needs, whatever the size of the notebook (#328)', () => {
  /** A notebook of `size` notes in the layout of #328, as the rebuild leaves it. */
  async function notebookOf(size: number, layout: 'indexed' | 'legacy') {
    const table = dynamoTable();
    if (layout === 'legacy') table.seed({ PK, ...LEGACY_NOTE });
    const graph = new DynamoLinkGraph(SUBSCRIPTION, table.db as never, 't');
    const notes = Array.from({ length: size }, (_, at) =>
      ref(`m${String(at).padStart(5, '0')}`, `Nota ${at}`, [`N${at}`]),
    );
    if (layout === 'indexed') {
      await graph.seedNotes(NOTEBOOK, notes);
      await graph.markIndexed(NOTEBOOK);
    } else {
      for (const note of notes) await graph.replaceOutgoing(NOTEBOOK, note, [link('Ninguém')]);
    }
    for (const note of notes.slice(0, 5)) {
      await graph.replaceOutgoing(NOTEBOOK, note, [link('Nota 0'), link('Ninguém'), link('N1')]);
    }
    // A fresh adapter, as the next invocation of the projector builds.
    return { table, graph: new DynamoLinkGraph(SUBSCRIPTION, table.db as never, 't') };
  }

  const links = [link('Nota 1'), link('Nota 2'), link('N3'), link('Ninguém'), link('Nota 4')];

  /** What one note write and one `read_note` read, in a notebook of `size` notes. */
  async function readsAt(size: number, layout: 'indexed' | 'legacy') {
    const { table, graph } = await notebookOf(size, layout);
    const write = await table.measure(() =>
      graph.replaceOutgoing(NOTEBOOK, ref('x', 'Nova'), links),
    );
    const update = await table.measure(() =>
      graph.replaceOutgoing(NOTEBOOK, ref('x', 'Nova'), links),
    );
    const read = await table.measure(() => graph.outgoingOf(NOTEBOOK, 'x'));
    const resolve = await table.measure(() => graph.resolvePending(NOTEBOOK, ref('x', 'Nova')));
    return { write: write.read, update: update.read, read: read.read, resolve: resolve.read };
  }

  it('reads as many items in a notebook of three hundred notes as in one of ten', async () => {
    const small = await readsAt(10, 'indexed');
    const large = await readsAt(300, 'indexed');

    expect(large).toEqual(small);
    expect(large.read).toBeLessThan(20);
    expect(large.update).toBeLessThan(30);
  });

  it('reads the whole notebook while the partition is in the layout of 0.13', async () => {
    // What the rebuild is for: a partition nobody rebuilt keeps answering, at
    // the cost it always had.
    const small = await readsAt(10, 'legacy');
    const large = await readsAt(300, 'legacy');

    expect(large.read).toBeGreaterThan(small.read + 250);
    expect(large.write).toBeGreaterThan(small.write + 250);
  });
});

describe('A note write writes only what changed (#327)', () => {
  it('writes nothing of the graph when a note keeps its name and its links', async () => {
    const { indexed } = twoLayouts();
    const { graph, measure } = indexed;
    await graph.replaceOutgoing(NOTEBOOK, ref('n2', 'Lei 14.133', ['LGL']), []);
    await graph.replaceOutgoing(NOTEBOOK, ref('n3', 'Parecer'), []);
    const links = [link('Lei 14.133'), link('LGL'), link('Parecer'), link('Ninguém')];
    await graph.replaceOutgoing(NOTEBOOK, ref('n1', 'Achado'), links);

    const again = await measure(() => graph.replaceOutgoing(NOTEBOOK, ref('n1', 'Achado'), links));
    expect(again.keys).toEqual([]);

    // And what changed is all that is written: one target gone, one added.
    const changed = await measure(() =>
      graph.replaceOutgoing(NOTEBOOK, ref('n1', 'Achado'), [
        link('Lei 14.133'),
        link('LGL'),
        link('Parecer'),
        link('Outra'),
      ]),
    );
    expect(changed.keys.sort()).toEqual([
      '-FROM#n1#PENDING#Ninguém#n1',
      '-PENDING#Ninguém#n1',
      'FROM#n1#PENDING#Outra#n1',
      'PENDING#Outra#n1',
    ]);
  });

  it('writes the note item and its spellings only when they changed', async () => {
    const { indexed } = twoLayouts();
    const { graph, measure } = indexed;
    await graph.replaceOutgoing(NOTEBOOK, ref('n1', 'Achado', ['A1']), []);

    const renamed = await measure(() =>
      graph.replaceOutgoing(NOTEBOOK, ref('n1', 'Descoberta', ['A1']), []),
    );
    expect(renamed.keys.sort()).toEqual([
      '-NAME#Achado#n1',
      'NAME#A1#n1',
      'NAME#Descoberta#n1',
      'NOTE#n1',
    ]);
  });

  it('writes again a spelling a failed write left out', async () => {
    const { indexed } = twoLayouts();
    const { graph, rows } = indexed;
    await graph.replaceOutgoing(NOTEBOOK, ref('n1', 'Achado', ['A1']), []);
    rows.delete(`${PK}\u0000NAME#A1#n1`);

    await graph.replaceOutgoing(NOTEBOOK, ref('n1', 'Achado', ['A1']), []);

    expect(indexed.keysOf(PK)).toContain('NAME#A1#n1');
  });

  it('reads past a spelling the note no longer carries', async () => {
    // Two projections of one note racing may leave a spelling too many; the
    // note item is what decides, and the leftover answers nothing.
    const { indexed } = twoLayouts();
    const { graph, seed } = indexed;
    await graph.replaceOutgoing(NOTEBOOK, ref('n2', 'Lei nova'), []);
    seed({ PK, SK: 'NAME#Lei antiga#n2', entity: 'NAME', spelling: 'Lei antiga', noteId: 'n2' });

    await graph.replaceOutgoing(NOTEBOOK, ref('n1', 'Achado'), [link('Lei antiga')]);

    expect(await graph.outgoingOf(NOTEBOOK, 'n1')).toEqual([
      { target: 'Lei antiga', kind: 'pending', by: null, notes: [] },
    ]);
  });

  it('writes no portrait of facets that did not change', async () => {
    const { db, measure } = dynamoTable();
    const facets = new DynamoFacetIndex(SUBSCRIPTION, db as never, 't');
    const snapshot = {
      maturity: { facet: 'maturity', kind: 'enum' as const, values: ['growing'] },
    };
    await facets.replaceFacets(NOTEBOOK, 'n1', snapshot);

    const again = await measure(() =>
      facets.replaceFacets(NOTEBOOK, 'n1', {
        maturity: { facet: 'maturity', kind: 'enum', values: ['growing'] },
      }),
    );
    expect(again.commands).toEqual(['GetCommand']);

    const none = await measure(() => facets.replaceFacets(NOTEBOOK, 'n2', null));
    expect(none.commands).toEqual(['GetCommand']);

    const changed = await measure(() =>
      facets.replaceFacets(NOTEBOOK, 'n1', {
        maturity: { facet: 'maturity', kind: 'enum', values: ['evergreen'] },
      }),
    );
    expect(changed.commands).toContain('TransactWriteCommand');
  });
});

describe('A portrait that fits one item is written in its head (#327)', () => {
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

  it('writes one item for a note of ordinary size, and reads it back whole', async () => {
    const { db, keysOf, measure } = dynamoTable();
    const index = new DynamoContentIndex(SUBSCRIPTION, db as never, 't');
    const body = 'Contratação direta de serviço técnico. '.repeat(70);

    const write = await measure(() => index.replaceNote(NOTEBOOK, portrait('n1', body)));

    expect(write.keys).toEqual(['TEXT#n1']);
    expect(keysOf(PK)).toEqual(['TEXT#n1']);
    expect((await index.scanNotebook(NOTEBOOK))[0]?.original).toBe(body);
  });

  it('answers the body as it is while a note grows past one item and shrinks back', async () => {
    const { db, keysOf } = dynamoTable();
    const index = new DynamoContentIndex(SUBSCRIPTION, db as never, 't');
    const small = 'palavra '.repeat(1_000);
    const large = 'palavra '.repeat(40_000);
    const read = async () => (await index.scanNotebook(NOTEBOOK)).map((note) => note.original);

    await index.replaceNote(NOTEBOOK, portrait('n1', small));
    expect(await read()).toEqual([small]);

    await index.replaceNote(NOTEBOOK, portrait('n1', large));
    expect(await read()).toEqual([large]);
    const generations = new Set(
      keysOf(PK)
        .filter((sk) => sk.startsWith('TEXT#n1#'))
        .map((sk) => sk.split('#')[2]),
    );
    expect(generations.size).toBe(1);

    await index.replaceNote(NOTEBOOK, portrait('n1', `${small}fim`));
    expect(await read()).toEqual([`${small}fim`]);
    expect(keysOf(PK)).toEqual(['TEXT#n1']);
  });
});

describe('The structure of a notebook is read by its own keys (#328)', () => {
  it('reads the notebook and its folders, and no counter of facets', async () => {
    const { db, seed, measure } = dynamoTable();
    const structure = new DynamoStructureProjection(SUBSCRIPTION, db as never, 't');
    seed({ PK, SK: 'STRUCT', entity: 'STRUCT', notebookName: 'Caderno' });
    await structure.upsertFolder(NOTEBOOK, {
      folderId: 'f1',
      name: 'Pasta',
      description: '',
      parentFolderId: null,
    });
    for (let at = 0; at < 50; at++) {
      seed({ PK, SK: `STAT#tags#t${at}`, facet: 'tags', value: `t${at}`, count: 1 });
    }

    let found: Awaited<ReturnType<typeof structure.get>> = null;
    const read = await measure(async () => {
      found = await structure.get(NOTEBOOK);
    });

    expect(read.read).toBe(2);
    expect(found).toMatchObject({ notebookName: 'Caderno' });
    expect((found as unknown as { folders: Map<string, unknown> }).folders.get('f1')).toEqual({
      name: 'Pasta',
      description: '',
      parentFolderId: null,
    });
  });
});

describe('A whole note write, through the projector (#327)', () => {
  it('writes the claim and the portrait of an update that keeps its links, and nothing else', async () => {
    const table = dynamoTable();
    const content = new Map<string, string>();
    const project = new ProjectNote({
      graph: new DynamoLinkGraph(SUBSCRIPTION, table.db as never, 't'),
      facets: new DynamoFacetIndex(SUBSCRIPTION, table.db as never, 't'),
      index: new DynamoContentIndex(SUBSCRIPTION, table.db as never, 't'),
      structure: new DynamoStructureProjection(SUBSCRIPTION, table.db as never, 't'),
      content: { read: async (ref) => content.get(ref.versionId) ?? '' },
      versions: new DynamoProjectedVersions(SUBSCRIPTION, table.db as never, 't'),
    });
    const write = async (noteId: string, version: number, markdown: string) => {
      content.set(`v${noteId}${version}`, markdown);
      await project.project({
        kind: 'written',
        notebookId: NOTEBOOK,
        noteId,
        folderId: 'f1',
        contentRef: { contentId: `c${noteId}`, versionId: `v${noteId}${version}` },
        version,
      });
    };
    const head = '---\nname: Achado\nmaturity: growing\n---\n\n';
    const links = 'Ver [[Lei 14.133]], [[Parecer]] e [[Ninguém ainda]].\n';
    await write('n2', 1, '---\nname: Lei 14.133\n---\n');
    await write('n3', 1, '---\nname: Parecer\n---\n');
    await write('n1', 1, `${head}${links}Primeira redação.`);

    const update = await table.measure(() =>
      write('n1', 2, `${head}${links}Segunda redação, mais longa que a primeira.`),
    );

    // The claim of the version, and the portrait the search reads.
    expect(update.keys).toEqual(['NOTE#n1', 'TEXT#n1']);
  });
});

describeAttachmentForms('DynamoLinkGraph over a table in memory, layout of #328', () => ({
  graph: new DynamoLinkGraph(SUBSCRIPTION, dynamoTable().db as never, 't'),
  notebookId: NOTEBOOK,
}));

describeAttachmentForms('DynamoLinkGraph over a table in memory, layout of 0.13', () => {
  const table = dynamoTable();
  table.seed({ PK, ...LEGACY_NOTE });
  return { graph: new DynamoLinkGraph(SUBSCRIPTION, table.db as never, 't'), notebookId: NOTEBOOK };
});

/**
 * Two notes of one fresh notebook, projected at once by two instances, the
 * way staging met them (#328): Beta written, then Alpha linking it, and the
 * link left pending for ever. Each instance is paused at the one point the
 * interleaving needs, and the other runs in between.
 */
describe('Two notes projected at once keep the link between them (#328)', () => {
  /** A client that stops before the first command `when` names, until released. */
  function paused(
    db: ReturnType<typeof dynamoTable>['db'],
    when: (command: { constructor: { name: string }; input: Record<string, unknown> }) => boolean,
  ) {
    let release = (): void => undefined;
    let reached = (): void => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const arrived = new Promise<void>((resolve) => (reached = resolve));
    let stopped = false;
    const client = {
      send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
        if (!stopped && when(command)) {
          stopped = true;
          reached();
          await gate;
        }
        return db.send(command as never);
      },
    };
    return { client, arrived, release };
  }

  const writesPending = (command: {
    constructor: { name: string };
    input: Record<string, unknown>;
  }) =>
    command.constructor.name === 'BatchWriteCommand' &&
    JSON.stringify(command.input).includes('"PENDING#Beta#alpha"');
  const asksForNotes = (command: {
    constructor: { name: string };
    input: Record<string, unknown>;
  }) => command.constructor.name === 'QueryCommand' && command.input['Limit'] === 1;

  const beta = ref('beta', 'Beta');
  const alpha = ref('alpha', 'Alpha');
  const alphaLinks = [link('Beta'), link('Gamma')];

  async function linkOf(graph: DynamoLinkGraph): Promise<unknown> {
    return (await graph.outgoingOf(NOTEBOOK, 'alpha')).find((each) => each.target === 'Beta');
  }

  it('when Beta decides the layout after Alpha marked the notebook and wrote its note', async () => {
    const table = dynamoTable();
    const onBeta = paused(table.db, asksForNotes);
    const onAlpha = paused(table.db, writesPending);
    const betaGraph = new DynamoLinkGraph(SUBSCRIPTION, onBeta.client as never, 't');
    const alphaGraph = new DynamoLinkGraph(SUBSCRIPTION, onAlpha.client as never, 't');

    // Beta finds no mark, and stops before asking whether the notebook holds a note.
    const betaDone = (async () => {
      await betaGraph.replaceOutgoing(NOTEBOOK, beta, []);
      await betaGraph.resolvePending(NOTEBOOK, beta);
    })();
    await onBeta.arrived;
    // Alpha marks the notebook, writes its note, and stops before its pending link.
    const alphaDone = (async () => {
      await alphaGraph.replaceOutgoing(NOTEBOOK, alpha, alphaLinks);
      await alphaGraph.resolvePending(NOTEBOOK, alpha);
    })();
    await onAlpha.arrived;
    // Beta finds Alpha's note and finishes, with nothing yet waiting for it.
    onBeta.release();
    await betaDone;
    onAlpha.release();
    await alphaDone;

    const graph = new DynamoLinkGraph(SUBSCRIPTION, table.db as never, 't');
    expect(await linkOf(graph)).toMatchObject({ kind: 'note', notes: [{ noteId: 'beta' }] });
    expect(table.keysOf(PK)).toContain('NAME#Beta#beta');
  });

  it('when Beta is written whole between Alpha reading the names and writing its pending link', async () => {
    const table = dynamoTable();
    const seeding = new DynamoLinkGraph(SUBSCRIPTION, table.db as never, 't');
    await seeding.markIndexed(NOTEBOOK);
    const onAlpha = paused(table.db, writesPending);
    const alphaGraph = new DynamoLinkGraph(SUBSCRIPTION, onAlpha.client as never, 't');

    const alphaDone = (async () => {
      await alphaGraph.replaceOutgoing(NOTEBOOK, alpha, alphaLinks);
      await alphaGraph.resolvePending(NOTEBOOK, alpha);
    })();
    await onAlpha.arrived;
    await seeding.replaceOutgoing(NOTEBOOK, beta, []);
    await seeding.resolvePending(NOTEBOOK, beta);
    onAlpha.release();
    await alphaDone;

    expect(await linkOf(seeding)).toMatchObject({ kind: 'note', notes: [{ noteId: 'beta' }] });
    expect(table.keysOf(PK)).not.toContain('PENDING#Beta#alpha');
    expect(table.keysOf(PK)).toContain('PENDING#Gamma#alpha');
  });
});
