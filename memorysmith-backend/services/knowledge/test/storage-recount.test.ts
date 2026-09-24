/**
 * The recount, against a fake table (RN-SUB-021).
 *
 * What is worth testing here is not the Scan, it is the ARITHMETIC: which
 * items count, which do not, and that each subscription is added up on its own.
 * A recount that quietly counts a deleted note, or adds one account's notes to
 * another, produces a number that looks plausible and is wrong, which is the
 * failure this file exists to catch.
 */

import { describe, expect, it } from 'vitest';
import { StorageRecount } from '../src/adapters/inbound/storage-recount.js';

const A = '01SUBAAA';
const B = '01SUBBBB';

function ref(bytes: number) {
  return { contentId: '01CONTENT', versionId: 'v1', sha256: 'a'.repeat(64), bytes };
}

/** Answers a Scan from a fixed list, in two pages, so paging is exercised. */
function tableOf(items: Record<string, unknown>[]) {
  const written: Record<string, unknown>[] = [];
  const deleted: Record<string, unknown>[] = [];
  const half = Math.ceil(items.length / 2);
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
      const first = command.input['ExclusiveStartKey'] === undefined;
      return first
        ? { Items: items.slice(0, half), LastEvaluatedKey: { PK: 'cursor' } }
        : { Items: items.slice(half) };
    },
  };
  return { db, written, deleted };
}

