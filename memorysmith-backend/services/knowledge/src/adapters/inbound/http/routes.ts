/**
 * HTTP surface of svc-knowledge (architecture-guide.md, section 14.1).
 * Consumed by the UI; the public contract is the MCP surface.
 *
 * No route receives a subscriptionId. The RequestContext on the request was
 * injected by the authorizer, and each use case authorizes against the notebook
 * it just loaded, which is stage 2 of section 14.2.
 */

import { Hono, type Context } from 'hono';
import {
  type Authorship,
  DomainError,
  FileId,
  FolderId,
  httpStatusFor,
  NoteId,
  UserId,
  NotebookId,
  type Result,
  type Role,
  type SubscriptionContext,
} from '@memorysmith/kernel';
import type { RequestContext } from '../../../domain/access/AuthorizationPolicy.js';
import type {
  ClearNotebookRoleLimit,
  CreateNotebook,
  DeleteNotebook,
  GetNotebook,
  DeleteGuidance,
  GetNotebookContext,
  ListNotebooks,
  PutGuidance,
  RenameNotebook,
  SetNotebookRoleLimit,
} from '../../../application/notebooks.js';
import type {
  CreateFolder,
  DeleteTemplate,
  GetTemplate,
  NextNumber,
  PatchFolder,
  PutTemplate,
  RemoveFolder,
  ReorderFolder,
} from '../../../application/folders.js';
import type {
  CreateNote,
  DeleteNote,
  ListNotes,
  MoveNote,
  ReadNote,
  ReorderNote,
  UpdateNote,
} from '../../../application/notes.js';
import type { DeleteFile, KeepFile, LinkToFile, ListFiles } from '../../../application/files.js';
import { NOTE_MESSAGE_MAX_LENGTH } from '@memorysmith/contracts';
import {
  fileToDto,
  folderToDto,
  noteToDto,
  noteToSummary,
  notebookToDetail,
  notebookToSummary,
} from './presenters.js';

/** What the composition root puts on every authenticated request. */
export interface KnowledgeRequest {
  readonly ctx: RequestContext;
  readonly subscription: SubscriptionContext;
  /**
   * Who a write of this session is by, or why this session may not write
   * (RN-AGT-001). A connector whose token was never bound reads, and every
   * write it attempts is refused. It is a Result so that a write route cannot
   * forget to look: it has no Authorship to pass until it does.
   */
  readonly authorship: Result<Authorship, DomainError>;
  /** The role this session holds in the subscription, already resolved. */
  readonly subscriptionRole: Role;
}

export interface KnowledgeUseCases {
  readonly createNotebook: (request: KnowledgeRequest) => CreateNotebook;
  readonly listNotebooks: (request: KnowledgeRequest) => ListNotebooks;
  readonly getNotebook: (request: KnowledgeRequest) => GetNotebook;
  readonly renameNotebook: (request: KnowledgeRequest) => RenameNotebook;
  readonly deleteNotebook: (request: KnowledgeRequest) => DeleteNotebook;
  readonly putGuidance: (request: KnowledgeRequest) => PutGuidance;
  readonly deleteGuidance: (request: KnowledgeRequest) => DeleteGuidance;
  readonly getNotebookContext: (request: KnowledgeRequest) => GetNotebookContext;
  readonly setNotebookLimit: (request: KnowledgeRequest) => SetNotebookRoleLimit;
  readonly clearNotebookLimit: (request: KnowledgeRequest) => ClearNotebookRoleLimit;
  readonly createFolder: (request: KnowledgeRequest) => CreateFolder;
  readonly patchFolder: (request: KnowledgeRequest) => PatchFolder;
  readonly reorderFolder: (request: KnowledgeRequest) => ReorderFolder;
  readonly removeFolder: (request: KnowledgeRequest) => RemoveFolder;
  readonly putTemplate: (request: KnowledgeRequest) => PutTemplate;
  readonly getTemplate: (request: KnowledgeRequest) => GetTemplate;
  readonly deleteTemplate: (request: KnowledgeRequest) => DeleteTemplate;
  readonly nextNumber: (request: KnowledgeRequest) => NextNumber;
  readonly listNotes: (request: KnowledgeRequest) => ListNotes;
  readonly readNote: (request: KnowledgeRequest) => ReadNote;
  readonly createNote: (request: KnowledgeRequest) => CreateNote;
  readonly updateNote: (request: KnowledgeRequest) => UpdateNote;
  readonly reorderNote: (request: KnowledgeRequest) => ReorderNote;
  readonly moveNote: (request: KnowledgeRequest) => MoveNote;
  readonly deleteNote: (request: KnowledgeRequest) => DeleteNote;
  readonly keepFile: (request: KnowledgeRequest) => KeepFile;
  readonly listFiles: (request: KnowledgeRequest) => ListFiles;
  readonly linkToFile: (request: KnowledgeRequest) => LinkToFile;
  readonly deleteFile: (request: KnowledgeRequest) => DeleteFile;
}

