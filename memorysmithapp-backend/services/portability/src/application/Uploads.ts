/**
 * An upload in parts (#240, RN-PRT-027, RN-PRT-028, RN-PRT-029, RN-SUB-025).
 *
 * `keep_file` takes a file in one call, base64, and the arguments of a call are
 * typed by the model: a photo from a phone is megabytes the agent cannot type,
 * and a mistyped part was kept as if it were the file, because the check of a
 * type reads only its start. So an agent was seen shrinking, cropping and
 * re-encoding pictures until they fitted what it could type without error.
 *
 * Here the agent declares the file first — its name, type, size and the
 * SHA-256 of the whole — and then sends it in parts **by URL**: a signed
 * address per part, which a script PUTs from the disk. The bytes never pass
 * through the model, so a photo of 5 MB costs it what one of 5 KB does. The
 * parts reach the store without passing through the API, and the store is
 * what says which arrived.
 *
 * There used to be a second way, base64 in the call, for an agent with no
 * network. Every conversation measured in Claude, ChatGPT and Grok sent by URL
 * once its sandbox reached the upload host, so it was retired (#468); an agent
 * that cannot reach the host checks the probe first and says so instead.
 *
 * Nothing becomes a file until the finish, which holds the whole to the hash
 * declared at the start and the type to the bytes; a file that merely looks
 * like the file is never kept.
 *
 * The upload is a **transfer** the person sees in Transfers, as *Agent*, with
 * no deadline: what it reserves is on Home, and deleting it is theirs to do.
 * When it becomes a file its record goes, because the file is what it was for;
 * when its finish finds the bytes wrong it stays as a notice, without bytes.
 */

import {
  DomainError,
  err,
  Instant,
  ok,
  ulid,
  type Authorship,
  type Result,
} from '@memorysmithapp/kernel';
import {
  UPLOAD_MAX_BYTES,
  UPLOAD_URL_PART_BYTES,
  uploadAssemblyKeyOf,
  uploadPartKeyOf,
  type KeptUpload,
  type Transfer,
  type TransferStore,
  type UploadRefusal,
  type TransferUpload,
} from '../domain/Transfer.js';
import type { StorageBudget, TransferQueue } from './Transfers.js';

/**
 * What starting an upload declares (RN-PRT-027): the file it becomes. It is the
 * shape the API validates at its edge.
 */
export interface BeginUploadInput {
  readonly notebookId: string;
  readonly name: string;
  readonly description?: string | undefined;
  readonly mimeType: string;
  readonly tags?: readonly string[] | undefined;
  readonly path?: string | undefined;
  readonly purpose: string;
  readonly size: number;
  readonly sha256: string;
}

/** How long the address of one part lives. Asked again, a fresh one is signed. */
export const PART_URL_SECONDS = 3600;

/**
 * Where the parts of an upload are kept, under the upload and never under a
 * notebook (RN-PRT-029). Every key it is given was built from the subscription
 * of the token (INV-01).
 */
export interface PartStore {
  /** Opens the multipart upload of an upload, and answers its identifier. */
  startMultipart(key: string, mimeType: string): Promise<string>;
  /** A short-lived address a plain PUT of the bytes of one part is sent to. */
  signPart(key: string, multipartId: string, part: number, seconds: number): Promise<string>;
  /** The parts the store holds, or `null` when the multipart upload is gone. */
  listParts(
    key: string,
    multipartId: string,
  ): Promise<Array<{ part: number; lastModified: string | null }> | null>;
  /** Joins the parts in place, and answers the revision the whole was written as. */
  completeMultipart(key: string, multipartId: string): Promise<string>;
  abortMultipart(key: string, multipartId: string): Promise<void>;
  /** Destroys one revision: its bytes, not a marker hiding them. */
  destroy(key: string, versionId: string): Promise<void>;
}

/**
 * The file an upload becomes. Keeping a file belongs to the Knowledge context,
 * which this service may not import, so it arrives as a port the composition
 * root fills — the arrangement an import already uses to write a notebook.
 */
export interface FileKeeper {
  /** Whether the file may be kept there: the notebook, the role, the type, the name. */
  destination(input: {
    notebookId: string;
    name: string;
    mimeType: string;
  }): Promise<Result<{ notebookName: string; mimeType: string }, DomainError>>;
  keepAssembled(input: {
    notebookId: string;
    name: string;
    description: string;
    mimeType: string;
    tags: readonly string[];
    path: string;
    assembled: { key: string; versionId: string; size: number; sha256: string };
    by: Authorship;
  }): Promise<Result<{ fileId: string; name: string; bytes: number }, DomainError>>;
}

