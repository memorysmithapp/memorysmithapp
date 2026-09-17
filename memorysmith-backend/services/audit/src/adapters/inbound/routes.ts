/**
 * HTTP surface of svc-audit (architecture-guide.md, section 14.1):
 *
 *   GET /notebooks/:v/notes/:n/history
 *   GET /notebooks/:v/notes/:n/revisions/:versionId
 *   GET /notebooks/:v/notes/:n/revisions?asOf=
 *   GET /notebooks/:v/activity?from=&to=
 *
 * Everything here is a read. There is no write route, because the only writer
 * is the event consumer, and there is no update route anywhere, because the
 * table refuses one by IAM.
 *
 * A read of the trail is about a note OF A NOTEBOOK. The trail is indexed by
 * the note alone, because a note keeps its history across a move (RN-AUD-004),
 * and that is a fact of the store, never of the surface: a caller addresses a
 * note where it lives, and is answered about the note that lives there.
 */

import { Hono, type Context } from 'hono';
import {
  DomainError,
  httpStatusFor,
  type Result,
  type SubscriptionContext,
} from '@memorysmith/kernel';
import type { AuditEvent } from '../../domain/index.js';
import type { GetNoteHistory, GetNotebookActivity, ReadRevision } from '../../application/index.js';

/**
 * The verified context travels with the request. Passing the subscription as a
 * bare string would mean rebuilding it downstream, and a value object that can
 * be rebuilt from a string is no longer the guarantee PE2 relies on.
 */
export interface AuditRequest {
  readonly subscription: SubscriptionContext;
  /**
   * Whether that notebook still holds that note, LIVE: the note itself, the
   * folder it lives in and the notebook above it (RN-KNW-046). Deleting is one
   * write on the unit deleted and nothing under it is rewritten, so the trail
   * cannot answer this out of its own entries — what is invalid left no event
   * of its own, and waiting for the purge to say so is what let a deleted note
   * serve its history and its content for a minute.
   */
  readonly holdsNote: (notebookId: string, noteId: string) => Promise<boolean>;
}

export interface AuditUseCases {
  readonly noteHistory: (request: AuditRequest) => GetNoteHistory;
  readonly notebookActivity: (request: AuditRequest) => GetNotebookActivity;
  readonly readRevision: (request: AuditRequest) => ReadRevision;
}

type Variables = { audit: AuditRequest };

function entryToDto(event: AuditEvent): Record<string, unknown> {
  return {
    eventId: event.eventId,
    type: event.type,
    subject: event.subject,
    subjectId: event.subjectId,
    occurredAt: event.occurredAt.toISOString(),
    authorship: event.authorship.toJSON(),
    contentRef: event.contentRef ? event.contentRef.toJSON() : null,
    payload: event.payload,
  };
}

function fail(c: Context, error: DomainError): Response {
  return c.json({ code: error.code, message: error.message }, httpStatusFor(error) as 400);
}

function present<T, U>(c: Context, result: Result<T, DomainError>, map: (value: T) => U): Response {
  return result.ok ? c.json(map(result.value) as object, 200) : fail(c, result.error);
}

/**
 * A note under anything deleted answers as missing here too, the instant it is
 * deleted and not when the purge gets to it, and so does a note addressed
 * through a notebook that does not hold it.
 */
async function guardNote(
  request: AuditRequest,
  notebookId: string,
  noteId: string,
): Promise<DomainError | null> {
  return (await request.holdsNote(notebookId, noteId))
    ? null
    : DomainError.notFound('Note not found');
}

export function createAuditRoutes(useCases: AuditUseCases): Hono<{ Variables: Variables }> {
  const app = new Hono<{ Variables: Variables }>();

  app.get('/notebooks/:v/notes/:n/history', async (c) => {
    const request = c.get('audit');
    const noteId = c.req.param('n') ?? '';
    const denied = await guardNote(request, c.req.param('v') ?? '', noteId);
    if (denied) return fail(c, denied);

    return present(c, await useCases.noteHistory(request).execute(noteId), (entries) => ({
      noteId,
      entries: entries.map(entryToDto),
    }));
  });

  /** The revision in force on a date, rebuilt from the trail (RN-AUD-005). */
  app.get('/notebooks/:v/notes/:n/revisions', async (c) => {
    const request = c.get('audit');
    const noteId = c.req.param('n') ?? '';
    const denied = await guardNote(request, c.req.param('v') ?? '', noteId);
    if (denied) return fail(c, denied);

    const read = await useCases.readRevision(request).execute({
      noteId,
      asOf: c.req.query('asOf'),
    });
    return present(c, read, ({ event, content }) => ({
      noteId,
      occurredAt: event.occurredAt.toISOString(),
      authorship: event.authorship.toJSON(),
      contentRef: event.contentRef?.toJSON(),
      content,
    }));
  });

  app.get('/notebooks/:v/notes/:n/revisions/:versionId', async (c) => {
    const request = c.get('audit');
    const noteId = c.req.param('n') ?? '';
    const denied = await guardNote(request, c.req.param('v') ?? '', noteId);
    if (denied) return fail(c, denied);

    const read = await useCases.readRevision(request).execute({
      noteId,
      versionId: c.req.param('versionId'),
    });
    return present(c, read, ({ event, content }) => ({
      noteId,
      occurredAt: event.occurredAt.toISOString(),
      authorship: event.authorship.toJSON(),
      contentRef: event.contentRef?.toJSON(),
      content,
    }));
  });

  app.get('/notebooks/:v/activity', async (c) => {
    const request = c.get('audit');
    const notebookId = c.req.param('v') ?? '';
    /**
     * No check of the notebook here, and that is the point: the activity of a
     * notebook somebody DELETED is what a trail exists to answer, the deletion
     * itself included. The subscription is what bounds this read.
     */
    const activity = await useCases.notebookActivity(request).execute({
      notebookId,
      from: c.req.query('from'),
      to: c.req.query('to'),
    });
    return present(c, activity, (entries) => ({
      notebookId,
      entries: entries.map(entryToDto),
    }));
  });

  return app;
}
