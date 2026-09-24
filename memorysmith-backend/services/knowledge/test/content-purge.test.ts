/**
 * The purge, against a fake table (RN-KNW-047).
 *
 * What is worth testing here is not the Query: it is WHICH units a deletion
 * takes, what each of them declares, and that nothing is freed twice. A purge
 * that frees the bytes of a note whose deletion already freed them produces a
 * storage counter that looks plausible and is wrong, and a purge that misses a
 * unit leaves bytes a subscription keeps paying for.
 *
 * Every identifier here is a real one, because the envelope these events go
 * into is validated against the contract before it is published: a case built
 * on `N1` would assert about an event the relay would refuse.
 */

import { describe, expect, it } from 'vitest';
import {
  ContentId,
  FileId,
  FolderId,
  NoteId,
  NotebookId,
  sha256Hex,
  SubscriptionId,
} from '@memorysmith/kernel';
import {
  ContentPurge,
  type DeletionEnvelope,
  UNITS_PER_RUN,
} from '../src/adapters/inbound/content-purge.js';

const SUBSCRIPTION = SubscriptionId.generate().value;
const NOTEBOOK = NotebookId.generate().value;
const PARTITION = `S#${SUBSCRIPTION}#NOTEBOOK#${NOTEBOOK}`;

/** A name a case can read, and the identifier the product would have. */
const identifiers = new Map<string, string>();
function idOf(name: string, mint: () => string): string {
  const known = identifiers.get(name);
  if (known) return known;
  const minted = mint();
  identifiers.set(name, minted);
  return minted;
}
const slot = (name: string) => idOf(name, () => ContentId.generate().value);
const folder = (name: string) => idOf(name, () => FolderId.generate().value);
const noteId = (name: string) => idOf(name, () => NoteId.generate().value);
const fileId = (name: string) => idOf(name, () => FileId.generate().value);
/** Reads a list of identifiers back as the names the case gave them. */
const named = (values: readonly string[]) =>
  values.map((value) => [...identifiers].find(([, id]) => id === value)?.[0] ?? value);

function ref(contentId: string, bytes: number) {
  return { contentId, versionId: 'v1', sha256: 'a'.repeat(64), bytes };
}

const authorship = { userId: 'user-owner', agent: null, at: '2026-09-16T00:00:00.000Z' };

function envelope(
  type: string,
  payload: Record<string, unknown>,
  contentRef: unknown = null,
): DeletionEnvelope {
  return { type, subscriptionId: SUBSCRIPTION, authorship, contentRef, payload };
}

/**
 * A table that answers a Query by prefix and applies what a transaction
 * writes, which is the whole of what the worker does to it.
 */
function tableOf(items: Record<string, unknown>[]) {
  const rows = new Map(items.map((item) => [String(item['SK']), item]));
  const purged: string[] = [];
  /** Which key shape each destroyed slot was asked for: a file lives under `f/`. */
  const kinds = new Map<string, string>();
  const events: Array<Record<string, unknown>> = [];

  const db = {
    async send(command: { constructor: { name: string }; input: Record<string, unknown> }) {
      const name = command.constructor.name;
      if (name === 'GetCommand') {
        return { Item: rows.get((command.input['Key'] as { SK: string }).SK) };
      }
      if (name === 'QueryCommand') {
        const values = command.input['ExpressionAttributeValues'] as Record<string, string>;
        const prefix = values[':prefix'] ?? '';
        return {
          Items: [...rows.values()].filter((item) => String(item['SK']).startsWith(prefix)),
        };
      }
      if (name === 'TransactWriteCommand') {
        for (const write of command.input['TransactItems'] as Array<Record<string, unknown>>) {
          const remove = write['Delete'] as { Key: { SK: string } } | undefined;
          if (remove) rows.delete(remove.Key.SK);
          const put = write['Put'] as { Item: Record<string, unknown> } | undefined;
          if (put) {
            rows.set(String(put.Item['SK']), put.Item);
            if (String(put.Item['entity']) === 'EVENT') events.push(put.Item);
          }
        }
        return {};
      }
      throw new Error(`Unexpected command: ${name}`);
    },
  };

  /** The notebooks whose trail this purge closed (RN-AUD-011). */
  const closed: string[] = [];

  const purge = new ContentPurge({
    db: db as never,
    tableName: 'mv-knowledge-test',
    purgerFor: () => ({
      purge: async (destroyed: ContentId, kind: 'note' | 'file' = 'note') => {
        purged.push(destroyed.value);
        kinds.set(destroyed.value, kind);
        return 1;
      },
    }),
    closeTrailOf: async (_subscriptionId, notebookId: string) => {
      closed.push(notebookId);
    },
  });

  return { purge, rows, purged, kinds, events, closed };
}