/** What a refusal of the finish is, when it ends the upload rather than waiting. */
const TERMINAL = new Set(['HASH_MISMATCH', 'TYPE_MISMATCH']);

function reasonOf(error: DomainError): string | null {
  const details = error.details as { reason?: string } | undefined;
  return details?.reason ?? null;
}

/** A refusal as the record keeps it, for whoever asks after the worker (#480). */
function refusalOf(error: DomainError): UploadRefusal {
  return {
    code: error.code,
    message: error.message,
    ...(error.details === undefined ? {} : { details: error.details }),
    ...(error.revealsExistence ? { revealsExistence: true } : {}),
  };
}

/** The refusal kept on the record, as the error it was. */
function errorOf(refusal: UploadRefusal): DomainError {
  return new DomainError(
    refusal.code as DomainError['code'],
    refusal.message,
    refusal.details,
    refusal.revealsExistence === true,
  );
}

/**
 * The file an upload became, read once: the record goes as it is read, since
 * the file is what stays (RN-PRT-028, #480).
 */
async function takeKept(
  transfers: TransferStore,
  userId: string,
  transfer: Transfer,
): Promise<KeptUpload | null> {
  const kept = transfer.status === 'ready' ? (transfer.upload?.kept ?? null) : null;
  if (kept) await transfers.remove(userId, transfer.transferId);
  return kept;
}

/** Every part number of an upload, from 1. */
function everyPart(upload: TransferUpload): number[] {
  return Array.from({ length: upload.partCount }, (_, index) => index + 1);
}

/** The parts that arrived, by number; all of them once the whole is assembled. */
export function receivedOf(upload: TransferUpload): number[] {
  if (upload.assembled) return everyPart(upload);
  return Object.keys(upload.parts)
    .map(Number)
    .filter((part) => Number.isInteger(part) && part >= 1 && part <= upload.partCount)
    .sort((left, right) => left - right);
}

/**
 * What the store says of an upload by URL, read into the record for the answer
 * and never written back: its parts reach the store without passing through
 * the API, so the store is the only one that knows them.
 */
export class ObserveUpload {
  constructor(
    private readonly parts: PartStore,
    private readonly subscriptionId: string,
  ) {}

  async execute(transfer: Transfer): Promise<Transfer> {
    const upload = transfer.upload;
    if (
      transfer.kind !== 'agent' ||
      !upload ||
      upload.transport !== 'url' ||
      !upload.multipartId ||
      upload.assembled
    ) {
      return this.counted(transfer);
    }
    const listed = await this.parts
      .listParts(uploadAssemblyKeyOf(this.subscriptionId, transfer.transferId), upload.multipartId)
      .catch(() => null);
    if (!listed) return this.counted(transfer);
    const parts: Record<string, string> = {};
    let lastPartAt: string | null = null;
    for (const each of listed) {
      parts[String(each.part)] = 'stored';
      if (each.lastModified && (!lastPartAt || each.lastModified > lastPartAt)) {
        lastPartAt = each.lastModified;
      }
    }
    return this.counted({ ...transfer, upload: { ...upload, parts, lastPartAt } });
  }

  /** `done` is how many parts arrived, which is what the row draws its bar with. */
  private counted(transfer: Transfer): Transfer {
    if (!transfer.upload) return transfer;
    return { ...transfer, done: receivedOf(transfer.upload).length };
  }
}

/** An upload and what is left of it, with an address for every missing part by URL. */
export interface UploadStatus {
  readonly transfer: Transfer;
  readonly missing: number[];
  readonly targets: Array<{ part: number; url: string }>;
  readonly expiresAt: string | null;
  /** The file the upload became, when the worker kept it (#480). */
  readonly kept?: KeptUpload | undefined;
}

async function statusOf(
  transfer: Transfer,
  parts: PartStore,
  subscriptionId: string,
): Promise<UploadStatus> {
  const observed = await new ObserveUpload(parts, subscriptionId).execute(transfer);
  const upload = observed.upload as TransferUpload;
  const received = new Set(receivedOf(upload));
  const missing = everyPart(upload).filter((part) => !received.has(part));
  if (
    observed.status !== 'running' ||
    upload.transport !== 'url' ||
    !upload.multipartId ||
    upload.finishing
  ) {
    return { transfer: observed, missing, targets: [], expiresAt: null };
  }
  const key = uploadAssemblyKeyOf(subscriptionId, transfer.transferId);
  const multipartId = upload.multipartId;
  const targets = await Promise.all(
    missing.map(async (part) => ({
      part,
      url: await parts.signPart(key, multipartId, part, PART_URL_SECONDS),
    })),
  );
  const expiresAt = Instant.fromEpochMillis(Instant.now().epochMillis + PART_URL_SECONDS * 1000);
  return {
    transfer: observed,
    missing,
    targets,
    expiresAt: expiresAt.ok ? expiresAt.value.toISOString() : null,
  };
}

