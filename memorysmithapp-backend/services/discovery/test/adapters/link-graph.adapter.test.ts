/**
 * The link graph against the real DynamoDB of a deployed environment (#147).
 *
 * The in-memory graph resolves every link on the fly, so it cannot hold a
 * residue and cannot show one: a pending item of a note that no longer exists
 * is invisible to every reader, because a listing and a backlink both join
 * against the `NOTE#` item. What it does is occupy a partition for ever, and
 * the only place that is visible is the table itself.
 *
 *   DISCOVERY_TABLE   the discovery table of the environment, mv-discovery-staging
 */

import { describe, expect, it } from 'vitest';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { NotebookId, SubscriptionId } from '@memorysmithapp/kernel';
import { DynamoLinkGraph, DynamoProjectedVersions } from '../../src/adapters/aws.js';
import type { NoteRef } from '../../src/domain/ports.js';
import {
  InMemoryContentIndex,
  InMemoryFacetIndex,
  InMemoryProjectedVersions,
  InMemoryStructureProjection,
} from '../../src/adapters/memory.js';
import { ProjectNote } from '../../src/application/projections.js';
import { describeAttachmentForms } from '../attachment-forms.js';

const table = process.env['DISCOVERY_TABLE'];
if (!table)
  throw new Error('The adapter tests run against a deployed environment: set DISCOVERY_TABLE.');

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

function note(noteId: string, name: string, aliases: string[] = []): NoteRef {
  return { noteId, name, aliases, folderId: 'f1' };
}

/** Every item of the partition of a notebook, whatever wrote it. */
async function partitionOf(subscription: SubscriptionId, notebookId: string): Promise<string[]> {
  const keys: string[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const response: {
      Items?: Record<string, unknown>[] | undefined;
      LastEvaluatedKey?: Record<string, unknown> | undefined;
    } = await db.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `S#${subscription.value}#NOTEBOOK#${notebookId}`,
        },
        ProjectionExpression: 'SK',
        ...(startKey ? { ExclusiveStartKey: startKey } : {}),
      }),
    );
    keys.push(...((response.Items ?? []) as Array<{ SK: string }>).map((item) => item.SK));
    startKey = response.LastEvaluatedKey;
  } while (startKey);
  return keys;
}

describe('DynamoLinkGraph: what a deletion leaves behind', () => {
  it('leaves no item of a notebook it deleted, links, pending and aliases included', async () => {
    const subscription = SubscriptionId.generate();
    const notebookId = NotebookId.generate().value;
    const graph = new DynamoLinkGraph(subscription, db, table);

    // A link between two notes of the notebook, a link waiting for a name
    // nobody carries, and an edge an alias answered for.
    await graph.replaceOutgoing(notebookId, note('n1', 'Achado'), [
      { name: 'Lei 14.133', anchor: null },
      { name: 'Ninguem ainda', anchor: null },
    ]);
    await graph.replaceOutgoing(notebookId, note('n2', 'Lei 14.133', ['LGL']), []);
    await graph.resolvePending(notebookId, note('n2', 'Lei 14.133', ['LGL']));
    await graph.replaceOutgoing(notebookId, note('n3', 'Parecer'), [{ name: 'LGL', anchor: null }]);
    expect(await partitionOf(subscription, notebookId)).not.toEqual([]);

    await graph.removeNotebook(notebookId);

    expect(await partitionOf(subscription, notebookId)).toEqual([]);
  });

  it('leaves no pending link and no alias mark of a note it deleted', async () => {
    const subscription = SubscriptionId.generate();
    const notebookId = NotebookId.generate().value;
    const graph = new DynamoLinkGraph(subscription, db, table);

    await graph.replaceOutgoing(notebookId, note('n2', 'Lei 14.133', ['LGL']), []);
    await graph.replaceOutgoing(notebookId, note('n1', 'Achado'), [
      { name: 'Ninguem ainda', anchor: null },
      { name: 'LGL', anchor: null },
    ]);

    await graph.removeNote(notebookId, 'n1');

    // Nothing of n1 survives: not the note, not the target that reached
    // nothing, not the mark on the edge its alias answered.
    const left = await partitionOf(subscription, notebookId);
    expect(left.filter((sk) => sk.includes('n1'))).toEqual([]);
    expect(left.some((sk) => sk.startsWith('PENDING#Ninguem ainda#'))).toBe(false);
    // And the note it pointed at is untouched.
    expect(left).toContain('NOTE#n2');

    await graph.removeNotebook(notebookId);
  });
});