describe('storage recount', () => {
  it('counts live notes, guidance and templates, per subscription', async () => {
    const { db } = tableOf([
      { PK: `S#${A}#NOTEBOOK#1`, entity: 'GUIDANCE', contentRef: ref(100) },
      { PK: `S#${A}#NOTEBOOK#1`, entity: 'TEMPLATE', contentRef: ref(50) },
      { PK: `S#${A}#NOTEBOOK#1`, entity: 'NOTE', bodyRef: ref(1000) },
      { PK: `S#${A}#NOTEBOOK#1`, entity: 'NOTE', bodyRef: ref(2000) },
      { PK: `S#${B}#NOTEBOOK#9`, entity: 'NOTE', bodyRef: ref(7) },
    ]);

    const usage = await new StorageRecount({ db: db as never, tableName: 't' }).measure();

    expect(usage).toMatchObject([
      { subscriptionId: A, storedBytes: 3150, notes: 2, guidances: 1, templates: 1 },
      { subscriptionId: B, storedBytes: 7, notes: 1, guidances: 0, templates: 0 },
    ]);
  });

  it('leaves out a deleted note, and keeps the ones in a deleted notebook', async () => {
    const { db } = tableOf([
      { PK: `S#${A}#NOTEBOOK#1`, entity: 'NOTE', bodyRef: ref(1000) },
      {
        PK: `S#${A}#NOTEBOOK#1`,
        entity: 'NOTE',
        bodyRef: ref(500),
        deletedAt: '2026-08-29T00:00:00Z',
      },
      // The notebook was deleted and the purge has not run yet: nothing was
      // released, so its notes keep counting until it does (RN-KNW-047).
      { PK: `S#${A}#NOTEBOOK#2`, entity: 'NOTEBOOK', deletedAt: '2026-08-29T00:00:00Z' },
      { PK: `S#${A}#NOTEBOOK#2`, entity: 'GUIDANCE', contentRef: ref(80) },
      { PK: `S#${A}#NOTEBOOK#2`, entity: 'NOTE', bodyRef: ref(300) },
    ]);

    const [usage] = await new StorageRecount({ db: db as never, tableName: 't' }).measure();

    expect(usage?.storedBytes).toBe(1380);
    expect(usage?.notes).toBe(2);
  });

  it('ignores the items that point at no content', async () => {
    const { db } = tableOf([
      { PK: `S#${A}#NOTEBOOK#1`, entity: 'NOTEBOOK' }, // the notebook item points at nothing
      { PK: `S#${A}#NOTEBOOK#1`, entity: 'FOLDER' }, // and neither does a folder
      { PK: `S#${A}#NOTEBOOK#1`, entity: 'EVENT', contentRef: ref(999) }, // outbox row
      { PK: `S#${A}#NOTEBOOKS`, entity: 'USAGE', storedBytes: 12345 }, // the counter itself
      { PK: `S#${A}#NOTEBOOK#1`, entity: 'NOTE', bodyRef: ref(42) },
    ]);

    const [usage] = await new StorageRecount({ db: db as never, tableName: 't' }).measure();

    expect(usage?.storedBytes).toBe(42);
  });

  it('replaces the counter rather than adding to it', async () => {
    const { db, written } = tableOf([
      { PK: `S#${A}#NOTEBOOK#1`, entity: 'NOTE', bodyRef: ref(4096) },
    ]);
    const recount = new StorageRecount({ db: db as never, tableName: 't' });

    await recount.apply(await recount.measure());

    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({
      PK: `S#${A}#NOTEBOOKS`,
      SK: 'USAGE',
      storedBytes: 4096,
    });
  });

  it('counts the files it used to leave out, which are content since they exist', async () => {
    const { db } = tableOf([
      { PK: `S#${A}#NOTEBOOK#1`, entity: 'NOTEBOOK' },
      { PK: `S#${A}#NOTEBOOK#1`, entity: 'NOTE', bodyRef: ref(100) },
      { PK: `S#${A}#NOTEBOOK#1`, entity: 'FILE', contentRef: ref(5000) },
      // Deleted and waiting for its purge: the deletion released its bytes.
      {
        PK: `S#${A}#NOTEBOOK#1`,
        entity: 'FILE',
        contentRef: ref(9000),
        deletedAt: '2026-09-20T00:00:00Z',
      },
    ]);

    const [usage] = await new StorageRecount({ db: db as never, tableName: 't' }).measure();

    // RN-SUB-023: a file counts against the quota, and a recount that did not
    // count it handed its bytes back as a bonus.
    expect(usage?.storedBytes).toBe(5100);
    expect(usage).toMatchObject({ files: 1, fileBytes: 5000, noteBytes: 100 });
  });

  it('reports the files a notebook that is gone left behind, and counts none of them (#202)', async () => {
    const { db, written, deleted } = tableOf([
      { PK: `S#${A}#NOTEBOOK#1`, entity: 'NOTEBOOK' },
      { PK: `S#${A}#NOTEBOOK#1`, entity: 'FILE', contentRef: ref(5000) },
      // Its notebook was deleted and purged before the purge took files with
      // it: the items are still there, and nobody can reach them.
      { PK: `S#${A}#NOTEBOOK#GONE`, entity: 'FILE', contentRef: ref(3000) },
      { PK: `S#${A}#NOTEBOOK#GONE`, entity: 'FILE', contentRef: ref(2000) },
      {
        PK: `S#${A}#NOTEBOOK#GONE`,
        entity: 'FILE',
        contentRef: ref(700),
        deletedAt: '2026-09-20T00:00:00Z',
      },
    ]);
    const recount = new StorageRecount({ db: db as never, tableName: 't' });

    const [usage] = await recount.measure();

    expect(usage).toMatchObject({ storedBytes: 5000, files: 1, fileBytes: 5000 });
    expect(usage?.orphanFiles).toEqual([{ notebookId: 'GONE', files: 2, bytes: 5000 }]);
    expect(usage?.byNotebook.has('GONE')).toBe(false);

    // Reported, never destroyed: applying writes the counters and nothing of
    // the files, whose bytes only the purge may take (rule 8).
    await recount.apply(usage ? [usage] : []);
    expect(deleted).toEqual([]);
    expect(written.every((item) => String(item['PK']) === `S#${A}#NOTEBOOKS`)).toBe(true);
  });
});

