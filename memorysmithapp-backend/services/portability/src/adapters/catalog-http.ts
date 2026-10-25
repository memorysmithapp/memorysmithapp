/**
 * The routes of the community catalog that no subscription is behind (#360).
 *
 * The public ones answer anybody, an account or none, and are served by a
 * handler of their own whose permissions reach the catalog entries and the
 * snapshots of versions and nothing else (#356): every read starts from an
 * entry, the one way a public request reaches a subscription (INV-02). Their
 * answers may be kept at the edge for a minute; a withdrawal empties it.
 *
 * The operator's routes are for a platform session, which holds no
 * subscription and reaches no customer content (INV-12): they read the
 * reports and delete a catalog entry, and nothing else.
 */

import { Hono, type Context } from 'hono';
import { DomainError, httpStatusFor, type Result } from '@memorysmithapp/kernel';
import { withdrawModelRequestSchema } from '@memorysmithapp/contracts';
import type {
  DismissReport,
  ListReports,
  PlatformActor,
  ReadCatalogModel,
  ReadCatalogVersion,
  SearchCatalog,
  WithdrawByOperator,
} from '../application/Catalog.js';
import { documentToDto } from './http.js';

/** How long the edge keeps a public answer (#356): short, so a new version shows soon. */
export const PUBLIC_MAX_AGE_SECONDS = 60;

export interface PublicCatalogUseCases {
  readonly search: () => SearchCatalog;
  readonly readModel: () => ReadCatalogModel;
  readonly readVersion: () => ReadCatalogVersion;
}

function fail(c: Context, error: DomainError): Response {
  return c.json({ code: error.code, message: error.message }, httpStatusFor(error) as 400);
}

function cached(c: Context, body: object): Response {
  c.header('cache-control', `public, max-age=${PUBLIC_MAX_AGE_SECONDS}`);
  return c.json(body, 200);
}

export function createPublicCatalogRoutes(useCases: PublicCatalogUseCases): Hono {
  const app = new Hono();

  app.get('/', async (c) => {
    const language = c.req.query('language')?.trim() || null;
    const models = await useCases.search().execute({ text: c.req.query('q') ?? '', language });
    return cached(c, { models });
  });

  app.get('/:p', async (c) => {
    const read = await useCases.readModel().execute(c.req.param('p'));
    return read.ok ? cached(c, read.value) : fail(c, read.error);
  });

  app.get('/:p/versions/:n', async (c) => {
    const read = await useCases.readVersion().execute({
      publicId: c.req.param('p'),
      number: Number(c.req.param('n')),
    });
    if (!read.ok) return fail(c, read.error);
    const { model, version, document, references } = read.value;
    return cached(c, {
      model,
      version: {
        number: version.number,
        changelog: version.changelog,
        createdAt: version.createdAt,
        bytes: version.bytes,
      },
      objective: model.objective,
      description: model.description,
      audience: model.audience,
      parameters: version.parameters,
      basedOn: model.basedOn,
      ...documentToDto(document),
      references,
    });
  });

  return app;
}

export interface CatalogOperatorUseCases {
  readonly listReports: (actor: PlatformActor) => ListReports;
  readonly withdraw: (actor: PlatformActor) => WithdrawByOperator;
  readonly dismissReport: (actor: PlatformActor) => DismissReport;
}

type OperatorVariables = { operator: PlatformActor };

function answer<T>(c: Context, result: Result<T, DomainError>, status: 200 | 204): Response {
  if (!result.ok) return fail(c, result.error);
  return status === 204 ? c.body(null, 204) : c.json(result.value as object, 200);
}

export function createCatalogOperatorRoutes(
  useCases: CatalogOperatorUseCases,
): Hono<{ Variables: OperatorVariables }> {
  const app = new Hono<{ Variables: OperatorVariables }>();

  app.get('/reports', async (c) => {
    const listed = await useCases.listReports(c.get('operator')).execute();
    if (!listed.ok) return fail(c, listed.error);
    return c.json({
      reports: listed.value.map(({ report, model }) => ({
        reportId: report.reportId,
        publicId: report.publicId,
        reason: report.reason,
        reportedAt: report.reportedAt,
        model,
      })),
    });
  });

  app.post('/models/:p/withdraw', async (c) => {
    const body = withdrawModelRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return fail(c, DomainError.validation('A withdrawal says why'));
    return answer(
      c,
      await useCases
        .withdraw(c.get('operator'))
        .execute({ publicId: c.req.param('p'), reason: body.data.reason }),
      204,
    );
  });

  app.delete('/reports/:r', async (c) =>
    answer(c, await useCases.dismissReport(c.get('operator')).execute(c.req.param('r')), 204),
  );

  return app;
}
