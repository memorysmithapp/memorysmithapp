import { describe, expect, it } from 'vitest';
import { Instant } from '@memorysmith/kernel';
import { InMemoryAuditTrail } from '../src/adapters/outbound/DynamoAuditTrail.js';
import {
  GetNoteHistory,
  GetVaultActivity,
  ReadRevision,
  RecordEvents,
} from '../src/application/index.js';
import { AuditEventConsumer } from '../src/adapters/inbound/event-consumer.js';
import type { RevisionReader } from '../src/domain/index.js';
import type { ContentRef } from '@memorysmith/kernel';

const SUBSCRIPTION = '01JBQ2X0000000000000000000';
const VAULT = '01JBQ2X0000000000000000001';
const NOTE = '01JBQ2X0000000000000000002';
const FOLDER = '01JBQ2X0000000000000000003';
const CONTENT = '01JBQ2X0000000000000000004';

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
      vaultId: VAULT,
      noteId: NOTE,
      folderId: FOLDER,
      title: 'Lei 14.133',
      slug: 'lei-14133',
      position: 'a0',
    },
  };
}

async function seedTrail() {
  const trail = new InMemoryAuditTrail();
  await new AuditEventConsumer(new RecordEvents(trail)).consume([
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
        vaultId: VAULT,
        noteId: NOTE,
        folderId: FOLDER,
        title: 'Lei 14.133',
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
        vaultId: VAULT,
        noteId: NOTE,
        folderId: FOLDER,
        title: 'Lei 14.133',
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
      new AuditEventConsumer(new RecordEvents(trail)).consume([
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
    await new AuditEventConsumer(new RecordEvents(trail)).consume([
      envelope({
        eventId: '01JBQ2X000000000000000000D',
        type: 'NoteDeleted',
        at: '2026-03-25T10:00:00.000Z',
        payload: { vaultId: VAULT, noteId: NOTE, folderId: FOLDER, slug: 'lei-14133' },
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

  it('survives the note changing vault, because the key is by subject', async () => {
    const { trail } = await seedTrail();
    await new AuditEventConsumer(new RecordEvents(trail)).consume([
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
          fromVaultId: VAULT,
          fromFolderId: FOLDER,
          toVaultId: '01JBQ2X0000000000000000009',
          toFolderId: '01JBQ2X000000000000000000F',
          slug: 'lei-14133',
          position: 'a1',
        },
      },
    ]);

    const history = await new GetNoteHistory(trail).execute(NOTE);
    expect(history.ok).toBe(true);
    if (!history.ok) return;
    // Four events, across two vaults, under one identifier (RN-AUD-004).
    expect(history.value).toHaveLength(4);
  });

  it('filters the activity of a vault by period', async () => {
    const { trail } = await seedTrail();
    const activity = await new GetVaultActivity(trail).execute({
      vaultId: VAULT,
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
    const bad = await new GetVaultActivity(trail).execute({ vaultId: VAULT, from: 'ontem' });
    expect(bad.ok).toBe(false);
  });

  it('exposes no revision for an event that changed no content', async () => {
    const trail = new InMemoryAuditTrail();
    await new AuditEventConsumer(new RecordEvents(trail)).consume([
      envelope({
        eventId: '01JBQ2X000000000000000000G',
        type: 'NoteReordered',
        at: '2026-03-02T10:00:00.000Z',
        payload: { vaultId: VAULT, noteId: NOTE, folderId: FOLDER, position: 'a1' },
      }),
    ]);
    const timeline = await trail.timelineOf('NOTE', NOTE);
    expect(timeline[0]?.changedContent).toBe(false);
    expect(Instant.fromISO('2026-03-02T10:00:00.000Z').ok).toBe(true);
  });
});