type Variables = { knowledge: KnowledgeRequest };

function fail(c: Context, error: DomainError): Response {
  return c.json(
    {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
    httpStatusFor(error) as 400,
  );
}

function present<T, U>(
  c: Context,
  result: Result<T, DomainError>,
  map: (value: T) => U,
  status = 200,
): Response {
  return result.ok ? c.json(map(result.value) as object, status as 200) : fail(c, result.error);
}

function noContent(c: Context, result: Result<unknown, DomainError>): Response {
  return result.ok ? new Response(null, { status: 204 }) : fail(c, result.error);
}

function parseNotebookId(raw: string | undefined): Result<NotebookId, DomainError> {
  return NotebookId.create(raw ?? '');
}

export function createKnowledgeRoutes(useCases: KnowledgeUseCases): Hono<{ Variables: Variables }> {
  const app = new Hono<{ Variables: Variables }>();

  app.get('/notebooks', async (c) => {
    const request = c.get('knowledge');
    const listed = await useCases.listNotebooks(request).execute({ ctx: request.ctx });
    return present(c, listed, (notebooks) =>
      notebooks.map((notebook) => notebookToSummary(notebook, request.subscriptionRole)),
    );
  });

  app.post('/notebooks', async (c) => {
    const request = c.get('knowledge');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const body = (await c.req.json().catch(() => ({}))) as {
      name?: string;
      description?: string;
    };

    const created = await useCases.createNotebook(request).execute({
      ctx: request.ctx,
      name: String(body.name ?? ''),
      description: String(body.description ?? ''),
      subscriptionId: request.subscription.subscriptionId,
      by: author.value,
    });
    return present(
      c,
      created,
      (notebook) => notebookToSummary(notebook, request.subscriptionRole),
      201,
    );
  });

  app.get('/notebooks/:v', async (c) => {
    const request = c.get('knowledge');
    const notebookId = parseNotebookId(c.req.param('v'));
    if (!notebookId.ok) return fail(c, notebookId.error);

    const found = await useCases
      .getNotebook(request)
      .execute({ ctx: request.ctx, notebookId: notebookId.value });
    return present(c, found, ({ notebook, guidance, role }) =>
      notebookToDetail(notebook, role, guidance),
    );
  });

  app.patch('/notebooks/:v', async (c) => {
    const request = c.get('knowledge');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const notebookId = parseNotebookId(c.req.param('v'));
    if (!notebookId.ok) return fail(c, notebookId.error);
    const body = (await c.req.json().catch(() => ({}))) as { name?: string };

    return noContent(
      c,
      await useCases.renameNotebook(request).execute({
        ctx: request.ctx,
        notebookId: notebookId.value,
        name: String(body.name ?? ''),
        by: author.value,
      }),
    );
  });

  /**
   * Definitive: the notebook leaves every listing, its name goes back to being
   * available at once, and everything it holds is purged (RN-KNW-033).
   */
  app.delete('/notebooks/:v', async (c) => {
    const request = c.get('knowledge');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const notebookId = parseNotebookId(c.req.param('v'));
    if (!notebookId.ok) return fail(c, notebookId.error);

    return noContent(
      c,
      await useCases.deleteNotebook(request).execute({
        ctx: request.ctx,
        notebookId: notebookId.value,
        by: author.value,
      }),
    );
  });

  /** The composed document the agent reads (software-vision.md, 9.2). */
  app.get('/notebooks/:v/context', async (c) => {
    const request = c.get('knowledge');
    const notebookId = parseNotebookId(c.req.param('v'));
    if (!notebookId.ok) return fail(c, notebookId.error);

    const composed = await useCases
      .getNotebookContext(request)
      .execute({ ctx: request.ctx, notebookId: notebookId.value });
    if (!composed.ok) return fail(c, composed.error);
    return c.text(composed.value, 200, { 'content-type': 'text/markdown; charset=utf-8' });
  });

  app.put('/notebooks/:v/guidance', async (c) => {
    const request = c.get('knowledge');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const notebookId = parseNotebookId(c.req.param('v'));
    if (!notebookId.ok) return fail(c, notebookId.error);
    const body = (await c.req.json().catch(() => ({}))) as {
      content?: string;
      baseRevision?: string | null;
    };

    const written = await useCases.putGuidance(request).execute({
      ctx: request.ctx,
      notebookId: notebookId.value,
      content: String(body.content ?? ''),
      baseRevision: body.baseRevision ?? null,
      by: author.value,
    });
    return present(c, written, (ref) => ({ revision: ref.toJSON() }));
  });

  /**
   * Deleting the guidance of a notebook, which the notebook survives
   * (RN-KNW-045). It was impossible while the guidance was a field of the
   * `META` item: the only way to be rid of one was to delete the notebook.
   */
  app.delete('/notebooks/:v/guidance', async (c) => {
    const request = c.get('knowledge');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const notebookId = parseNotebookId(c.req.param('v'));
    if (!notebookId.ok) return fail(c, notebookId.error);

    const deleted = await useCases.deleteGuidance(request).execute({
      ctx: request.ctx,
      notebookId: notebookId.value,
      by: author.value,
    });
    if (!deleted.ok) return fail(c, deleted.error);
    return c.body(null, 204);
  });

  // ---- Folders -------------------------------------------------------------

  app.post('/notebooks/:v/folders', async (c) => {
    const request = c.get('knowledge');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const notebookId = parseNotebookId(c.req.param('v'));
    if (!notebookId.ok) return fail(c, notebookId.error);
    const body = (await c.req.json().catch(() => ({}))) as {
      parentFolderId?: string | null;
      name?: string;
      description?: string;
      afterFolderId?: string | null;
    };

    const parent = body.parentFolderId ? FolderId.create(body.parentFolderId) : null;
    if (parent && !parent.ok) return fail(c, parent.error);
    const after = body.afterFolderId ? FolderId.create(body.afterFolderId) : null;
    if (after && !after.ok) return fail(c, after.error);

    const created = await useCases.createFolder(request).execute({
      ctx: request.ctx,
      notebookId: notebookId.value,
      parentFolderId: parent?.ok ? parent.value : null,
      name: String(body.name ?? ''),
      description: String(body.description ?? ''),
      afterFolderId: after?.ok ? after.value : null,
      by: author.value,
    });
    return present(
      c,
      created,
      (folder) => ({
        folderId: folder.id.value,
        parentFolderId: folder.parentFolderId?.value ?? null,
        name: folder.name.value,
        slug: folder.slug.value,
        description: folder.description.value,
        position: folder.position.value,
        // A folder is born with no template: it is a unit of its own, and
        // nothing wrote one yet (RN-KNW-044).
        hasTemplate: false,
        noteCount: 0,
      }),
      201,
    );
  });

  app.patch('/notebooks/:v/folders/:f', async (c) => {
    const request = c.get('knowledge');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const notebookId = parseNotebookId(c.req.param('v'));
    if (!notebookId.ok) return fail(c, notebookId.error);
    const folderId = FolderId.create(c.req.param('f') ?? '');
    if (!folderId.ok) return fail(c, folderId.error);

    const body = (await c.req.json().catch(() => ({}))) as {
      name?: string;
      description?: string;
      parentFolderId?: string | null;
      afterFolderId?: string | null;
    };
    const parent =
      body.parentFolderId === undefined
        ? undefined
        : body.parentFolderId === null
          ? null
          : FolderId.create(body.parentFolderId);
    if (parent && parent !== null && !parent.ok) return fail(c, parent.error);
    const after = body.afterFolderId ? FolderId.create(body.afterFolderId) : null;

    return noContent(
      c,
      await useCases.patchFolder(request).execute({
        ctx: request.ctx,
        notebookId: notebookId.value,
        folderId: folderId.value,
        name: body.name,
        description: body.description,
        parentFolderId:
          parent === undefined
            ? undefined
            : parent === null
              ? null
              : parent.ok
                ? parent.value
                : null,
        afterFolderId: after?.ok ? after.value : null,
        by: author.value,
      }),
    );
  });

  app.post('/notebooks/:v/folders/:f/reorder', async (c) => {
    const request = c.get('knowledge');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const notebookId = parseNotebookId(c.req.param('v'));
    if (!notebookId.ok) return fail(c, notebookId.error);
    const folderId = FolderId.create(c.req.param('f') ?? '');
    if (!folderId.ok) return fail(c, folderId.error);

    const body = (await c.req.json().catch(() => ({}))) as { afterFolderId?: string | null };
    const after = body.afterFolderId ? FolderId.create(body.afterFolderId) : null;
    if (after && !after.ok) return fail(c, after.error);

    const reordered = await useCases.reorderFolder(request).execute({
      ctx: request.ctx,
      notebookId: notebookId.value,
      folderId: folderId.value,
      afterFolderId: after?.ok ? after.value : null,
      by: author.value,
    });
    // The folder as the write left it, so a caller learns where it now sits.
    return present(c, reordered, ({ notebook, folder }) => folderToDto(folder, notebook));
  });

  app.delete('/notebooks/:v/folders/:f', async (c) => {
    const request = c.get('knowledge');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const notebookId = parseNotebookId(c.req.param('v'));
    if (!notebookId.ok) return fail(c, notebookId.error);
    const folderId = FolderId.create(c.req.param('f') ?? '');
    if (!folderId.ok) return fail(c, folderId.error);

    // No implicit default: the policy travels in the query (RN-KNW-007).
    const removed = await useCases.removeFolder(request).execute({
      ctx: request.ctx,
      notebookId: notebookId.value,
      folderId: folderId.value,
      policy: c.req.query('policy') ?? '',
      by: author.value,
    });
    return present(c, removed, (ids) => ({ removedFolderIds: ids.map((id) => id.value) }));
  });

  app.put('/notebooks/:v/folders/:f/template', async (c) => {
    const request = c.get('knowledge');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const notebookId = parseNotebookId(c.req.param('v'));
    if (!notebookId.ok) return fail(c, notebookId.error);
    const folderId = FolderId.create(c.req.param('f') ?? '');
    if (!folderId.ok) return fail(c, folderId.error);
    const body = (await c.req.json().catch(() => ({}))) as {
      content?: string;
      baseRevision?: string | null;
    };

    /**
     * Answers the revision this write produced, as the guidance route already
     * did. It used to answer 204, so a caller that wrote twice without
     * reloading had nothing to base the second write on and echoed a revision
     * its own first write had retired (RN-AGT-005).
     */
    const written = await useCases.putTemplate(request).execute({
      ctx: request.ctx,
      notebookId: notebookId.value,
      folderId: folderId.value,
      content: String(body.content ?? ''),
      baseRevision: body.baseRevision ?? null,
      by: author.value,
    });
    return present(c, written, (ref) => ({ revision: ref.toJSON() }));
  });

  app.get('/notebooks/:v/folders/:f/template', async (c) => {
    const request = c.get('knowledge');
    const notebookId = parseNotebookId(c.req.param('v'));
    if (!notebookId.ok) return fail(c, notebookId.error);
    const folderId = FolderId.create(c.req.param('f') ?? '');
    if (!folderId.ok) return fail(c, folderId.error);

    const template = await useCases
      .getTemplate(request)
      .execute({ ctx: request.ctx, notebookId: notebookId.value, folderId: folderId.value });
    if (!template.ok) return fail(c, template.error);
    if (!template.value) return c.json({ content: null }, 200);
    const { content, folderName, revision } = template.value;
    return c.json({ content, folderName, revision: revision.toJSON() }, 200);
  });

  /** The next number of a folder, issued once and never again (RN-KNW-043). */
  app.post('/notebooks/:v/folders/:f/numbers', async (c) => {
    const request = c.get('knowledge');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const notebookId = parseNotebookId(c.req.param('v'));
    if (!notebookId.ok) return fail(c, notebookId.error);
    const folderId = FolderId.create(c.req.param('f') ?? '');
    if (!folderId.ok) return fail(c, folderId.error);

    const issued = await useCases.nextNumber(request).execute({
      ctx: request.ctx,
      notebookId: notebookId.value,
      folderId: folderId.value,
      by: author.value,
    });
    if (!issued.ok) return fail(c, issued.error);
    return c.json({ number: issued.value }, 200);
  });

  /** Deleting the template of a folder, which the folder survives. */
  app.delete('/notebooks/:v/folders/:f/template', async (c) => {
    const request = c.get('knowledge');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const notebookId = parseNotebookId(c.req.param('v'));
    if (!notebookId.ok) return fail(c, notebookId.error);
    const folderId = FolderId.create(c.req.param('f') ?? '');
    if (!folderId.ok) return fail(c, folderId.error);

    const deleted = await useCases.deleteTemplate(request).execute({
      ctx: request.ctx,
      notebookId: notebookId.value,
      folderId: folderId.value,
      by: author.value,
    });
    if (!deleted.ok) return fail(c, deleted.error);
    return c.body(null, 204);
  });

  // ---- Notes ---------------------------------------------------------------

  app.get('/notebooks/:v/notes', async (c) => {
    const request = c.get('knowledge');
    const notebookId = parseNotebookId(c.req.param('v'));
    if (!notebookId.ok) return fail(c, notebookId.error);

    const folderParam = c.req.query('folderId');
    const folderId = folderParam ? FolderId.create(folderParam) : null;
    if (folderId && !folderId.ok) return fail(c, folderId.error);

    const listed = await useCases.listNotes(request).execute({
      ctx: request.ctx,
      notebookId: notebookId.value,
      ...(folderId?.ok ? { folderId: folderId.value } : {}),
    });
    return present(c, listed, (notes) => notes.map(noteToSummary));
  });

  app.post('/notebooks/:v/notes', async (c) => {
    const request = c.get('knowledge');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const notebookId = parseNotebookId(c.req.param('v'));
    if (!notebookId.ok) return fail(c, notebookId.error);
    const body = (await c.req.json().catch(() => ({}))) as {
      folderId?: string;
      content?: string;
      afterNoteId?: string | null;
    };
    const folderId = FolderId.create(String(body.folderId ?? ''));
    if (!folderId.ok) return fail(c, folderId.error);
    const after = body.afterNoteId ? NoteId.create(body.afterNoteId) : null;
    if (after && !after.ok) return fail(c, after.error);

    const created = await useCases.createNote(request).execute({
      ctx: request.ctx,
      notebookId: notebookId.value,
      folderId: folderId.value,
      content: String(body.content ?? ''),
      afterNoteId: after?.ok ? after.value : null,
      by: author.value,
    });
    return present(c, created, (note) => noteToSummary(note), 201);
  });

  app.get('/notebooks/:v/notes/:n', async (c) => {
    const request = c.get('knowledge');
    const notebookId = parseNotebookId(c.req.param('v'));
    if (!notebookId.ok) return fail(c, notebookId.error);
    const noteId = NoteId.create(c.req.param('n') ?? '');
    if (!noteId.ok) return fail(c, noteId.error);

    const read = await useCases
      .readNote(request)
      .execute({ ctx: request.ctx, notebookId: notebookId.value, noteId: noteId.value });
    return present(c, read, ({ note, content, folderTrail }) => ({
      ...noteToDto(note, content),
      folderTrail,
    }));
  });

  app.put('/notebooks/:v/notes/:n', async (c) => {
    const request = c.get('knowledge');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const notebookId = parseNotebookId(c.req.param('v'));
    if (!notebookId.ok) return fail(c, notebookId.error);
    const noteId = NoteId.create(c.req.param('n') ?? '');
    if (!noteId.ok) return fail(c, noteId.error);

    const body = (await c.req.json().catch(() => ({}))) as {
      content?: string;
      baseRevision?: string;
      message?: string;
    };
    const content = String(body.content ?? '');
    const updated = await useCases.updateNote(request).execute({
      ctx: request.ctx,
      notebookId: notebookId.value,
      noteId: noteId.value,
      content,
      baseRevision: String(body.baseRevision ?? ''),
      // What the author said about this change, which the trail records beside
      // the instant and the authorship (RN-AUD-012). Never required.
      message:
        typeof body.message === 'string' ? body.message.slice(0, NOTE_MESSAGE_MAX_LENGTH) : null,
      by: author.value,
    });
    /**
     * The full DTO, so the answer carries THE REVISION THIS WRITE PRODUCED.
     *
     * It used to answer a summary, which has none, so a caller had no way to
     * learn what to base its next edit on and could only echo the revision it
     * loaded with. A second write then arrived claiming a revision the first
     * one had already retired, and the person conflicted with themselves
     * (RN-AGT-005, RN-KNW-028).
     *
     * The content costs nothing to include: it is what the caller just sent,
     * so no blob is read to answer.
     */
    return present(c, updated, (note) => noteToDto(note, content));
  });

  app.post('/notebooks/:v/notes/:n/reorder', async (c) => {
    const request = c.get('knowledge');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const notebookId = parseNotebookId(c.req.param('v'));
    if (!notebookId.ok) return fail(c, notebookId.error);
    const noteId = NoteId.create(c.req.param('n') ?? '');
    if (!noteId.ok) return fail(c, noteId.error);

    const body = (await c.req.json().catch(() => ({}))) as { afterNoteId?: string | null };
    const after = body.afterNoteId ? NoteId.create(body.afterNoteId) : null;
    if (after && !after.ok) return fail(c, after.error);

    const reordered = await useCases.reorderNote(request).execute({
      ctx: request.ctx,
      notebookId: notebookId.value,
      noteId: noteId.value,
      afterNoteId: after?.ok ? after.value : null,
      by: author.value,
    });
    // The note as the write left it: the listing of a folder is an index that
    // converges after the write, so this is where the new position is read.
    return present(c, reordered, (note) => noteToSummary(note));
  });

  app.post('/notebooks/:v/notes/:n/move', async (c) => {
    const request = c.get('knowledge');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const notebookId = parseNotebookId(c.req.param('v'));
    if (!notebookId.ok) return fail(c, notebookId.error);
    const noteId = NoteId.create(c.req.param('n') ?? '');
    if (!noteId.ok) return fail(c, noteId.error);

    const body = (await c.req.json().catch(() => ({}))) as {
      toNotebookId?: string;
      toFolderId?: string;
      afterNoteId?: string | null;
    };
    const toFolderId = FolderId.create(String(body.toFolderId ?? ''));
    if (!toFolderId.ok) return fail(c, toFolderId.error);
    const toNotebookId = body.toNotebookId ? NotebookId.create(body.toNotebookId) : null;
    if (toNotebookId && !toNotebookId.ok) return fail(c, toNotebookId.error);
    const after = body.afterNoteId ? NoteId.create(body.afterNoteId) : null;
    if (after && !after.ok) return fail(c, after.error);

    const moved = await useCases.moveNote(request).execute({
      ctx: request.ctx,
      notebookId: notebookId.value,
      noteId: noteId.value,
      toNotebookId: toNotebookId?.ok ? toNotebookId.value : null,
      toFolderId: toFolderId.value,
      afterNoteId: after?.ok ? after.value : null,
      by: author.value,
    });
    return present(c, moved, (note) => noteToSummary(note));
  });

  app.delete('/notebooks/:v/notes/:n', async (c) => {
    const request = c.get('knowledge');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const notebookId = parseNotebookId(c.req.param('v'));
    if (!notebookId.ok) return fail(c, notebookId.error);
    const noteId = NoteId.create(c.req.param('n') ?? '');
    if (!noteId.ok) return fail(c, noteId.error);

    return noContent(
      c,
      await useCases.deleteNote(request).execute({
        ctx: request.ctx,
        notebookId: notebookId.value,
        noteId: noteId.value,
        by: author.value,
      }),
    );
  });

  // ---- Notebook role ceilings -------------------------------------------------

  app.put('/notebooks/:v/limits/:user', async (c) => {
    const request = c.get('knowledge');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const notebookId = parseNotebookId(c.req.param('v'));
    if (!notebookId.ok) return fail(c, notebookId.error);
    const userId = UserId.create(c.req.param('user') ?? '');
    if (!userId.ok) return fail(c, userId.error);

    const body = (await c.req.json().catch(() => ({}))) as { limit?: string };
    return noContent(
      c,
      await useCases.setNotebookLimit(request).execute({
        ctx: request.ctx,
        notebookId: notebookId.value,
        userId: userId.value,
        limit: String(body.limit ?? ''),
        subscriptionRole: request.subscriptionRole,
        by: author.value,
      }),
    );
  });

  /**
   * The files a notebook keeps (#166). The bytes travel inline, base64: an
   * agent that must perform an HTTP PUT of its own is an agent that cannot
   * keep a file at all.
   */
  app.post('/notebooks/:v/files', async (c) => {
    const request = c.get('knowledge');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const notebookId = parseNotebookId(c.req.param('v'));
    if (!notebookId.ok) return fail(c, notebookId.error);

    const body = (await c.req.json().catch(() => ({}))) as {
      name?: string;
      description?: string;
      mimeType?: string;
      tags?: string[];
      path?: string;
      contentBase64?: string;
    };

    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(Buffer.from(String(body.contentBase64 ?? ''), 'base64'));
    } catch {
      return fail(c, DomainError.validation('The bytes of a file travel base64'));
    }

    const kept = await useCases.keepFile(request).execute({
      ctx: request.ctx,
      notebookId: notebookId.value,
      name: String(body.name ?? ''),
      description: String(body.description ?? ''),
      mimeType: String(body.mimeType ?? ''),
      tags: Array.isArray(body.tags) ? body.tags.map((tag) => String(tag)) : [],
      path: String(body.path ?? '/'),
      bytes,
      by: author.value,
    });
    return present(c, kept, (file) => fileToDto(file), 201);
  });

  app.get('/notebooks/:v/files', async (c) => {
    const request = c.get('knowledge');
    const notebookId = parseNotebookId(c.req.param('v'));
    if (!notebookId.ok) return fail(c, notebookId.error);

    const listed = await useCases
      .listFiles(request)
      .execute({ ctx: request.ctx, notebookId: notebookId.value });
    return present(c, listed, (files) => ({ files: files.map(fileToDto) }));
  });

  /**
   * A link a browser follows on its own, which is what an `<img>` needs. It
   * points at the object store and not here, so a file somebody uploaded is
   * served from an origin that is not the one the product runs in.
   */
  app.get('/notebooks/:v/files/:f/link', async (c) => {
    const request = c.get('knowledge');
    const notebookId = parseNotebookId(c.req.param('v'));
    if (!notebookId.ok) return fail(c, notebookId.error);
    const fileId = FileId.create(c.req.param('f') ?? '');
    if (!fileId.ok) return fail(c, fileId.error);

    const link = await useCases.linkToFile(request).execute({
      ctx: request.ctx,
      notebookId: notebookId.value,
      fileId: fileId.value,
    });
    return present(c, link, (signed) => ({
      url: signed.url,
      expiresAt: signed.expiresAt.toISOString(),
    }));
  });

  app.delete('/notebooks/:v/files/:f', async (c) => {
    const request = c.get('knowledge');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const notebookId = parseNotebookId(c.req.param('v'));
    if (!notebookId.ok) return fail(c, notebookId.error);
    const fileId = FileId.create(c.req.param('f') ?? '');
    if (!fileId.ok) return fail(c, fileId.error);

    const deleted = await useCases.deleteFile(request).execute({
      ctx: request.ctx,
      notebookId: notebookId.value,
      fileId: fileId.value,
      by: author.value,
    });
    return deleted.ok ? c.body(null, 204) : fail(c, deleted.error);
  });

  app.delete('/notebooks/:v/limits/:user', async (c) => {
    const request = c.get('knowledge');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const notebookId = parseNotebookId(c.req.param('v'));
    if (!notebookId.ok) return fail(c, notebookId.error);
    const userId = UserId.create(c.req.param('user') ?? '');
    if (!userId.ok) return fail(c, userId.error);

    return noContent(
      c,
      await useCases.clearNotebookLimit(request).execute({
        ctx: request.ctx,
        notebookId: notebookId.value,
        userId: userId.value,
        by: author.value,
      }),
    );
  });

  return app;
}