describe('the recount of what fills the space (RN-SUB-024)', () => {
  const NB1 = '01NOTEBOOKONE';
  const NB2 = '01NOTEBOOKTWO';
  const items = [
    { PK: `S#${A}#NOTEBOOK#${NB1}`, SK: 'META', entity: 'NOTEBOOK' },
    { PK: `S#${A}#NOTEBOOK#${NB1}`, SK: 'FOLDER#f1', entity: 'FOLDER' },
    { PK: `S#${A}#NOTEBOOK#${NB1}`, SK: 'FOLDER#f2', entity: 'FOLDER' },
    { PK: `S#${A}#NOTEBOOK#${NB1}`, SK: 'NOTE#n1', entity: 'NOTE', bodyRef: ref(100) },
    { PK: `S#${A}#NOTEBOOK#${NB1}`, SK: 'FILE#x', entity: 'FILE', contentRef: ref(1000) },
    { PK: `S#${A}#NOTEBOOK#${NB1}`, SK: 'GUIDANCE', entity: 'GUIDANCE', contentRef: ref(30) },
    { PK: `S#${A}#NOTEBOOK#${NB1}`, SK: 'FTPL#f1', entity: 'TEMPLATE', contentRef: ref(20) },
    // Deleted and not purged yet: it still holds what it holds, and it is still
    // a notebook, exactly as the relay counts it until the purge ends.
    {
      PK: `S#${A}#NOTEBOOK#${NB2}`,
      SK: 'META',
      entity: 'NOTEBOOK',
      deletedAt: '2026-09-20T00:00:00Z',
    },
    { PK: `S#${A}#NOTEBOOK#${NB2}`, SK: 'FOLDER#f3', entity: 'FOLDER' },
    { PK: `S#${A}#NOTEBOOK#${NB2}`, SK: 'NOTE#n2', entity: 'NOTE', bodyRef: ref(7) },
    // What the relay kept, one line of it for a notebook that is gone.
    { PK: `S#${A}#NOTEBOOKS`, SK: 'USAGE', entity: 'USAGE', storedBytes: 1, revisions: 41 },
    { PK: `S#${A}#NOTEBOOKS`, SK: `NBUSAGE#${NB1}`, entity: 'NBUSAGE', notebookId: NB1 },
    { PK: `S#${A}#NOTEBOOKS`, SK: 'NBUSAGE#01GONE', entity: 'NBUSAGE', notebookId: '01GONE' },
  ];

  it('counts every kind, every notebook and every folder', async () => {
    const { db } = tableOf(items);

    const [usage] = await new StorageRecount({ db: db as never, tableName: 't' }).measure();

    expect(usage).toMatchObject({
      storedBytes: 1157,
      notes: 2,
      noteBytes: 107,
      files: 1,
      fileBytes: 1000,
      guidances: 1,
      templates: 1,
      otherBytes: 50,
      folders: 3,
      notebooks: 2,
      stale: ['01GONE'],
    });
    expect(usage?.byNotebook.get(NB1)).toEqual({ bytes: 1150, notes: 1, folders: 2, files: 1 });
    expect(usage?.byNotebook.get(NB2)).toEqual({ bytes: 7, notes: 1, folders: 1, files: 0 });
  });

  it('takes the revisions from whoever can count them, and keeps them when nobody can', async () => {
    const counted = await new StorageRecount({
      db: tableOf(items).db as never,
      tableName: 't',
      revisions: async () => new Map([[A, 12]]),
    }).measure();
    expect(counted[0]?.revisions).toBe(12);

    // Listing the versions of an object belongs to the purge alone (rule 8),
    // so a recount run without the trail leaves the relay's number standing.
    const uncounted = await new StorageRecount({
      db: tableOf(items).db as never,
      tableName: 't',
    }).measure();
    expect(uncounted[0]?.revisions).toBe(41);
  });

  it('writes the counters under the names the relay adds into, and drops the stale lines', async () => {
    const { db, written, deleted } = tableOf(items);
    const recount = new StorageRecount({ db: db as never, tableName: 't' });

    await recount.apply(await recount.measure());

    expect(written.find((item) => item['SK'] === 'USAGE')).toMatchObject({
      PK: `S#${A}#NOTEBOOKS`,
      storedBytes: 1157,
      notebooks: 2,
      folders: 3,
      revisions: 41,
      noteCount: 2,
      noteBytes: 107,
      fileCount: 1,
      fileBytes: 1000,
      otherCount: 2,
      otherBytes: 50,
    });
    expect(written.find((item) => item['SK'] === `NBUSAGE#${NB1}`)).toMatchObject({
      PK: `S#${A}#NOTEBOOKS`,
      entity: 'NBUSAGE',
      notebookId: NB1,
      bytes: 1150,
      notes: 1,
      folders: 2,
      files: 1,
    });
    expect(deleted).toEqual([{ PK: `S#${A}#NOTEBOOKS`, SK: 'NBUSAGE#01GONE' }]);
  });
});
