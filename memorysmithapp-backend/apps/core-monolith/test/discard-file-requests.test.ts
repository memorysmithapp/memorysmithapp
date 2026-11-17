/**
 * The discard of the file requests and inline uploads left open when they were
 * retired (#469, #468): it reports unless it applies, and applied it destroys
 * the parts of an inline upload, deletes each record and gives the room back.
 */

import { describe, expect, it } from 'vitest';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { discardFileRequests } from '../src/discard-file-requests.js';

const ITEMS = [
  {
    PK: 'S#sub1#USER#user1',
    SK: 'TRANSFER#R1',
    entity: 'TRANSFER',
    kind: 'request',
    status: 'running',
    notebookId: 'nb1',
    bytes: 0,
  },
  {
    PK: 'S#sub2#USER#user2',
    SK: 'TRANSFER#U1',
    entity: 'TRANSFER',
    kind: 'agent',
    status: 'running',
    notebookId: 'nb2',
    bytes: 3000,
    upload: { transport: 'inline', parts: { '1': 'v1', '2': 'v2' } },
  },
];

/** A table that answers the scan with ITEMS and records every other command. */
function table() {
  const sent: Array<{ name: string; input: Record<string, unknown> }> = [];
  const db = {
    send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      sent.push({ name: command.constructor.name, input: command.input });
      if (command.constructor.name === 'ScanCommand') return { Items: ITEMS };
      return {};
    },
  } as unknown as DynamoDBDocumentClient;
  return { db, sent };
}

describe('the discard of what request_file and the inline transport left open', () => {
  it('only reports, and changes nothing, unless it applies', async () => {
    const { db, sent } = table();
    const destroyed: string[] = [];
    const summary = await discardFileRequests({
      db,
      tableName: 'mv-portability-test',
      destroy: async (key, version) => void destroyed.push(`${key}@${version}`),
      apply: false,
    });
    expect(summary).toMatchObject({
      mode: 'report',
      requests: 1,
      inlineUploads: 1,
      subscriptions: 2,
      reservedBytes: 3000,
      discarded: 0,
      failures: [],
    });
    expect(sent.map((each) => each.name)).toEqual(['ScanCommand']);
    expect(destroyed).toEqual([]);
  });

  it('applied, destroys the parts, deletes each record and gives the reserved room back', async () => {
    const { db, sent } = table();
    const destroyed: string[] = [];
    const summary = await discardFileRequests({
      db,
      tableName: 'mv-portability-test',
      destroy: async (key, version) => void destroyed.push(`${key}@${version}`),
      apply: true,
    });
    expect(summary).toMatchObject({ mode: 'apply', discarded: 2, failures: [] });
    expect(destroyed).toEqual(['s/sub2/uploads/U1/part-1@v1', 's/sub2/uploads/U1/part-2@v2']);
    const deleted = sent
      .filter((each) => each.name === 'DeleteCommand')
      .map((each) => each.input['Key']);
    expect(deleted).toEqual([
      { PK: 'S#sub1#USER#user1', SK: 'TRANSFER#R1' },
      { PK: 'S#sub2#USER#user2', SK: 'TRANSFER#U1' },
    ]);
    // The room the inline upload reserved goes back to its subscription; a request held none.
    const counters = sent.filter((each) => each.name === 'UpdateCommand');
    expect(counters.length).toBeGreaterThan(0);
    expect(JSON.stringify(counters)).toContain('sub2');
    expect(JSON.stringify(counters)).not.toContain('sub1');
  });
});