/**
 * Two targets that reach ONE note (#163).
 *
 * The in-memory graph cannot show this and never could: it keeps the targets
 * as written and resolves them at read time, so it never builds a key, let
 * alone the same key twice. Here the edge is keyed by the pair it joins, both
 * targets build it, and a batch carrying a key twice is refused WHOLE — which
 * cost the note every link it had, the ones that had nothing to do with the
 * repetition included.
 */
describe('DynamoLinkGraph: two targets, one note at the end of both', () => {
  it('keeps every link of the note, and writes one edge', async () => {
    const subscription = SubscriptionId.generate();
    const notebookId = NotebookId.generate().value;
    const graph = new DynamoLinkGraph(subscription, db, table);

    await graph.replaceOutgoing(notebookId, note('n2', 'Lei 14.133', ['LGL']), []);
    await graph.replaceOutgoing(notebookId, note('n3', 'Parecer'), []);

    // By its name, by its alias, and a third target of its own: the shape a
    // note takes when it quotes a source and also links to it.
    await graph.replaceOutgoing(notebookId, note('n1', 'Achado'), [
      { name: 'Lei 14.133', anchor: null },
      { name: 'LGL', anchor: null },
      { name: 'Parecer', anchor: null },
    ]);

    const targets = await graph.outgoingOf(notebookId, 'n1');
    expect(targets.map((each) => each.target).sort()).toEqual(['Lei 14.133', 'Parecer']);
    const left = await partitionOf(subscription, notebookId);
    expect(left.filter((sk) => sk === 'OUT#n1#n2')).toEqual(['OUT#n1#n2']);
    expect(left).toContain('OUT#n1#n3');
    expect(left).toContain('IN#n2#n1');

    await graph.removeNotebook(notebookId);
  });

  it('keeps them when one note repeats a spelling of its own', async () => {
    const subscription = SubscriptionId.generate();
    const notebookId = NotebookId.generate().value;
    const graph = new DynamoLinkGraph(subscription, db, table);

    // One note, one alias declared twice: one target, and the same edge built
    // twice inside a single iteration.
    await graph.replaceOutgoing(notebookId, note('n2', 'Lei 14.133', ['LGL', 'LGL']), []);
    await graph.replaceOutgoing(notebookId, note('n1', 'Achado'), [{ name: 'LGL', anchor: null }]);

    expect((await graph.outgoingOf(notebookId, 'n1')).map((each) => each.target)).toEqual(['LGL']);

    await graph.removeNotebook(notebookId);
  });

  it('leaves the edges it had when the write that would replace them fails', async () => {
    const subscription = SubscriptionId.generate();
    const notebookId = NotebookId.generate().value;
    const graph = new DynamoLinkGraph(subscription, db, table);

    await graph.replaceOutgoing(notebookId, note('n2', 'Lei 14.133'), []);
    await graph.replaceOutgoing(notebookId, note('n1', 'Achado'), [
      { name: 'Lei 14.133', anchor: null },
    ]);

    // A note whose links cannot be written keeps the ones it had: the write
    // comes first now, and only what it replaced is taken away.
    const broken = new DynamoLinkGraph(subscription, db, 'mv-discovery-does-not-exist');
    await expect(
      broken.replaceOutgoing(notebookId, note('n1', 'Achado'), [{ name: 'Parecer', anchor: null }]),
    ).rejects.toThrow();
    expect((await graph.outgoingOf(notebookId, 'n1')).map((each) => each.target)).toEqual([
      'Lei 14.133',
    ]);

    await graph.removeNotebook(notebookId);
  });
});

