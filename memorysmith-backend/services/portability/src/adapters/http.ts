/**
 * HTTP surface of svc-portability (architecture-guide.md, sections 14.1, 16):
 *
 *   POST   /notebooks/:v/export        ->  starts the job, answers the transfer
 *   GET    /transfers                  ->  the transfers of whoever is asking
 *   GET    /transfers/:t               ->  one of them, with its progress
 *   POST   /transfers/:t/download      ->  a link issued at this moment
 *   DELETE /transfers/:t               ->  destroys the archive and its bytes
 *   POST   /imports                    ->  a short-lived address to upload to
 *   POST   /imports/apply              ->  starts the import, answers the transfer
 *   POST   /transfers/:t/cancel        ->  takes a running import back down
 *
 * **An export is a job and not a request** (RN-PRT-019). Building the archive
 * means reading every note of the notebook, and the function behind this API
 * stops at 29 seconds: a notebook large enough could not be exported at all.
 * The API records the transfer and hands the work to a worker; what the
 * interface polls is the record.
 *
 * The archive is answered as a LINK and never as a body, and the link is issued
 * at the moment of each download rather than stored: a stored link is one that
 * has expired by the time somebody comes back to it, which is what used to make
 * an export unreachable a quarter of an hour after it was made.
 *
 * Portability holds no notebook, so whether the caller may read it is answered by
 * the context that owns it, exactly as Discovery does (section 14.2).
 */

import { Hono, type Context } from 'hono';
import { archiveNameOf } from '../domain/NotebookDocumentBuilder.js';
import {
  type Authorship,
  DomainError,
  httpStatusFor,
  Instant,
  type Result,
  type SubscriptionContext,
} from '@memorysmith/kernel';
import type {
  CancelTransfer,
  DeleteTransfer,
  DownloadTransfer,
  GetTransfer,
  ListTransfers,
  StartExport,
  StartImport,
} from '../application/Transfers.js';
import type { ImportSelection } from '../application/ImportNotebook.js';
import type { Transfer } from '../domain/Transfer.js';
import type { PrepareImport, NotebookWriter } from '../application/ImportNotebook.js';

export interface PortabilityRequest {
  readonly subscription: SubscriptionContext;
  readonly canRead: (notebookId: string) => Promise<boolean>;
  /**
   * Who is importing, or why this session may not write. Every write of an
   * import carries it (rule 7), and a connector whose token was never bound is
   * refused before the first one (RN-AGT-001).
   */
  readonly authorship: Result<Authorship, DomainError>;
  /**
   * What an import writes with. Writing a notebook belongs to the Knowledge
   * context, which this service may not import, so it arrives already built
   * for this request — the same arrangement `canRead` uses to ask a question
   * this service cannot answer either.
   */
  readonly write: NotebookWriter;
}

export interface PortabilityUseCases {
  readonly startExport: (request: PortabilityRequest) => StartExport;
  readonly listTransfers: (request: PortabilityRequest) => ListTransfers;
  readonly getTransfer: (request: PortabilityRequest) => GetTransfer;
  readonly downloadTransfer: (request: PortabilityRequest) => DownloadTransfer;
  readonly deleteTransfer: (request: PortabilityRequest) => DeleteTransfer;
  readonly cancelTransfer: (request: PortabilityRequest) => CancelTransfer;
  readonly prepareImport: (request: PortabilityRequest) => PrepareImport;
  readonly startImport: (request: PortabilityRequest) => StartImport;
}

/** What a transfer looks like on the wire, which is what it is (§16). */
function transferToDto(transfer: Transfer): Record<string, unknown> {
  return {
    transferId: transfer.transferId,
    kind: transfer.kind,
    status: transfer.status,
    notebookId: transfer.notebookId,
    notebookName: transfer.notebookName,
    requestedAt: transfer.requestedAt,
    finishedAt: transfer.finishedAt,
    done: transfer.done,
    total: transfer.total,
    bytes: transfer.bytes,
    failure: transfer.failure,
    /**
     * The file this transfer is about (#155). An import carries the one the
     * person chose; an export is named after its notebook, by the same
     * function that names the download, so the row says what will be saved.
     */
    fileName: transfer.kind === 'import' ? transfer.fileName : archiveNameOf(transfer.notebookName),
  };
}

type Variables = { portability: PortabilityRequest };

function fail(c: Context, error: DomainError): Response {
  return c.json({ code: error.code, message: error.message }, httpStatusFor(error) as 400);
}

