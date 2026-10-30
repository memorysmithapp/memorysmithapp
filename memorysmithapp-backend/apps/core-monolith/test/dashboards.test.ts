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
});
