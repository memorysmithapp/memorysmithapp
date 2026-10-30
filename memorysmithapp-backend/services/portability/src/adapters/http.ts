/**
 * HTTP surface of svc-portability:
 *
 *   POST   /notebooks/:v/export        ->  starts the job, answers the transfer
 *   GET    /transfers                  ->  the transfers of whoever is asking
 *   GET    /transfers/:t               ->  one of them, with its progress
 *   POST   /transfers/:t/download      ->  a link issued at this moment
 *   DELETE /transfers/:t               ->  destroys the archive and its bytes
 *   POST   /imports                    ->  a short-lived address to upload to
 *   POST   /imports/from-export        ->  an upload made of a kept export
 *   POST   /imports/apply              ->  starts the import, answers the transfer
 *   POST   /transfers/:t/cancel        ->  takes a running import back down
 *   POST   /uploads                    ->  starts an upload in parts (RN-PRT-027)
 *   GET    /uploads                    ->  the open uploads, of one notebook or all
 *   GET    /uploads/:t                 ->  what is missing, with addresses by URL
 *   PUT    /uploads/:t/parts/:n        ->  one inline part, with its hash
 *   POST   /uploads/:t/finish          ->  the whole becomes a file, or is refused
 *   POST   /uploads/:t/link            ->  points it at another notebook (RN-PRT-029)
 *   POST   /requests                   ->  asks the person for a file (RN-PRT-030)
 *   POST   /notebooks/:v/notes/:n/pdf  ->  starts a print, answers it (RN-PRT-031)
 *   GET    /prints/:p                  ->  the print, with a link once its file is made
 *   POST   /notebooks/:v/previews      ->  starts drawing a note or a draft (RN-PRT-032)
 *   GET    /previews/:p                ->  the preview, with its image once it is drawn
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
 * the context that owns it, exactly as Discovery does (INV-09).
 */

import { Hono, type Context } from 'hono';
import {
  beginUploadRequestSchema,
  createFromVersionRequestSchema,
  createModelVersionRequestSchema,
  declareModelRequestSchema,
  publishModelRequestSchema,
  reportModelRequestSchema,
  finishedUploadSchema,
  importFromExportRequestSchema,
  importUploadSchema,
  linkUploadRequestSchema,
  previewRequestSchema,
  printRequestSchema,
  requestFileRequestSchema,
  uploadPartRequestSchema,
} from '@memorysmithapp/contracts';
import { archiveNameOf } from '../domain/NotebookDocumentBuilder.js';
import {
  type Authorship,
  DomainError,
  httpStatusFor,
  Instant,
  type Result,
  type SubscriptionContext,
} from '@memorysmithapp/kernel';
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
import type { GetPrint, StartPrint } from '../application/Prints.js';
import type { GetPreview, StartPreview } from '../application/Previews.js';
import type { Transfer } from '../domain/Transfer.js';
import type {
  CreateFromVersion,
  CreateModelVersion,
  DeclareModel,
  DeleteModelVersion,
  GetModel,
  ListModels,
  ModelVersion,
  ViewModelVersion,
  VersionView,
} from '../application/Models.js';
import type {
  Author,
  CreateFromCatalog,
  PublicationOf,
  PublishModel,
  ReportModel,
  WithdrawModel,
} from '../application/Catalog.js';
import type { NotebookDocument } from '../domain/NotebookDocumentBuilder.js';
import {
  MODEL_LICENCE,
  type NotebookModel,
  type ParameterDeclaration,
} from '../domain/NotebookModel.js';
import {
  receivedOf,
  type BeginUpload,
  type FileKeeper,
  type FinishUpload,
  type GetUploadStatus,
  type LinkUpload,
  type RequestFile,
  type ListUploads,
  type PutUploadPart,
  type UploadStatus,
} from '../application/Uploads.js';
import type {
  ImportFromExport,
  PrepareImport,
  NotebookWriter,
} from '../application/ImportNotebook.js';