function noteItem(name: string, inFolder: string, bytes: number, deleted = false) {
  return {
    PK: PARTITION,
    SK: `NOTE#${noteId(name)}`,
    entity: 'NOTE',
    noteId: noteId(name),
    notebookId: NOTEBOOK,
    folderId: folder(inFolder),
    bodyRef: ref(slot(`content of ${name}`), bytes),
    ...(deleted ? { deletedAt: '2026-09-16T00:00:00.000Z' } : {}),
  };
}

function fileItem(name: string, bytes: number, deleted = false) {
  return {
    PK: PARTITION,
    SK: `FILE#${fileId(name)}`,
    entity: 'FILE',
    fileId: fileId(name),
    notebookId: NOTEBOOK,
    name,
    mimeType: 'image/png',
    path: '/',
    contentRef: ref(slot(`bytes of ${name}`), bytes),
    ...(deleted ? { deletedAt: '2026-09-16T00:00:00.000Z' } : {}),
  };
}

/** The guard a live file holds on its name (RN-KNW-049). */
function fileNameItem(name: string) {
  return {
    PK: PARTITION,
    SK: `FNAME#${sha256Hex(name.normalize('NFC'))}`,
    entity: 'FILE_NAME',
    fileId: fileId(name),
    name,
  };
}

function templateItem(inFolder: string, bytes: number) {
  return {
    PK: PARTITION,
    SK: `FTPL#${folder(inFolder)}`,
    entity: 'TEMPLATE',
    notebookId: NOTEBOOK,
    folderId: folder(inFolder),
    contentRef: ref(slot(`template of ${inFolder}`), bytes),
  };
}

describe('the purge of one deleted note', () => {
  it('destroys its content, takes its item and frees nothing it already freed', async () => {
    const { purge, rows, purged, events } = tableOf([noteItem('first', 'notes', 500, true)]);

    const outcome = await purge.run(
      envelope('NoteDeleted', { notebookId: NOTEBOOK, noteId: noteId('first') }),
    );

    expect(outcome).toEqual({ purged: 1, done: true });
    expect(named(purged)).toEqual(['content of first']);
    expect(rows.has(`NOTE#${noteId('first')}`)).toBe(false);
    const [event] = events;
    expect(event?.['type']).toBe('NotePurged');
    // Deleting the note already freed its bytes; freeing them again would make
    // the counter of the subscription lie (RN-SUB-021).
    expect(event?.['storageDelta']).toBe(0);
    // The purge is filed under whoever deleted it (RN-AUD-010).
    expect((event?.['authorship'] as { userId: string }).userId).toBe('user-owner');
  });

  it('changes nothing the second time it runs', async () => {
    const { purge, purged, events } = tableOf([noteItem('first', 'notes', 500, true)]);
    const deletion = envelope('NoteDeleted', { notebookId: NOTEBOOK, noteId: noteId('first') });

    await purge.run(deletion);
    const again = await purge.run(deletion);

    // Delivery is at least once, so a second pass has to be a no-op.
    expect(again).toEqual({ purged: 0, done: true });
    expect(purged).toHaveLength(1);
    expect(events).toHaveLength(1);
  });
});

describe('the purge of what a removed folder invalidated', () => {
  it('takes the notes of the removed folders and their Templates, and nothing else', async () => {
    const { purge, rows, purged, events, closed } = tableOf([
      noteItem('gone', 'removed', 100),
      noteItem('also gone', 'removed child', 200),
      noteItem('kept', 'elsewhere', 400),
      templateItem('removed', 50),
      templateItem('elsewhere', 60),
    ]);

    await purge.run(
      envelope('FolderRemoved', {
        notebookId: NOTEBOOK,
        folderId: folder('removed'),
        removedFolderIds: [folder('removed'), folder('removed child')],
      }),
    );

    expect(named(purged).sort()).toEqual([
      'content of also gone',
      'content of gone',
      'template of removed',
    ]);
    expect([...rows.keys()].filter((key) => key.startsWith('NOTE#'))).toEqual([
      `NOTE#${noteId('kept')}`,
    ]);
    expect([...rows.keys()].filter((key) => key.startsWith('FTPL#'))).toEqual([
      `FTPL#${folder('elsewhere')}`,
    ]);
    // A note that was live when its folder went frees its bytes HERE: nothing
    // wrote it, so no other event ever said so.
    const notes = events.filter((event) => event['type'] === 'NotePurged');
    expect(notes.map((event) => Number(event['storageDelta'])).sort((a, b) => a - b)).toEqual([
      -200, -100,
    ]);
    // The notebook is alive, so its trail is untouched: what closes one is the
    // deletion of the notebook and nothing smaller (RN-AUD-011).
    expect(closed).toEqual([]);
  });
});