/** The upload of this person by its identifier, or not found (INV-09). */
async function openUpload(
  transfers: TransferStore,
  userId: string,
  transferId: string,
): Promise<Result<Transfer & { upload: TransferUpload }, DomainError>> {
  const found = await transfers.get(userId, transferId);
  if (!found || found.kind !== 'agent' || !found.upload) {
    return err(DomainError.notFound('Upload not found'));
  }
  return ok(found as Transfer & { upload: TransferUpload });
}

export class BeginUpload {
  constructor(
    private readonly transfers: TransferStore,
    private readonly parts: PartStore,
    private readonly files: FileKeeper,
    private readonly budget: StorageBudget,
    private readonly subscriptionId: string,
    private readonly userId: string,
  ) {}

  async execute(
    declared: BeginUploadInput & { by: Authorship },
  ): Promise<Result<UploadStatus, DomainError>> {
    const input = declared;
    if (input.size > UPLOAD_MAX_BYTES) {
      return err(
        DomainError.limitExceeded(
          `A file sent in parts goes up to ${UPLOAD_MAX_BYTES / (1024 * 1024)} MB`,
        ),
      );
    }

    const partSize = UPLOAD_URL_PART_BYTES;
    const partCount = Math.max(1, Math.ceil(input.size / partSize));

    const destination = await this.files.destination({
      notebookId: input.notebookId,
      name: input.name,
      mimeType: input.mimeType,
    });
    if (!destination.ok) return destination;

    /**
     * The whole declared size is reserved now (RN-SUB-025). Parts by URL reach
     * the store without passing through here, so nothing could count them as
     * they arrive; and an upload with no room is refused before a byte travels
     * rather than at its last part.
     */
    const budget = await this.budget.current();
    if (budget.usedBytes + input.size > budget.limitBytes) {
      return err(
        DomainError.limitExceeded(
          'The storage of this plan has no room for this file: delete something first',
        ),
      );
    }

    const transferId = ulid();
    const multipartId = await this.parts.startMultipart(
      uploadAssemblyKeyOf(this.subscriptionId, transferId),
      destination.value.mimeType,
    );

    const transfer: Transfer = {
      transferId,
      kind: 'agent',
      status: 'running',
      userId: this.userId,
      notebookId: input.notebookId,
      notebookName: destination.value.notebookName,
      fileName: input.name.normalize('NFC').trim(),
      requestedAt: Instant.now().toISOString(),
      finishedAt: null,
      done: 0,
      total: partCount,
      bytes: input.size,
      key: null,
      versionId: null,
      failure: null,
      upload: {
        mimeType: destination.value.mimeType,
        description: (input.description ?? '').trim(),
        tags: input.tags ?? [],
        path: input.path ?? '',
        purpose: input.purpose.trim(),
        platform: input.by.agent?.clientName ?? null,
        transport: 'url',
        sha256: input.sha256,
        partSize,
        partCount,
        multipartId,
        parts: {},
        assembled: null,
        lastPartAt: null,
      },
    };
    await this.transfers.put(transfer);
    await this.transfers.addTransitBytes(input.size, input.notebookId);
    return ok(await statusOf(transfer, this.parts, this.subscriptionId));
  }
}

export class GetUploadStatus {
  constructor(
    private readonly transfers: TransferStore,
    private readonly parts: PartStore,
    private readonly subscriptionId: string,
    private readonly userId: string,
  ) {}

  async execute(transferId: string): Promise<Result<UploadStatus, DomainError>> {
    const found = await openUpload(this.transfers, this.userId, transferId);
    if (!found.ok) return found;
    // A finish the worker ended: the file it kept is answered, once (#480).
    const kept = await takeKept(this.transfers, this.userId, found.value);
    const status = await statusOf(found.value, this.parts, this.subscriptionId);
    return ok(kept ? { ...status, kept } : status);
  }
}

