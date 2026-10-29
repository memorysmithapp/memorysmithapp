/**
 * The Tables of a notebook, end to end over HTTP (#366): a schema in JSON
 * Schema, rows checked against it, a key that makes an upsert, a filter in the
 * search language, and a schema change that never leaves a row invalid.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  notebookTableSchema,
  rowsWrittenSchema,
  tableListSchema,
  tablePageSchema,
} from '@memorysmithapp/contracts';
import { buildTestApp } from './wiring.js';

type App = ReturnType<typeof buildTestApp>;
let harness: App;

const TOKEN = 'token-owner';

beforeEach(async () => {
  harness = buildTestApp();
  harness.verifier.issue(TOKEN, { sub: 'user-owner', email: 'owner@example.com' });
  const created = await harness.app.request('/access/subscriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
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
});

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

async function seedNotebook(): Promise<string> {
  const response = await call('/knowledge/notebooks', {
    method: 'POST',
    body: { name: 'Finanças', description: 'Os gastos da casa' },
  });
  return ((await response.json()) as { notebookId: string }).notebookId;
}

const EXPENSES = {
  type: 'object',
  properties: {
    date: { type: 'string', format: 'date' },
    description: { type: 'string', description: 'What was bought' },
    amount: { type: 'number', minimum: 0 },
    status: { type: 'string', enum: ['pending', 'paid', 'cancelled'], default: 'pending' },
    tags: { type: 'array', items: { type: 'string' } },
  },
  required: ['date', 'description', 'amount'],
  additionalProperties: false,
};

async function createExpenses(notebookId: string, key: string[] | null = null): Promise<string> {
  const response = await call(`/knowledge/notebooks/${notebookId}/tables`, {
    method: 'POST',
    body: { name: 'expenses', description: 'Every expense of the house', schema: EXPENSES, key },
  });
  expect(response.status).toBe(201);
  return notebookTableSchema.parse(await response.json()).tableId;
}

const rows = (notebookId: string, table: string) =>
  `/knowledge/notebooks/${notebookId}/tables/${table}/rows`;
const query = async (notebookId: string, table: string, body: Record<string, unknown> = {}) =>
  tablePageSchema.parse(
    await (
      await call(`/knowledge/notebooks/${notebookId}/tables/${table}/query`, {
        method: 'POST',
        body,
      })
    ).json(),
  );

describe('a notebook keeps tables', () => {
  it('creates one from JSON Schema and gives the schema back as it was declared', async () => {
    const notebookId = await seedNotebook();
    await createExpenses(notebookId);

    const listed = tableListSchema.parse(
      await (await call(`/knowledge/notebooks/${notebookId}/tables`)).json(),
    );
    expect(listed.tables).toHaveLength(1);
    const [table] = listed.tables;
    expect(table?.name).toBe('expenses');
    expect(table?.schema['required']).toEqual(['date', 'description', 'amount']);
    expect((table?.schema['properties'] as Record<string, unknown>)['status']).toEqual({
      type: 'string',
      enum: ['pending', 'paid', 'cancelled'],
      default: 'pending',
    });
  });

  it('refuses a keyword outside the subset, naming it', async () => {
    const notebookId = await seedNotebook();
    const response = await call(`/knowledge/notebooks/${notebookId}/tables`, {
      method: 'POST',
      body: {
        name: 'codes',
        schema: { type: 'object', properties: { code: { type: 'string', pattern: '^[A-Z]+$' } } },
      },
    });
    expect(response.status).toBe(400);
    expect(((await response.json()) as { message: string }).message).toContain('"pattern"');
  });

  it('holds one table of each name, whatever its case', async () => {
    const notebookId = await seedNotebook();
    await createExpenses(notebookId);
    const response = await call(`/knowledge/notebooks/${notebookId}/tables`, {
      method: 'POST',
      body: { name: 'Expenses', schema: EXPENSES },
    });
    expect(response.status).toBe(409);
  });
});

describe('the rows of a table', () => {
  it('are checked against the schema, all or nothing, the defaults filled in', async () => {
    const notebookId = await seedNotebook();
    await createExpenses(notebookId);

    const refused = await call(rows(notebookId, 'expenses'), {
      method: 'POST',
      body: {
        rows: [
          { date: '2026-10-01', description: 'Market', amount: 120.5 },
          { date: '2026-10-02', description: 'Pharmacy', amount: -3 },
        ],
      },
    });
    expect(refused.status).toBe(400);
    expect(((await refused.json()) as { message: string }).message).toContain('Row 2');
    expect((await query(notebookId, 'expenses')).total).toBe(0);

    const written = await call(rows(notebookId, 'expenses'), {
      method: 'POST',
      body: { rows: [{ date: '2026-10-01', description: 'Market', amount: 120.5 }] },
    });
    expect(written.status).toBe(201);
    const page = await query(notebookId, 'expenses');
    expect(page.rows[0]?.values).toEqual({
      date: '2026-10-01',
      description: 'Market',
      amount: 120.5,
      status: 'pending',
    });
  });

  it('keeps a number with every digit it was written with', async () => {
    const notebookId = await seedNotebook();
    await createExpenses(notebookId);
    await call(rows(notebookId, 'expenses'), {
      method: 'POST',
      body: {
        rows: [
          { date: '2026-10-01', description: 'Bond', amount: '12345678901234567890.123456789' },
        ],
      },
    });
    const page = await query(notebookId, 'expenses');
    expect(page.rows[0]?.values['amount']).toBe('12345678901234567890.123456789');
  });

  it('upserts by key, so reading the same statement twice duplicates nothing', async () => {
    const notebookId = await seedNotebook();
    await createExpenses(notebookId, ['date', 'description']);
    const statement = [
      { date: '2026-10-01', description: 'Market', amount: 120.5 },
      { date: '2026-10-02', description: 'Pharmacy', amount: 30 },
    ];
    await call(rows(notebookId, 'expenses'), { method: 'POST', body: { rows: statement } });

    const again = await call(rows(notebookId, 'expenses'), {
      method: 'POST',
      body: { rows: statement },
    });
    expect(again.status).toBe(409);

    const upserted = rowsWrittenSchema.parse(
      await (
        await call(rows(notebookId, 'expenses'), {
          method: 'POST',
          body: {
            mode: 'upsert',
            rows: [...statement, { date: '2026-10-03', description: 'Bakery', amount: 12 }],
          },
        })
      ).json(),
    );
    expect(upserted.inserted).toHaveLength(1);
    expect(upserted.updated).toHaveLength(2);
    expect((await query(notebookId, 'expenses')).total).toBe(3);
  });

  it('updates and deletes rows named by their key, and never sets a column of the key', async () => {
    const notebookId = await seedNotebook();
    await createExpenses(notebookId, ['date', 'description']);
    await call(rows(notebookId, 'expenses'), {
      method: 'POST',
      body: { rows: [{ date: '2026-10-01', description: 'Market', amount: 120.5 }] },
    });
    const key = { date: '2026-10-01', description: 'Market' };

    const paid = await call(rows(notebookId, 'expenses'), {
      method: 'PATCH',
      body: { updates: [{ target: { key }, set: { status: 'paid' } }] },
    });
    expect(paid.status).toBe(200);
    expect((await query(notebookId, 'expenses')).rows[0]?.values['status']).toBe('paid');

    const rekeyed = await call(rows(notebookId, 'expenses'), {
      method: 'PATCH',
      body: { updates: [{ target: { key }, set: { description: 'Supermarket' } }] },
    });
    expect(rekeyed.status).toBe(400);

    const deleted = await call(`${rows(notebookId, 'expenses')}/delete`, {
      method: 'POST',
      body: { targets: [{ key }] },
    });
    expect(deleted.status).toBe(200);
    expect((await query(notebookId, 'expenses')).total).toBe(0);
  });

  it('are filtered in the search language, sorted and paged', async () => {
    const notebookId = await seedNotebook();
    await createExpenses(notebookId);
    await call(rows(notebookId, 'expenses'), {
      method: 'POST',
      body: {
        rows: [
          { date: '2026-09-30', description: 'Rent', amount: 2000, status: 'paid' },
          { date: '2026-10-01', description: 'Market', amount: 120.5 },
          { date: '2026-10-15', description: 'Farmácia', amount: 30, tags: ['health'] },
          { date: '2026-10-31', description: 'Gym', amount: 99, status: 'cancelled' },
        ],
      },
    });

    const october = await query(notebookId, 'expenses', {
      where: 'date:2026-10 -status:cancelled',
      sort: [{ column: 'amount', direction: 'desc' }],
    });
    expect(october.rows.map((row) => row.values['description'])).toEqual(['Market', 'Farmácia']);

    expect((await query(notebookId, 'expenses', { where: 'farmacia' })).total).toBe(1);
    expect((await query(notebookId, 'expenses', { where: 'amount:>=100' })).total).toBe(2);
    expect((await query(notebookId, 'expenses', { where: 'date:<=2026-10' })).total).toBe(4);
    const second = await query(notebookId, 'expenses', { pageSize: 3, page: 2 });
    expect(second.rows).toHaveLength(1);
    expect(second.total).toBe(4);

    const unknown = await call(`/knowledge/notebooks/${notebookId}/tables/expenses/query`, {
      method: 'POST',
      body: { where: 'category:food' },
    });
    expect(unknown.status).toBe(400);
  });
});

describe('a schema change', () => {
  it('converts every row or changes nothing, naming the rows that do not fit', async () => {
    const notebookId = await seedNotebook();
    const created = await call(`/knowledge/notebooks/${notebookId}/tables`, {
      method: 'POST',
      body: {
        name: 'readings',
        schema: { type: 'object', properties: { value: { type: 'string' } } },
      },
    });
    expect(created.status).toBe(201);
    await call(rows(notebookId, 'readings'), {
      method: 'POST',
      body: { rows: [{ value: '12' }, { value: 'n/a' }] },
    });

    const refused = await call(`/knowledge/notebooks/${notebookId}/tables/readings`, {
      method: 'PATCH',
      body: { changes: [{ op: 'change-column', column: 'value', schema: { type: 'number' } }] },
    });
    expect(refused.status).toBe(400);
    expect(((await refused.json()) as { message: string }).message).toContain('1 rows do not fit');

    const page = await query(notebookId, 'readings');
    const bad = page.rows.find((row) => row.values['value'] === 'n/a');
    await call(`${rows(notebookId, 'readings')}/delete`, {
      method: 'POST',
      body: { targets: [{ rowId: bad?.rowId }] },
    });
    const converted = await call(`/knowledge/notebooks/${notebookId}/tables/readings`, {
      method: 'PATCH',
      body: {
        changes: [
          { op: 'change-column', column: 'value', schema: { type: 'number' } },
          { op: 'rename-column', column: 'value', to: 'reading' },
          { op: 'add-column', name: 'unit', schema: { type: 'string', default: 'kWh' } },
        ],
      },
    });
    expect(converted.status).toBe(200);
    expect((await query(notebookId, 'readings')).rows[0]?.values).toEqual({
      reading: 12,
      unit: 'kWh',
    });
  });

  it('refuses a required column with no default over rows that would have no value', async () => {
    const notebookId = await seedNotebook();
    await createExpenses(notebookId);
    await call(rows(notebookId, 'expenses'), {
      method: 'POST',
      body: { rows: [{ date: '2026-10-01', description: 'Market', amount: 1 }] },
    });
    const refused = await call(`/knowledge/notebooks/${notebookId}/tables/expenses`, {
      method: 'PATCH',
      body: {
        changes: [{ op: 'add-column', name: 'payer', schema: { type: 'string' }, required: true }],
      },
    });
    expect(refused.status).toBe(400);
  });

  it('sets a key only when no two rows share it', async () => {
    const notebookId = await seedNotebook();
    await createExpenses(notebookId);
    await call(rows(notebookId, 'expenses'), {
      method: 'POST',
      body: {
        rows: [
          { date: '2026-10-01', description: 'Market', amount: 1 },
          { date: '2026-10-01', description: 'Market', amount: 2 },
        ],
      },
    });
    const refused = await call(`/knowledge/notebooks/${notebookId}/tables/expenses`, {
      method: 'PATCH',
      body: { changes: [{ op: 'set-key', columns: ['date', 'description'] }] },
    });
    expect(refused.status).toBe(409);

    const keyed = await call(`/knowledge/notebooks/${notebookId}/tables/expenses`, {
      method: 'PATCH',
      body: { changes: [{ op: 'set-key', columns: ['date', 'description', 'amount'] }] },
    });
    expect(keyed.status).toBe(200);
    expect((await query(notebookId, 'expenses')).total).toBe(2);
  });

  it('deletes a table for good', async () => {
    const notebookId = await seedNotebook();
    await createExpenses(notebookId);
    const deleted = await call(`/knowledge/notebooks/${notebookId}/tables/expenses`, {
      method: 'DELETE',
    });
    expect(deleted.status).toBe(200);
    expect((await call(`/knowledge/notebooks/${notebookId}/tables/expenses`)).status).toBe(404);
    const again = await call(`/knowledge/notebooks/${notebookId}/tables`, {
      method: 'POST',
      body: { name: 'expenses', schema: EXPENSES },
    });
    expect(again.status).toBe(201);
  });
});
