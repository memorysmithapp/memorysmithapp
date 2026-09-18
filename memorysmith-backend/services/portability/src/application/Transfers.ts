/**
 * The transfers of a person: starting one, reading it, downloading what it
 * produced and deleting it (RN-PRT-019, RN-PRT-020, architecture-guide.md §16).
 *
 * Starting an export is a WRITE of two lines — a record and a message — and
 * nothing else: the work belongs to the worker, which is not bound to the 29
 * seconds of the API. What the interface polls is the record.
 */

import {
  DomainError,
  err,
  Instant,
  ok,
  ulid,
  type Authorship,
  type Result,
} from '@memorysmith/kernel';
import { startedTransfer, type Transfer, type TransferStore } from '../domain/Transfer.js';
import type { ArchiveStore } from './ExportNotebook.js';
import { refusalOf, type ImportJob, type ImportSelection } from './ImportNotebook.js';

/** How long a download link lives. Issued at the moment of each download. */
const URL_TTL_SECONDS = 900;

/**
 * What the worker is told to do, and the only thing the queue carries.
 *
 * An export names the notebook it reads; an import names the upload it writes
 * from, the name the notebook will carry and what part of the document was
 * chosen (RN-PRT-017).
 */
export interface TransferWork {
  readonly subscriptionId: string;
  readonly userId: string;
  readonly transferId: string;
  readonly kind: 'export' | 'import';
  readonly notebookId?: string | undefined;
  /**
   * What the transfer carries, or nothing for the whole notebook: an export
   * chooses now as an import already did (RN-PRT-017, RN-PRT-024).
   */
  readonly selection?: ImportSelection | null | undefined;
  readonly uploadKey?: string | undefined;
  readonly name?: string | undefined;
  /**
   * Who every write of an import is attributed to, carried in the message
   * because the worker serves no request and has no token to read it from
   * (rule 7). The connector travels with it, so an import asked for through a
   * connector is recorded as that connector wrote it (RN-AGT-001).
   */
  readonly authorship?:
    { userId: string; agent: { clientId: string; clientName: string } | null } | undefined;
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

  async execute(input: {
    notebookId: string;
    /**
     * What the archive carries, or nothing for the whole notebook
     * (RN-PRT-024). The history is one item of it, and it is what makes an
     * archive survive the deletion of the notebook it describes (RN-PRT-022);
     * it also makes the archive larger, and a kept export counts towards the
     * storage of the plan (RN-SUB-021).
     */
    selection?: ImportSelection | null;
  }): Promise<Result<Transfer, DomainError>> {
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
      // What it will read, which a selection narrows (RN-PRT-024).
      total: input.selection ? input.selection.notes.length : brief.noteCount,
    });
    await this.transfers.put(transfer);
    await this.queue.send({
      subscriptionId: this.subscriptionId,
      userId: this.userId,
      transferId: transfer.transferId,
      kind: 'export',
      notebookId: input.notebookId,
      selection: input.selection ?? null,
    });
    return ok(transfer);
  }
}

/**
 * Starting an import (RN-PRT-018). The file is already uploaded; what the API
 * does is record the job and hand the work over, because writing a notebook of
 * several hundred notes does not fit in the 29 seconds it is allowed to live.
 *
 * The name is checked here, before anything is written, for the same reason
 * the interface checks it as it is typed: a subscription holds each notebook
 * name once (RN-KNW-032), and finding out at the end of a long import is
 * finding out too late. The server stays the judge either way — the write
 * itself is what settles a name somebody took meanwhile.
 */
export class StartImport {
  constructor(
    private readonly transfers: TransferStore,
    private readonly queue: TransferQueue,
    private readonly subscriptionId: string,
    private readonly userId: string,
  ) {}

  async execute(input: {
    uploadKey: string;
    name: string;
    selection: ImportSelection | null;
    /**
     * The file the person chose, as they see it in their own folder. The upload
     * is addressed by an identifier, which says nothing to anybody, and the
     * record is what Transfers reads back weeks later (#155).
     */
    fileName?: string | null;
    by: Authorship;
  }): Promise<Result<Transfer, DomainError>> {
    if (!input.uploadKey.startsWith(`s/${this.subscriptionId}/imports/`)) {
      return err(DomainError.notFound('Upload not found'));
    }
    if (input.name.trim().length === 0) {
      return err(DomainError.validation('An import needs a name for the notebook it creates'));
    }

    const transfer = startedTransfer({
      transferId: ulid(),
      kind: 'import',
      userId: this.userId,
      // There is no notebook yet: the import creates one, and the transfer
      // learns its identifier when the worker has written it.
      notebookId: null,
      notebookName: input.name.trim(),
      requestedAt: Instant.now().toISOString(),
      total: input.selection ? input.selection.notes.length : 0,
      fileName: input.fileName?.trim() ? input.fileName.trim().slice(0, 200) : null,
    });
    await this.transfers.put(transfer);
    await this.queue.send({
      subscriptionId: this.subscriptionId,
      userId: this.userId,
      transferId: transfer.transferId,
      kind: 'import',
      uploadKey: input.uploadKey,
      name: transfer.notebookName,
      selection: input.selection,
      authorship: {
        userId: input.by.user.value,
        agent: input.by.agent
          ? { clientId: input.by.agent.clientId, clientName: input.by.agent.clientName }
          : null,
      },
    });
    return ok(transfer);
  }
}

/**
 * Cancelling a transfer (RN-PRT-018). It marks the record, and the worker is
 * what acts on it: an import takes its notebook back down whole at the next
 * note it was about to write, which frees the name (RN-PRT-014, RN-KNW-033).
 */
