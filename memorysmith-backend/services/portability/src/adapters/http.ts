/**
 * HTTP surface of svc-portability (architecture-guide.md, sections 14.1, 16):
 *
 *   POST /notebooks/:v/export     ->  a ready archive and a short-lived link
 *   POST /imports              ->  a short-lived address to upload a .notebook to
 *   POST /imports/apply        ->  reads what was uploaded and writes the notebook
 *
 * The export is answered as a LINK and never as a body. A notebook of two
 * thousand notes is megabytes of Markdown, and a synchronous response has a
 * ceiling that a large notebook would hit exactly when the export matters most.
 * The link points at one object, expires in fifteen minutes and is the only
 * way to reach it: the bucket blocks public access.
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
import type { ExportNotebook } from '../application/ExportNotebook.js';
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
  readonly exportNotebook: (request: PortabilityRequest) => ExportNotebook;
  readonly prepareImport: (request: PortabilityRequest) => PrepareImport;
  readonly importNotebook: (request: PortabilityRequest) => ImportNotebook;
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

    const job = await useCases.exportNotebook(request).execute({ notebookId, now: Instant.now() });
    return present(c, job, (value) => ({
      exportId: value.exportId,
      notebookId: value.notebookId,
      status: value.status,
      requestedAt: Instant.now().toISOString(),
      downloadUrl: value.downloadUrl,
      expiresAt: value.expiresAt,
      noteCount: value.noteCount,
      bytes: value.bytes,
    }));
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
