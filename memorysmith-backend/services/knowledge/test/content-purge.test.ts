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
import { ContentId, FolderId, NoteId, NotebookId, SubscriptionId } from '@memorysmith/kernel';
import { ContentPurge, type DeletionEnvelope } from '../src/adapters/inbound/content-purge.js';

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

  const purge = new ContentPurge({
    db: db as never,
    tableName: 'mv-knowledge-test',
    purgerFor: () => ({
      purge: async (destroyed: ContentId) => {
        purged.push(destroyed.value);
        return 1;
      },
    }),
  });

  return { purge, rows, purged, events };
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
    const { purge, rows, purged, events } = tableOf([
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
  });
});

describe('the purge of a deleted notebook', () => {
  it('leaves nothing of it in the table but the outbox', async () => {
    const { purge, rows, purged, events } = tableOf([
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
  });
});