/** The open uploads of this person, newest first; one notebook's, when it is named. */
export class ListUploads {
  constructor(
    private readonly transfers: TransferStore,
    private readonly parts: PartStore,
    private readonly subscriptionId: string,
    private readonly userId: string,
  ) {}

  async execute(notebookId: string | null): Promise<Result<Transfer[], DomainError>> {
    const observe = new ObserveUpload(this.parts, this.subscriptionId);
    const all = await this.transfers.list(this.userId);
    // An upload the worker made a file of is no upload any more (RN-PRT-028).
    for (const transfer of all) {
      if (transfer.kind === 'agent' && transfer.status === 'ready') {
        await this.transfers.remove(this.userId, transfer.transferId);
      }
    }
    const mine = all.filter(
      (transfer) =>
        transfer.kind === 'agent' &&
        transfer.status !== 'ready' &&
        (notebookId === null || transfer.notebookId === notebookId),
    );
    return ok(await Promise.all(mine.map((transfer) => observe.execute(transfer))));
  }
}

/**
 * The finish (RN-PRT-027, RN-PRT-028): the parts are joined, and the whole
 * becomes a file only if it hashes to what was declared and its bytes support
 * its type. Ready, the record goes and the file is what stays; wrong bytes end
 * the upload as failed, with its reason and without its bytes. Anything else —
 * the notebook unavailable, a name taken meanwhile, no room — leaves it open,
 * joined, for the finish to be asked again.
 */
export class FinishUpload {
  constructor(
    private readonly transfers: TransferStore,
    private readonly parts: PartStore,
    private readonly files: FileKeeper,
    private readonly subscriptionId: string,
    private readonly userId: string,
  ) {}

  async execute(
    transferId: string,
    by: Authorship,
  ): Promise<
    Result<{ fileId: string; notebookId: string; name: string; bytes: number }, DomainError>
  > {
    const found = await openUpload(this.transfers, this.userId, transferId);
    if (!found.ok) return found;
    if (found.value.status !== 'running') {
      return err(DomainError.conflict('This upload has ended: start another one'));
    }
    const transfer = await new ObserveUpload(this.parts, this.subscriptionId).execute(found.value);
    const upload = transfer.upload as TransferUpload;
    const notebookId = transfer.notebookId;
    if (!notebookId) return err(DomainError.notFound('Notebook not found'));

    const received = new Set(receivedOf(upload));
    const missing = everyPart(upload).filter((part) => !received.has(part));
    if (missing.length > 0) {
      return err(
        DomainError.conflict(
          `Parts ${missing.join(', ')} of ${upload.partCount} have not arrived yet`,
          { reason: 'PARTS_MISSING', missing },
        ),
      );
    }

    const assemblyKey = uploadAssemblyKeyOf(this.subscriptionId, transfer.transferId);
    let assembledVersion = upload.assembled;
    if (!assembledVersion) {
      const joined = await this.assemble(transfer, upload);
      if (!joined.ok) return joined;
      assembledVersion = joined.value;
    }

    // The reservation is given back before the file is kept, or the file would
    // be refused for the room its own upload holds; a refusal that leaves the
    // upload open takes it again (RN-SUB-025).
    await this.transfers.addTransitBytes(-transfer.bytes, notebookId);
    const kept = await this.files.keepAssembled({
      notebookId,
      name: transfer.fileName ?? '',
      description: upload.description || upload.purpose,
      mimeType: upload.mimeType,
      tags: upload.tags,
      path: upload.path,
      assembled: {
        key: assemblyKey,
        versionId: assembledVersion,
        size: transfer.bytes,
        sha256: upload.sha256,
      },
      by,
    });

    if (kept.ok) {
      await this.parts.destroy(assemblyKey, assembledVersion).catch(() => undefined);
      // The file is what stays (RN-PRT-028). The record says so until whoever
      // asked for the finish reads it, and then goes (#480).
      const file = { ...kept.value, notebookId };
      await this.transfers.patch(this.userId, transfer.transferId, {
        status: 'ready',
        finishedAt: Instant.now().toISOString(),
        upload: {
          ...upload,
          parts: {},
          multipartId: null,
          assembled: null,
          finishing: null,
          refusal: null,
          kept: file,
        },
      });
      return ok(file);
    }

    const reason = reasonOf(kept.error);
    if (reason && TERMINAL.has(reason)) {
      await this.parts.destroy(assemblyKey, assembledVersion).catch(() => undefined);
      await this.transfers.patch(this.userId, transfer.transferId, {
        status: 'failed',
        finishedAt: Instant.now().toISOString(),
        failure: reason,
        upload: {
          ...upload,
          parts: {},
          assembled: null,
          multipartId: null,
          finishing: null,
          refusal: refusalOf(kept.error),
        },
      });
      return kept;
    }
    await this.transfers.addTransitBytes(transfer.bytes, notebookId);
    await this.transfers.patch(this.userId, transfer.transferId, {
      upload: {
        ...upload,
        parts: {},
        multipartId: null,
        assembled: assembledVersion,
        finishing: null,
        refusal: refusalOf(kept.error),
      },
    });
    return kept;
  }

