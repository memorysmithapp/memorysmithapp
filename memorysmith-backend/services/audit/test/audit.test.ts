import { describe, expect, it } from 'vitest';
import { Instant, SubscriptionId } from '@memorysmith/kernel';
import { DynamoAuditTrail, InMemoryAuditTrail } from '../src/adapters/outbound/DynamoAuditTrail.js';
import {
  GetNoteHistory,
  GetNotebookActivity,
  ReadRevision,
  RecordEvents,
} from '../src/application/index.js';
import { AuditEventConsumer } from '../src/adapters/inbound/event-consumer.js';
import type { RevisionReader } from '../src/domain/index.js';
import type { ContentRef } from '@memorysmith/kernel';

const SUBSCRIPTION = '01JBQ2X0000000000000000000';
const NOTEBOOK = '01JBQ2X0000000000000000001';
const NOTE = '01JBQ2X0000000000000000002';
const FOLDER = '01JBQ2X0000000000000000003';
const CONTENT = '01JBQ2X0000000000000000004';
const OTHER_NOTE = '01JBQ2X0000000000000000005';

/** Unwraps what the kernel hands back as a Result, in a test that seeded it. */
function need<T>(result: { ok: true; value: T } | { ok: false }): T {
  if (!result.ok) throw new Error('The test seeded an unusable value');
  return result.value;
}

/** The bucket, faked: revision id to content. */
class FakeRevisionReader implements RevisionReader {
  constructor(private readonly revisions: Record<string, string>) {}
  async read(ref: ContentRef): Promise<string> {
    const found = this.revisions[ref.versionId];
    if (found === undefined) throw new Error(`No such revision: ${ref.versionId}`);
    return found;
  }
}

function envelope(input: {
  eventId: string;
  type: string;
  at: string;
  versionId?: string;
  payload?: Record<string, unknown>;
  agent?: boolean;
}): Record<string, unknown> {
  return {
    eventId: input.eventId,
    type: input.type,
    occurredAt: input.at,
    subscriptionId: SUBSCRIPTION,
    subject: 'NOTE',
    subjectId: NOTE,
    authorship: {
      userId: 'user-1',
      agent: input.agent ? { clientId: 'https://claude.ai/mcp', clientName: 'Claude' } : null,
      at: input.at,
    },
    contentRef: input.versionId
      ? { contentId: CONTENT, versionId: input.versionId, sha256: 'a'.repeat(64), bytes: 10 }
      : null,
    payload: input.payload ?? {
      notebookId: NOTEBOOK,
      noteId: NOTE,
      folderId: FOLDER,
      name: 'Lei 14.133',
      slug: 'lei-14133',
      position: 'a0',
    },
  };
}

async function seedTrail() {
  const trail = new InMemoryAuditTrail();
  await new AuditEventConsumer(new RecordEvents(trail, trail)).consume([
    envelope({
      eventId: '01JBQ2X000000000000000000A',
      type: 'NoteCreated',
      at: '2026-03-01T10:00:00.000Z',
      versionId: 'v1',
    }),
    envelope({
      eventId: '01JBQ2X000000000000000000B',
      type: 'NoteUpdated',
      at: '2026-03-10T10:00:00.000Z',
      versionId: 'v2',
      payload: {
        notebookId: NOTEBOOK,
        noteId: NOTE,
        folderId: FOLDER,
        name: 'Lei 14.133',
        slug: 'lei-14133',
      },
      agent: true,
    }),
    envelope({
      eventId: '01JBQ2X000000000000000000C',
      type: 'NoteUpdated',
      at: '2026-03-20T10:00:00.000Z',
      versionId: 'v3',
      payload: {
        notebookId: NOTEBOOK,
        noteId: NOTE,
        folderId: FOLDER,
        name: 'Lei 14.133',
        slug: 'lei-14133',
      },
    }),
  ]);
  const content = new FakeRevisionReader({
    v1: '# Primeira versao',
    v2: '# Versao de 10 de marco',
    v3: '# Versao vigente',
  });
  return { trail, content };
}

