/**
 * The HTTP surface of the Dashboards of a notebook (#368). A dashboard is named
 * in the path by its identifier or its name, URL-encoded.
 */

import type { Context, Hono } from 'hono';
import {
  createDashboardRequestSchema,
  dashboardDataRequestSchema,
  type NotebookDashboardDto,
  updateDashboardRequestSchema,
} from '@memorysmithapp/contracts';
import {
  type Authorship,
  DomainError,
  Instant,
  NotebookId,
  type Result,
} from '@memorysmithapp/kernel';
import type { RequestContext } from '../../../domain/access/AuthorizationPolicy.js';
import type {
  CreateDashboard,
  DeleteDashboard,
  GetDashboard,
  ListDashboards,
  ReadDashboardData,
  UpdateDashboard,
} from '../../../application/dashboards.js';
import type { Dashboard } from '../../../domain/dashboard/Dashboard.js';
import {
  presentDefinition,
  type TableShape,
} from '../../../domain/dashboard/DashboardDefinition.js';

export interface DashboardRequest {
  readonly ctx: RequestContext;
  readonly authorship: Result<Authorship, DomainError>;
}

export interface DashboardUseCases<R extends DashboardRequest = DashboardRequest> {
  readonly listDashboards: (request: R) => ListDashboards;
  readonly createDashboard: (request: R) => CreateDashboard;
  readonly getDashboard: (request: R) => GetDashboard;
  readonly updateDashboard: (request: R) => UpdateDashboard;
  readonly deleteDashboard: (request: R) => DeleteDashboard;
  readonly readDashboardData: (request: R) => ReadDashboardData;
}

type Fail = (c: Context, error: DomainError) => Response;

export function dashboardToDto(
  dashboard: Dashboard,
  tables: readonly TableShape[],
): NotebookDashboardDto {
  return {
    dashboardId: dashboard.id.value,
    notebookId: dashboard.notebookId.value,
    name: dashboard.name,
    description: dashboard.description,
    definition: presentDefinition(dashboard.definition, tables),
    updatedAt: dashboard.updatedBy.at.toISOString(),
    authorship: dashboard.updatedBy.toJSON(),
  };
}

interface BodySchema<T> {
  safeParse(value: unknown):
    | { success: true; data: T }
    | {
        success: false;
        error: { issues: ReadonlyArray<{ path: PropertyKey[]; message: string }> };
      };
}

async function bodyOf<T>(c: Context, schema: BodySchema<T>): Promise<Result<T, DomainError>> {
  const parsed = schema.safeParse((await c.req.json().catch(() => undefined)) ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? `${issue.path.map(String).join('.')}: ` : '';
    return {
      ok: false,
      error: DomainError.validation(`${where}${issue?.message ?? 'The request is not readable'}`),
    };
  }
  return { ok: true, value: parsed.data };
}

export function registerDashboardRoutes<R extends DashboardRequest>(
  app: Hono<{ Variables: { knowledge: R } }>,
  useCases: DashboardUseCases<R>,
  fail: Fail,
): void {
  const notebookOf = (c: Context): Result<NotebookId, DomainError> =>
    NotebookId.create(c.req.param('v') ?? '');
  const dashboardOf = (c: Context): string => decodeURIComponent(c.req.param('d') ?? '');

  app.get('/notebooks/:v/dashboards', async (c) => {
    const request = c.get('knowledge');
    const notebookId = notebookOf(c);
    if (!notebookId.ok) return fail(c, notebookId.error);
    const listed = await useCases
      .listDashboards(request)
      .execute({ ctx: request.ctx, notebookId: notebookId.value });
    if (!listed.ok) return fail(c, listed.error);
    return c.json({
      dashboards: listed.value.dashboards.map((each) => dashboardToDto(each, listed.value.tables)),
    });
  });

  app.post('/notebooks/:v/dashboards', async (c) => {
    const request = c.get('knowledge');
    if (!request.authorship.ok) return fail(c, request.authorship.error);
    const notebookId = notebookOf(c);
    if (!notebookId.ok) return fail(c, notebookId.error);
    const body = await bodyOf(c, createDashboardRequestSchema);
    if (!body.ok) return fail(c, body.error);
    const created = await useCases.createDashboard(request).execute({
      ctx: request.ctx,
      notebookId: notebookId.value,
      name: body.value.name,
      description: body.value.description,
      definition: body.value.definition,
      by: request.authorship.value,
    });
    return created.ok
      ? c.json(dashboardToDto(created.value.dashboard, created.value.tables), 201)
      : fail(c, created.error);
  });

  app.get('/notebooks/:v/dashboards/:d', async (c) => {
    const request = c.get('knowledge');
    const notebookId = notebookOf(c);
    if (!notebookId.ok) return fail(c, notebookId.error);
    const found = await useCases
      .getDashboard(request)
      .execute({ ctx: request.ctx, notebookId: notebookId.value, dashboard: dashboardOf(c) });
    return found.ok
      ? c.json(dashboardToDto(found.value.dashboard, found.value.tables))
      : fail(c, found.error);
  });

  app.patch('/notebooks/:v/dashboards/:d', async (c) => {
    const request = c.get('knowledge');
    if (!request.authorship.ok) return fail(c, request.authorship.error);
    const notebookId = notebookOf(c);
    if (!notebookId.ok) return fail(c, notebookId.error);
    const body = await bodyOf(c, updateDashboardRequestSchema);
    if (!body.ok) return fail(c, body.error);
    const changed = await useCases.updateDashboard(request).execute({
      ctx: request.ctx,
      notebookId: notebookId.value,
      dashboard: dashboardOf(c),
      name: body.value.name,
      description: body.value.description,
      definition: body.value.definition,
      by: request.authorship.value,
    });
    return changed.ok
      ? c.json(dashboardToDto(changed.value.dashboard, changed.value.tables))
      : fail(c, changed.error);
  });

  app.delete('/notebooks/:v/dashboards/:d', async (c) => {
    const request = c.get('knowledge');
    if (!request.authorship.ok) return fail(c, request.authorship.error);
    const notebookId = notebookOf(c);
    if (!notebookId.ok) return fail(c, notebookId.error);
    const deleted = await useCases.deleteDashboard(request).execute({
      ctx: request.ctx,
      notebookId: notebookId.value,
      dashboard: dashboardOf(c),
      by: request.authorship.value,
    });
    return deleted.ok ? c.body(null, 204) : fail(c, deleted.error);
  });

  /** What every component draws now, under the periods and pages asked. A POST, so it carries them. */
  app.post('/notebooks/:v/dashboards/:d/data', async (c) => {
    const request = c.get('knowledge');
    const notebookId = notebookOf(c);
    if (!notebookId.ok) return fail(c, notebookId.error);
    const body = await bodyOf(c, dashboardDataRequestSchema);
    if (!body.ok) return fail(c, body.error);
    const read = await useCases.readDashboardData(request).execute({
      ctx: request.ctx,
      notebookId: notebookId.value,
      dashboard: dashboardOf(c),
      filters: body.value.filters,
      pages: body.value.pages,
      cross: body.value.cross,
    });
    if (!read.ok) return fail(c, read.error);
    const found = await useCases.getDashboard(request).execute({
      ctx: request.ctx,
      notebookId: notebookId.value,
      dashboard: read.value.dashboard.id.value,
    });
    return c.json({
      dashboard: dashboardToDto(read.value.dashboard, found.ok ? found.value.tables : []),
      readAt: Instant.now().toISOString(),
      components: read.value.components,
    });
  });
}
