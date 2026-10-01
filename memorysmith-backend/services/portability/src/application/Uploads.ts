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
 * SHA-256 of the whole — and then sends it in parts it can follow, by one of
 * two ways:
 *
 *  - **by URL**: a signed address per part, which a script PUTs from the disk.
 *    The bytes never pass through the model, so a photo of 5 MB costs it what
 *    one of 5 KB does. The parts reach the store without passing through the
 *    API, and the store is what says which arrived.
 *  - **inline**: base64 in the call, for an agent with no network. Every byte is
 *    typed, so every part carries the hash of its own bytes and a part that
 *    does not match is refused and sent again rather than kept.
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
} from '@memorysmith/kernel';
import { createHash } from 'node:crypto';
import {
  UPLOAD_INLINE_MAX_BYTES,
  UPLOAD_INLINE_MAX_PARTS,
  UPLOAD_INLINE_PART_MAX,
  UPLOAD_INLINE_PART_MIN,
  UPLOAD_MAX_BYTES,
  UPLOAD_URL_PART_BYTES,
  uploadAssemblyKeyOf,
  uploadPartKeyOf,
  type Transfer,
  type TransferRequest,
  type TransferStore,
  type TransferUpload,
} from '../domain/Transfer.js';
import type { StorageBudget } from './Transfers.js';

/**
 * What starting an upload declares (RN-PRT-027): the file it becomes and how
 * its parts will travel. It is the shape the API validates at its edge.
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
  readonly transport: 'url' | 'inline';
  readonly partSize?: number | undefined;
  /**
   * The request of the person this upload fulfils (RN-PRT-030). The file is
   * then the one the request names — its notebook, name and what travels with
   * it — and the type chosen must be the one it asks for.
   */
  readonly request?: string | undefined;
}

/** How long the address of one part lives. Asked again, a fresh one is signed. */
export const PART_URL_SECONDS = 3600;

/**
 * Where the parts of an upload are kept, under the upload and never under a
 * notebook (RN-PRT-029). Every key it is given was built from the subscription
 * of the token (rule 1).
 */
export interface PartStore {
  /** Opens the multipart upload of an upload by URL, and answers its identifier. */
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
  /** Writes bytes once, and answers the revision they were written as. */
  putObject(key: string, bytes: Uint8Array): Promise<string>;
  readObject(key: string, versionId: string): Promise<Uint8Array | null>;
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

/** How many bytes part `part` of an upload must be. */
function sizeOfPart(upload: TransferUpload, size: number, part: number): number {
  return part < upload.partCount
    ? upload.partSize
    : size - upload.partSize * (upload.partCount - 1);
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
  if (observed.status !== 'running' || upload.transport !== 'url' || !upload.multipartId) {
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

/** The upload of this person by its identifier, or not found (rule 9). */
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

/** The open request of this person by its identifier, or not found (rule 9). */
async function openRequest(
  transfers: TransferStore,
  userId: string,
  transferId: string,
): Promise<Result<Transfer & { request: TransferRequest }, DomainError>> {
  const found = await transfers.get(userId, transferId);
  if (!found || found.kind !== 'request' || !found.request || found.status !== 'running') {
    return err(DomainError.notFound('Request not found'));
  }
  return ok(found as Transfer & { request: TransferRequest });
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
    const fulfilled = await this.fulfilling(declared);
    if (!fulfilled.ok) return fulfilled;
    const input = fulfilled.value;
    if (input.size > UPLOAD_MAX_BYTES) {
      return err(
        DomainError.limitExceeded(
          `A file sent in parts goes up to ${UPLOAD_MAX_BYTES / (1024 * 1024)} MB`,
        ),
      );
    }

    let partSize: number;
    if (input.transport === 'url') {
      partSize = UPLOAD_URL_PART_BYTES;
    } else {
      if (input.size > UPLOAD_INLINE_MAX_BYTES) {
        return err(
          DomainError.limitExceeded(
            `An upload whose parts travel inline goes up to ${UPLOAD_INLINE_MAX_BYTES / (1024 * 1024)} MB: above it, send the parts by URL`,
          ),
        );
      }
      partSize = input.partSize ?? 0;
      if (partSize < UPLOAD_INLINE_PART_MIN || partSize > UPLOAD_INLINE_PART_MAX) {
        return err(
          DomainError.validation(
            `An inline part is between ${UPLOAD_INLINE_PART_MIN} and ${UPLOAD_INLINE_PART_MAX} bytes: say which with partSize`,
          ),
        );
      }
    }
    const partCount = Math.max(1, Math.ceil(input.size / partSize));
    if (input.transport === 'inline' && partCount > UPLOAD_INLINE_MAX_PARTS) {
      return err(
        DomainError.validation(
          `An inline upload has at most ${UPLOAD_INLINE_MAX_PARTS} parts: ${partCount} of ${partSize} bytes is too many, so choose larger parts`,
        ),
      );
    }

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
    const multipartId =
      input.transport === 'url'
        ? await this.parts.startMultipart(
            uploadAssemblyKeyOf(this.subscriptionId, transferId),
            destination.value.mimeType,
          )
        : null;

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
        transport: input.transport,
        sha256: input.sha256,
        partSize,
        partCount,
        multipartId,
        parts: {},
        assembled: null,
        lastPartAt: null,
        fulfils: input.request ?? null,
      },
    };
    await this.transfers.put(transfer);
    await this.transfers.addTransitBytes(input.size, input.notebookId);
    return ok(await statusOf(transfer, this.parts, this.subscriptionId));
  }

