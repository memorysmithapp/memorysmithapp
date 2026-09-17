/**
 * HTTP surface of svc-portability (architecture-guide.md, sections 14.1, 16):
 *
 *   POST   /notebooks/:v/export        ->  starts the job, answers the transfer
 *   GET    /transfers                  ->  the transfers of whoever is asking
 *   GET    /transfers/:t               ->  one of them, with its progress
 *   POST   /transfers/:t/download      ->  a link issued at this moment
 *   DELETE /transfers/:t               ->  destroys the archive and its bytes
 *   POST   /imports                    ->  a short-lived address to upload to
 *   POST   /imports/apply              ->  reads the upload and writes the notebook
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
import {
  type Authorship,
  DomainError,
  httpStatusFor,
  Instant,
  type Result,
  type SubscriptionContext,
} from '@memorysmith/kernel';
import type {
  DeleteTransfer,
  DownloadTransfer,
  GetTransfer,
  ListTransfers,
  StartExport,
} from '../application/Transfers.js';
import type { Transfer } from '../domain/Transfer.js';
import type {
  ImportNotebook,
  PrepareImport,
  NotebookWriter,
} from '../application/ImportNotebook.js';

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
  readonly prepareImport: (request: PortabilityRequest) => PrepareImport;
  readonly importNotebook: (request: PortabilityRequest) => ImportNotebook;
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

    const started = await useCases.startExport(request).execute({ notebookId });
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

  app.post('/imports/apply', async (c) => {
    const request = c.get('portability');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const body = (await c.req.json().catch(() => ({}))) as {
      uploadKey?: string;
      name?: string;
    };
    const job = await useCases.importNotebook(request).execute({
      uploadKey: String(body.uploadKey ?? ''),
      name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null,
      by: author.value,
    });
    return present(c, job, (value) => ({
      importId: value.importId,
      notebookId: value.notebookId,
      status: value.status,
      folderCount: value.folderCount,
      noteCount: value.noteCount,
    }));
  });

  return app;
}
