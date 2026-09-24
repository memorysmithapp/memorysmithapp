/**
 * Importing a kept export from where it is kept (#207, RN-PRT-020).
 *
 * What is worth proving here is WHICH exports qualify and what the answer is:
 * the requester's own ready export becomes an upload under the key an ordinary
 * upload gets, and everything else — somebody else's, one still running, one
 * that failed, an import, one that is gone — answers the same `404`, because
 * telling them apart would say what exists (rule 9). And the export is read,
 * never consumed.
 */

import { describe, expect, it } from 'vitest';
import { InMemoryTransferStore } from '../src/adapters/dynamo.js';
import { ImportFromExport, type UploadStore } from '../src/application/ImportNotebook.js';
import { startedTransfer, type Transfer } from '../src/domain/Transfer.js';

const SUBSCRIPTION = '01JBQ2X0000000000000000000';
const OWNER = 'user-owner';
const MEMBER = 'user-member';
const EXPORT = '01JBQ2X00000000000000000E1';
const KEY = `s/${SUBSCRIPTION}/exports/01JBQ2X00000000000000000K1.notebook`;

/** An upload of this subscription, exactly as `PrepareImport` mints one. */
const UPLOAD_KEY = new RegExp(`^s/${SUBSCRIPTION}/imports/[0-9A-HJKMNP-TV-Z]{26}\\.notebook$`);

function exportOf(changes: Partial<Transfer> = {}): Transfer {
  return {
    ...startedTransfer({
      transferId: EXPORT,
      kind: 'export',
      userId: OWNER,
      notebookId: '01JBQ2X0000000000000000001',
      notebookName: 'Normas',
      requestedAt: '2026-09-23T00:00:00.000Z',
      total: 3,
    }),
    status: 'ready',
    finishedAt: '2026-09-23T00:01:00.000Z',
    bytes: 2048,
    key: KEY,
    versionId: 'v1',
    ...changes,
  };
}

/** A bucket of two prefixes, which is all the copy touches. */
function storeOf(objects: Record<string, string>) {
  const bucket = new Map(Object.entries(objects));
  const copies: Array<{ source: string; key: string }> = [];
  const uploads: UploadStore = {
    presignUpload: async (key) => `memory://upload/${key}`,
    read: async (key) => (bucket.has(key) ? Buffer.from(bucket.get(key) ?? '') : null),
    discard: async (key) => void bucket.delete(key),
    copyFrom: async (source, key) => {
      const found = bucket.get(source);
      if (found === undefined) return false;
      copies.push({ source, key });
      bucket.set(key, found);
      return true;
    },
  };
  return { bucket, copies, uploads };
}

async function importing(
  transfer: Transfer | null,
  asUser = OWNER,
  objects: Readonly<Record<string, string>> = { [KEY]: 'zip' },
) {
  const transfers = new InMemoryTransferStore();
  if (transfer) await transfers.put(transfer);
  const store = storeOf(objects);
  const answer = await new ImportFromExport(transfers, store.uploads, SUBSCRIPTION, asUser).execute(
    EXPORT,
  );
  return { answer, transfers, ...store };
}

describe('importing a kept export', () => {
  it('copies the requester’s own ready export to a fresh upload key', async () => {
    const { answer, bucket, copies } = await importing(exportOf());

    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    expect(answer.value.uploadKey).toMatch(UPLOAD_KEY);
    expect(copies).toEqual([{ source: KEY, key: answer.value.uploadKey }]);
    // The upload holds the archive, which is what `apply` reads.
    expect(bucket.get(answer.value.uploadKey)).toBe('zip');
  });

  it('leaves the export kept, so it can be imported again', async () => {
    const { answer, bucket, transfers, uploads } = await importing(exportOf());
    expect(answer.ok).toBe(true);

    expect(bucket.get(KEY)).toBe('zip');
    expect(await transfers.get(OWNER, EXPORT)).toMatchObject({ status: 'ready', key: KEY });

    const again = await new ImportFromExport(transfers, uploads, SUBSCRIPTION, OWNER).execute(
      EXPORT,
    );
    expect(again.ok).toBe(true);
    if (!again.ok || !answer.ok) return;
    expect(again.value.uploadKey).not.toBe(answer.value.uploadKey);
  });

  it.each([
    ['another member’s export', exportOf(), MEMBER, { [KEY]: 'zip' }],
    ['an export still running', exportOf({ status: 'running', key: null }), OWNER, {}],
    ['an export that failed', exportOf({ status: 'failed', key: null }), OWNER, {}],
    ['an import', exportOf({ kind: 'import', key: null }), OWNER, {}],
    ['a transfer that does not exist', null, OWNER, { [KEY]: 'zip' }],
    ['an export whose archive is gone', exportOf(), OWNER, {}],
    [
      'a record naming a key outside the exports of this subscription',
      exportOf({ key: 's/01OTHERSUBSCRIPTION0000000/exports/x.notebook' }),
      OWNER,
      { 's/01OTHERSUBSCRIPTION0000000/exports/x.notebook': 'zip' },
    ],
  ] as const)('answers 404 for %s, and copies nothing', async (_, transfer, user, objects) => {
    const { answer, copies } = await importing(transfer, user, objects);

    expect(answer.ok).toBe(false);
    if (answer.ok) return;
    expect(answer.error.code).toBe('NOT_FOUND');
    expect(copies).toEqual([]);
  });
});