describe('the purge of a deleted notebook', () => {
  it('leaves nothing of it in the table but the outbox', async () => {
    const { purge, rows, purged, events, closed } = tableOf([
      noteItem('deleted first', 'notes', 100, true),
      noteItem('still live', 'notes', 200),
      {
        PK: PARTITION,
        SK: 'GUIDANCE',
        entity: 'GUIDANCE',
        notebookId: NOTEBOOK,
        contentRef: ref(slot('the guidance'), 70),
      },
      templateItem('notes', 50),
      { PK: PARTITION, SK: `FOLDER#${folder('notes')}`, entity: 'FOLDER' },
      { PK: PARTITION, SK: 'FSTAT', entity: 'NBSTAT', noteCount: 2 },
      { PK: PARTITION, SK: `FSTAT#${folder('notes')}`, entity: 'FSTAT', noteCount: 2 },
      { PK: PARTITION, SK: 'SLUG#ROOT#normas', entity: 'SLUG' },
      { PK: PARTITION, SK: 'LIMIT#user-member', entity: 'LIMIT' },
      { PK: PARTITION, SK: 'META', entity: 'NOTEBOOK', notebookId: NOTEBOOK },
    ]);

    await purge.run(envelope('NotebookDeleted', { notebookId: NOTEBOOK }));

    expect(named(purged).sort()).toEqual([
      'content of deleted first',
      'content of still live',
      'template of notes',
      'the guidance',
    ]);
    // Everything of the notebook is gone from the table, and what is left is
    // the outbox: taking an event away before the relay published it would
    // lose the very events this purge wrote.
    expect([...rows.keys()].filter((key) => !key.startsWith('EVENT#'))).toEqual([]);
    expect(events.map((event) => event['type'])).toEqual([
      'NotePurged',
      'NotePurged',
      'TemplatePurged',
      'GuidancePurged',
      'NotebookPurged',
    ]);
    // Only what was still counted is freed: the deleted note freed its bytes
    // when it was deleted.
    const freed = events.reduce((total, event) => total + Number(event['storageDelta'] ?? 0), 0);
    expect(freed).toBe(-(200 + 70 + 50));
    /**
     * And the trail of the notebook is closed, keeping its life and losing
     * what happened inside it (RN-AUD-011). It happens after the tree, so a
     * run that stopped on its budget does not close a trail that is still
     * receiving the purge of what is left.
     */
    expect(closed).toEqual([NOTEBOOK]);
  });

  it('says what each unit took off the counters of the space (RN-SUB-024)', async () => {
    const { purge, events } = tableOf([
      noteItem('deleted first', 'notes', 100, true),
      noteItem('still live', 'notes', 200),
      templateItem('notes', 50),
      { PK: PARTITION, SK: `FOLDER#${folder('notes')}`, entity: 'FOLDER' },
      { PK: PARTITION, SK: `FOLDER#${folder('other')}`, entity: 'FOLDER' },
      { PK: PARTITION, SK: 'META', entity: 'NOTEBOOK', notebookId: NOTEBOOK },
    ]);

    await purge.run(envelope('NotebookDeleted', { notebookId: NOTEBOOK }));

    const payloads = events.map((event) => ({
      type: event['type'],
      ...(event['payload'] as Record<string, unknown>),
    }));
    // A note deleted on its own left the count at its deletion; one the
    // notebook took with it leaves it here. Both take their revisions along.
    expect(payloads.filter((each) => each.type === 'NotePurged')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ noteId: noteId('deleted first'), live: false, revisions: 1 }),
        expect.objectContaining({ noteId: noteId('still live'), live: true, revisions: 1 }),
      ]),
    );
    expect(payloads.find((each) => each.type === 'TemplatePurged')).toMatchObject({
      live: true,
      revisions: 1,
    });
    // The folders the tree still held, which no FolderRemoved will ever say
    // are gone.
    expect(payloads.find((each) => each.type === 'NotebookPurged')).toMatchObject({
      folderCount: 2,
    });
  });
});

