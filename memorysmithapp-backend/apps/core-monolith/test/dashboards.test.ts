/**
 * The Dashboards of a notebook, end to end over HTTP (#368): a definition
 * checked against the tables it draws from, data computed from them each time
 * it is read under the periods chosen, and a table renamed or deleted
 * afterwards said in place of the components that drew from it.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { dashboardDataSchema, notebookDashboardSchema } from '@memorysmithapp/contracts';
import { buildTestApp } from './wiring.js';

type App = ReturnType<typeof buildTestApp>;
let harness: App;
let notebookId: string;
const TOKEN = 'token-owner';

async function call(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<Response> {
  return harness.app.request(path, {
    method: init.method ?? 'GET',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

beforeEach(async () => {
  harness = buildTestApp();
  harness.verifier.issue(TOKEN, { sub: 'user-owner', email: 'owner@example.com' });
  const created = await call('/access/subscriptions', { method: 'POST', body: {} });
  const { subscriptionId } = (await created.json()) as { subscriptionId: string };
  harness.verifier.issue('platform-token', {
    sub: 'platform-admin',
    email: 'admin@memorysmith.app',
    groups: ['platform-admin'],
  });
  await harness.app.request(`/access/platform/subscriptions/${subscriptionId}/approve`, {
    method: 'POST',
    headers: { authorization: 'Bearer platform-token', 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'active' }),
  });
  harness.verifier.issue(TOKEN, {
    sub: 'user-owner',
    email: 'owner@example.com',
    subscription_id: subscriptionId,
    subscription_status: 'active',
  });
  notebookId = (
    (await (
      await call('/knowledge/notebooks', {
        method: 'POST',
        body: { name: 'Casa', description: 'A casa' },
      })
    ).json()) as {
      notebookId: string;
    }
  ).notebookId;
  await call(`/knowledge/notebooks/${notebookId}/tables`, {
    method: 'POST',
    body: {
      name: 'gastos',
      schema: {
        type: 'object',
        properties: {
          data: { type: 'string', format: 'date' },
          categoria: { type: 'string' },
          valor: { type: 'number' },
          status: { type: 'string', enum: ['pendente', 'pago'] },
        },
      },
    },
  });
  await call(`/knowledge/notebooks/${notebookId}/tables/gastos/rows`, {
    method: 'POST',
    body: {
      rows: [
        { data: '2026-09-30', categoria: 'casa', valor: 2000, status: 'pago' },
        { data: '2026-10-01', categoria: 'mercado', valor: 120.5, status: 'pago' },
        { data: '2026-10-15', categoria: 'saúde', valor: 30, status: 'pendente' },
        { data: '2026-10-20', categoria: 'mercado', valor: 79.5, status: 'pendente' },
      ],
    },
  });
});

const DEFINITION = {
  layout: 'header-two-columns',
  refreshSeconds: 60,
  filters: [{ id: 'periodo', type: 'period', column: 'data', label: 'Mês', default: '2026-10' }],
  components: [
    {
      id: 'total',
      type: 'kpi',
      slot: 'header',
      title: 'Gasto',
      source: { table: 'gastos', measure: 'sum(valor)' },
    },
    {
      id: 'categorias',
      type: 'pie',
      slot: 'left',
      source: { table: 'gastos', group: 'categoria', measures: ['sum(valor)'] },
    },
    {
      id: 'contas',
      type: 'kanban',
      slot: 'right',
      source: { table: 'gastos' },
      options: { lane: 'status', card: 'categoria' },
    },
    { id: 'nota', type: 'text', slot: 'footer', options: { markdown: 'Os gastos do **mês**.' } },
  ],
};

const dashboards = () => `/knowledge/notebooks/${notebookId}/dashboards`;
const data = async (name: string, filters: Record<string, string | null> = {}) =>
  dashboardDataSchema.parse(
    await (
      await call(`${dashboards()}/${encodeURIComponent(name)}/data`, {
        method: 'POST',
        body: { filters },
      })
    ).json(),
  );

describe('a dashboard of a notebook', () => {
  it('is defined against its tables and answers each component from them, under the period chosen', async () => {
    const created = await call(dashboards(), {
      method: 'POST',
      body: { name: 'Mês', definition: DEFINITION },
    });
    expect(created.status).toBe(201);
    const dashboard = notebookDashboardSchema.parse(await created.json());
    expect(
      (dashboard.definition['components'] as Array<{ source?: { table: string } }>)[0]?.source
        ?.table,
    ).toBe('gastos');

    const october = await data('Mês');
    expect(october.components[0]).toMatchObject({
      id: 'total',
      status: 'ok',
      kind: 'value',
      value: 230,
    });
    expect(october.components[1]).toMatchObject({
      id: 'categorias',
      kind: 'groups',
      groups: [
        { key: 'mercado', values: [200] },
        { key: 'saúde', values: [30] },
      ],
    });
    expect(october.components[2]).toMatchObject({ id: 'contas', kind: 'rows', total: 3 });
    expect(october.components[3]).toMatchObject({ id: 'nota', kind: 'text' });

    const everything = await data('Mês', { periodo: null });
    expect(everything.components[0]).toMatchObject({ value: 2230 });
  });

  it('refuses a definition naming what its table cannot answer, naming it', async () => {
    const refused = async (component: Record<string, unknown>) => {
      const answer = await call(dashboards(), {
        method: 'POST',
        body: { name: 'Errado', definition: { components: [component] } },
      });
      expect(answer.status).toBe(400);
      return ((await answer.json()) as { message: string }).message;
    };
    expect(
      await refused({ type: 'kpi', source: { table: 'vendas', measure: 'count()' } }),
    ).toContain('"vendas"');
    expect(
      await refused({
        type: 'bar',
        source: { table: 'gastos', group: 'loja', measures: ['count()'] },
      }),
    ).toContain('"loja"');
    expect(await refused({ type: 'radar', source: { table: 'gastos' } })).toContain('kpi, pie');
    expect(
      await refused({
        type: 'kanban',
        source: { table: 'gastos' },
        options: { lane: 'status', card: 'nome' },
      }),
    ).toContain('"nome"');
  });

  it('keeps drawing a table renamed, and says in place of its components when it is gone', async () => {
    await call(dashboards(), { method: 'POST', body: { name: 'Mês', definition: DEFINITION } });
    await call(`/knowledge/notebooks/${notebookId}/tables/gastos`, {
      method: 'PATCH',
      body: { changes: [{ op: 'rename-table', to: 'despesas' }] },
    });
    const renamed = await data('Mês');
    expect(renamed.components[0]).toMatchObject({ status: 'ok', value: 230 });
    expect(
      (renamed.dashboard.definition['components'] as Array<{ source?: { table: string } }>)[0]
        ?.source?.table,
    ).toBe('despesas');

    await call(`/knowledge/notebooks/${notebookId}/tables/despesas`, { method: 'DELETE' });
    const gone = await data('Mês');
    expect(gone.components.map((component) => component.status)).toEqual([
      'missing-table',
      'missing-table',
      'missing-table',
      'ok',
    ]);
  });

  it('is changed whole and deleted for good', async () => {
    await call(dashboards(), { method: 'POST', body: { name: 'Mês', definition: DEFINITION } });
    const changed = await call(`${dashboards()}/${encodeURIComponent('Mês')}`, {
      method: 'PATCH',
      body: { name: 'Outubro' },
    });
    expect(changed.status).toBe(200);
    expect((await call(`${dashboards()}/Outubro`)).status).toBe(200);
    expect((await call(`${dashboards()}/Outubro`, { method: 'DELETE' })).status).toBe(204);
    expect((await call(`${dashboards()}/Outubro`)).status).toBe(404);
  });

  describe('the components of the second batch (#369)', () => {
    const SECOND = {
      layout: 'one-column',
      components: [
        {
          id: 'pivo',
          type: 'matrix',
          source: { table: 'gastos', group: 'categoria', measures: ['sum(valor)'] },
          options: { across: 'data:month' },
        },
        {
          id: 'combo',
          type: 'combo',
          source: {
            table: 'gastos',
            group: 'categoria',
            measures: ['sum(valor)', 'count()'],
          },
          options: { lines: ['count()'] },
        },
        {
          id: 'fluxo',
          type: 'waterfall',
          source: { table: 'gastos', group: 'data:month', measures: ['sum(valor)'] },
          options: { total: true },
        },
        {
          id: 'etapas',
          type: 'funnel',
          source: { table: 'gastos', group: 'status', measures: ['count()'] },
        },
        {
          id: 'arvore',
          type: 'wbs',
          source: { table: 'gastos' },
          options: { code: 'categoria', title: 'status', progress: 'valor' },
        },
        { id: 'linhas', type: 'table', source: { table: 'gastos' } },
        {
          id: 'total',
          type: 'kpi',
          source: { table: 'gastos', measure: 'sum(valor)' },
        },
      ],
    };
    const create = () =>
      call(dashboards(), { method: 'POST', body: { name: 'Segundo', definition: SECOND } });
    const read = async (cross: { component: string; key: string } | null) =>
      dashboardDataSchema.parse(
        await (
          await call(`${dashboards()}/Segundo/data`, { method: 'POST', body: { cross } })
        ).json(),
      ).components;
    const byId = (components: Array<{ id: string }>, id: string) =>
      components.find((each) => each.id === id) as Record<string, unknown>;

    it('adds a matrix up by row and by column, with its totals', async () => {
      expect((await create()).status).toBe(201);
      const matrix = byId(await read(null), 'pivo');
      expect(matrix['kind']).toBe('matrix');
      expect(matrix['columns']).toEqual(['2026-09', '2026-10']);
      expect(matrix['totals']).toEqual([2000, 230]);
      expect(matrix['grand']).toBe(2230);
      const rows = matrix['rows'] as Array<{ key: string; cells: unknown[]; total: unknown }>;
      expect(rows.find((row) => row.key === 'mercado')).toEqual({
        key: 'mercado',
        cells: [null, 200],
        total: 200,
      });
    });

    it('narrows the other components by a mark clicked, and leaves the chart whole', async () => {
      await create();
      const crossed = await read({ component: 'etapas', key: 'pendente' });
      expect(byId(crossed, 'total')['value']).toBe(109.5);
      expect(byId(crossed, 'linhas')['total']).toBe(2);
      expect((byId(crossed, 'etapas')['groups'] as unknown[]).length).toBe(2);
      const cleared = await read(null);
      expect(byId(cleared, 'total')['value']).toBe(2230);
    });

    it('narrows by the period a chart groups by', async () => {
      await create();
      const crossed = await read({ component: 'fluxo', key: '2026-09' });
      expect(byId(crossed, 'total')['value']).toBe(2000);
    });

    it('refuses what the new components need and were not given', async () => {
      const refused = async (component: Record<string, unknown>) => {
        const answer = await call(dashboards(), {
          method: 'POST',
          body: { name: 'Errado', definition: { components: [component] } },
        });
        expect(answer.status).toBe(400);
        return JSON.stringify(await answer.json());
      };
      const source = { table: 'gastos', group: 'categoria', measures: ['sum(valor)'] };
      expect(await refused({ id: 'a', type: 'matrix', source })).toContain('options.across');
      expect(await refused({ id: 'a', type: 'combo', source })).toContain('two measures');
      expect(
        await refused({ id: 'a', type: 'wbs', source: { table: 'gastos' }, options: {} }),
      ).toContain('outline code');
      expect(
        await refused({
          id: 'a',
          type: 'waterfall',
          source: { ...source, measures: ['sum(valor)', 'count()'] },
        }),
      ).toContain('one measure');
    });
  });

  describe('the components of the third batch (#370)', () => {
    it('draws them from the tables, and refuses what each one needs', async () => {
      const source = { table: 'gastos' };
      const created = await call(dashboards(), {
        method: 'POST',
        body: {
          name: 'Terceiro',
          definition: {
            components: [
              {
                id: 'areas',
                type: 'treemap',
                source: { ...source, group: 'categoria', measures: ['sum(valor)'] },
              },
              {
                id: 'pontos',
                type: 'scatter',
                source,
                options: { x: 'valor', y: 'valor', color: 'status', label: 'categoria' },
              },
              {
                id: 'calor',
                type: 'heatmap',
                source: { ...source, group: 'categoria', measures: ['sum(valor)'] },
                options: { across: 'data:month' },
              },
              {
                id: 'dias',
                type: 'calendar',
                source: { ...source, group: 'data:day', measures: ['sum(valor)'] },
              },
              {
                id: 'meta',
                type: 'gauge',
                source: { ...source, measure: 'sum(valor)' },
                options: { goal: 5000 },
              },
              {
                id: 'fatos',
                type: 'timeline',
                source,
                options: { date: 'data', title: 'categoria', detail: 'status' },
              },
            ],
          },
        },
      });
      expect(created.status).toBe(201);
      const read = await data('Terceiro');
      const kinds = Object.fromEntries(read.components.map((each) => [each.id, each.kind]));
      expect(kinds).toEqual({
        areas: 'groups',
        pontos: 'rows',
        calor: 'matrix',
        dias: 'groups',
        meta: 'value',
        fatos: 'rows',
      });

      const refused = async (component: Record<string, unknown>) => {
        const answer = await call(dashboards(), {
          method: 'POST',
          body: { name: 'Errado', definition: { components: [component] } },
        });
        expect(answer.status).toBe(400);
        return JSON.stringify(await answer.json());
      };
      expect(
        await refused({ id: 'a', type: 'gauge', source: { ...source, measure: 'count()' } }),
      ).toContain('options.goal');
      expect(
        await refused({
          id: 'a',
          type: 'calendar',
          source: { ...source, group: 'data:month', measures: ['count()'] },
        }),
      ).toContain('by day');
      expect(
        await refused({ id: 'a', type: 'scatter', source, options: { x: 'status', y: 'valor' } }),
      ).toContain('numbers');
      expect(
        await refused({
          id: 'a',
          type: 'timeline',
          source,
          options: { date: 'status', title: 'status' },
        }),
      ).toContain('not a date');
      expect(
        await refused({
          id: 'a',
          type: 'bar',
          source: { ...source, group: 'status', measures: ['count()'] },
          options: { names: { 'sum(valor)': 'Valor' } },
        }),
      ).toContain('options.names');
    });
  });
});
