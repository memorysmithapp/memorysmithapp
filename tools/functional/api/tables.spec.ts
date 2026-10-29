/**
 * The Tables of a notebook against the deployed core (#366): a schema in JSON
 * Schema, rows checked against it, an upsert by key, a filter in the search
 * language, a schema change that never leaves a row invalid, and a deletion
 * that is definitive.
 */

import { eventually } from '../support/eventually.js';
import { expect, test, unique, type NotebookFixture } from './fixtures.js';

interface Table {
  tableId: string;
  name: string;
  schema: Record<string, unknown>;
  key: string[] | null;
  rows: number;
}

interface Page {
  rows: Array<{ rowId: string; values: Record<string, unknown> }>;
  total: number;
}

const tablesPath = (notebook: NotebookFixture) =>
  `/knowledge/notebooks/${notebook.notebookId}/tables`;

const EXPENSES = {
  type: 'object',
  properties: {
    date: { type: 'string', format: 'date' },
    description: { type: 'string' },
    amount: { type: 'number', minimum: 0 },
    status: { type: 'string', enum: ['pending', 'paid'], default: 'pending' },
  },
  required: ['date', 'description', 'amount'],
};

test.describe('the tables of a notebook', () => {
  test('[route:POST /knowledge/notebooks/:v/tables] [route:GET /knowledge/notebooks/:v/tables] [route:GET /knowledge/notebooks/:v/tables/:t] creates a table from JSON Schema, lists it and reads it by name', async ({
    owner,
    notebook,
  }) => {
    const name = unique('expenses').replace(/\s+/g, '-');
    const created = await owner.call<Table>('POST', tablesPath(notebook), {
      name,
      description: 'Created by a functional case.',
      schema: EXPENSES,
      key: ['date', 'description'],
    });
    expect(created.status).toBe(201);
    expect(created.body.key).toEqual(['date', 'description']);

    const listed = await owner.ok<{ tables: Table[] }>('GET', tablesPath(notebook));
    expect(listed.tables.map((table) => table.name)).toContain(name);

    const read = await owner.ok<Table>(
      'GET',
      `${tablesPath(notebook)}/${encodeURIComponent(name)}`,
    );
    expect(read.tableId).toBe(created.body.tableId);
    expect(read.schema['required']).toEqual(['date', 'description', 'amount']);

    const refused = await owner.call('POST', tablesPath(notebook), {
      name: unique('codes').replace(/\s+/g, '-'),
      schema: { type: 'object', properties: { code: { type: 'string', pattern: '^[A-Z]+$' } } },
    });
    expect(refused.status).toBe(400);
  });

  test('[route:POST /knowledge/notebooks/:v/tables/:t/rows] [route:POST /knowledge/notebooks/:v/tables/:t/query] inserts rows checked against the schema, upserts by key and filters in the search language', async ({
    owner,
    notebook,
  }) => {
    const name = unique('statement').replace(/\s+/g, '-');
    await owner.ok('POST', tablesPath(notebook), {
      name,
      schema: EXPENSES,
      key: ['date', 'description'],
    });
    const rows = `${tablesPath(notebook)}/${encodeURIComponent(name)}/rows`;
    const statement = [
      { date: '2026-10-01', description: 'Market', amount: 120.5 },
      { date: '2026-10-15', description: 'Farmácia', amount: 30 },
      { date: '2026-09-30', description: 'Rent', amount: 2000, status: 'paid' },
    ];

    expect(
      (
        await owner.call('POST', rows, {
          rows: [{ date: 'yesterday', description: 'x', amount: 1 }],
        })
      ).status,
    ).toBe(400);
    expect((await owner.call('POST', rows, { rows: statement })).status).toBe(201);
    expect((await owner.call('POST', rows, { rows: statement })).status).toBe(409);
    const upserted = await owner.ok<{ inserted: string[]; updated: string[] }>('POST', rows, {
      mode: 'upsert',
      rows: statement,
    });
    expect(upserted.updated).toHaveLength(3);

    const query = (body: Record<string, unknown>) =>
      owner.ok<Page>('POST', `${tablesPath(notebook)}/${encodeURIComponent(name)}/query`, body);
    const october = await query({
      where: 'date:2026-10',
      sort: [{ column: 'amount', direction: 'desc' }],
    });
    expect(october.rows.map((row) => row.values['description'])).toEqual(['Market', 'Farmácia']);
    expect((await query({ where: 'farmacia' })).total).toBe(1);
    expect((await query({ where: 'amount:>=100 -status:paid' })).total).toBe(1);

    await eventually(
      'the relay to count the rows',
      () => owner.ok<Table>('GET', `${tablesPath(notebook)}/${encodeURIComponent(name)}`),
      (table) => table.rows === 3,
    );
  });

  test('[route:PATCH /knowledge/notebooks/:v/tables/:t/rows] [route:POST /knowledge/notebooks/:v/tables/:t/rows/delete] updates and deletes rows named by their key', async ({
    owner,
    notebook,
  }) => {
    const name = unique('bills').replace(/\s+/g, '-');
    await owner.ok('POST', tablesPath(notebook), {
      name,
      schema: EXPENSES,
      key: ['date', 'description'],
    });
    const rows = `${tablesPath(notebook)}/${encodeURIComponent(name)}/rows`;
    await owner.ok('POST', rows, {
      rows: [{ date: '2026-10-01', description: 'Power', amount: 80 }],
    });
    const key = { date: '2026-10-01', description: 'Power' };

    await owner.ok('PATCH', rows, { updates: [{ target: { key }, set: { status: 'paid' } }] });
    const page = await owner.ok<Page>(
      'POST',
      `${tablesPath(notebook)}/${encodeURIComponent(name)}/query`,
      {},
    );
    expect(page.rows[0]?.values['status']).toBe('paid');
    expect(
      (
        await owner.call('PATCH', rows, {
          updates: [{ target: { key }, set: { description: 'Light' } }],
        })
      ).status,
    ).toBe(400);

    await owner.ok('POST', `${rows}/delete`, { targets: [{ key }] });
    const empty = await owner.ok<Page>(
      'POST',
      `${tablesPath(notebook)}/${encodeURIComponent(name)}/query`,
      {},
    );
    expect(empty.total).toBe(0);
  });

  test('[route:PATCH /knowledge/notebooks/:v/tables/:t] [route:DELETE /knowledge/notebooks/:v/tables/:t] converts every row or changes nothing, and deletes a table for good', async ({
    owner,
    notebook,
  }) => {
    const name = unique('readings').replace(/\s+/g, '-');
    const path = `${tablesPath(notebook)}/${encodeURIComponent(name)}`;
    await owner.ok('POST', tablesPath(notebook), {
      name,
      schema: { type: 'object', properties: { value: { type: 'string' } } },
    });
    await owner.ok('POST', `${path}/rows`, { rows: [{ value: '12' }, { value: 'n/a' }] });

    const toNumber = {
      changes: [{ op: 'change-column', column: 'value', schema: { type: 'number' } }],
    };
    expect((await owner.call('PATCH', path, toNumber)).status).toBe(400);

    const page = await owner.ok<Page>('POST', `${path}/query`, { where: 'value:n/a' });
    await owner.ok('POST', `${path}/rows/delete`, { targets: [{ rowId: page.rows[0]?.rowId }] });
    const altered = await owner.ok<{ changes: string[] }>('PATCH', path, toNumber);
    expect(altered.changes).toEqual(['changed the column value']);
    const converted = await owner.ok<Page>('POST', `${path}/query`, {});
    expect(converted.rows[0]?.values['value']).toBe(12);

    expect((await owner.call('DELETE', path)).status).toBe(200);
    expect((await owner.call('GET', path)).status).toBe(404);
  });
});
