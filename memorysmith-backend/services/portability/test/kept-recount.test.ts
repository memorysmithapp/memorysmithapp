/**
 * The recount of what the kept exports occupy (RN-SUB-021, RN-SUB-024),
 * against a fake table. What matters is which transfers count: an export that
 * is ready, and nothing else — not an import, not an export still running or
 * one that failed, whose bytes were never kept.
 */

import { describe, expect, it } from 'vitest';
import { KeptRecount } from '../src/adapters/dynamo.js';

const A = '01SUBAAA';
const B = '01SUBBBB';

function tableOf(items: Record<string, unknown>[]) {
  const written: Record<string, unknown>[] = [];
  const deleted: Record<string, unknown>[] = [];
  const db = {
    async send(command: { constructor: { name: string }; input: Record<string, unknown> }) {
      if (command.constructor.name === 'PutCommand') {
        written.push(command.input['Item'] as Record<string, unknown>);
        return {};
      }
      if (command.constructor.name === 'DeleteCommand') {
        deleted.push(command.input['Key'] as Record<string, unknown>);
        return {};
      }
      return { Items: items };
    },
  };
  return { recount: new KeptRecount(db as never, 't'), written, deleted };
}

let sequence = 0;
function transfer(subscription: string, fields: Record<string, unknown>) {
  sequence += 1;
  return {
    PK: `S#${subscription}#USER#user-1`,
    SK: `TRANSFER#${sequence}`,
    entity: 'TRANSFER',
    kind: 'export',
    status: 'ready',
    ...fields,
  };
}

describe('the recount of the kept exports', () => {
  it('counts the exports that are kept, per subscription and per notebook', async () => {
    const { recount } = tableOf([
      transfer(A, { notebookId: 'nb1', bytes: 100 }),
      transfer(A, { notebookId: 'nb1', bytes: 50 }),
      transfer(A, { notebookId: 'nb2', bytes: 7 }),
      transfer(A, { notebookId: 'nb2', bytes: 999, status: 'failed' }),
      transfer(A, { notebookId: 'nb2', bytes: 999, status: 'running' }),
      transfer(A, { notebookId: 'nb3', bytes: 999, kind: 'import' }),
      transfer(B, { notebookId: 'nb9', bytes: 1 }),
    ]);

    const measured = await recount.measure();
    const a = measured.find((each) => each.subscriptionId === A);

    expect(a).toMatchObject({ count: 3, bytes: 157, stale: [] });
    expect(a?.byNotebook.get('nb1')).toEqual({ count: 2, bytes: 150 });
    expect(a?.byNotebook.get('nb2')).toEqual({ count: 1, bytes: 7 });
    expect(measured.find((each) => each.subscriptionId === B)).toMatchObject({
      count: 1,
      bytes: 1,
    });
  });

  it('replaces the counters and drops the line of a notebook no kept export is of', async () => {
    const { recount, written, deleted } = tableOf([
      transfer(A, { notebookId: 'nb1', bytes: 100 }),
      { PK: `S#${A}`, SK: 'KEPT', entity: 'KEPT', bytes: 12345 },
      { PK: `S#${A}`, SK: 'KEPT#nb-gone', entity: 'KEPT_NOTEBOOK', notebookId: 'nb-gone' },
    ]);

    await recount.apply(await recount.measure());

    expect(written).toEqual([
      { PK: `S#${A}`, SK: 'KEPT', entity: 'KEPT', bytes: 100, count: 1 },
      {
        PK: `S#${A}`,
        SK: 'KEPT#nb1',
        entity: 'KEPT_NOTEBOOK',
        notebookId: 'nb1',
        bytes: 100,
        count: 1,
      },
    ]);
    expect(deleted).toEqual([{ PK: `S#${A}`, SK: 'KEPT#nb-gone' }]);
  });
});
