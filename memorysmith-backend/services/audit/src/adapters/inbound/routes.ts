/**
 * HTTP surface of svc-audit (architecture-guide.md, section 14.1):
 *
 *   GET /notes/:n/history
 *   GET /notes/:n/revisions/:versionId
 *   GET /notes/:n/revisions?asOf=
 *   GET /vaults/:v/activity?from=&to=
 *
 * Everything here is a read. There is no write route, because the only writer
 * is the event consumer, and there is no update route anywhere, because the
 * table refuses one by IAM.
 */

import { Hono, type Context } from 'hono';
import {
  type DomainError,
  httpStatusFor,
  type Result,
  type SubscriptionContext,
} from '@memorysmith/kernel';
import type { AuditEvent } from '../../domain/index.js';
import type { GetNoteHistory, GetVaultActivity, ReadRevision } from '../../application/index.js';

/**
 * The verified context travels with the request. Passing the subscription as a
 * bare string would mean rebuilding it downstream, and a value object that can
 * be rebuilt from a string is no longer the guarantee PE2 relies on.
 */
export interface AuditRequest {
  readonly subscription: SubscriptionContext;
}

export interface AuditUseCases {
  readonly noteHistory: (request: AuditRequest) => GetNoteHistory;
  readonly vaultActivity: (request: AuditRequest) => GetVaultActivity;
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

export function createAuditRoutes(useCases: AuditUseCases): Hono<{ Variables: Variables }> {
  const app = new Hono<{ Variables: Variables }>();

  app.get('/notes/:n/history', async (c) => {
    const request = c.get('audit');
    const noteId = c.req.param('n') ?? '';
    return present(c, await useCases.noteHistory(request).execute(noteId), (entries) => ({
      noteId,
      entries: entries.map(entryToDto),
    }));
  });

  /** The revision in force on a date, rebuilt from the trail (RN-AUD-005). */
  app.get('/notes/:n/revisions', async (c) => {
    const request = c.get('audit');
    const noteId = c.req.param('n') ?? '';
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

  app.get('/notes/:n/revisions/:versionId', async (c) => {
    const request = c.get('audit');
    const noteId = c.req.param('n') ?? '';
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

  app.get('/vaults/:v/activity', async (c) => {
    const request = c.get('audit');
    const vaultId = c.req.param('v') ?? '';
    const activity = await useCases.vaultActivity(request).execute({
      vaultId,
      from: c.req.query('from'),
      to: c.req.query('to'),
    });
    return present(c, activity, (entries) => ({
      vaultId,
      entries: entries.map(entryToDto),
    }));
  });

  return app;
}
