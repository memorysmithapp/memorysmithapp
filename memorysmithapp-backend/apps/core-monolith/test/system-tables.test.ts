/**
 * The system table of a notebook, end to end over HTTP (#517): `system-notes`,
 * one row per note, read from what Discovery projected of the notes, listed
 * and queried as any table, drawn by a dashboard, and written by nothing.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  notebookDashboardSchema,
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

/** Projects what the writes published, as the bus would: the notes into Discovery. */
async function project(): Promise<void> {
  for (const event of harness.events.published) {
    const payload = event.payload as Record<string, string>;
    if (event.type !== 'NoteCreated' && event.type !== 'NoteUpdated') continue;
    await harness.projectNote.onWritten({
      notebookId: String(payload['notebookId']),
      noteId: String(payload['noteId']),
      folderId: String(payload['folderId']),
      contentRef: event.contentRef
        ? { contentId: event.contentRef.contentId.value, versionId: event.contentRef.versionId }
        : null,
    });
  }
  harness.events.published.length = 0;
}

let notebookId = '';
const notes: Record<string, string> = {};

async function folder(name: string): Promise<string> {
  const answer = await call(`/knowledge/notebooks/${notebookId}/folders`, {
    method: 'POST',
    body: { name, description: `The ${name}` },
  });
  return ((await answer.json()) as { folderId: string }).folderId;
}

async function note(folderId: string, content: string): Promise<string> {
  const answer = await call(`/knowledge/notebooks/${notebookId}/notes`, {
    method: 'POST',
    body: { folderId, content },
  });
  expect(answer.status).toBe(201);
  return ((await answer.json()) as { noteId: string }).noteId;
}

async function seed(): Promise<void> {
  const created = await call('/knowledge/notebooks', {
    method: 'POST',
    body: { name: 'Projeto', description: 'Tarefas e pessoas' },
  });
  notebookId = ((await created.json()) as { notebookId: string }).notebookId;
  const tasks = await folder('Tarefas');
  const people = await folder('Pessoas');
  notes['plan'] = await note(
    tasks,
    '---\nname: Plano\nstatus: open\ndue: 2026-12-01\nhours: 3\ndone: false\ntags: [obra, casa]\n---\n\nCom [[Ana]].',
  );
  notes['buy'] = await note(
    tasks,
    '---\nname: Comprar\nstatus: done\ndue: 2026-11-10\nhours: 1.5\ndone: true\ntags: [casa]\n---\n\nVer [[Plano]] e [[Ana]].',
  );
  notes['ana'] = await note(people, '---\nname: Ana\nrole: arquiteta\n---\n\nPessoa.');
  await project();
}

const system = () => `/knowledge/notebooks/${notebookId}/tables/system-notes`;

async function query(body: Record<string, unknown> = {}) {
  const answer = await call(`${system()}/query`, { method: 'POST', body });
  expect(answer.status).toBe(200);
  return tablePageSchema.parse(await answer.json());
}