describe('The trail writes every entry the table hands back', () => {
  /** A table that leaves the first entries of each answer unwritten, as DynamoDB does under load. */
  function tableHandingBack(unwrittenPerAnswer: number[]) {
    const offered: number[] = [];
    const db = {
      send: async (command: {
        input: { RequestItems?: Record<string, unknown[]>; Key?: unknown };
      }) => {
        // The consumer asks whether the trail of that notebook was closed
        // before it appends anything (RN-AUD-011). No notebook here was.
        if (!command.input.RequestItems) return {};
        const requests = command.input.RequestItems['mv-audit'] ?? [];
        offered.push(requests.length);
        const unwritten = unwrittenPerAnswer.shift() ?? 0;
        return unwritten > 0
          ? { UnprocessedItems: { 'mv-audit': requests.slice(0, unwritten) } }
          : { UnprocessedItems: {} };
      },
    };
    const trail = new DynamoAuditTrail(db as never, 'mv-audit', null, async () => undefined);
    return { trail, offered };
  }

  const three = [
    envelope({
      eventId: '01JBQ2X000000000000000000A',
      type: 'NoteCreated',
      at: '2026-03-01T10:00:00.000Z',
      versionId: 'v1',
    }),
    envelope({
      eventId: '01JBQ2X000000000000000000B',
      type: 'NoteCreated',
      at: '2026-03-01T10:01:00.000Z',
      versionId: 'v2',
    }),
    envelope({
      eventId: '01JBQ2X000000000000000000C',
      type: 'NoteCreated',
      at: '2026-03-01T10:02:00.000Z',
      versionId: 'v3',
    }),
  ];

  it('offers again only what the table did not write, until it is all written', async () => {
    const { trail, offered } = tableHandingBack([2, 1, 0]);
    await new AuditEventConsumer(new RecordEvents(trail, trail)).consume(three);
    expect(offered).toEqual([3, 2, 1]);
  });

  it('fails when entries stay unwritten, so the events are delivered again', async () => {
    const { trail } = tableHandingBack([3, 3, 3, 3, 3, 3]);
    await expect(
      new AuditEventConsumer(new RecordEvents(trail, trail)).consume(three),
    ).rejects.toThrow('not written');
  });
});

describe('The trail is append-only and keyed by subject', () => {
  it('appends every event of the bus with its authorship', async () => {
    const { trail } = await seedTrail();
    const timeline = await trail.timelineOf('NOTE', NOTE);
    expect(timeline).toHaveLength(3);
    expect(timeline[0]?.type).toBe('NoteCreated');
    // Chronological order comes from the sort key, with no sorting at read.
    expect(timeline.map((event) => event.occurredAt.toISOString())).toEqual([
      '2026-03-01T10:00:00.000Z',
      '2026-03-10T10:00:00.000Z',
      '2026-03-20T10:00:00.000Z',
    ]);
  });

  it('records which agent wrote on behalf of which human', async () => {
    const { trail } = await seedTrail();
    const timeline = await trail.timelineOf('NOTE', NOTE);
    const byAgent = timeline[1];
    expect(byAgent?.authorship.agent?.clientName).toBe('Claude');
    expect(byAgent?.authorship.user.value).toBe('user-1');
    // The UI write has no agent, and that is the distinction that matters.
    expect(timeline[2]?.authorship.agent).toBeNull();
  });

  it('refuses an event that does not match its contract', async () => {
    const trail = new InMemoryAuditTrail();
    await expect(
      new AuditEventConsumer(new RecordEvents(trail, trail)).consume([
        { eventId: 'nope', type: 'NoteCreated' },
      ]),
    ).rejects.toThrow();
  });

  it('offers no way to change what was written', () => {
    const trail = new InMemoryAuditTrail();
    const surface = Object.getOwnPropertyNames(Object.getPrototypeOf(trail));
    // The code offers append and reads, and nothing that mutates the past.
    // The REAL guarantee is the explicit IAM Deny on UpdateItem and
    // DeleteItem for mv-audit (PE4); this only records that the application
    // adds no door of its own.
    expect(surface).toContain('append');
    expect(surface.filter((name) => /update|delete|remove|purge/i.test(name))).toEqual([]);
  });
});