export interface PortabilityRequest {
  readonly subscription: SubscriptionContext;
  readonly canRead: (notebookId: string) => Promise<boolean>;
  /**
   * Who is importing, or why this session may not write. Every write of an
   * import carries it (INV-07), and a connector whose token was never bound is
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
  /** What an upload in parts becomes a file with, built the same way (RN-PRT-027). */
  readonly files: FileKeeper;
  /**
   * The token the session was authenticated with, which a print is drawn
   * under (RN-PRT-031): the page the renderer opens reads as the person who
   * asked, and nothing more.
   */
  readonly accessToken: string;
  /**
   * Whether the caller owns the subscription, which declaring a model and
   * creating its versions ask (#353): they occupy its storage.
   */
  readonly isOwner: boolean;
  /**
   * Who is publishing, as the catalog shows them: the display name of the
   * account, never its e-mail, and the e-mail a withdrawal is told to (#360).
   */
  readonly author: () => Promise<Author>;
}

export interface PortabilityUseCases {
  readonly startExport: (request: PortabilityRequest) => StartExport;
  readonly listTransfers: (request: PortabilityRequest) => ListTransfers;
  readonly getTransfer: (request: PortabilityRequest) => GetTransfer;
  readonly downloadTransfer: (request: PortabilityRequest) => DownloadTransfer;
  readonly deleteTransfer: (request: PortabilityRequest) => DeleteTransfer;
  readonly cancelTransfer: (request: PortabilityRequest) => CancelTransfer;
  readonly prepareImport: (request: PortabilityRequest) => PrepareImport;
  readonly importFromExport: (request: PortabilityRequest) => ImportFromExport;
  readonly startImport: (request: PortabilityRequest) => StartImport;
  readonly beginUpload: (request: PortabilityRequest) => BeginUpload;
  readonly listUploads: (request: PortabilityRequest) => ListUploads;
  readonly uploadStatus: (request: PortabilityRequest) => GetUploadStatus;
  readonly putUploadPart: (request: PortabilityRequest) => PutUploadPart;
  readonly finishUpload: (request: PortabilityRequest) => FinishUpload;
  readonly linkUpload: (request: PortabilityRequest) => LinkUpload;
  readonly requestFile: (request: PortabilityRequest) => RequestFile;
  readonly startPrint: (request: PortabilityRequest) => StartPrint;
  readonly getPrint: (request: PortabilityRequest) => GetPrint;
  readonly startPreview: (request: PortabilityRequest) => StartPreview;
  readonly getPreview: (request: PortabilityRequest) => GetPreview;
  readonly declareModel: (request: PortabilityRequest) => DeclareModel;
  readonly getModel: (request: PortabilityRequest) => GetModel;
  readonly listModels: (request: PortabilityRequest) => ListModels;
  readonly createModelVersion: (request: PortabilityRequest) => CreateModelVersion;
  readonly viewModelVersion: (request: PortabilityRequest) => ViewModelVersion;
  readonly deleteModelVersion: (request: PortabilityRequest) => DeleteModelVersion;
  readonly createFromVersion: (request: PortabilityRequest) => CreateFromVersion;
  // The community catalog (#360).
  readonly publishModel: (request: PortabilityRequest) => PublishModel;
  readonly withdrawModel: (request: PortabilityRequest) => WithdrawModel;
  readonly publicationOf: (request: PortabilityRequest) => PublicationOf;
  readonly createFromCatalog: (request: PortabilityRequest) => CreateFromCatalog;
  readonly reportModel: (request: PortabilityRequest) => ReportModel;
}

/** A model on the wire (#353): what it says of itself, and its versions. */
function modelToDto(model: NotebookModel): Record<string, unknown> {
  return {
    notebookId: model.notebookId,
    objective: model.objective,
    description: model.description,
    audience: model.audience,
    parameters: model.parameters.map(parameterToDto),
    basedOn: model.basedOn,
    declaredAt: model.declaredAt,
    updatedAt: model.updatedAt,
    // Null while the model was never distributed: it is its author's (#357).
    licence: model.licenceAcceptedAt ? MODEL_LICENCE : null,
  };
}

