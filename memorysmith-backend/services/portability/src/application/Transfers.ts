/**
 * The transfers of a person: starting one, reading it, downloading what it
 * produced and deleting it (RN-PRT-019, RN-PRT-020, architecture-guide.md §16).
 *
 * Starting an export is a WRITE of two lines — a record and a message — and
 * nothing else: the work belongs to the worker, which is not bound to the 29
 * seconds of the API. What the interface polls is the record.
 */

import { DomainError, err, Instant, ok, ulid, type Result } from '@memorysmith/kernel';
import { startedTransfer, type Transfer, type TransferStore } from '../domain/Transfer.js';
import type { ArchiveStore } from './ExportNotebook.js';

/** How long a download link lives. Issued at the moment of each download. */
const URL_TTL_SECONDS = 900;

/** What the worker is told to do, and the only thing the queue carries. */
export interface TransferWork {
  readonly subscriptionId: string;
  readonly userId: string;
  readonly transferId: string;
  readonly notebookId: string;
}

export interface TransferQueue {
  send(work: TransferWork): Promise<void>;
}

/** What the notebook is called and how many notes it holds, before any work. */
export interface NotebookBrief {
  brief(notebookId: string): Promise<{ name: string; noteCount: number } | null>;
}

/** How much the plan still allows, joined where the two halves meet. */
export interface StorageBudget {
  current(): Promise<{ usedBytes: number; limitBytes: number }>;
}

export class StartExport {
  constructor(
    private readonly transfers: TransferStore,
    private readonly queue: TransferQueue,
    private readonly notebooks: NotebookBrief,
    private readonly budget: StorageBudget,
    private readonly subscriptionId: string,
    private readonly userId: string,
  ) {}

  async execute(input: { notebookId: string }): Promise<Result<Transfer, DomainError>> {
    const brief = await this.notebooks.brief(input.notebookId);
    if (!brief) return err(DomainError.notFound('Notebook not found'));

    /**
     * A kept export occupies storage of the subscription (RN-SUB-021), so a
     * plan with no room refuses it BEFORE the work: an export that runs for
     * minutes and is then refused for room is worse than one never started.
     * What it will occupy is unknown until it is built, so what is checked is
     * that there is any room at all.
     */
    const budget = await this.budget.current();
    if (budget.usedBytes >= budget.limitBytes) {
      return err(
        DomainError.limitExceeded('The storage of this plan is full: delete something first'),
      );
    }

    const transfer = startedTransfer({
      transferId: ulid(),
      kind: 'export',
      userId: this.userId,
      notebookId: input.notebookId,
      notebookName: brief.name,
      requestedAt: Instant.now().toISOString(),
      total: brief.noteCount,
    });
    await this.transfers.put(transfer);
    await this.queue.send({
      subscriptionId: this.subscriptionId,
      userId: this.userId,
      transferId: transfer.transferId,
      notebookId: input.notebookId,
    });
    return ok(transfer);
  }
}

export class ListTransfers {
  constructor(
    private readonly transfers: TransferStore,
    private readonly userId: string,
  ) {}

  async execute(): Promise<Result<{ transfers: Transfer[]; keptBytes: number }, DomainError>> {
    const [transfers, keptBytes] = await Promise.all([
      this.transfers.list(this.userId),
      this.transfers.keptBytes(),
    ]);
    return ok({ transfers, keptBytes });
  }
}

export class GetTransfer {
  constructor(
    private readonly transfers: TransferStore,
    private readonly userId: string,
  ) {}

  async execute(transferId: string): Promise<Result<Transfer, DomainError>> {
    const found = await this.transfers.get(this.userId, transferId);
    // The transfer of somebody else is a key that does not exist under this
    // person, so it answers as missing and never as refused (rule 9).
    if (!found) return err(DomainError.notFound('Transfer not found'));
    return ok(found);
  }
}

/**
 * A link issued at the moment of the download, never one that was stored
 * (RN-PRT-019). A stored link is a link that has expired by the time somebody
 * comes back to it, which is exactly what made an export unreachable.
 */
export class DownloadTransfer {
  constructor(
    private readonly transfers: TransferStore,
    private readonly archives: ArchiveStore,
    private readonly userId: string,
  ) {}