describe('read_note(asOf) rebuilds the past', () => {
  it('returns the revision in force on a date', async () => {
    const { trail, content } = await seedTrail();
    const read = new ReadRevision(trail, content);

    const onTheFifteenth = await read.execute({ noteId: NOTE, asOf: '2026-03-15T00:00:00.000Z' });
    expect(read.constructor.name).toBe('ReadRevision');
    expect(onTheFifteenth.ok).toBe(true);
    if (!onTheFifteenth.ok) return;
    // On the 15th the note said what the edit of the 10th left behind.
    expect(onTheFifteenth.value.content).toBe('# Versao de 10 de marco');
    expect(onTheFifteenth.value.event.contentRef?.versionId).toBe('v2');
  });

  it('returns the current revision when no date is given', async () => {
    const { trail, content } = await seedTrail();
    const latest = await new ReadRevision(trail, content).execute({ noteId: NOTE });
    expect(latest.ok).toBe(true);
    if (!latest.ok) return;
    expect(latest.value.content).toBe('# Versao vigente');
  });

  it('returns a specific revision by its version id', async () => {
    const { trail, content } = await seedTrail();
    const first = await new ReadRevision(trail, content).execute({ noteId: NOTE, versionId: 'v1' });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.content).toBe('# Primeira versao');
  });

  it('answers NOT_FOUND for a date before the note existed', async () => {
    const { trail, content } = await seedTrail();
    const tooEarly = await new ReadRevision(trail, content).execute({
      noteId: NOTE,
      asOf: '2026-02-01T00:00:00.000Z',
    });
    expect(tooEarly.ok).toBe(false);
    if (tooEarly.ok) return;
    expect(tooEarly.error.code).toBe('NOT_FOUND');
  });

  it('keeps answering after the note is deleted', async () => {
    // Deleting a note never destroys the content (RN-AUD-006).
    const { trail, content } = await seedTrail();
    await new AuditEventConsumer(new RecordEvents(trail, trail)).consume([
      envelope({
        eventId: '01JBQ2X000000000000000000D',
        type: 'NoteDeleted',
        at: '2026-03-25T10:00:00.000Z',
        payload: { notebookId: NOTEBOOK, noteId: NOTE, folderId: FOLDER, slug: 'lei-14133' },
      }),
    ]);

    const afterDeletion = await new ReadRevision(trail, content).execute({
      noteId: NOTE,
      asOf: '2026-03-30T00:00:00.000Z',
    });
    expect(afterDeletion.ok).toBe(true);
    if (!afterDeletion.ok) return;
    expect(afterDeletion.value.content).toBe('# Versao vigente');
  });
});