  /**
   * An upload that fulfils a request keeps the file the request names: the
   * notebook, the name and what travels with a file come from the request, and
   * only the bytes — their size, hash and type — from whoever chose the file.
   */
  private async fulfilling(
    input: BeginUploadInput & { by: Authorship },
  ): Promise<Result<BeginUploadInput & { by: Authorship }, DomainError>> {
    if (!input.request) return ok(input);
    const found = await openRequest(this.transfers, this.userId, input.request);
    if (!found.ok) return found;
    const { request } = found.value;
    if (!found.value.notebookId) return err(DomainError.notFound('Notebook not found'));
    if (input.mimeType.trim().toLowerCase() !== request.mimeType) {
      return err(
        DomainError.validation(
          `This request asks for a file of type ${request.mimeType}, and the one chosen is ${input.mimeType}`,
          { reason: 'REQUEST_TYPE_MISMATCH', expected: request.mimeType },
        ),
      );
    }
    return ok({
      ...input,
      notebookId: found.value.notebookId,
      name: found.value.fileName ?? input.name,
      mimeType: request.mimeType,
      description: request.description,
      tags: request.tags,
      path: request.path,
      purpose: request.purpose,
    });
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
    return ok(await statusOf(found.value, this.parts, this.subscriptionId));
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
    const mine = (await this.transfers.list(this.userId)).filter(
      (transfer) =>
        (transfer.kind === 'agent' || transfer.kind === 'request') &&
        (notebookId === null || transfer.notebookId === notebookId),
    );
    return ok(await Promise.all(mine.map((transfer) => observe.execute(transfer))));
  }
}

/**
 * One inline part (RN-PRT-027). Its hash is the hash of the bytes the agent
 * meant to send, and the bytes that arrived must hash to it: a mistyped part is
 * refused here and sent again, where it used to be kept as the file.
 */
export class PutUploadPart {
  constructor(
    private readonly transfers: TransferStore,
    private readonly parts: PartStore,
    private readonly subscriptionId: string,
    private readonly userId: string,
  ) {}