/**
 * A pending link resolves when the note that answers it is written, by its
 * name **or by its alias** (§5.5). The alias half swept nothing, so a link
 * waited for a rewrite of its own source that nobody had a reason to make.
 */
describe('DynamoLinkGraph: what was waiting for a name, and for a spelling', () => {
  it('resolves a pending link when a note carries the target as an alias', async () => {
    const subscription = SubscriptionId.generate();
    const notebookId = NotebookId.generate().value;
    const graph = new DynamoLinkGraph(subscription, db, table);

    await graph.replaceOutgoing(notebookId, note('n1', 'Achado'), [{ name: 'LGL', anchor: null }]);
    // Nothing answers it yet: the target is there and reaches no note.
    expect((await graph.outgoingOf(notebookId, 'n1'))[0]?.notes).toEqual([]);

    const later = note('n2', 'Lei 14.133', ['LGL']);
    await graph.replaceOutgoing(notebookId, later, []);
    await graph.resolvePending(notebookId, later);

    const target = (await graph.outgoingOf(notebookId, 'n1'))[0];
    expect(target?.target).toBe('LGL');
    expect(target?.by).toBe('alias');
    expect(target?.notes.map((each) => each.noteId)).toEqual(['n2']);
    expect((await graph.backlinks(notebookId, 'n2')).map((each) => each.noteId)).toEqual(['n1']);

    await graph.removeNotebook(notebookId);
  });
});

/**
 * A pair a name reaches is the name's, whatever order the projector meets the
 * writes in (RN-DSC-053, #304). The write of a note already asked; what was
 * waiting did not, so a note quoting a source by its name and its alias,
 * projected before the source, had the pair held by the alias.
 */
