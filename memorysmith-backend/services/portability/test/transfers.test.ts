/**
 * A transfer is a job with a status (RN-PRT-019, RN-PRT-020). What is proved
 * here is what neither the API nor the interface can show: that the worker
 * records how far it got, that a message delivered twice writes one archive,
 * and that a plan with no room refuses the work before it starts.
 */

import { describe, expect, it } from 'vitest';
import { DomainError, err, ok, type Instant } from '@memorysmith/kernel';
import { InMemoryTransferStore } from '../src/adapters/dynamo.js';
import {
  DeleteTransfer,
  ListTransfers,
  RunExport,
  RunImport,
  StartExport,
  StartImport,
  type TransferWork,
} from '../src/application/Transfers.js';
import { Authorship, Instant as Clock, UserId } from '@memorysmith/kernel';

const SUBSCRIPTION = '01JBQ2X0000000000000000000';
const USER = 'user-owner';
const NOTEBOOK = '01JBQ2X0000000000000000001';

const room = { current: async () => ({ usedBytes: 0, limitBytes: 1_000_000 }) };
const notebook = { brief: async () => ({ name: 'Normas', noteCount: 40 }) };

function starter(
  transfers: InMemoryTransferStore,
  queue: { send: (work: TransferWork) => Promise<void> },
  budget = room,
) {
  return new StartExport(transfers, queue, notebook, budget, SUBSCRIPTION, USER);
}

describe('starting an export', () => {
  it('records the transfer and hands the work over, without doing any of it', async () => {
    const transfers = new InMemoryTransferStore();
    const sent: TransferWork[] = [];
    const started = await starter(transfers, {
      send: async (work) => void sent.push(work),
    }).execute({ notebookId: NOTEBOOK });

    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.value.status).toBe('running');
    expect(started.value.total).toBe(40);
    expect(sent).toEqual([
      {
        subscriptionId: SUBSCRIPTION,
        userId: USER,
        transferId: started.value.transferId,
        kind: 'export',
        notebookId: NOTEBOOK,
        // The whole notebook, which is what a selection of nothing means
        // (RN-PRT-024).
        selection: null,
      },
    ]);
  });

  it('refuses before the work when the plan has no room left', async () => {
    // Minutes of work and then a refusal for room is worse than no start
    // (RN-SUB-021).
    const started = await starter(
      new InMemoryTransferStore(),
      { send: async () => undefined },
      {
        current: async () => ({ usedBytes: 1_000, limitBytes: 1_000 }),
      },
    ).execute({ notebookId: NOTEBOOK });

    expect(started.ok).toBe(false);
    if (started.ok) return;
    expect(started.error.code).toBe('LIMIT_EXCEEDED');
  });

  it('answers not found for a notebook this session cannot see', async () => {
    const started = await new StartExport(
      new InMemoryTransferStore(),
      { send: async () => undefined },
      { brief: async () => null },
      room,
      SUBSCRIPTION,
      USER,
    ).execute({ notebookId: NOTEBOOK });

    expect(started.ok).toBe(false);
  });
});

describe('running an export', () => {
  const work = (transferId: string): TransferWork => ({
    subscriptionId: SUBSCRIPTION,
    userId: USER,
    transferId,
    kind: 'export',
    notebookId: NOTEBOOK,
  });

  function exporter(runs: { count: number }) {
    return {
      execute: async (input: {
        notebookId: string;
        now: Instant;
        report?: ((readNotes: number, totalNotes: number) => void) | undefined;
      }) => {
        runs.count += 1;
        // Far enough apart to pass the step, so the progress is written.
        input.report?.(40, 100);
        input.report?.(100, 100);
        return ok({ key: 's/x/exports/a.notebook', versionId: 'v1', noteCount: 100, bytes: 4_096 });
      },
    };
  }

  it('records how far it got, and what it produced', async () => {
    const transfers = new InMemoryTransferStore();
    const started = await starter(transfers, { send: async () => undefined }).execute({
      notebookId: NOTEBOOK,
    });
    if (!started.ok) throw new Error('the export did not start');

    const runs = { count: 0 };
    await new RunExport(transfers, exporter(runs)).execute(work(started.value.transferId));

    const ended = await transfers.get(USER, started.value.transferId);
    expect(ended?.status).toBe('ready');
    expect(ended?.done).toBe(100);
    expect(ended?.bytes).toBe(4_096);
    expect(ended?.key).toBe('s/x/exports/a.notebook');
    expect(ended?.versionId).toBe('v1');
    // The kept export occupies storage from the moment the bytes exist.
    expect(await transfers.keptBytes()).toBe(4_096);
    // And it is counted as one export, of the notebook it was made of
    // (RN-SUB-024).
    const kept = await transfers.keptUsage();
    expect(kept).toMatchObject({ count: 1, bytes: 4_096 });
    expect(kept.byNotebook.get(NOTEBOOK)).toEqual({ count: 1, bytes: 4_096 });
  });

  it('writes one archive when the same message is delivered twice', async () => {
    const transfers = new InMemoryTransferStore();
    const started = await starter(transfers, { send: async () => undefined }).execute({
      notebookId: NOTEBOOK,
    });
    if (!started.ok) throw new Error('the export did not start');

    const runs = { count: 0 };
    const runner = new RunExport(transfers, exporter(runs));
    await runner.execute(work(started.value.transferId));
    await runner.execute(work(started.value.transferId));

    // The second delivery finds a transfer that already ended: a second run
    // would write a second archive nothing points at.
    expect(runs.count).toBe(1);
    expect(await transfers.keptBytes()).toBe(4_096);
  });

  it('records a failure with its reason, and keeps nothing', async () => {
    const transfers = new InMemoryTransferStore();
    const started = await starter(transfers, { send: async () => undefined }).execute({
      notebookId: NOTEBOOK,
    });
    if (!started.ok) throw new Error('the export did not start');

    await new RunExport(transfers, {
      execute: async () => err(DomainError.notFound('Notebook not found')),
    }).execute(work(started.value.transferId));

    const ended = await transfers.get(USER, started.value.transferId);
    expect(ended?.status).toBe('failed');
    expect(ended?.failure).toBe('NOT_FOUND');
    expect(await transfers.keptBytes()).toBe(0);
  });
});