  async execute(
    transferId: string,
  ): Promise<Result<{ downloadUrl: string; expiresAt: string }, DomainError>> {
    const found = await this.transfers.get(this.userId, transferId);
    if (!found || !found.key || found.status !== 'ready') {
      return err(DomainError.notFound('Transfer not found'));
    }
    const expiresAt = Instant.fromEpochMillis(Instant.now().epochMillis + URL_TTL_SECONDS * 1000);
    return ok({
      downloadUrl: await this.archives.presign(
        found.key,
        URL_TTL_SECONDS,
        `${found.notebookName}.notebook`,
      ),
      expiresAt: expiresAt.ok ? expiresAt.value.toISOString() : Instant.now().toISOString(),
    });
  }
}

/** Destroys the bytes of one export, and its place in the quota with them. */
export class DeleteTransfer {
  constructor(
    private readonly transfers: TransferStore,
    private readonly archives: ArchiveStore,
    private readonly userId: string,
  ) {}

  async execute(transferId: string): Promise<Result<void, DomainError>> {
    const found = await this.transfers.get(this.userId, transferId);
    if (!found) return err(DomainError.notFound('Transfer not found'));

    /**
     * The bytes go first, and by the EXACT revision the worker wrote. An
     * export is written once and never overwritten, so its version is the
     * whole object: destroying it leaves no delete marker and no noncurrent
     * version, and it needs no listing of versions — which is what keeps this
     * within reach of a role that may not touch the revision of a note (rule 8).
     */
    if (found.key && found.versionId) {
      await this.archives.destroy(found.key, found.versionId);
    }
    await this.transfers.remove(this.userId, transferId);
    if (found.status === 'ready' && found.bytes > 0) {
      await this.transfers.addKeptBytes(-found.bytes);
    }
    return ok(undefined);
  }
}

/**
 * The worker side: builds the archive of one export and records what happened
 * to it, whichever way it ended.
 *
 * Progress is written while the notes are read, but not on every note: a
 * notebook of a thousand notes would be a thousand writes for a number nobody
 * reads that often. It is written when the count moves by a step or when a
 * couple of seconds have passed, whichever comes first.
 */
export const PROGRESS_STEP = 25;
export const PROGRESS_INTERVAL_MS = 2_000;

export interface ExportRunner {
  execute(input: {
    notebookId: string;
    now: Instant;
    report?: ((readNotes: number, totalNotes: number) => void) | undefined;
  }): Promise<
    Result<{ key: string; versionId: string | null; noteCount: number; bytes: number }, DomainError>
  >;
}

export class RunExport {
  constructor(
    private readonly transfers: TransferStore,
    private readonly exporter: ExportRunner,
  ) {}

  async execute(work: TransferWork): Promise<void> {
    const started = await this.transfers.get(work.userId, work.transferId);
    // A message delivered twice finds a transfer that already ended, and a
    // second run would write a second archive nothing points at.
    if (!started || started.status !== 'running') return;

    let lastWrite = Date.now();
    let lastDone = 0;
    const pending: Array<Promise<void>> = [];
    const report = (readNotes: number, totalNotes: number): void => {
      if (readNotes - lastDone < PROGRESS_STEP && Date.now() - lastWrite < PROGRESS_INTERVAL_MS) {
        return;
      }
      lastDone = readNotes;
      lastWrite = Date.now();
      pending.push(
        this.transfers
          .patch(work.userId, work.transferId, { done: readNotes, total: totalNotes })
          // A progress that failed to be written is not a failed export.
          .catch(() => undefined),
      );
    };

    try {
      const built = await this.exporter.execute({
        notebookId: work.notebookId,
        now: Instant.now(),
        report,
      });
      await Promise.all(pending);

      if (!built.ok) {
        await this.transfers.patch(work.userId, work.transferId, {
          status: 'failed',
          finishedAt: Instant.now().toISOString(),
          failure: built.error.code,
        });
        return;
      }

      await this.transfers.patch(work.userId, work.transferId, {
        status: 'ready',
        finishedAt: Instant.now().toISOString(),
        done: built.value.noteCount,
        total: built.value.noteCount,
        bytes: built.value.bytes,
        key: built.value.key,
        versionId: built.value.versionId,
      });
      // The kept export occupies storage of the subscription from here on
      // (RN-SUB-021), and the counter moves when the bytes exist and not when
      // somebody clicked.
      await this.transfers.addKeptBytes(built.value.bytes);
    } catch (error) {
      await this.transfers.patch(work.userId, work.transferId, {
        status: 'failed',
        finishedAt: Instant.now().toISOString(),
        failure: error instanceof Error ? error.message.slice(0, 200) : 'INTERNAL',
      });
    }
  }
}