describe('History and activity', () => {
  it('serves the timeline of a note by its identifier', async () => {
    const { trail } = await seedTrail();
    const history = await new GetNoteHistory(trail).execute(NOTE);
    expect(history.ok).toBe(true);
    if (!history.ok) return;
    expect(history.value).toHaveLength(3);
  });

  it('survives the note changing notebook, because the key is by subject', async () => {
    const { trail } = await seedTrail();
    await new AuditEventConsumer(new RecordEvents(trail, trail)).consume([
      {
        eventId: '01JBQ2X000000000000000000E',
        type: 'NoteMoved',
        occurredAt: '2026-04-01T10:00:00.000Z',
        subscriptionId: SUBSCRIPTION,
        subject: 'NOTE',
        subjectId: NOTE,
        authorship: { userId: 'user-1', agent: null, at: '2026-04-01T10:00:00.000Z' },
        contentRef: null,
        payload: {
          noteId: NOTE,
          fromNotebookId: NOTEBOOK,
          fromFolderId: FOLDER,
          toNotebookId: '01JBQ2X0000000000000000009',
          toFolderId: '01JBQ2X000000000000000000F',
          slug: 'lei-14133',
          position: 'a1',
        },
      },
    ]);

    const history = await new GetNoteHistory(trail).execute(NOTE);
    expect(history.ok).toBe(true);
    if (!history.ok) return;
    // Four events, across two notebooks, under one identifier (RN-AUD-004).
    expect(history.value).toHaveLength(4);
  });

  it('stops answering about a note the purge destroyed, and keeps its entries', async () => {
    // RN-AUD-010: the trail never forgets, and the product stops serving the
    // history of something somebody deleted, because what it points at is
    // gone.
    const { trail, content } = await seedTrail();
    await new AuditEventConsumer(new RecordEvents(trail, trail)).consume([
      {
        eventId: '01JBQ2X000000000000000000P',
        type: 'NotePurged',
        occurredAt: '2026-04-02T10:00:00.000Z',
        subscriptionId: SUBSCRIPTION,
        subject: 'NOTE',
        subjectId: NOTE,
        authorship: { userId: 'user-1', agent: null, at: '2026-04-02T10:00:00.000Z' },
        contentRef: null,
        payload: { notebookId: NOTEBOOK, noteId: NOTE, folderId: FOLDER },
      },
    ]);

    const history = await new GetNoteHistory(trail).execute(NOTE);
    const revision = await new ReadRevision(trail, content).execute({ noteId: NOTE });

    expect(history.ok).toBe(false);
    expect(revision.ok).toBe(false);
    // The entries themselves are still there: append-only means appended.
    expect(await trail.timelineOf('NOTE', NOTE)).toHaveLength(4);
  });

  it('answers an empty history for a note the trail has not heard of yet', async () => {
    // The trail follows a write within seconds, so a note written a moment ago
    // has no entry yet: "nothing yet" and never "no such note", or a reader
    // waiting for the history is refused before it arrives.
    const { trail } = await seedTrail();
    const history = await new GetNoteHistory(trail).execute('01JBQ2X000000000000000NEW1');
    expect(history).toEqual({ ok: true, value: [] });
  });

  it('filters the activity of a notebook by period', async () => {
    const { trail } = await seedTrail();
    const activity = await new GetNotebookActivity(trail).execute({
      notebookId: NOTEBOOK,
      from: '2026-03-05T00:00:00.000Z',
      to: '2026-03-21T00:00:00.000Z',
    });
    expect(activity.ok).toBe(true);
    if (!activity.ok) return;
    expect(activity.value).toHaveLength(2);
    // Most recent first, which is how the screen reads it.
    expect(activity.value[0]?.occurredAt.isAfter(activity.value[1]!.occurredAt)).toBe(true);
  });

  it('rejects a malformed period', async () => {
    const { trail } = await seedTrail();
    const bad = await new GetNotebookActivity(trail).execute({
      notebookId: NOTEBOOK,
      from: 'ontem',
    });
    expect(bad.ok).toBe(false);
  });

  it('exposes no revision for an event that changed no content', async () => {
    const trail = new InMemoryAuditTrail();
    await new AuditEventConsumer(new RecordEvents(trail, trail)).consume([
      envelope({
        eventId: '01JBQ2X000000000000000000G',
        type: 'NoteReordered',
        at: '2026-03-02T10:00:00.000Z',
        payload: { notebookId: NOTEBOOK, noteId: NOTE, folderId: FOLDER, position: 'a1' },
      }),
    ]);
    const timeline = await trail.timelineOf('NOTE', NOTE);
    expect(timeline[0]?.changedContent).toBe(false);
    expect(Instant.fromISO('2026-03-02T10:00:00.000Z').ok).toBe(true);
  });
});

/**
 * What a purge does to the trail of the notebook it destroyed (RN-AUD-011).
 *
 * The two halves are one feature: the erase takes what is already there, and
 * the mark keeps out what arrives after it — which is most of it, because the
 * events of a purge travel through the outbox and reach the consumer once the
 * purge that wrote them has ended.
 */