describe('the system table of a notebook (#517)', () => {
  beforeEach(seed);

  it('is listed in every notebook, marked as a system table, its columns typed by what the notes wrote', async () => {
    const listed = tableListSchema.parse(
      await (await call(`/knowledge/notebooks/${notebookId}/tables`)).json(),
    );
    const table = listed.tables.find((each) => each.name === 'system-notes');
    expect(table).toMatchObject({ system: true, key: ['note'], rows: 3, bytes: 0 });
    const properties = table?.schema['properties'] as Record<string, Record<string, unknown>>;
    expect(Object.keys(properties)).toEqual([
      'note',
      'name',
      'folder',
      'updated',
      'backlinks',
      'links',
      'done',
      'due',
      'hours',
      'role',
      'status',
      'tags',
    ]);
    expect(properties['due']).toMatchObject({ type: 'string', format: 'date' });
    expect(properties['done']).toMatchObject({ type: 'boolean' });
    expect(properties['hours']).toMatchObject({ type: 'number' });
    expect(properties['tags']).toMatchObject({ type: 'array' });
    expect(properties['status']).toMatchObject({ type: 'string' });

    // A notebook with no note still has it, with no row: a dashboard made from
    // a model draws from it the moment the first note is written.
    const empty = await call('/knowledge/notebooks', {
      method: 'POST',
      body: { name: 'Vazio', description: 'Nada' },
    });
    const emptyId = ((await empty.json()) as { notebookId: string }).notebookId;
    const none = tableListSchema.parse(
      await (await call(`/knowledge/notebooks/${emptyId}/tables`)).json(),
    );
    expect(none.tables.map((each) => [each.name, each.rows])).toEqual([['system-notes', 0]]);
  });

  it('answers one row per note, filtered by folder and by any attribute, with its links counted', async () => {
    const tasks = await query({ where: 'folder:Tarefas', sort: [{ column: 'name' }] });
    expect(tasks.rows.map((row) => row.values)).toEqual([
      expect.objectContaining({
        name: 'Comprar',
        folder: 'Tarefas',
        status: 'done',
        due: '2026-11-10',
        hours: 1.5,
        done: true,
        tags: ['casa'],
        backlinks: 0,
        links: 2,
      }),
      expect.objectContaining({ name: 'Plano', status: 'open', hours: 3, backlinks: 1, links: 1 }),
    ]);
    expect(tasks.rows[0]?.rowId).toBe(notes['buy']);

    const ana = await query({ where: 'role:arquiteta' });
    expect(ana.rows.map((row) => row.values)).toEqual([
      expect.objectContaining({ name: 'Ana', backlinks: 2, links: 0 }),
    ]);
    expect(ana.rows[0]?.values['status']).toBeUndefined();

    const counted = await query({ aggregate: { group: 'status', measures: ['count()'] } });
    expect(counted.total).toBe(3);
  });

  it('follows an edit of a note once it is projected', async () => {
    const read = await call(`/knowledge/notebooks/${notebookId}/notes/${notes['plan']}`);
    const { revision } = (await read.json()) as { revision: { versionId: string } };
    const updated = await call(`/knowledge/notebooks/${notebookId}/notes/${notes['plan']}`, {
      method: 'PUT',
      body: {
        baseRevision: revision.versionId,
        content: '---\nname: Plano\nstatus: done\ndue: 2026-12-01\n---\n\nSem links.',
      },
    });
    expect(updated.status).toBe(200);
    await project();
    const plan = await query({ where: 'name:Plano' });
    expect(plan.rows[0]?.values).toMatchObject({ status: 'done', links: 0 });
    expect(plan.rows[0]?.values['hours']).toBeUndefined();
  });

  it('is drawn by a dashboard as any table', async () => {
    const created = await call(`/knowledge/notebooks/${notebookId}/dashboards`, {
      method: 'POST',
      body: {
        name: 'Andamento',
        definition: {
          components: [
            {
              id: 'by-status',
              type: 'bar',
              source: { table: 'system-notes', group: 'status', measures: ['count()'] },
            },
          ],
        },
      },
    });
    expect(created.status).toBe(201);
    notebookDashboardSchema.parse(await created.json());
    const data = (await (
      await call(`/knowledge/notebooks/${notebookId}/dashboards/Andamento/data`, {
        method: 'POST',
        body: {},
      })
    ).json()) as { components: Array<Record<string, unknown>> };
    expect(data.components[0]).toMatchObject({
      status: 'ok',
      groups: expect.arrayContaining([
        { key: 'open', values: [1] },
        { key: 'done', values: [1] },
      ]),
    });
  });

  it("travels as nothing, and a dashboard drawn from it comes back drawn from the new notebook's own", async () => {
    const created = await call(`/knowledge/notebooks/${notebookId}/dashboards`, {
      method: 'POST',
      body: {
        name: 'Andamento',
        definition: {
          components: [
            {
              id: 'by-status',
              type: 'bar',
              source: { table: 'system-notes', group: 'status', measures: ['count()'] },
            },
          ],
        },
      },
    });
    expect(created.status).toBe(201);

    const started = await call(`/portability/notebooks/${notebookId}/export`, {
      method: 'POST',
      body: {},
    });
    const { transferId } = (await started.json()) as { transferId: string };
    const copied = await call('/portability/imports/from-export', {
      method: 'POST',
      body: { transferId },
    });
    const { uploadKey } = (await copied.json()) as { uploadKey: string };
    const applied = await call('/portability/imports/apply', {
      method: 'POST',
      body: { uploadKey, name: 'Projeto, de volta' },
    });
    const { transferId: job } = (await applied.json()) as { transferId: string };
    const done = (await (await call(`/portability/transfers/${job}`)).json()) as {
      status: string;
      notebookId: string;
      failure: string | null;
    };
    expect(done).toMatchObject({ status: 'ready', failure: null });

    const back = tableListSchema.parse(
      await (await call(`/knowledge/notebooks/${done.notebookId}/tables`)).json(),
    );
    expect(back.tables.map((table) => table.name)).toEqual(['system-notes']);
    const data = (await (
      await call(`/knowledge/notebooks/${done.notebookId}/dashboards/Andamento/data`, {
        method: 'POST',
        body: {},
      })
    ).json()) as { components: Array<Record<string, unknown>> };
    expect(data.components[0]).toMatchObject({ status: 'ok' });
  });

  it('is written, altered and deleted by nothing, and no table takes its prefix', async () => {
    const refused = async (path: string, method: string, body: unknown) => {
      const answer = await call(path, { method, body });
      expect(answer.status).toBe(400);
      return ((await answer.json()) as { message: string }).message;
    };
    expect(
      await refused(system(), 'PATCH', { changes: [{ op: 'describe', description: 'x' }] }),
    ).toMatch(/system table/);
    expect(await refused(system(), 'DELETE', undefined)).toMatch(/system table/);
    expect(await refused(`${system()}/rows`, 'POST', { rows: [{ name: 'x' }] })).toMatch(
      /system table/,
    );
    expect(
      await refused(`${system()}/rows`, 'PATCH', {
        updates: [{ target: { rowId: notes['ana'] }, set: { name: 'x' } }],
      }),
    ).toMatch(/system table/);
    expect(
      await refused(`${system()}/rows/delete`, 'POST', { targets: [{ rowId: notes['ana'] }] }),
    ).toMatch(/system table/);

    const tables = `/knowledge/notebooks/${notebookId}/tables`;
    const schema = { type: 'object', properties: { a: { type: 'string' } } };
    expect(await refused(tables, 'POST', { name: 'System-Mine', schema })).toMatch(/system-/);
    const mine = await call(tables, { method: 'POST', body: { name: 'mine', schema } });
    expect(mine.status).toBe(201);
    expect(
      await refused(`${tables}/mine`, 'PATCH', {
        changes: [{ op: 'rename-table', to: 'system-mine' }],
      }),
    ).toMatch(/system-/);

    // Still there, still three rows.
    expect((await query()).total).toBe(3);
  });
});