  /**
   * Joins the parts into the one object the file is made of, in place in the
   * store, and records that it did, so a finish asked again joins nothing
   * twice. An upload opened inline before #468 is never joined: it is refused,
   * to be discarded and sent again by URL.
   */
  private async assemble(
    transfer: Transfer,
    upload: TransferUpload,
  ): Promise<Result<string, DomainError>> {
    const key = uploadAssemblyKeyOf(this.subscriptionId, transfer.transferId);
    if (upload.transport !== 'url') {
      return err(
        DomainError.conflict(
          'This upload sent its parts inline, which is no longer supported: discard it and send the file by URL',
          { reason: 'INLINE_RETIRED' },
        ),
      );
    }
    if (!upload.multipartId) return err(DomainError.notFound('Upload not found'));
    const versionId = await this.parts.completeMultipart(key, upload.multipartId);
    await this.transfers.patch(this.userId, transfer.transferId, {
      upload: { ...upload, parts: {}, multipartId: null, assembled: versionId },
    });
    return ok(versionId);
  }
}

/** What asking for the finish answers: the file, or that the worker is still at it. */
export type FinishAnswer =
  | { readonly status: 'kept'; readonly file: KeptUpload }
  | { readonly status: 'finishing'; readonly transferId: string };

/** How long asking for the finish waits for the worker, and how often it looks. */
export interface FinishWait {
  readonly withinMs: number;
  readonly everyMs: number;
  readonly sleep?: (ms: number) => Promise<void>;
}

/** A little under the 29 seconds of the API, as a notebook from a model waits (RN-AGT-067). */
export const FINISH_WAIT: FinishWait = { withinMs: 20_000, everyMs: 1_000 };

/**
 * A finish asked for again while the worker runs it is not run twice; one that
 * has run longer than the worker can is asked for again.
 */
const STALE_FINISH_MS = 16 * 60 * 1000;

/**
 * Asking for the finish (#480, RN-PRT-027). Joining the parts and reading the
 * whole back to hold it to its hash take time that grows with the file, and a
 * file near 500 MB passed the 29 seconds of the API after every part had
 * arrived. So the API checks what it can at once — the upload is open, every
 * part is there — hands the finish to the transfer worker, and waits for it
 * within the call: a file of a few megabytes is answered as before; a larger
 * one answers `finishing`, and the status says when it is kept.
 */
export class RequestFinish {
  constructor(
    private readonly transfers: TransferStore,
    private readonly parts: PartStore,
    private readonly queue: TransferQueue,
    private readonly subscriptionId: string,
    private readonly userId: string,
    private readonly wait: FinishWait = FINISH_WAIT,
  ) {}

  async execute(transferId: string, by: Authorship): Promise<Result<FinishAnswer, DomainError>> {
    const found = await openUpload(this.transfers, this.userId, transferId);
    if (!found.ok) return found;
    const already = await takeKept(this.transfers, this.userId, found.value);
    if (already) return ok({ status: 'kept', file: already });
    if (found.value.status !== 'running') {
      return err(DomainError.conflict('This upload has ended: start another one'));
    }

    const transfer = await new ObserveUpload(this.parts, this.subscriptionId).execute(found.value);
    const upload = transfer.upload as TransferUpload;
    if (!transfer.notebookId) return err(DomainError.notFound('Notebook not found'));
    const received = new Set(receivedOf(upload));
    const missing = everyPart(upload).filter((part) => !received.has(part));
    if (missing.length > 0) {
      return err(
        DomainError.conflict(
          `Parts ${missing.join(', ')} of ${upload.partCount} have not arrived yet`,
          { reason: 'PARTS_MISSING', missing },
        ),
      );
    }

    const started = upload.finishing ? Date.parse(upload.finishing) : Number.NaN;
    const running = Number.isFinite(started) && Date.now() - started < STALE_FINISH_MS;
    if (!running) {
      const current = found.value.upload as TransferUpload;
      await this.transfers.patch(this.userId, transferId, {
        upload: { ...current, finishing: Instant.now().toISOString(), refusal: null },
      });
      await this.queue.send({
        kind: 'finish',
        subscriptionId: this.subscriptionId,
        userId: this.userId,
        transferId,
        authorship: {
          userId: by.user.value,
          agent: by.agent ? { clientId: by.agent.clientId, clientName: by.agent.clientName } : null,
        },
      });
    }
    return this.waitFor(transferId);
  }