export class CancelTransfer {
  constructor(
    private readonly transfers: TransferStore,
    private readonly userId: string,
  ) {}

  async execute(transferId: string): Promise<Result<Transfer, DomainError>> {
    const found = await this.transfers.get(this.userId, transferId);
    if (!found) return err(DomainError.notFound('Transfer not found'));
    if (found.status !== 'running') {
      return err(DomainError.conflict('That transfer has already ended'));
    }
    /**
     * An import is cancellable because it WRITES: stopping it takes the
     * notebook it had started back down. An export writes nothing anybody can
     * see until it ends, so there is nothing to undo and nothing to stop.
     */
    if (found.kind !== 'import') {
      return err(
        DomainError.conflict('An export cannot be cancelled: nothing of it is written yet'),
      );
    }
    await this.transfers.patch(this.userId, transferId, {
      status: 'cancelled',
      finishedAt: Instant.now().toISOString(),
    });
    return ok({ ...found, status: 'cancelled' });
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
    selection?: ImportSelection | null | undefined;
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
        notebookId: work.notebookId ?? '',
        now: Instant.now(),
        selection: work.selection ?? null,
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
      reportUnexpected('export', work, error);
      await this.transfers.patch(work.userId, work.transferId, {
        status: 'failed',
        finishedAt: Instant.now().toISOString(),
        failure: error instanceof Error ? error.message.slice(0, 200) : 'INTERNAL',
      });
    }
  }
}

/**
 * What the record cannot hold. A failure nobody foresaw is kept on the transfer
 * cut to 200 characters, which is where a sentence of the cloud provider names
 * the thing it refused: the one that started #148 reached the person ending
 * mid-word, at `perfo`. The worker serves no request and has nowhere to carry
 * an error out to, so the whole of it is written here, where the log of the
 * function keeps it.
 */
function reportUnexpected(kind: 'export' | 'import', work: TransferWork, error: unknown): void {
  console.error(
    `A transfer failed for a reason it did not foresee (${kind} ${work.transferId})`,
    error,
  );
}

/**
 * The worker side of an import: writes the notebook and records how far it got,
 * and answers the cancel the interface may have asked for (RN-PRT-018).
 */
export interface ImportRunner {
  /**
   * Takes down a notebook an import wrote, which is what a cancel discovered
   * after the fact needs (#153): the importer holds the writer, and the run of
   * the job is what learns too late.
   */
  undo(notebookId: string, by: Authorship): Promise<void>;
  execute(input: {
    uploadKey: string;
    name: string | null;
    by: Authorship;
    selection?: ImportSelection | null | undefined;
    progress?:
      | {
          wrote(written: number, total: number): Promise<void>;
          cancelled(): Promise<boolean>;
        }
      | undefined;
  }): Promise<Result<ImportJob, DomainError>>;
}

export class RunImport {
  constructor(
    private readonly transfers: TransferStore,
    private readonly importer: ImportRunner,
    private readonly by: Authorship,
  ) {}

  async execute(work: TransferWork): Promise<void> {
    const started = await this.transfers.get(work.userId, work.transferId);
    if (!started || started.status !== 'running') return;

    let lastWrite = Date.now();
    let lastDone = 0;
    const progress = {
      wrote: async (written: number, total: number): Promise<void> => {
        if (written - lastDone < PROGRESS_STEP && Date.now() - lastWrite < PROGRESS_INTERVAL_MS) {
          return;
        }
        lastDone = written;
        lastWrite = Date.now();
        await this.transfers
          .patch(work.userId, work.transferId, { done: written, total })
          .catch(() => undefined);
      },
      /**
       * Read from the record, because the cancel is a write of the API on the
       * same record: the worker has no other way of hearing about it.
       */
      cancelled: async (): Promise<boolean> => {
        const now = await this.transfers.get(work.userId, work.transferId);
        return now === null || now.status === 'cancelled';
      },
    };

    try {
      const written = await this.importer.execute({
        uploadKey: work.uploadKey ?? '',
        name: work.name ?? null,
        by: this.by,
        selection: work.selection ?? null,
        progress,
      });

      /**
       * A cancel that landed mid-import already ended the transfer, and the
       * notebook went down with it. One that landed AFTER the importer's last
       * look finds an import that finished, so what it has to undo is here:
       * returning alone left the notebook standing, with the name it took,
       * under a transfer that said it was cancelled (#153).
       */
      if (await progress.cancelled()) {
        if (written.ok) await this.importer.undo(written.value.notebookId, this.by);
        return;
      }

      if (!written.ok) {
        await this.transfers.patch(work.userId, work.transferId, {
          status: 'failed',
          finishedAt: Instant.now().toISOString(),
          // The code and not the sentence: what reaches the person is read by
          // an interface that speaks two languages (RN-PRT-018).
          failure: refusalOf(written.error),
        });
        return;
      }

      await this.transfers.patch(work.userId, work.transferId, {
        status: 'ready',
        finishedAt: Instant.now().toISOString(),
        done: written.value.noteCount,
        total: written.value.noteCount,
        notebookId: written.value.notebookId,
      });
    } catch (error) {
      reportUnexpected('import', work, error);
      await this.transfers.patch(work.userId, work.transferId, {
        status: 'failed',
        finishedAt: Instant.now().toISOString(),
        failure: error instanceof Error ? error.message.slice(0, 200) : 'INTERNAL',
      });
    }
  }
}
