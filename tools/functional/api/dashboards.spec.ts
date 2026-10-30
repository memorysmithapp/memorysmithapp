/**
 * The Dashboards of a notebook against the deployed core (#368): a definition
 * checked against its tables, and every component computed from them.
 */

import { expect, test, unique, type NotebookFixture } from './fixtures.js';

const path = (notebook: NotebookFixture) => `/knowledge/notebooks/${notebook.notebookId}`;

test.describe('the dashboards of a notebook', () => {
  test('[route:POST /knowledge/notebooks/:v/dashboards] [route:GET /knowledge/notebooks/:v/dashboards] [route:GET /knowledge/notebooks/:v/dashboards/:d] [route:POST /knowledge/notebooks/:v/dashboards/:d/data] [route:PATCH /knowledge/notebooks/:v/dashboards/:d] [route:DELETE /knowledge/notebooks/:v/dashboards/:d] builds a dashboard over a table, reads what it draws, changes it and deletes it', async ({
    owner,
    notebook,
  }) => {
    const table = unique('gastos').replace(/\s+/g, '-');
    await owner.ok('POST', `${path(notebook)}/tables`, {
      name: table,
      schema: {
        type: 'object',
        properties: {
          data: { type: 'string', format: 'date' },
          categoria: { type: 'string' },
          valor: { type: 'number' },
        },
      },
    });
    await owner.ok('POST', `${path(notebook)}/tables/${encodeURIComponent(table)}/rows`, {
      rows: [
        { data: '2026-10-01', categoria: 'mercado', valor: 120.5 },
        { data: '2026-10-15', categoria: 'saúde', valor: 30 },
      ],
    });

    const name = unique('Mês');
    const created = await owner.call<{ dashboardId: string }>(
      'POST',
      `${path(notebook)}/dashboards`,
      {
        name,
        definition: {
          layout: 'two-columns',
          filters: [{ id: 'periodo', type: 'period', column: 'data', default: '2026-10' }],
          components: [
            { id: 'total', type: 'kpi', slot: 'left', source: { table, measure: 'sum(valor)' } },
            {
              id: 'pizza',
              type: 'pie',
              slot: 'right',
              source: { table, group: 'categoria', measures: ['sum(valor)'] },
            },
          ],
        },
      },
    );
    expect(created.status).toBe(201);

    const listed = await owner.ok<{ dashboards: Array<{ name: string }> }>(
      'GET',
      `${path(notebook)}/dashboards`,
    );
    expect(listed.dashboards.map((each) => each.name)).toContain(name);
    const address = `${path(notebook)}/dashboards/${encodeURIComponent(name)}`;
    expect((await owner.call('GET', address)).status).toBe(200);

    const drawn = await owner.ok<{ components: Array<Record<string, unknown>> }>(
      'POST',
      `${address}/data`,
      {},
    );
    expect(drawn.components[0]).toMatchObject({ status: 'ok', kind: 'value', value: 150.5 });
    expect(drawn.components[1]).toMatchObject({ status: 'ok', kind: 'groups' });

    const renamed = unique('Outubro');
    expect((await owner.call('PATCH', address, { name: renamed })).status).toBe(200);
    const moved = `${path(notebook)}/dashboards/${encodeURIComponent(renamed)}`;
    expect((await owner.call('DELETE', moved)).status).toBe(204);
    expect((await owner.call('GET', moved)).status).toBe(404);
  });
});