function parameterToDto(parameter: ParameterDeclaration): Record<string, unknown> {
  return {
    ...parameter,
    default: Array.isArray(parameter.default) ? [...parameter.default] : parameter.default,
  };
}

function versionToDto(version: ModelVersion): Record<string, unknown> {
  return {
    number: version.number,
    changelog: version.changelog,
    createdAt: version.createdAt,
    status: version.status,
    bytes: version.bytes,
  };
}

/** A version read whole: what it froze, and the notebook it holds, without its file bytes. */
function versionViewToDto({
  model,
  version,
  document,
  references,
}: VersionView): Record<string, unknown> {
  const meta = version.transfer.model;
  return {
    notebookId: model.notebookId,
    version: versionToDto(version),
    objective: meta?.objective ?? model.objective,
    description: meta?.description ?? model.description,
    audience: meta?.audience ?? model.audience,
    parameters: (meta?.parameters ?? model.parameters).map(parameterToDto),
    basedOn: meta?.basedOn ?? model.basedOn,
    ...documentToDto(document),
    references,
  };
}

/** What a frozen snapshot holds, on the wire: every part, and the size of each file. */
export function documentToDto(document: NotebookDocument): Record<string, unknown> {
  return {
    notebook: document.notebook,
    folders: document.folders.map((folder) => ({
      folderId: folder.folderId,
      parentFolderId: folder.parentFolderId,
      name: folder.name,
      description: folder.description,
      template: folder.template,
    })),
    notes: document.notes.map((note) => ({
      noteId: note.noteId,
      folderId: note.folderId,
      body: note.body,
    })),
    files: (document.files ?? []).map((file) => ({
      name: file.name,
      mimeType: file.mimeType,
      // The bytes travel as base64 in the document; what is said is their size.
      bytes: Math.floor((file.bytes.replace(/=+$/, '').length * 3) / 4),
    })),
    tables: (document.tables ?? []).map((table) => ({
      name: table.name,
      description: table.description,
      columns: Object.keys((table.schema['properties'] as Record<string, unknown>) ?? {}),
      rows: table.rows ? table.rows.length : null,
    })),
    dashboards: (document.dashboards ?? []).map((dashboard) => ({
      name: dashboard.name,
      description: dashboard.description,
    })),
  };
}

/** What a transfer looks like on the wire, which is what it is. */
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
    fileName: transfer.kind === 'export' ? archiveNameOf(transfer.notebookName) : transfer.fileName,
    ...(transfer.upload
      ? {
          upload: {
            mimeType: transfer.upload.mimeType,
            purpose: transfer.upload.purpose,
            platform: transfer.upload.platform,
            transport: transfer.upload.transport,
            sha256: transfer.upload.sha256,
            partSize: transfer.upload.partSize,
            partCount: transfer.upload.partCount,
            received: receivedOf(transfer.upload),
            lastPartAt: transfer.upload.lastPartAt,
            fulfils: transfer.upload.fulfils ?? null,
          },
        }
      : {}),
    ...(transfer.request
      ? { request: { ...transfer.request, tags: [...transfer.request.tags] } }
      : {}),
  };
}

function statusToDto(status: UploadStatus): Record<string, unknown> {
  return {
    transfer: transferToDto(status.transfer),
    missing: status.missing,
    targets: status.targets,
    expiresAt: status.expiresAt,
  };
}

type Variables = { portability: PortabilityRequest };

function fail(c: Context, error: DomainError): Response {
  return c.json(
    {
      code: error.code,
      message: error.message,
      // What an upload refuses with carries its reason and, when parts are
      // missing, which ones: a connector turns them into what to send again.
      ...(error.details === undefined ? {} : { details: error.details }),
    },
    httpStatusFor(error) as 400,
  );
}

function present<T, U>(c: Context, result: Result<T, DomainError>, map: (value: T) => U): Response {
  return result.ok ? c.json(map(result.value) as object, 200) : fail(c, result.error);
}