describe('the purge of the files of a deleted notebook (#202)', () => {
  it('destroys the bytes of every file, takes their items and frees what was still counted', async () => {
    const { purge, rows, purged, kinds, events, closed } = tableOf([
      noteItem('a note', 'notes', 100),
      fileItem('picture.png', 3000),
      fileNameItem('picture.png'),
      fileItem('diagram.png', 2000),
      fileNameItem('diagram.png'),
      // Deleted on its own before the notebook went: its name and its bytes
      // were released then, and its item waits here as a tombstone.
      fileItem('old.png', 500, true),
      { PK: PARTITION, SK: `FOLDER#${folder('notes')}`, entity: 'FOLDER' },
      { PK: PARTITION, SK: 'META', entity: 'NOTEBOOK', notebookId: NOTEBOOK },
    ]);

    const outcome = await purge.run(envelope('NotebookDeleted', { notebookId: NOTEBOOK }));

    expect(outcome.done).toBe(true);
    expect(named(purged).sort()).toEqual([
      'bytes of diagram.png',
      'bytes of old.png',
      'bytes of picture.png',
      'content of a note',
    ]);
    // The bytes of a file are under the key of a file, not of a slot.
    expect(kinds.get(slot('bytes of picture.png'))).toBe('file');
    expect(kinds.get(slot('bytes of old.png'))).toBe('file');
    // Nothing of any file is left: not its item, not the guard of its name.
    expect([...rows.keys()].filter((key) => !key.startsWith('EVENT#'))).toEqual([]);

    // A live file leaves as a deletion of that one file would have left: the
    // same event, with its bytes off the count, filed under whoever deleted
    // the notebook. The tombstone already said so, and says nothing twice.
    const files = events.filter((event) => event['type'] === 'FileDeleted');
    expect(files.map((event) => event['subjectId']).sort()).toEqual(
      [fileId('picture.png'), fileId('diagram.png')].sort(),
    );
    expect(files.map((event) => Number(event['storageDelta'])).sort((a, b) => a - b)).toEqual([
      -3000, -2000,
    ]);
    expect(files[0]?.['subject']).toBe('FILE');
    expect(files[0]?.['payload']).toMatchObject({ notebookId: NOTEBOOK, mimeType: 'image/png' });
    expect((files[0]?.['authorship'] as { userId: string }).userId).toBe('user-owner');

    // The files go before the tree, and the trail closes after both.
    const order = events.map((event) => event['type']);
    expect(order.lastIndexOf('FileDeleted')).toBeLessThan(order.indexOf('NotebookPurged'));
    const freed = events.reduce((total, event) => total + Number(event['storageDelta'] ?? 0), 0);
    expect(freed).toBe(-(100 + 3000 + 2000));
    expect(closed).toEqual([NOTEBOOK]);
  });

  it('carries on in the next message when the files outlast the budget of a run', async () => {
    const count = UNITS_PER_RUN + 5;
    const names = Array.from({ length: count }, (_, at) => `picture ${at}.png`);
    const { purge, rows, purged, events, closed } = tableOf([
      ...names.flatMap((name) => [fileItem(name, 10), fileNameItem(name)]),
      { PK: PARTITION, SK: 'META', entity: 'NOTEBOOK', notebookId: NOTEBOOK },
    ]);
    const deletion = envelope('NotebookDeleted', { notebookId: NOTEBOOK });

    const first = await purge.run(deletion);

    // The run stopped on its budget: the tree and the trail are still there,
    // because what is above a file is what says the file is invalid.
    expect(first).toEqual({ purged: UNITS_PER_RUN, done: false });
    expect(rows.has('META')).toBe(true);
    expect(closed).toEqual([]);
    expect(events.filter((event) => event['type'] === 'NotebookPurged')).toHaveLength(0);

    const second = await purge.run(deletion);

    expect(second.done).toBe(true);
    expect(purged).toHaveLength(count);
    expect(events.filter((event) => event['type'] === 'FileDeleted')).toHaveLength(count);
    expect([...rows.keys()].filter((key) => !key.startsWith('EVENT#'))).toEqual([]);
    expect(closed).toEqual([NOTEBOOK]);
  });
});

describe('the purge of a Content Slot deleted on its own', () => {
  it('destroys the content the event names, and declares no bytes', async () => {
    const { purge, purged, events } = tableOf([]);

    await purge.run(
      envelope(
        'TemplateDeleted',
        { notebookId: NOTEBOOK, folderId: folder('notes') },
        ref(slot('the template that went'), 50),
      ),
    );

    // Its item went at the deletion (RN-KNW-044) and its bytes left the count
    // then, so the purge answers for the content alone.
    expect(named(purged)).toEqual(['the template that went']);
    expect(events[0]?.['type']).toBe('TemplatePurged');
    expect(events[0]?.['storageDelta']).toBe(0);
    // Its place in the count left with its bytes; what goes here is its
    // revisions (RN-SUB-024).
    expect(events[0]?.['payload']).toMatchObject({ live: false, revisions: 1 });
  });
});
