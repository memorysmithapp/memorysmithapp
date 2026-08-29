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
  const half = Math.ceil(items.length / 2);
  const db = {
    async send(command: { constructor: { name: string }; input: Record<string, unknown> }) {
      if (command.constructor.name === 'PutCommand') {
        written.push(command.input['Item'] as Record<string, unknown>);
        return {};
      }
      const first = command.input['ExclusiveStartKey'] === undefined;
      return first
        ? { Items: items.slice(0, half), LastEvaluatedKey: { PK: 'cursor' } }
        : { Items: items.slice(half) };
    },
  };
  return { db, written };
}

describe('storage recount', () => {
  it('counts live notes, guidance and templates, per subscription', async () => {
    const { db } = tableOf([
      { PK: `S#${A}#VAULT#1`, entity: 'VAULT', guidanceRef: ref(100) },
      { PK: `S#${A}#VAULT#1`, entity: 'FOLDER', templateRef: ref(50) },
      { PK: `S#${A}#VAULT#1`, entity: 'NOTE', bodyRef: ref(1000) },
      { PK: `S#${A}#VAULT#1`, entity: 'NOTE', bodyRef: ref(2000) },
      { PK: `S#${B}#VAULT#9`, entity: 'NOTE', bodyRef: ref(7) },
    ]);

    const usage = await new StorageRecount({ db: db as never, tableName: 't' }).measure();

    expect(usage).toEqual([
      { subscriptionId: A, storedBytes: 3150, notes: 2, guidances: 1, templates: 1 },
      { subscriptionId: B, storedBytes: 7, notes: 1, guidances: 0, templates: 0 },
    ]);
  });

  it('leaves out a deleted note, and keeps the ones in a deleted vault', async () => {
    const { db } = tableOf([
      { PK: `S#${A}#VAULT#1`, entity: 'NOTE', bodyRef: ref(1000) },
      { PK: `S#${A}#VAULT#1`, entity: 'NOTE', bodyRef: ref(500), deletedAt: '2026-08-29T00:00:00Z' },
      // The vault is in the bin; nothing was released, and restoring brings it
      // all back, so its notes keep counting (RN-SUB-021).
      { PK: `S#${A}#VAULT#2`, entity: 'VAULT', deletedAt: '2026-08-29T00:00:00Z', guidanceRef: ref(80) },
      { PK: `S#${A}#VAULT#2`, entity: 'NOTE', bodyRef: ref(300) },
    ]);

    const [usage] = await new StorageRecount({ db: db as never, tableName: 't' }).measure();

    expect(usage?.storedBytes).toBe(1380);
    expect(usage?.notes).toBe(2);
  });

  it('ignores the items that point at no content', async () => {
    const { db } = tableOf([
      { PK: `S#${A}#VAULT#1`, entity: 'VAULT' }, // vault with no guidance
      { PK: `S#${A}#VAULT#1`, entity: 'FOLDER' }, // folder with no template
      { PK: `S#${A}#VAULT#1`, entity: 'EVENT', contentRef: ref(999) }, // outbox row
      { PK: `S#${A}#VAULTS`, entity: 'USAGE', storedBytes: 12345 }, // the counter itself
      { PK: `S#${A}#VAULT#1`, entity: 'NOTE', bodyRef: ref(42) },
    ]);

    const [usage] = await new StorageRecount({ db: db as never, tableName: 't' }).measure();

    expect(usage?.storedBytes).toBe(42);
  });

  it('replaces the counter rather than adding to it', async () => {
    const { db, written } = tableOf([
      { PK: `S#${A}#VAULT#1`, entity: 'NOTE', bodyRef: ref(4096) },
    ]);
    const recount = new StorageRecount({ db: db as never, tableName: 't' });

    await recount.apply(await recount.measure());

    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({
      PK: `S#${A}#VAULTS`,
      SK: 'USAGE',
      storedBytes: 4096,
    });
  });
});