  async execute(input: {
    transferId: string;
    part: number;
    sha256: string;
    contentBase64: string;
  }): Promise<Result<UploadStatus, DomainError>> {
    const found = await openUpload(this.transfers, this.userId, input.transferId);
    if (!found.ok) return found;
    const transfer = found.value;
    const upload = transfer.upload;
    if (transfer.status !== 'running') {
      return err(DomainError.conflict('This upload has ended: start another one'));
    }
    if (upload.transport !== 'inline') {
      return err(
        DomainError.validation(
          'The parts of this upload go to their addresses by URL, not in the call',
        ),
      );
    }
    if (upload.assembled) {
      return err(DomainError.conflict('Every part of this upload arrived: finish it'));
    }
    if (!Number.isInteger(input.part) || input.part < 1 || input.part > upload.partCount) {
      return err(
        DomainError.validation(`This upload has parts 1 to ${upload.partCount}`, {
          partCount: upload.partCount,
        }),
      );
    }
    const text = input.contentBase64.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text) || text.length % 4 !== 0) {
      return err(
        DomainError.validation('contentBase64 is not base64', { reason: 'PART_NOT_BASE64' }),
      );
    }
    const bytes = new Uint8Array(Buffer.from(text, 'base64'));
    const expected = sizeOfPart(upload, transfer.bytes, input.part);
    if (bytes.byteLength !== expected) {
      return err(
        DomainError.validation(
          `Part ${input.part} is ${expected} bytes, and ${bytes.byteLength} arrived: send it again`,
          { reason: 'PART_SIZE_MISMATCH', expected, arrived: bytes.byteLength },
        ),
      );
    }
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (sha256 !== input.sha256) {
      return err(
        DomainError.validation(
          `Part ${input.part} does not hash to the SHA-256 sent with it, so it was not kept: send it again`,
          { reason: 'PART_HASH_MISMATCH' },
        ),
      );
    }

    const key = uploadPartKeyOf(this.subscriptionId, transfer.transferId, input.part);
    const versionId = await this.parts.putObject(key, bytes);
    // A part sent twice leaves one revision, not two: the one it replaces is
    // destroyed, so what the upload holds is exactly what it will join.
    const previous = upload.parts[String(input.part)];
    if (previous && previous !== versionId) {
      await this.parts.destroy(key, previous).catch(() => undefined);
    }
    const at = Instant.now().toISOString();
    await this.transfers.recordPart(this.userId, transfer.transferId, input.part, versionId, at);
    return ok(
      await statusOf(
        {
          ...transfer,
          upload: {
            ...upload,
            parts: { ...upload.parts, [String(input.part)]: versionId },
            lastPartAt: at,
          },
        },
        this.parts,
        this.subscriptionId,
      ),
    );
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
      await this.transfers.remove(this.userId, transfer.transferId);
      // The file the request asked for is kept, which is what ends it (RN-PRT-030).
      if (upload.fulfils) await this.transfers.remove(this.userId, upload.fulfils);
      return ok({ ...kept.value, notebookId });
    }

    const reason = reasonOf(kept.error);
    if (reason && TERMINAL.has(reason)) {
      await this.parts.destroy(assemblyKey, assembledVersion).catch(() => undefined);
      await this.transfers.patch(this.userId, transfer.transferId, {
        status: 'failed',
        finishedAt: Instant.now().toISOString(),
        failure: reason,
        upload: { ...upload, parts: {}, assembled: null, multipartId: null },
      });
      return kept;
    }
    await this.transfers.addTransitBytes(transfer.bytes, notebookId);
    return kept;
  }

  /**
   * Joins the parts into the one object the file is made of, and records that
   * it did, so a finish asked again joins nothing twice. By URL the store joins
   * them in place; inline, the parts are read in order and written once — at
   * most 4 MB — and then destroyed.
   */
  private async assemble(
    transfer: Transfer,
    upload: TransferUpload,
  ): Promise<Result<string, DomainError>> {
    const key = uploadAssemblyKeyOf(this.subscriptionId, transfer.transferId);
    let versionId: string;
    if (upload.transport === 'url') {
      if (!upload.multipartId) return err(DomainError.notFound('Upload not found'));
      versionId = await this.parts.completeMultipart(key, upload.multipartId);
    } else {
      const chunks: Uint8Array[] = [];
      for (const part of everyPart(upload)) {
        const partKey = uploadPartKeyOf(this.subscriptionId, transfer.transferId, part);
        const bytes = await this.parts.readObject(partKey, upload.parts[String(part)] ?? '');
        if (!bytes) {
          return err(
            DomainError.conflict(`Part ${part} is not there any more: send it again`, {
              reason: 'PARTS_MISSING',
              missing: [part],
            }),
          );
        }
        chunks.push(bytes);
      }
      versionId = await this.parts.putObject(key, Buffer.concat(chunks));
      for (const part of everyPart(upload)) {
        const partKey = uploadPartKeyOf(this.subscriptionId, transfer.transferId, part);
        await this.parts.destroy(partKey, upload.parts[String(part)] ?? '').catch(() => undefined);
      }
    }
    await this.transfers.patch(this.userId, transfer.transferId, {
      upload: { ...upload, parts: {}, multipartId: null, assembled: versionId },
    });
    return ok(versionId);
  }
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
    const request = await openRequest(this.transfers, this.userId, transferId);
    if (request.ok) return this.linkRequest(request.value, notebookId);
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

  /** A request reserves nothing, so only its record moves (RN-PRT-030). */
  private async linkRequest(
    transfer: Transfer & { request: TransferRequest },
    notebookId: string,
  ): Promise<Result<Transfer, DomainError>> {
    const destination = await this.files.destination({
      notebookId,
      name: transfer.fileName ?? '',
      mimeType: transfer.request.mimeType,
    });
    if (!destination.ok) return destination;
    await this.transfers.patch(this.userId, transfer.transferId, {
      notebookId,
      notebookName: destination.value.notebookName,
    });
    return ok({ ...transfer, notebookId, notebookName: destination.value.notebookName });
  }
}

/**
 * What asking the person for a file declares (RN-PRT-030): the file, as an
 * upload declares it, without its bytes. `fromUpload` takes it all from an
 * upload the agent could not finish instead, which that upload then becomes.
 */
