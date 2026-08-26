import { describe, expect, it } from 'vitest';
import { OutboxRelay, envelopeOf } from '../src/adapters/inbound/outbox-relay.js';

const SUBSCRIPTION = '01JBQ2X0000000000000000000';
const VAULT = '01JBQ2X0000000000000000001';
const NOTE = '01JBQ2X0000000000000000002';
const FOLDER = '01JBQ2X0000000000000000003';
const EVENT = '01JBQ2X0000000000000000005';

const outboxItem = {
  PK: `S#${SUBSCRIPTION}#VAULT#${VAULT}`,
  SK: `EVENT#${EVENT}`,
  entity: 'EVENT',
  eventId: EVENT,
  type: 'NoteCreated',
  occurredAt: '2026-03-12T10:15:00.000Z',
  subscriptionId: SUBSCRIPTION,
  subject: 'NOTE',
  subjectId: NOTE,
  authorship: { userId: 'user-1', agent: null, at: '2026-03-12T10:15:00.000Z' },
  contentRef: {
    contentId: '01JBQ2X0000000000000000004',
    versionId: 'v1',
    sha256: 'a'.repeat(64),
    bytes: 12,
  },
  payload: {
    vaultId: VAULT,
    noteId: NOTE,
    folderId: FOLDER,
    title: 'Lei 14.133',
    slug: 'lei-14133',
    position: 'a0',
  },
};

/** Captures what the relay would have sent, without touching AWS. */
function fakes() {
  const busCalls: unknown[] = [];
  const dbCalls: unknown[] = [];
  return {
    busCalls,
    dbCalls,
    relay: new OutboxRelay({
      bus: { send: async (command: unknown) => busCalls.push(command) } as never,
      db: { send: async (command: unknown) => dbCalls.push(command) } as never,
      tableName: 'mv-knowledge',
      busName: 'mv-events',
      source: 'memorysmith.knowledge',
    }),
  };
}

describe('OutboxRelay', () => {
  it('publishes an outbox item as a validated envelope', async () => {
    const { relay, busCalls } = fakes();
    const result = await relay.process([outboxItem]);

    expect(result.published).toBe(1);
    expect(busCalls).toHaveLength(1);
    const entries = (busCalls[0] as { input: { Entries: Array<Record<string, unknown>> } }).input
      .Entries;
    expect(entries[0]?.['DetailType']).toBe('NoteCreated');
    expect(entries[0]?.['EventBusName']).toBe('mv-events');
    const detail = JSON.parse(String(entries[0]?.['Detail'])) as Record<string, unknown>;
    // The complete ContentRef travels with the event, which is what makes the
    // audit trail a sufficient recovery index (section 9.2).
    expect(detail['contentRef']).toMatchObject({ versionId: 'v1', bytes: 12 });
  });

  it('refuses to publish an envelope that does not match its contract', async () => {
    const { relay } = fakes();
    const broken = { ...outboxItem, payload: { vaultId: VAULT } };
    await expect(relay.process([broken])).rejects.toThrow();
  });

  it('ignores items that are not outbox events', async () => {
    const { relay, busCalls } = fakes();
    const result = await relay.process([{ entity: 'NOTE', noteId: NOTE }]);
    expect(result.published).toBe(0);
    expect(busCalls).toHaveLength(0);
  });

  it('moves the folder and vault counters, guarded by a dedup item', async () => {
    const { relay, dbCalls } = fakes();
    await relay.process([outboxItem]);

    expect(dbCalls).toHaveLength(1);
    const items = (
      dbCalls[0] as { input: { TransactItems: Array<Record<string, Record<string, unknown>>> } }
    ).input.TransactItems;
    // The dedup item is what makes the counter exactly-once under replay.
    expect(items[0]?.['Put']?.['ConditionExpression']).toBe('attribute_not_exists(SK)');
    expect(String((items[0]?.['Put']?.['Item'] as Record<string, unknown>)['SK'])).toBe(
      `SEEN#${EVENT}`,
    );
    expect(String((items[1]?.['Update']?.['Key'] as Record<string, unknown>)['SK'])).toBe(
      `FSTAT#${FOLDER}`,
    );
    expect(String((items[2]?.['Update']?.['Key'] as Record<string, unknown>)['SK'])).toBe('FSTAT');
  });

  it('decrements on delete and leaves other events alone', async () => {
    const { relay, dbCalls } = fakes();
    await relay.process([
      {
        ...outboxItem,
        type: 'NoteDeleted',
        payload: { vaultId: VAULT, noteId: NOTE, folderId: FOLDER, slug: 'lei-14133' },
      },
    ]);
    const items = (
      dbCalls[0] as { input: { TransactItems: Array<Record<string, Record<string, unknown>>> } }
    ).input.TransactItems;
    expect(
      (items[1]?.['Update']?.['ExpressionAttributeValues'] as Record<string, unknown>)[':delta'],
    ).toBe(-1);

    const reorder = fakes();
    await reorder.relay.process([
      {
        ...outboxItem,
        type: 'NoteReordered',
        contentRef: null,
        payload: { vaultId: VAULT, noteId: NOTE, folderId: FOLDER, position: 'a1' },
      },
    ]);
    // Reordering moves no note in or out of a folder, so no counter moves.
    expect(reorder.dbCalls).toHaveLength(0);
  });

  it('builds the envelope with no attribute of the storage layer', () => {
    const envelope = envelopeOf(outboxItem) as Record<string, unknown>;
    expect(envelope['PK']).toBeUndefined();
    expect(envelope['SK']).toBeUndefined();
    expect(envelope['ttl']).toBeUndefined();
    expect(envelope['subscriptionId']).toBe(SUBSCRIPTION);
  });
});