describe('deleting a transfer', () => {
  it('destroys the exact revision it wrote, and takes its bytes out of the quota', async () => {
    const transfers = new InMemoryTransferStore();
    const started = await starter(transfers, { send: async () => undefined }).execute({
      notebookId: NOTEBOOK,
    });
    if (!started.ok) throw new Error('the export did not start');
    await transfers.patch(USER, started.value.transferId, {
      status: 'ready',
      bytes: 2_048,
      key: 's/x/exports/a.notebook',
      versionId: 'v7',
    });
    await transfers.addKeptBytes(2_048, NOTEBOOK);

    const destroyed: Array<[string, string]> = [];
    const archives = {
      put: async () => ({ versionId: null }),
      presign: async () => 'memory://link',
      destroy: async (key: string, versionId: string) => void destroyed.push([key, versionId]),
    };
    const deleted = await new DeleteTransfer(transfers, archives, USER).execute(
      started.value.transferId,
    );

    expect(deleted.ok).toBe(true);
    expect(destroyed).toEqual([['s/x/exports/a.notebook', 'v7']]);
    expect(await transfers.keptBytes()).toBe(0);
    // It leaves the count of its notebook with its bytes (RN-SUB-024).
    const kept = await transfers.keptUsage();
    expect(kept).toMatchObject({ count: 0, bytes: 0 });
    expect(kept.byNotebook.get(NOTEBOOK)).toEqual({ count: 0, bytes: 0 });
    expect((await new ListTransfers(transfers, USER).execute()).ok).toBe(true);
    expect(await transfers.get(USER, started.value.transferId)).toBeNull();
  });

  it('answers not found for the transfer of somebody else', async () => {
    const transfers = new InMemoryTransferStore();
    const started = await starter(transfers, { send: async () => undefined }).execute({
      notebookId: NOTEBOOK,
    });
    if (!started.ok) throw new Error('the export did not start');

    // Addressed under another person it is a key that does not exist, which is
    // what makes it a 404 and never a 403 (RN-PRT-020, rule 9).
    const deleted = await new DeleteTransfer(
      transfers,
      {
        put: async () => ({ versionId: null }),
        presign: async () => 'memory://link',
        destroy: async () => undefined,
      },
      'user-other',
    ).execute(started.value.transferId);

    expect(deleted.ok).toBe(false);
    if (deleted.ok) return;
    expect(deleted.error.code).toBe('NOT_FOUND');
  });
});

/**
 * A cancel is a write of the API on the record, and the worker is what acts on
 * it (RN-PRT-014, RN-KNW-033). The one it used to miss is the one that lands
 * AFTER the importer has finished: the run of the job saw it, returned, and
 * left the notebook standing under a transfer that said it was cancelled
 * (#153). This is that instant, at the seam rather than by a race.
 */
describe('cancelling an import', () => {
  const author = (): Authorship => {
    const user = UserId.create(USER);
    if (!user.ok) throw new Error('the test seeded an unusable author');
    return Authorship.byHuman(user.value, Clock.now());
  };

  const NOTEBOOK_WRITTEN = '01JBQ2X0000000000000000009';

  it('takes down what it wrote, when the cancel lands after the writing', async () => {
    const transfers = new InMemoryTransferStore();
    const started = await new StartImport(
      transfers,
      { send: async () => undefined },
      SUBSCRIPTION,
      USER,
    ).execute({
      uploadKey: `s/${SUBSCRIPTION}/imports/01JBQ2X000000000000000000A.notebook`,
      name: 'Normas importadas',
      selection: null,
      by: author(),
    });
    if (!started.ok) throw new Error('the import did not start');

    const undone: string[] = [];
    const importer = {
      undo: async (notebookId: string) => void undone.push(notebookId),
      execute: async () => {
        // The cancel lands here: the notebook is written, and the importer has
        // already looked for the last time.
        await transfers.patch(USER, started.value.transferId, { status: 'cancelled' });
        return ok({
          importId: '01JBQ2X000000000000000000B',
          notebookId: NOTEBOOK_WRITTEN,
          status: 'imported' as const,
          folderCount: 2,
          noteCount: 3,
          guidance: true,
          templateCount: 1,
        });
      },
    };

    await new RunImport(transfers, importer, author()).execute({
      subscriptionId: SUBSCRIPTION,
      userId: USER,
      transferId: started.value.transferId,
      kind: 'import',
      uploadKey: `s/${SUBSCRIPTION}/imports/01JBQ2X000000000000000000A.notebook`,
      name: 'Normas importadas',
    });

    expect(undone).toEqual([NOTEBOOK_WRITTEN]);
    // And the record still says what the person asked for.
    const ended = await transfers.get(USER, started.value.transferId);
    expect(ended?.status).toBe('cancelled');
    expect(ended?.notebookId).toBeNull();
  });
});