describe('the trail of a purged notebook', () => {
  const lifeOf = async (trail: InMemoryAuditTrail): Promise<string[]> =>
    (await trail.activityOf(NOTEBOOK, null, null)).map((entry) => entry.type);

  /** An entry about the notebook itself, which the subscription keeps. */
  const NOTEBOOK_PAYLOADS: Record<string, Record<string, unknown>> = {
    NotebookCreated: {
      notebookId: NOTEBOOK,
      name: 'Normas e Legislacao',
      slug: 'normas-e-legislacao',
      description: '',
    },
    NotebookDeleted: { notebookId: NOTEBOOK, slug: 'normas-e-legislacao', noteCount: 1 },
    NotebookPurged: { notebookId: NOTEBOOK },
  };

  const notebookEnvelope = (input: {
    eventId: string;
    type: string;
    at: string;
  }): Record<string, unknown> => ({
    ...envelope({ eventId: input.eventId, type: input.type, at: input.at }),
    subject: 'NOTEBOOK',
    subjectId: NOTEBOOK,
    payload: NOTEBOOK_PAYLOADS[input.type] ?? { notebookId: NOTEBOOK },
  });

  async function seedNotebook(): Promise<InMemoryAuditTrail> {
    const trail = new InMemoryAuditTrail();
    await new AuditEventConsumer(new RecordEvents(trail, trail)).consume([
      notebookEnvelope({
        eventId: '01JBQ2X000000000000000000P',
        type: 'NotebookCreated',
        at: '2026-03-01T09:00:00.000Z',
      }),
      envelope({
        eventId: '01JBQ2X000000000000000000Q',
        type: 'NoteCreated',
        at: '2026-03-01T10:00:00.000Z',
        versionId: 'v1',
      }),
      envelope({
        eventId: '01JBQ2X000000000000000000R',
        type: 'NoteUpdated',
        at: '2026-03-01T11:00:00.000Z',
        versionId: 'v2',
      }),
      notebookEnvelope({
        eventId: '01JBQ2X000000000000000000S',
        type: 'NotebookDeleted',
        at: '2026-03-02T09:00:00.000Z',
      }),
    ]);
    return trail;
  }

  it('keeps the life of the notebook and takes what happened inside it', async () => {
    const trail = await seedNotebook();
    expect(await lifeOf(trail)).toHaveLength(4);

    const subscription = need(SubscriptionId.fromClaim(SUBSCRIPTION));
    expect(await trail.closeNotebook(subscription, NOTEBOOK)).toBe(2);

    // What is left says the notebook existed and was deleted, and by whom.
    expect(await lifeOf(trail)).toEqual(['NotebookDeleted', 'NotebookCreated']);
    expect(await trail.timelineOf('NOTE', NOTE)).toEqual([]);
  });

  it('appends nothing of that notebook afterwards, and its purge all the same', async () => {
    const trail = await seedNotebook();
    const subscription = need(SubscriptionId.fromClaim(SUBSCRIPTION));
    await trail.closeNotebook(subscription, NOTEBOOK);

    /**
     * Exactly what a purge publishes: one entry per unit destroyed, and one
     * for the notebook. The first kind is what the erase could not take, since
     * it had not arrived; the second is the notebook's own life.
     */
    const consumer = new AuditEventConsumer(new RecordEvents(trail, trail));
    await consumer.consume([
      envelope({
        eventId: '01JBQ2X000000000000000000T',
        type: 'NotePurged',
        at: '2026-03-02T09:05:00.000Z',
        versionId: 'v2',
        payload: { notebookId: NOTEBOOK, noteId: NOTE, folderId: FOLDER },
      }),
      notebookEnvelope({
        eventId: '01JBQ2X000000000000000000W',
        type: 'NotebookPurged',
        at: '2026-03-02T09:05:01.000Z',
      }),
    ]);

    expect(await lifeOf(trail)).toEqual(['NotebookPurged', 'NotebookDeleted', 'NotebookCreated']);
  });

  it('touches no other notebook', async () => {
    const trail = await seedNotebook();
    const subscription = need(SubscriptionId.fromClaim(SUBSCRIPTION));
    const other = '01JBQ2X000000000000000000Z';
    await new AuditEventConsumer(new RecordEvents(trail, trail)).consume([
      {
        ...envelope({
          eventId: '01JBQ2X000000000000000000V',
          type: 'NoteCreated',
          at: '2026-03-01T10:30:00.000Z',
          versionId: 'v1',
        }),
        subjectId: OTHER_NOTE,
        payload: {
          notebookId: other,
          noteId: OTHER_NOTE,
          folderId: FOLDER,
          name: 'Decreto 11.462',
          slug: 'decreto-11462',
          position: 'a0',
        },
      },
    ]);

    await trail.closeNotebook(subscription, NOTEBOOK);
    expect((await trail.activityOf(other, null, null)).map((entry) => entry.type)).toEqual([
      'NoteCreated',
    ]);
  });
});