  private async waitFor(transferId: string): Promise<Result<FinishAnswer, DomainError>> {
    const sleep =
      this.wait.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
    const deadline = Date.now() + this.wait.withinMs;
    for (;;) {
      const now = await this.transfers.get(this.userId, transferId);
      if (!now?.upload) return err(DomainError.notFound('Upload not found'));
      const kept = await takeKept(this.transfers, this.userId, now);
      if (kept) return ok({ status: 'kept', file: kept });
      if (!now.upload.finishing && now.upload.refusal) return err(errorOf(now.upload.refusal));
      if (Date.now() >= deadline) return ok({ status: 'finishing', transferId });
      await sleep(this.wait.everyMs);
    }
  }
}

/**
 * The finish, run by the transfer worker (#480): the finish of before, and,
 * when it is refused before it reaches the file — a part gone, the notebook
 * unavailable — the refusal kept on the record for whoever asks next.
 */
export class RunFinish {
  constructor(
    private readonly transfers: TransferStore,
    private readonly finish: FinishUpload,
    private readonly userId: string,
  ) {}

  async execute(transferId: string, by: Authorship): Promise<void> {
    const done = await this.finish.execute(transferId, by);
    if (!done.ok) await refuseFinish(this.transfers, this.userId, transferId, done.error);
  }
}

/**
 * A finish refused before it reached the file, kept on the record for whoever
 * asks next (#480); an upload that ended meanwhile is left as it is.
 */
export async function refuseFinish(
  transfers: TransferStore,
  userId: string,
  transferId: string,
  error: DomainError,
): Promise<void> {
  const now = await transfers.get(userId, transferId);
  if (!now?.upload || now.status !== 'running' || !now.upload.finishing) return;
  await transfers.patch(userId, transferId, {
    upload: { ...now.upload, finishing: null, refusal: refusalOf(error) },
  });
}

/**
 * Points an open upload at another notebook (RN-PRT-029), which is what an
 * upload whose notebook became unavailable needs: its parts name no notebook,
 * so nothing moves but the record and the line of the space it reserves.
 */
export class LinkUpload {
  constructor(
    private readonly transfers: TransferStore,
    private readonly files: FileKeeper,
    private readonly userId: string,
  ) {}

  async execute(transferId: string, notebookId: string): Promise<Result<Transfer, DomainError>> {
    const found = await openUpload(this.transfers, this.userId, transferId);
    if (!found.ok) return found;
    const transfer = found.value;
    if (transfer.status !== 'running') {
      return err(DomainError.conflict('This upload has ended: start another one'));
    }
    const destination = await this.files.destination({
      notebookId,
      name: transfer.fileName ?? '',
      mimeType: transfer.upload.mimeType,
    });
    if (!destination.ok) return destination;

    await this.transfers.patch(this.userId, transferId, {
      notebookId,
      notebookName: destination.value.notebookName,
    });
    await this.transfers.addTransitBytes(-transfer.bytes, transfer.notebookId);
    await this.transfers.addTransitBytes(transfer.bytes, notebookId);
    return ok({ ...transfer, notebookId, notebookName: destination.value.notebookName });
  }
}

/**
 * Throws an upload's bytes away, whatever it held: the parts, the multipart
 * upload of the store, and the whole if it was joined. Only deleting its row
 * does this (RN-PRT-028): an upload has no deadline.
 */
export async function discardUpload(
  parts: PartStore,
  subscriptionId: string,
  transfer: Transfer,
): Promise<void> {
  const upload = transfer.upload;
  if (!upload) return;
  const key = uploadAssemblyKeyOf(subscriptionId, transfer.transferId);
  if (upload.multipartId)
    await parts.abortMultipart(key, upload.multipartId).catch(() => undefined);
  if (upload.assembled) await parts.destroy(key, upload.assembled).catch(() => undefined);
  for (const [part, versionId] of Object.entries(upload.parts)) {
    await parts
      .destroy(uploadPartKeyOf(subscriptionId, transfer.transferId, Number(part)), versionId)
      .catch(() => undefined);
  }
}
