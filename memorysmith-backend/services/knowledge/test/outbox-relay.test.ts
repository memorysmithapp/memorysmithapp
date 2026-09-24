import { describe, expect, it } from 'vitest';
import { OutboxRelay, envelopeOf } from '../src/adapters/inbound/outbox-relay.js';

const SUBSCRIPTION = '01JBQ2X0000000000000000000';
const NOTEBOOK = '01JBQ2X0000000000000000001';
const NOTE = '01JBQ2X0000000000000000002';
const FOLDER = '01JBQ2X0000000000000000003';
const EVENT = '01JBQ2X0000000000000000005';

const outboxItem = {
  PK: `S#${SUBSCRIPTION}#NOTEBOOK#${NOTEBOOK}`,
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
    notebookId: NOTEBOOK,
    noteId: NOTE,
    folderId: FOLDER,
    name: 'Lei 14.133',
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
    const broken = { ...outboxItem, payload: { notebookId: NOTEBOOK } };
    await expect(relay.process([broken])).rejects.toThrow();
  });

  it('ignores items that are not outbox events', async () => {
    const { relay, busCalls } = fakes();
    const result = await relay.process([{ entity: 'NOTE', noteId: NOTE }]);
    expect(result.published).toBe(0);
    expect(busCalls).toHaveLength(0);
  });

  it('moves the folder and notebook counters, guarded by a dedup item', async () => {
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
        payload: { notebookId: NOTEBOOK, noteId: NOTE, folderId: FOLDER, slug: 'lei-14133' },
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
        payload: { notebookId: NOTEBOOK, noteId: NOTE, folderId: FOLDER, position: 'a1' },
      },
    ]);
    // Reordering moves no note in or out of a folder, so no counter moves.
    expect(reorder.dbCalls).toHaveLength(0);
  });

  it('publishes a batch of the stream in calls of at most ten events, and counts them all', async () => {
    // The stream hands the relay up to 25 records, and PutEvents takes ten.
    // Staging refused every batch of more than ten until this held.
    const { relay, busCalls, dbCalls } = fakes();
    const batch = Array.from({ length: 25 }, (_unused, index) => {
      const eventId = `01JBQ2X00000000000000000${String(index).padStart(2, '0')}`;
      return { ...outboxItem, SK: `EVENT#${eventId}`, eventId };
    });

    const result = await relay.process(batch);

    expect(result.published).toBe(25);
    const sizes = busCalls.map(
      (call) => (call as { input: { Entries: unknown[] } }).input.Entries.length,
    );
    expect(sizes).toEqual([10, 10, 5]);
    expect(dbCalls).toHaveLength(25);
  });

  it('fails the batch when the bus refuses an event, so the stream delivers it again', async () => {
    const relay = new OutboxRelay({
      bus: {
        send: async () => ({
          FailedEntryCount: 1,
          Entries: [{ ErrorCode: 'InternalFailure', ErrorMessage: 'try again' }],
        }),
      } as never,
      db: { send: async () => undefined } as never,
      tableName: 'mv-knowledge',
      busName: 'mv-events',
      source: 'memorysmith.knowledge',
    });

    await expect(relay.process([outboxItem])).rejects.toThrow('refused 1 of 1');
  });

  it('builds the envelope with no attribute of the storage layer', () => {
    const envelope = envelopeOf(outboxItem) as Record<string, unknown>;
    expect(envelope['PK']).toBeUndefined();
    expect(envelope['SK']).toBeUndefined();
    expect(envelope['ttl']).toBeUndefined();
    expect(envelope['subscriptionId']).toBe(SUBSCRIPTION);
  });

  describe('what fills the space (RN-SUB-024)', () => {
    type Write = Record<string, Record<string, unknown>>;
    const writesOf = (dbCalls: unknown[]): Write[] =>
      (dbCalls[0] as { input: { TransactItems: Write[] } }).input.TransactItems;
    /** An Update of the transaction, read back as the counters it adds. */
    const added = (write: Write | undefined): Record<string, unknown> => {
      const update = write?.['Update'] ?? {};
      const names = (update['ExpressionAttributeNames'] ?? {}) as Record<string, string>;
      const values = (update['ExpressionAttributeValues'] ?? {}) as Record<string, unknown>;
      const expression = String(update['UpdateExpression'] ?? '');
      const adds = /ADD (.*?)( SET|$)/.exec(expression)?.[1] ?? '';
      return Object.fromEntries(
        adds.split(', ').map((pair) => {
          const [name = '', value = ''] = pair.split(' ');
          return [names[name] ?? name, values[value]];
        }),
      );
    };
    const updateOf = (writes: Write[], sk: string): Write | undefined =>
      writes.find((write) => (write['Update']?.['Key'] as { SK?: string } | undefined)?.SK === sk);

    it('adds a note to its kind, its notebook and the revisions, beside the total', async () => {
      const { relay, dbCalls } = fakes();
      await relay.process([{ ...outboxItem, storageDelta: 12 }]);
      const writes = writesOf(dbCalls);

      const usage = updateOf(writes, 'USAGE');
      expect((usage?.['Update']?.['Key'] as { PK: string }).PK).toBe(`S#${SUBSCRIPTION}#NOTEBOOKS`);
      expect(added(usage)).toEqual({ storedBytes: 12, noteCount: 1, noteBytes: 12, revisions: 1 });
      expect(added(updateOf(writes, `NBUSAGE#${NOTEBOOK}`))).toEqual({ notes: 1, bytes: 12 });
      // Nothing of it touches the notebook's own partition beyond the counters
      // that were already there, and never its META item (rule 10).
      expect(
        writes.some((write) => (write['Update']?.['Key'] as { SK?: string })?.SK === 'META'),
      ).toBe(false);
    });

    it('moves a note and its bytes between notebooks, and nothing in the subscription', async () => {
      const OTHER = '01JBQ2X0000000000000000009';
      const { relay, dbCalls } = fakes();
      await relay.process([
        {
          ...outboxItem,
          type: 'NoteMoved',
          payload: {
            noteId: NOTE,
            fromNotebookId: NOTEBOOK,
            fromFolderId: FOLDER,
            toNotebookId: OTHER,
            toFolderId: FOLDER,
            position: 'a0',
          },
        },
      ]);
      const writes = writesOf(dbCalls);

      expect(updateOf(writes, 'USAGE')).toBeUndefined();
      expect(added(updateOf(writes, `NBUSAGE#${NOTEBOOK}`))).toEqual({ notes: -1, bytes: -12 });
      expect(added(updateOf(writes, `NBUSAGE#${OTHER}`))).toEqual({ notes: 1, bytes: 12 });
    });

    it('counts a file as a file', async () => {
      const { relay, dbCalls } = fakes();
      await relay.process([
        {
          ...outboxItem,
          type: 'FileKept',
          subject: 'FILE',
          storageDelta: 4096,
          payload: {
            notebookId: NOTEBOOK,
            fileId: NOTE,
            name: 'picture.png',
            mimeType: 'image/png',
            path: '',
          },
        },
      ]);
      const writes = writesOf(dbCalls);
      expect(added(updateOf(writes, 'USAGE'))).toEqual({
        storedBytes: 4096,
        fileCount: 1,
        fileBytes: 4096,
      });
      expect(added(updateOf(writes, `NBUSAGE#${NOTEBOOK}`))).toEqual({ files: 1, bytes: 4096 });
    });

    it('takes a purged notebook off the list, with the folders its tree still held', async () => {
      const { relay, dbCalls } = fakes();
      await relay.process([
        {
          ...outboxItem,
          type: 'NotebookPurged',
          subject: 'NOTEBOOK',
          subjectId: NOTEBOOK,
          contentRef: null,
          payload: { notebookId: NOTEBOOK, folderCount: 3 },
        },
      ]);
      const writes = writesOf(dbCalls);
      expect(added(updateOf(writes, 'USAGE'))).toEqual({ notebooks: -1, folders: -3 });
      expect(writes.find((write) => write['Delete'])?.['Delete']?.['Key']).toEqual({
        PK: `S#${SUBSCRIPTION}#NOTEBOOKS`,
        SK: `NBUSAGE#${NOTEBOOK}`,
      });
    });

    it('takes a note invalidated by its folder off the count when the purge frees it', async () => {
      const { relay, dbCalls } = fakes();
      await relay.process([
        {
          ...outboxItem,
          type: 'NotePurged',
          storageDelta: -12,
          payload: {
            notebookId: NOTEBOOK,
            noteId: NOTE,
            folderId: FOLDER,
            live: true,
            revisions: 3,
          },
        },
      ]);
      const writes = writesOf(dbCalls);
      expect(added(updateOf(writes, 'USAGE'))).toEqual({
        storedBytes: -12,
        noteCount: -1,
        noteBytes: -12,
        revisions: -3,
      });
    });

    it('takes only the revisions of a note deleted on its own, which left the count before', async () => {
      const { relay, dbCalls } = fakes();
      await relay.process([
        {
          ...outboxItem,
          type: 'NotePurged',
          storageDelta: 0,
          payload: {
            notebookId: NOTEBOOK,
            noteId: NOTE,
            folderId: FOLDER,
            live: false,
            revisions: 2,
          },
        },
      ]);
      const writes = writesOf(dbCalls);
      expect(added(updateOf(writes, 'USAGE'))).toEqual({ revisions: -2 });
      expect(updateOf(writes, `NBUSAGE#${NOTEBOOK}`)).toBeUndefined();
    });
  });
});
