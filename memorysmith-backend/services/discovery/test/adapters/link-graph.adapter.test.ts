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
import { NotebookId, SubscriptionId } from '@memorysmith/kernel';
import { DynamoLinkGraph, DynamoProjectedVersions } from '../../src/adapters/aws.js';
import type { NoteRef } from '../../src/domain/ports.js';

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