describe('DynamoLinkGraph: a pair reached by a name and by a spelling, in any order', () => {
  const quoting = [
    { name: 'Lei 14.133', anchor: null },
    { name: 'LGL', anchor: null },
  ];

  it('holds the pair by the name when both were waiting for the source', async () => {
    const subscription = SubscriptionId.generate();
    const notebookId = NotebookId.generate().value;
    const graph = new DynamoLinkGraph(subscription, db, table);

    await graph.replaceOutgoing(notebookId, note('n1', 'Achado'), quoting);
    const source = note('n2', 'Lei 14.133', ['LGL']);
    await graph.replaceOutgoing(notebookId, source, []);
    await graph.resolvePending(notebookId, source);

    const targets = await graph.outgoingOf(notebookId, 'n1');
    expect(targets.map((each) => [each.target, each.by])).toEqual([['Lei 14.133', 'name']]);
    expect(
      (await partitionOf(subscription, notebookId)).some((sk) => sk.startsWith('ALIAS#')),
    ).toBe(false);

    await graph.removeNotebook(notebookId);
  });

  it('leaves the pair to the name when the spelling arrives after it', async () => {
    const subscription = SubscriptionId.generate();
    const notebookId = NotebookId.generate().value;
    const graph = new DynamoLinkGraph(subscription, db, table);

    // The source exists under its name alone: the name links, the spelling waits.
    await graph.replaceOutgoing(notebookId, note('n2', 'Lei 14.133'), []);
    await graph.replaceOutgoing(notebookId, note('n1', 'Achado'), quoting);
    // Then the source declares the spelling.
    const spelled = note('n2', 'Lei 14.133', ['LGL']);
    await graph.replaceOutgoing(notebookId, spelled, []);
    await graph.resolvePending(notebookId, spelled);

    const targets = await graph.outgoingOf(notebookId, 'n1');
    expect(targets.map((each) => [each.target, each.by])).toEqual([['Lei 14.133', 'name']]);

    await graph.removeNotebook(notebookId);
  });

  it('gives the pair to the name when the name arrives after the spelling held it', async () => {
    const subscription = SubscriptionId.generate();
    const notebookId = NotebookId.generate().value;
    const graph = new DynamoLinkGraph(subscription, db, table);

    // The source answers the spelling under another name: the spelling holds
    // the pair, and the name waits.
    await graph.replaceOutgoing(notebookId, note('n2', 'Lei antiga', ['LGL']), []);
    await graph.replaceOutgoing(notebookId, note('n1', 'Achado'), quoting);
    expect(
      (await graph.outgoingOf(notebookId, 'n1')).find((each) => each.target === 'LGL')?.by,
    ).toBe('alias');
    // Then it is renamed to the name the note was waiting for.
    const renamed = note('n2', 'Lei 14.133', ['LGL']);
    await graph.replaceOutgoing(notebookId, renamed, []);
    await graph.resolvePending(notebookId, renamed);

    const targets = await graph.outgoingOf(notebookId, 'n1');
    expect(targets.map((each) => [each.target, each.by])).toEqual([['Lei 14.133', 'name']]);
    expect((await graph.backlinks(notebookId, 'n2')).map((each) => each.noteId)).toEqual(['n1']);

    await graph.removeNotebook(notebookId);
  });

  it('leaves the pair to the name when a deletion lands a link on a spelling of a note already named', async () => {
    const subscription = SubscriptionId.generate();
    const notebookId = NotebookId.generate().value;
    const graph = new DynamoLinkGraph(subscription, db, table);

    // `Lei` is a note of its own and a spelling of `Parecer`, which the note
    // also links by name.
    await graph.replaceOutgoing(notebookId, note('n2', 'Lei'), []);
    await graph.replaceOutgoing(notebookId, note('n3', 'Parecer', ['Lei']), []);
    await graph.replaceOutgoing(notebookId, note('n1', 'Achado'), [
      { name: 'Lei', anchor: null },
      { name: 'Parecer', anchor: null },
    ]);
    // Deleting `Lei` lands its link on the spelling, on a pair the name holds.
    await graph.removeNote(notebookId, 'n2');

    const targets = await graph.outgoingOf(notebookId, 'n1');
    expect(targets.map((each) => [each.target, each.by])).toEqual([['Parecer', 'name']]);

    await graph.removeNotebook(notebookId);
  });

  it('does not mark as a spelling a link a second note of the same name answers after a deletion', async () => {
    const subscription = SubscriptionId.generate();
    const notebookId = NotebookId.generate().value;
    const graph = new DynamoLinkGraph(subscription, db, table);

    // Two notes carry one name, and the link reaches both (RN-DSC-042).
    await graph.replaceOutgoing(notebookId, note('n2', 'Lei'), []);
    await graph.replaceOutgoing(notebookId, note('n3', 'Lei'), []);
    await graph.replaceOutgoing(notebookId, note('n1', 'Achado'), [{ name: 'Lei', anchor: null }]);
    await graph.removeNote(notebookId, 'n2');

    const targets = await graph.outgoingOf(notebookId, 'n1');
    expect(targets.map((each) => [each.target, each.by])).toEqual([['Lei', 'name']]);
    expect(
      (await partitionOf(subscription, notebookId)).some((sk) => sk.startsWith('ALIAS#')),
    ).toBe(false);

    await graph.removeNotebook(notebookId);
  });
});

/**
 * The edge a link made by a spelling its target no longer carries (#316). The
 * first report of `reproject-links` in production lost two of them: a note that
 * dropped the alias a link reached it by, and one renamed away from the name a
 * link wrote. Both edges stayed, because the write of the target re-resolved
 * only what reached it and never what had stopped reaching it.
 */
