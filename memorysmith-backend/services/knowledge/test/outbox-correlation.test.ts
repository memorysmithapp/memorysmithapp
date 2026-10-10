import { describe, expect, it } from 'vitest';
import { Authorship, SubscriptionId, UserId, createEvent } from '@memorysmith/kernel';
import { openScope, runInScope } from '@memorysmith/observability';
import { outboxItem, unwrapOrThrow } from '../src/adapters/outbound/dynamodb/items.js';
import { envelopeOf } from '../src/adapters/inbound/outbox-relay.js';

const SUBSCRIPTION = '01JBQ2X0000000000000000000';

function event() {
  return createEvent({
    type: 'NotebookRenamed',
    subscriptionId: unwrapOrThrow(SubscriptionId.fromClaim(SUBSCRIPTION)),
    subject: 'NOTEBOOK',
    subjectId: '01JBQ2X0000000000000000001',
    authorship: Authorship.byHuman(unwrapOrThrow(UserId.create('user-1'))),
    payload: { notebookId: '01JBQ2X0000000000000000001', name: 'Renamed' },
  });
}

describe('the outbox writer and the correlation id (section 17)', () => {
  it('writes the id of the request in course on the outbox item, and the relay carries it', () => {
    const item = runInScope(openScope('corr-of-the-request'), () =>
      outboxItem(event(), 'PK', 'SK'),
    );
    expect(item['correlationId']).toBe('corr-of-the-request');
    expect(envelopeOf(item)).toMatchObject({ correlationId: 'corr-of-the-request' });
  });

  it('writes none outside a request, as a migration or a test does', () => {
    expect(outboxItem(event(), 'PK', 'SK')).not.toHaveProperty('correlationId');
  });
});