function present<T, U>(c: Context, result: Result<T, DomainError>, map: (value: T) => U): Response {
  return result.ok ? c.json(map(result.value) as object, 200) : fail(c, result.error);
}

export function createPortabilityRoutes(
  useCases: PortabilityUseCases,
): Hono<{ Variables: Variables }> {
  const app = new Hono<{ Variables: Variables }>();

  app.post('/notebooks/:v/export', async (c) => {
    const request = c.get('portability');
    const notebookId = c.req.param('v') ?? '';
    // A notebook the caller cannot read is indistinguishable from a missing one.
    if (!(await request.canRead(notebookId))) {
      return fail(c, DomainError.forbidden('Notebook not found'));
    }

    // What the archive carries, absent for the whole notebook (RN-PRT-024).
    const body = (await c.req.json().catch(() => ({}))) as {
      selection?: ImportSelection | null;
    };
    const started = await useCases
      .startExport(request)
      .execute({ notebookId, selection: body.selection ?? null });
    return started.ok ? c.json(transferToDto(started.value), 202) : fail(c, started.error);
  });

  /** Every transfer of whoever is asking, and what the kept ones occupy. */
  app.get('/transfers', async (c) => {
    const request = c.get('portability');
    const listed = await useCases.listTransfers(request).execute();
    return present(c, listed, (value) => ({
      transfers: value.transfers.map(transferToDto),
      keptBytes: value.keptBytes,
    }));
  });

  app.get('/transfers/:t', async (c) => {
    const request = c.get('portability');
    const found = await useCases.getTransfer(request).execute(c.req.param('t') ?? '');
    return present(c, found, transferToDto);
  });

  /**
   * A POST, because it MINTS something: the link is issued here and now, lives
   * fifteen minutes, and is never the same twice.
   */
  app.post('/transfers/:t/download', async (c) => {
    const request = c.get('portability');
    const link = await useCases.downloadTransfer(request).execute(c.req.param('t') ?? '');
    return present(c, link, (value) => value);
  });

  app.delete('/transfers/:t', async (c) => {
    const request = c.get('portability');
    const deleted = await useCases.deleteTransfer(request).execute(c.req.param('t') ?? '');
    return deleted.ok ? c.body(null, 204) : fail(c, deleted.error);
  });

  /**
   * Cancelling asks the worker to stop, and an import that stops takes its
   * notebook back down whole, which frees its name (RN-PRT-018).
   */
  app.post('/transfers/:t/cancel', async (c) => {
    const request = c.get('portability');
    const cancelled = await useCases.cancelTransfer(request).execute(c.req.param('t') ?? '');
    return present(c, cancelled, transferToDto);
  });

  /**
   * The file is uploaded, not posted. A request body has a ceiling a real
   * notebook clears easily, so the client asks for a place to put the file,
   * uploads it there, and then asks for it to be applied — the mirror image of
   * how the export hands an object over by a short-lived URL.
   */
  app.post('/imports', async (c) => {
    const request = c.get('portability');
    const prepared = await useCases.prepareImport(request).execute();
    return present(c, prepared, (value) => ({
      uploadKey: value.uploadKey,
      uploadUrl: value.uploadUrl,
      expiresAt: Instant.now().toISOString(),
    }));
  });

  /**
   * Starts the import and answers the transfer. The work belongs to a worker:
   * writing a notebook of several hundred notes does not fit in the 29 seconds
   * this function is allowed to live, and the interface used to see that as
   * `Failed to fetch` (RN-PRT-018).
   */
  app.post('/imports/apply', async (c) => {
    const request = c.get('portability');
    // A connector whose token was never bound may not write, and an import is
    // a write like any other (rule 7, RN-AGT-001).
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);

    const body = (await c.req.json().catch(() => ({}))) as {
      uploadKey?: string;
      name?: string;
      selection?: ImportSelection | null;
      fileName?: string;
    };
    const started = await useCases.startImport(request).execute({
      uploadKey: String(body.uploadKey ?? ''),
      name: String(body.name ?? ''),
      selection: body.selection ?? null,
      // What the person calls the file, which the upload key cannot say (#155).
      fileName: body.fileName === undefined ? null : String(body.fileName),
      by: author.value,
    });
    return started.ok ? c.json(transferToDto(started.value), 202) : fail(c, started.error);
  });

  return app;
}