export interface RequestFileInput {
  readonly notebookId?: string | undefined;
  readonly name?: string | undefined;
  readonly mimeType?: string | undefined;
  readonly description?: string | undefined;
  readonly tags?: readonly string[] | undefined;
  readonly path?: string | undefined;
  readonly purpose?: string | undefined;
  readonly size?: number | undefined;
  readonly sha256?: string | undefined;
  readonly fromUpload?: string | undefined;
}

interface RequestedFile {
  readonly notebookId: string;
  readonly name: string;
  readonly mimeType: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly path: string;
  readonly purpose: string;
  readonly size: number | null;
  readonly sha256: string | null;
  /** The upload the request replaces, when it is made from one. */
  readonly upload: Transfer | null;
}

/**
 * An agent asks the person for a file instead of sending it (#253, RN-PRT-030).
 *
 * An agent often learns it cannot send a file only by trying: a sandbox with no
 * network opens an upload by URL and no part ever arrives. So a request is made
 * either from nothing, or from that upload — which it replaces, its bytes
 * thrown away and the room it reserved given back, so no attempt is left open.
 *
 * The request reserves nothing and has no deadline. It ends when the person
 * keeps the file it names, or when either of them dismisses it; asking again
 * for a name the notebook is already waiting for answers the same request.
 */
export class RequestFile {
  constructor(
    private readonly transfers: TransferStore,
    private readonly parts: PartStore,
    private readonly files: FileKeeper,
    private readonly subscriptionId: string,
    private readonly userId: string,
  ) {}

  async execute(
    input: RequestFileInput & { by: Authorship },
  ): Promise<Result<Transfer, DomainError>> {
    const declared = await this.declared(input);
    if (!declared.ok) return declared;
    const want = declared.value;

    const destination = await this.files.destination({
      notebookId: want.notebookId,
      name: want.name,
      mimeType: want.mimeType,
    });
    if (!destination.ok) return destination;

    const name = want.name.normalize('NFC').trim();
    const waiting = (await this.transfers.list(this.userId)).find(
      (transfer) =>
        transfer.kind === 'request' &&
        transfer.status === 'running' &&
        transfer.notebookId === want.notebookId &&
        transfer.fileName === name,
    );
    if (waiting) {
      await this.dropUpload(want.upload);
      return ok(waiting);
    }

    const transfer: Transfer = {
      transferId: ulid(),
      kind: 'request',
      status: 'running',
      userId: this.userId,
      notebookId: want.notebookId,
      notebookName: destination.value.notebookName,
      fileName: name,
      requestedAt: Instant.now().toISOString(),
      finishedAt: null,
      done: 0,
      total: 0,
      bytes: want.size ?? 0,
      key: null,
      versionId: null,
      failure: null,
      request: {
        mimeType: destination.value.mimeType,
        description: want.description,
        tags: want.tags,
        path: want.path,
        purpose: want.purpose,
        platform: input.by.agent?.clientName ?? null,
        expectedSize: want.size,
        expectedSha256: want.sha256,
      },
    };
    await this.transfers.put(transfer);
    await this.dropUpload(want.upload);
    return ok(transfer);
  }

  private async declared(input: RequestFileInput): Promise<Result<RequestedFile, DomainError>> {
    if (input.fromUpload) {
      const found = await openUpload(this.transfers, this.userId, input.fromUpload);
      if (!found.ok) return found;
      const upload = found.value;
      if (upload.status !== 'running' || !upload.notebookId) {
        return err(DomainError.conflict('This upload has ended: request the file from nothing'));
      }
      return ok({
        notebookId: upload.notebookId,
        name: upload.fileName ?? '',
        mimeType: upload.upload.mimeType,
        description: upload.upload.description,
        tags: upload.upload.tags,
        path: upload.upload.path,
        purpose: upload.upload.purpose,
        size: upload.bytes,
        sha256: upload.upload.sha256,
        upload,
      });
    }
    if (!input.notebookId || !input.name || !input.mimeType || !input.purpose) {
      return err(
        DomainError.validation(
          'A request names the notebook, the name of the file, its type and what it is for — or the upload it replaces',
        ),
      );
    }
    return ok({
      notebookId: input.notebookId,
      name: input.name,
      mimeType: input.mimeType,
      description: (input.description ?? '').trim(),
      tags: input.tags ?? [],
      path: input.path ?? '',
      purpose: input.purpose.trim(),
      size: input.size ?? null,
      sha256: input.sha256 ?? null,
      upload: null,
    });
  }

  /** The upload a request replaces goes: its bytes, its record and the room it held. */
  private async dropUpload(upload: Transfer | null): Promise<void> {
    if (!upload) return;
    await discardUpload(this.parts, this.subscriptionId, upload);
    await this.transfers.remove(this.userId, upload.transferId);
    await this.transfers.addTransitBytes(-upload.bytes, upload.notebookId);
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
