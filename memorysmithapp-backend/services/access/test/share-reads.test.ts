/**
 * A share is read as it was last written (#390): the grantee accepts a moment
 * after the owner shares, and leaves a moment after accepting, so a read that
 * could miss the write answered that the notebook was not found.
 */

import { describe, expect, it } from 'vitest';
import { NotebookId, UserId } from '@memorysmithapp/kernel';
import { DynamoShareRepository } from '../src/adapters/outbound/dynamodb/DynamoAccess.js';
import { NULL_OUTBOX_SINK } from '../src/adapters/outbound/dynamodb/items.js';

function value<T>(result: { ok: true; value: T } | { ok: false }): T {
  if (!result.ok) throw new Error('A value of the test was refused');
  return result.value;
}

describe('the reads of a share', () => {
  it('are strongly consistent, on the grantee side as on any list', async () => {
    const sent: Array<{ input: { ConsistentRead?: boolean } }> = [];
    const db = {
      send: async (command: { input: { ConsistentRead?: boolean } }) => {
        sent.push(command);
        return { Items: [] };
      },
    };
    const shares = new DynamoShareRepository(db as never, 'mv-access', NULL_OUTBOX_SINK);
    const grantee = value(UserId.create('user-bea'));
    const notebook = value(NotebookId.create('01JBQ2X0000000000000000001'));

    await shares.findIncoming(grantee, notebook);
    await shares.listIncoming(grantee);

    expect(sent).toHaveLength(2);
    for (const command of sent) expect(command.input.ConsistentRead).toBe(true);
  });
});