describe('DynamoLinkGraph: a spelling the target stopped carrying, through the projector', () => {
  const projector = (subscription: SubscriptionId) => {
    const graph = new DynamoLinkGraph(subscription, db, table);
    const content = new Map<string, string>();
    const project = new ProjectNote({
      graph,
      facets: new InMemoryFacetIndex(),
      index: new InMemoryContentIndex(),
      structure: new InMemoryStructureProjection(),
      content: { read: async (ref) => content.get(`${ref.contentId}#${ref.versionId}`) ?? '' },
      versions: new InMemoryProjectedVersions(),
    });
    let version = 0;
    const write = async (notebookId: string, noteId: string, markdown: string): Promise<void> => {
      version += 1;
      const ref = { contentId: `c-${noteId}`, versionId: `v-${version}` };
      content.set(`${ref.contentId}#${ref.versionId}`, markdown);
      await project.project({
        kind: 'written',
        notebookId,
        noteId,
        folderId: 'f1',
        contentRef: ref,
        version,
      });
    };
    return { graph, write };
  };

  it('returns to pending a link that reached a note by an alias it dropped', async () => {
    const subscription = SubscriptionId.generate();
    const notebookId = NotebookId.generate().value;
    const { graph, write } = projector(subscription);

    await write(notebookId, 'n2', '---\nname: Orquestração\naliases: [Máquina de estados]\n---\n');
    await write(notebookId, 'n1', '---\nname: Origem\n---\n\n[[Máquina de estados]]');
    expect((await graph.backlinks(notebookId, 'n2')).map((each) => each.noteId)).toEqual(['n1']);

    await write(notebookId, 'n2', '---\nname: Orquestração\naliases: [Saga orquestrada]\n---\n');

    expect(await graph.outgoingOf(notebookId, 'n1')).toEqual([
      { target: 'Máquina de estados', kind: 'pending', by: null, notes: [] },
    ]);
    expect(await graph.backlinks(notebookId, 'n2')).toEqual([]);
    const left = await partitionOf(subscription, notebookId);
    expect(left.filter((sk) => /^(OUT|IN|ALIAS)#/.test(sk))).toEqual([]);

    await graph.removeNotebook(notebookId);
  });

  it('returns to pending a link that wrote the old name of a note renamed', async () => {
    const subscription = SubscriptionId.generate();
    const notebookId = NotebookId.generate().value;
    const { graph, write } = projector(subscription);

    await write(notebookId, 'n2', '---\nname: TRB-001 Guia\n---\n');
    await write(notebookId, 'n1', '---\nname: Origem\n---\n\n[[TRB-001 Guia]]');

    await write(notebookId, 'n2', '---\nname: Trabalho 1 Guia\n---\n');

    expect(await graph.outgoingOf(notebookId, 'n1')).toEqual([
      { target: 'TRB-001 Guia', kind: 'pending', by: null, notes: [] },
    ]);
    expect(await graph.backlinks(notebookId, 'n2')).toEqual([]);

    await graph.removeNotebook(notebookId);
  });

  it('keeps the edge a spelling the note kept still holds, and lands one another note carries', async () => {
    const subscription = SubscriptionId.generate();
    const notebookId = NotebookId.generate().value;
    const { graph, write } = projector(subscription);

    await write(notebookId, 'n2', '---\nname: Lei antiga\naliases: [LGL]\n---\n');
    await write(notebookId, 'n3', '---\nname: Parecer\naliases: [Lei antiga]\n---\n');
    await write(notebookId, 'n1', '---\nname: Achado\n---\n\n[[Lei antiga]] e [[LGL]]');

    // Renamed: its old name is now answered by the alias of another note, and
    // the alias it kept still reaches it.
    await write(notebookId, 'n2', '---\nname: Lei 14.133\naliases: [LGL]\n---\n');

    const targets = await graph.outgoingOf(notebookId, 'n1');
    expect(
      targets.map((each) => [each.target, each.by, each.notes.map((note) => note.noteId)]).sort(),
    ).toEqual([
      ['LGL', 'alias', ['n2']],
      ['Lei antiga', 'alias', ['n3']],
    ]);

    await graph.removeNotebook(notebookId);
  });
});

describe('DynamoProjectedVersions: the marker of a note that is gone', () => {
  it('carries a deadline, and the marker of a live note does not', async () => {
    const subscription = SubscriptionId.generate();
    const versions = new DynamoProjectedVersions(subscription, db, table);
    const notebookId = NotebookId.generate().value;
    const pk = `S#${subscription.value}#PROJECTED`;

    const state = { notebookId, folderId: 'f1', contentRef: null };
    await versions.claim('live', { ...state, version: 1, gone: false });
    await versions.claim('gone', { ...state, version: 1, gone: true });

    const read = async (noteId: string): Promise<Record<string, unknown> | undefined> => {
      const response = await db.send(
        new QueryCommand({
          TableName: table,
          KeyConditionExpression: 'PK = :pk AND SK = :sk',
          ExpressionAttributeValues: { ':pk': pk, ':sk': `NOTE#${noteId}` },
        }),
      );
      return (response.Items ?? [])[0];
    };

    expect((await read('live'))?.['ttl']).toBeUndefined();
    const deadline = Number((await read('gone'))?.['ttl']);
    const days = (deadline - Date.now() / 1000) / 86_400;
    // Thirty days: longer than any delivery the marker defends against, and
    // not for ever, which is what one item per note ever deleted would be.
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThan(31);
  });
});

/**
 * Whether a target is a file is decided when it is read, never when the note
 * was written (#185). The in-memory graph resolves on every read, so it could
 * not show that this one froze the answer at the write: a note written before
 * its picture was kept stayed pending for ever.
 */
describe('DynamoLinkGraph: a file kept or deleted after the note that embeds it', () => {
  it('stops counting the embed as pending once the file is kept, and counts it again once deleted', async () => {
    const subscription = SubscriptionId.generate();
    const notebookId = NotebookId.generate().value;
    const graph = new DynamoLinkGraph(subscription, db, table);
    const targets = async (): Promise<string[]> =>
      (await graph.pending(notebookId)).map((link) => link.targetName).sort();

    await graph.replaceOutgoing(notebookId, note('n1', 'Capa'), [
      { name: 'simbolo.svg', anchor: null },
      { name: 'Ninguem ainda', anchor: null },
    ]);
    expect(await targets()).toEqual(['Ninguem ainda', 'simbolo.svg']);

    await graph.keepAttachment(notebookId, 'simbolo.svg');
    expect(await targets()).toEqual(['Ninguem ainda']);
    expect((await graph.wholeGraph(notebookId)).pending.map((p) => p.targetName)).toEqual([
      'Ninguem ainda',
    ]);
    const kinds = (await graph.outgoingOf(notebookId, 'n1')).map((t) => `${t.target}:${t.kind}`);
    expect(kinds.sort()).toEqual(['Ninguem ainda:pending', 'simbolo.svg:attachment']);

    await graph.forgetAttachment(notebookId, 'simbolo.svg');
    expect(await targets()).toEqual(['Ninguem ainda', 'simbolo.svg']);

    await graph.removeNotebook(notebookId);
  });

  it('is restated by the rebuild, and forgets a file no longer kept', async () => {
    const subscription = SubscriptionId.generate();
    const notebookId = NotebookId.generate().value;
    const graph = new DynamoLinkGraph(subscription, db, table);

    await graph.keepAttachment(notebookId, 'apagado.png');
    await graph.seedAttachments(notebookId, ['simbolo.svg']);
    expect((await graph.attachmentsOf(notebookId)).sort()).toEqual(['simbolo.svg']);

    await graph.removeNotebook(notebookId);
  });
});

describeAttachmentForms('DynamoLinkGraph', () => ({
  graph: new DynamoLinkGraph(SubscriptionId.generate(), db, table),
  notebookId: NotebookId.generate().value,
}));