export function createPortabilityRoutes(
  useCases: PortabilityUseCases,
): Hono<{ Variables: Variables }> {
  const app = new Hono<{ Variables: Variables }>();

  // ---- Notebook models (#353) ---------------------------------------------

  app.get('/models', async (c) => {
    const request = c.get('portability');
    const listed = await useCases.listModels(request).execute();
    return present(c, listed, (models) => ({
      models: models.map(({ model, name, sharedBy }) => ({
        ...modelToDto(model),
        name,
        sharedBy,
      })),
    }));
  });

  app.get('/models/:v', async (c) => {
    const request = c.get('portability');
    const found = await useCases.getModel(request).execute(c.req.param('v') ?? '');
    if (!found.ok) return fail(c, found.error);
    const { model, versions, sharedBy } = found.value;
    // Where it stands in the community catalog, for whoever reads it here (#360).
    const publication =
      sharedBy === null ? await useCases.publicationOf(request).execute(model.notebookId) : null;
    return c.json({
      ...modelToDto(model),
      sharedBy,
      publication,
      versions: versions.map(versionToDto),
    });
  });

  app.put('/models/:v', async (c) => {
    const request = c.get('portability');
    const body = declareModelRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return fail(
        c,
        DomainError.validation(
          'A model takes an objective, and optionally a description, an audience, parameters and a credit',
        ),
      );
    }
    const declared = await useCases.declareModel(request).execute({
      notebookId: c.req.param('v') ?? '',
      declaration: body.data,
    });
    return present(c, declared, modelToDto);
  });

  app.post('/models/:v/versions', async (c) => {
    const request = c.get('portability');
    if (!request.authorship.ok) return fail(c, request.authorship.error);
    const body = createModelVersionRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return fail(c, DomainError.validation('A changelog is a text'));
    const created = await useCases.createModelVersion(request).execute({
      notebookId: c.req.param('v') ?? '',
      changelog: body.data.changelog,
      ...(body.data.tables ? { tables: body.data.tables } : {}),
      by: request.authorship.value,
    });
    return created.ok ? c.json(versionToDto(created.value), 202) : fail(c, created.error);
  });

  app.get('/models/:v/versions/:n', async (c) => {
    const request = c.get('portability');
    const viewed = await useCases.viewModelVersion(request).execute({
      notebookId: c.req.param('v') ?? '',
      number: Number(c.req.param('n')),
    });
    return present(c, viewed, versionViewToDto);
  });

  /**
   * An independent notebook created from a version (#359): its parameters
   * filled in, written by the worker as any import is. The answer is the
   * import, which the client follows until it ends.
   */
  app.post('/models/:v/versions/:n/notebooks', async (c) => {
    const request = c.get('portability');
    if (!request.authorship.ok) return fail(c, request.authorship.error);
    const body = createFromVersionRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) {
      return fail(
        c,
        DomainError.validation('A creation takes a name and the values of the parameters'),
      );
    }
    const started = await useCases.createFromVersion(request).execute({
      notebookId: c.req.param('v') ?? '',
      number: Number(c.req.param('n')),
      name: body.data.name,
      values: body.data.values,
      by: request.authorship.value,
    });
    return started.ok ? c.json(transferToDto(started.value), 202) : fail(c, started.error);
  });

  /**
   * Publishing a model to the community (#360), and withdrawing it. What it is
   * published as is answered, which is what anybody will see of it.
   */
  app.put('/models/:v/publication', async (c) => {
    const request = c.get('portability');
    const body = publishModelRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return fail(c, DomainError.validation('A publication takes the language of the model'));
    }
    const published = await useCases.publishModel(request).execute({
      notebookId: c.req.param('v') ?? '',
      language: body.data.language,
      acceptLicence: body.data.acceptLicence,
      author: await request.author(),
    });
    return present(c, published, (model) => model);
  });

  app.delete('/models/:v/publication', async (c) => {
    const request = c.get('portability');
    const withdrawn = await useCases.withdrawModel(request).execute(c.req.param('v') ?? '');
    return withdrawn.ok ? c.body(null, 204) : fail(c, withdrawn.error);
  });

  /** A notebook created from a published version, in the caller's own subscription (#360). */
  app.post('/catalog/:p/versions/:n/notebooks', async (c) => {
    const request = c.get('portability');
    if (!request.authorship.ok) return fail(c, request.authorship.error);
    const body = createFromVersionRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) {
      return fail(
        c,
        DomainError.validation('A creation takes a name and the values of the parameters'),
      );
    }
    const started = await useCases.createFromCatalog(request).execute({
      publicId: c.req.param('p') ?? '',
      number: Number(c.req.param('n')),
      name: body.data.name,
      values: body.data.values,
      by: request.authorship.value,
    });
    return started.ok ? c.json(transferToDto(started.value), 202) : fail(c, started.error);
  });

  /** A report of a published model, which only a person who signed in makes (#358). */
  app.post('/catalog/:p/reports', async (c) => {
    const request = c.get('portability');
    const body = reportModelRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return fail(c, DomainError.validation('A report says why'));
    const reported = await useCases.reportModel(request).execute({
      publicId: c.req.param('p') ?? '',
      reason: body.data.reason,
    });
    return reported.ok ? c.body(null, 204) : fail(c, reported.error);
  });

  app.delete('/models/:v/versions/:n', async (c) => {
    const request = c.get('portability');
    const deleted = await useCases.deleteModelVersion(request).execute({
      notebookId: c.req.param('v') ?? '',
      number: Number(c.req.param('n')),
    });
    return deleted.ok ? c.body(null, 204) : fail(c, deleted.error);
  });

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
      tables?: Array<{ name: string; rows: boolean }>;
    };
    const started = await useCases.startExport(request).execute({
      notebookId,
      selection: body.selection ?? null,
      // What it carries of each table, apart from the rest (#366, RN-PRT-049).
      ...(Array.isArray(body.tables) ? { tables: body.tables } : {}),
    });
    return started.ok ? c.json(transferToDto(started.value), 202) : fail(c, started.error);
  });

  /**
   * A note as a PDF made by the server (RN-PRT-031). A job, as an export is:
   * the answer is the print, and the screen asks for it until its file is made.
   */
  app.post('/notebooks/:v/notes/:n/pdf', async (c) => {
    const request = c.get('portability');
    const notebookId = c.req.param('v') ?? '';
    if (!(await request.canRead(notebookId))) {
      return fail(c, DomainError.forbidden('Notebook not found'));
    }
    const body = printRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) {
      return fail(
        c,
        DomainError.validation('That is not a print this page makes', body.error.issues),
      );
    }
    const { locale, ...choices } = body.data;
    const started = await useCases.startPrint(request).execute({
      notebookId,
      noteId: c.req.param('n') ?? '',
      accessToken: request.accessToken,
      choices,
      locale,
    });
    return started.ok
      ? c.json({ printId: started.value.printId, status: 'running' }, 202)
      : fail(c, started.error);
  });

  app.get('/prints/:p', async (c) => {
    const request = c.get('portability');
    const found = await useCases.getPrint(request).execute(c.req.param('p') ?? '');
    return present(c, found, (value) => value);
  });

  /**
   * How a note, a draft or a part of either is drawn, as an image an agent can
   * see (#260, RN-PRT-032). A job, as a print is: the answer is the preview,
   * and the connector asks for it until its image is drawn.
   */
  app.post('/notebooks/:v/previews', async (c) => {
    const request = c.get('portability');
    const notebookId = c.req.param('v') ?? '';
    if (!(await request.canRead(notebookId))) {
      return fail(c, DomainError.forbidden('Notebook not found'));
    }
    const body = previewRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) {
      return fail(
        c,
        DomainError.validation('That is not a preview this page draws', body.error.issues),
      );
    }
    const started = await useCases.startPreview(request).execute({
      notebookId,
      noteId: body.data.noteId,
      content: body.data.content,
      folderId: body.data.folderId,
      part: body.data.part,
      dashboard: body.data.dashboard,
      accessToken: request.accessToken,
      locale: body.data.locale,
    });
    return started.ok
      ? c.json({ previewId: started.value.previewId, status: 'running' }, 202)
      : fail(c, started.error);
  });

  app.get('/previews/:p', async (c) => {
    const request = c.get('portability');
    const found = await useCases.getPreview(request).execute(c.req.param('p') ?? '');
    return present(c, found, (value) => value);
  });

  /** Every transfer of whoever is asking, and what the kept ones occupy. */
  app.get('/transfers', async (c) => {
    const request = c.get('portability');
    const listed = await useCases.listTransfers(request).execute();
    return present(c, listed, (value) => ({
      transfers: value.transfers.map(transferToDto),
      keptBytes: value.keptBytes,
      transitBytes: value.transitBytes,
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
   * The other way an upload arrives: made of a kept export, copied where the
   * product keeps it, so the bytes do not travel down to the device and back
   * up again (#207, RN-PRT-020). It answers the key `POST /imports` answers,
   * and `POST /imports/apply` takes it unchanged. Only the requester's own
   * ready export qualifies, and anything else is `404` (INV-09).
   */
  app.post('/imports/from-export', async (c) => {
    const request = c.get('portability');
    const parsed = importFromExportRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return fail(c, DomainError.validation('An import from an export names its transfer'));
    }
    const copied = await useCases.importFromExport(request).execute(parsed.data.transferId);
    return present(c, copied, (value) => importUploadSchema.parse({ uploadKey: value.uploadKey }));
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
    // a write like any other (INV-07, RN-AGT-001).
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

  /**
   * An upload in parts (RN-PRT-027). It is a write from its first call — it
   * reserves room and will keep a file — so a connector whose token was never
   * bound is refused before it starts (INV-07, RN-AGT-001).
   */
  app.post('/uploads', async (c) => {
    const request = c.get('portability');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const parsed = beginUploadRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return fail(
        c,
        DomainError.validation(
          parsed.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; '),
        ),
      );
    }
    const begun = await useCases.beginUpload(request).execute({ ...parsed.data, by: author.value });
    return begun.ok ? c.json(statusToDto(begun.value), 201) : fail(c, begun.error);
  });

  app.get('/uploads', async (c) => {
    const request = c.get('portability');
    const listed = await useCases.listUploads(request).execute(c.req.query('notebookId') ?? null);
    return present(c, listed, (value) => ({ transfers: value.map(transferToDto) }));
  });

  app.get('/uploads/:t', async (c) => {
    const request = c.get('portability');
    const status = await useCases.uploadStatus(request).execute(c.req.param('t') ?? '');
    return present(c, status, statusToDto);
  });

  app.put('/uploads/:t/parts/:n', async (c) => {
    const request = c.get('portability');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const parsed = uploadPartRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return fail(c, DomainError.validation('A part carries its sha256 and its contentBase64'));
    }
    const put = await useCases.putUploadPart(request).execute({
      transferId: c.req.param('t') ?? '',
      part: Number(c.req.param('n')),
      ...parsed.data,
    });
    return present(c, put, statusToDto);
  });

  app.post('/uploads/:t/finish', async (c) => {
    const request = c.get('portability');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const finished = await useCases
      .finishUpload(request)
      .execute(c.req.param('t') ?? '', author.value);
    return present(c, finished, (value) => finishedUploadSchema.parse(value));
  });

  app.post('/uploads/:t/link', async (c) => {
    const request = c.get('portability');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const parsed = linkUploadRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return fail(c, DomainError.validation('A link names the notebook the upload goes to'));
    }
    const linked = await useCases
      .linkUpload(request)
      .execute(c.req.param('t') ?? '', parsed.data.notebookId);
    return present(c, linked, transferToDto);
  });

  /**
   * An agent asks the person for a file instead of sending it (RN-PRT-030),
   * from nothing or from an upload it could not finish. It is a write, of a
   * record the person acts on, so an unbound connector is refused (INV-07).
   */
  app.post('/requests', async (c) => {
    const request = c.get('portability');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const parsed = requestFileRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return fail(
        c,
        DomainError.validation(
          parsed.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; '),
        ),
      );
    }
    const asked = await useCases.requestFile(request).execute({ ...parsed.data, by: author.value });
    return asked.ok ? c.json(transferToDto(asked.value), 201) : fail(c, asked.error);
  });

  return app;
}
