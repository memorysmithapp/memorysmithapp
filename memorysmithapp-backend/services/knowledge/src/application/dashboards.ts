/**
 * The Dashboards of a notebook (#368): built by an agent through the
 * connector, read by whoever reads the notebook, and deleted by whoever
 * maintains it, as a table is (RN-KNW-074).
 *
 * A definition is checked whole against the tables of the notebook before it
 * is kept, and a dashboard keeps no data: its components are computed from
 * their tables every time it is read.
 */

import {
  type Authorship,
  DashboardId,
  DomainError,
  err,
  type NotebookId,
  ok,
  type Result,
  TableId,
} from '@memorysmithapp/kernel';
import type { RequestContext } from '../domain/access/AuthorizationPolicy.js';
import type { DashboardRepository } from '../domain/ports/index.js';
import { Dashboard } from '../domain/dashboard/Dashboard.js';
import {
  componentData,
  type ComponentData,
  type TableWithRows,
} from '../domain/dashboard/DashboardData.js';
import {
  DASHBOARD_LIMITS,
  readDefinition,
  type TableShape,
  tablesOf,
} from '../domain/dashboard/DashboardDefinition.js';
import { loadAuthorized } from './notebooks.js';
import type { TableDependencies } from './tables.js';

export interface DashboardDependencies extends TableDependencies {
  readonly dashboards: DashboardRepository;
}

async function shapesOf(
  deps: DashboardDependencies,
  notebookId: NotebookId,
): Promise<TableShape[]> {
  return (await deps.tables.list(notebookId)).map((table) => ({
    tableId: table.id.value,
    name: table.name,
    columns: table.columns,
  }));
}

/** A dashboard named by its identifier or its name, as an agent and a page name it. */
async function resolveDashboard(
  deps: DashboardDependencies,
  notebookId: NotebookId,
  reference: string,
): Promise<Result<Dashboard, DomainError>> {
  const id = DashboardId.create(reference);
  if (id.ok) {
    const found = await deps.dashboards.findById(notebookId, id.value);
    if (found) return ok(found);
  }
  const named = await deps.dashboards.findByName(notebookId, reference);
  return named
    ? ok(named)
    : err(DomainError.notFound(`This notebook has no dashboard "${reference}"`));
}

/** A dashboard with the tables it was checked against, which name its components. */
export interface DashboardView {
  readonly dashboard: Dashboard;
  readonly tables: TableShape[];
}

export class CreateDashboard {
  constructor(private readonly deps: DashboardDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    name: string;
    description: string;
    definition: unknown;
    by: Authorship;
  }): Promise<Result<DashboardView, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'maintain');
    if (!notebook.ok) return notebook;
    const existing = await this.deps.dashboards.list(input.notebookId);
    if (existing.length >= DASHBOARD_LIMITS.dashboardsPerNotebook) {
      return err(
        DomainError.limitExceeded(
          `A notebook holds up to ${DASHBOARD_LIMITS.dashboardsPerNotebook} dashboards`,
        ),
      );
    }
    const tables = await shapesOf(this.deps, input.notebookId);
    const definition = readDefinition(input.definition, tables);
    if (!definition.ok) return definition;
    const dashboard = Dashboard.create({
      id: DashboardId.generate(),
      subscriptionId: notebook.value.subscriptionId,
      notebookId: input.notebookId,
      name: input.name,
      description: input.description,
      definition: definition.value,
      by: input.by,
    });
    if (!dashboard.ok) return dashboard;
    const held = await this.deps.dashboards.findByName(input.notebookId, dashboard.value.name);
    if (held) {
      return err(
        DomainError.conflict(
          `This notebook already has a dashboard called "${held.name}"`,
          held.id.value,
        ),
      );
    }
    const saved = await this.deps.dashboards.save(dashboard.value);
    if (!saved.ok) return saved;
    return ok({ dashboard: dashboard.value, tables });
  }
}

