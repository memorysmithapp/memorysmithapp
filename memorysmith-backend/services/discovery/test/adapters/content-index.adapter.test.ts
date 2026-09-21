/**
 * The content index against the real DynamoDB of a deployed environment
 * (#135). A DynamoDB item holds 400 KB, and a note holds 1 MB: this is where
 * a portrait of a note that size is proved to be written, read back whole and
 * removed without a trace, which no fake table can prove.
 *
 *   DISCOVERY_TABLE   the discovery table of the environment, mv-discovery-staging
 */

import { describe, expect, it } from 'vitest';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { NotebookId, SubscriptionId } from '@memorysmith/kernel';
import { DynamoContentIndex } from '../../src/adapters/aws.js';
import { normalize } from '../../src/domain/SearchQuery.js';

const table = process.env['DISCOVERY_TABLE'];
if (!table)
  throw new Error('The adapter tests run against a deployed environment: set DISCOVERY_TABLE.');

/**
 * Retries further than the default, and adaptively, because these cases are a
 * BURST no person makes: a note of 700 KB and one of 1 MB written, grown and
 * deleted in one partition within seconds, each of them tens of items. An
 * on-demand table answers that with `Throughput exceeds the current capacity`
 * while it scales, and three attempts are not enough to ride it out.
 *
 * In the product nothing needs this: the work that walks a partition in bursts
 * is a worker reading a queue, and a throttled run fails its message, which is
 * redelivered — and a purge that runs twice destroys the same things twice.
 */
const db = DynamoDBDocumentClient.from(
  new DynamoDBClient({ maxAttempts: 10, retryMode: 'adaptive' }),
  { marshallOptions: { removeUndefinedValues: true } },
);

/** A body of about `bytes`, with accents, and a term that appears only at its end. */
function bodyOf(bytes: number, term: string): string {
  const line = 'Contratação direta de serviço técnico especializado. ';
  return `${line.repeat(Math.ceil(bytes / Buffer.byteLength(line, 'utf8')))}${term}.`;
}

function portrait(noteId: string, body: string) {
  return {
    noteId,
    name: 'nota grande',
    folderId: 'f1',
    folderName: 'pasta',
    sections: [],
    normalized: normalize(body),
    original: body,
    facets: {},
  };
}

describe('DynamoContentIndex: a portrait of any note up to 1 MB', () => {
  it('writes a 1 MB note, reads it back whole, and finds the term written at its end', async () => {
    const subscription = SubscriptionId.generate();
    const notebookId = NotebookId.generate().value;
    const index = new DynamoContentIndex(subscription, db, table);
    const body = bodyOf(1_000_000, 'termofinalraro');

    await index.replaceNote(notebookId, portrait('01JBQ2X000000000000000BIG1', body));

    const [read] = await index.scanNotebook(notebookId);
    expect(read?.original).toBe(body);
    expect(read?.normalized.endsWith('termofinalraro.')).toBe(true);
  });

  it('answers the new text after a note grows from 100 KB to 1 MB, and leaves no stale part', async () => {
    const subscription = SubscriptionId.generate();
    const notebookId = NotebookId.generate().value;
    const index = new DynamoContentIndex(subscription, db, table);
    const noteId = '01JBQ2X000000000000000BIG2';

    await index.replaceNote(notebookId, portrait(noteId, bodyOf(100_000, 'antes')));
    const grown = bodyOf(1_000_000, 'depois');
    await index.replaceNote(notebookId, portrait(noteId, grown));

    const [read] = await index.scanNotebook(notebookId);
    expect(read?.original).toBe(grown);

    const parts = await db.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `S#${subscription.value}#NOTEBOOK#${notebookId}`,
          ':prefix': `TEXT#${noteId}#`,
        },
      }),
    );
    const generations = new Set(
      (parts.Items ?? []).map((item) => String(item['SK']).split('#')[2]),
    );
    expect(generations.size).toBe(1);
  });

  it('removes every item of a large note on delete', async () => {
    const subscription = SubscriptionId.generate();
    const notebookId = NotebookId.generate().value;
    const index = new DynamoContentIndex(subscription, db, table);
    const noteId = '01JBQ2X000000000000000BIG3';

    await index.replaceNote(notebookId, portrait(noteId, bodyOf(700_000, 'fim')));
    await index.removeNote(notebookId, noteId);

    const left = await db.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `S#${subscription.value}#NOTEBOOK#${notebookId}`,
          ':prefix': 'TEXT#',
        },
        ConsistentRead: true,
      }),
    );
    expect(left.Items ?? []).toHaveLength(0);
  });
});
