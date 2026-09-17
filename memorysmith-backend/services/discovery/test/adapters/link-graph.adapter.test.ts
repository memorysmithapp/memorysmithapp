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