export class UpdateDashboard {
  constructor(private readonly deps: DashboardDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    dashboard: string;
    name: string | null;
    description: string | null;
    definition: unknown;
    by: Authorship;
  }): Promise<Result<DashboardView, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'maintain');
    if (!notebook.ok) return notebook;
    const dashboard = await resolveDashboard(this.deps, input.notebookId, input.dashboard);
    if (!dashboard.ok) return dashboard;
    const tables = await shapesOf(this.deps, input.notebookId);
    const definition =
      input.definition === undefined || input.definition === null
        ? ok(dashboard.value.definition)
        : readDefinition(input.definition, tables);
    if (!definition.ok) return definition;
    const name = input.name ?? dashboard.value.name;
    if (name.normalize('NFC').trim().toLowerCase() !== dashboard.value.name.toLowerCase()) {
      const held = await this.deps.dashboards.findByName(
        input.notebookId,
        name.normalize('NFC').trim(),
      );
      if (held && !held.id.equals(dashboard.value.id)) {
        return err(
          DomainError.conflict(
            `This notebook already has a dashboard called "${held.name}"`,
            held.id.value,
          ),
        );
      }
    }
    const changed = dashboard.value.change({
      name,
      description: input.description ?? dashboard.value.description,
      definition: definition.value,
      by: input.by,
    });
    if (!changed.ok) return changed;
    const saved = await this.deps.dashboards.save(dashboard.value);
    if (!saved.ok) return saved;
    return ok({ dashboard: dashboard.value, tables });
  }
}

export class ListDashboards {
  constructor(private readonly deps: DashboardDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
  }): Promise<Result<{ dashboards: Dashboard[]; tables: TableShape[] }, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'read');
    if (!notebook.ok) return notebook;
    const [dashboards, tables] = await Promise.all([
      this.deps.dashboards.list(input.notebookId),
      shapesOf(this.deps, input.notebookId),
    ]);
    return ok({ dashboards, tables });
  }
}

export class GetDashboard {
  constructor(private readonly deps: DashboardDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    dashboard: string;
  }): Promise<Result<DashboardView, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'read');
    if (!notebook.ok) return notebook;
    const dashboard = await resolveDashboard(this.deps, input.notebookId, input.dashboard);
    if (!dashboard.ok) return dashboard;
    return ok({ dashboard: dashboard.value, tables: await shapesOf(this.deps, input.notebookId) });
  }
}

export class DeleteDashboard {
  constructor(private readonly deps: DashboardDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    dashboard: string;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'maintain');
    if (!notebook.ok) return notebook;
    const dashboard = await resolveDashboard(this.deps, input.notebookId, input.dashboard);
    if (!dashboard.ok) return dashboard;
    const deleted = dashboard.value.delete(input.by);
    if (!deleted.ok) return deleted;
    return this.deps.dashboards.save(dashboard.value);
  }
}

/**
 * What every component of a dashboard draws now (#368): each table it draws
 * from read once, under the periods chosen on the dashboard and the page each
 * table component is on.
 */
export class ReadDashboardData {
  constructor(private readonly deps: DashboardDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    dashboard: string;
    filters: Readonly<Record<string, string | null>>;
    pages: Readonly<Record<string, number>>;
  }): Promise<Result<{ dashboard: Dashboard; components: ComponentData[] }, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'read');
    if (!notebook.ok) return notebook;
    const dashboard = await resolveDashboard(this.deps, input.notebookId, input.dashboard);
    if (!dashboard.ok) return dashboard;

    const tables = new Map<string, TableWithRows>();
    await Promise.all(
      tablesOf(dashboard.value.definition).map(async (raw) => {
        const id = TableId.create(raw);
        if (!id.ok) return;
        const table = await this.deps.tables.findById(input.notebookId, id.value);
        if (!table) return;
        tables.set(raw, {
          tableId: table.id.value,
          name: table.name,
          columns: table.columns,
          rows: await this.deps.tables.rows(table),
        });
      }),
    );
    return ok({
      dashboard: dashboard.value,
      components: componentData(dashboard.value.definition, tables, input.filters, input.pages),
    });
  }
}
