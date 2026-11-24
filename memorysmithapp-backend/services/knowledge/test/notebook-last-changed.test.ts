import { describe, expect, it } from 'vitest';
import { Role, SubscriptionId } from '@memorysmithapp/kernel';
import { notebookMetaItem, parseNotebook } from '../src/adapters/outbound/dynamodb/items.js';
import { notebookToSummary } from '../src/adapters/inbound/http/presenters.js';
import { newNotebook } from './fixtures.js';

/**
 * When a notebook last changed (#546). A note write never touches the
 * notebook's META (INV-10), so what the Notebooks page shows is the later of
 * META's date and the one the relay keeps on the counter item.
 */
describe('when a notebook last changed', () => {
  const subscription = SubscriptionId.generate();
  const meta = () => notebookMetaItem(newNotebook(), 'PK');

  it('is the date a note last changed, when that is later than the notebook itself', () => {
    const item = meta();
    const later = new Date(Date.parse(String(item['updatedAt'])) + 4 * 86_400_000).toISOString();
    const read = parseNotebook(
      [item, { SK: 'FSTAT', noteCount: 3, contentChangedAt: later }],
      subscription,
    );
    expect(read?.lastChangedAt.toISOString()).toBe(later);
    expect(read?.noteCount).toBe(3);
    expect(notebookToSummary(read!, Role.OWNER).updatedAt).toBe(later);
  });

  it('is the notebook itself when it changed after its last note', () => {
    const item = meta();
    const read = parseNotebook(
      [item, { SK: 'FSTAT', noteCount: 0, contentChangedAt: '2020-01-01T00:00:00.000Z' }],
      subscription,
    );
    expect(read?.lastChangedAt.toISOString()).toBe(item['updatedAt']);
  });

  it('is the notebook itself for a counter item written before the relay kept the date', () => {
    const item = meta();
    const read = parseNotebook([item, { SK: 'FSTAT', noteCount: 1 }], subscription);
    expect(read?.lastChangedAt.toISOString()).toBe(item['updatedAt']);
  });
});
