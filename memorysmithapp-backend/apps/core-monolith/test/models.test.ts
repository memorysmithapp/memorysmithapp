/**
 * Notebook models (#353, #431): a notebook declared as a model by the owner of
 * its subscription, read whole as it stands, with the history of its changes,
 * created from as a copy of the notebook at that moment, and gone with it.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { Authorship, Role, UserId } from '@memorysmithapp/kernel';
import { Email } from '@memorysmithapp/svc-access/domain/values';
import { buildTestApp } from './wiring.js';

type App = ReturnType<typeof buildTestApp>;
let harness: App;
let subscriptionId: string;
let notebookId: string;
let folderId: string;

const OWNER = 'token-owner';
const MEMBER = 'token-member';

async function call(token: string, path: string, init: { method?: string; body?: unknown } = {}) {
  return harness.app.request(path, {
    method: init.method ?? 'GET',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

/** Hands what the writes published to the trail, as the bus would. */
async function drainTrail(): Promise<void> {
  await harness.auditConsumer.consume(
    harness.events.published.map((event) => ({
      eventId: event.eventId,
      type: event.type,
      occurredAt: event.occurredAt.toISOString(),
      subscriptionId: event.subscriptionId.value,
      subject: event.subject,
      subjectId: event.subjectId,
      authorship: event.authorship.toJSON(),
      contentRef: event.contentRef ? event.contentRef.toJSON() : null,
      payload: event.payload,
    })),
  );
  harness.events.published.length = 0;
}

const declaration = {
  objective: 'Run the assemblies and the works of one condominium',
  description: 'Minutes, works and suppliers, one folder each',
  audience: 'Property managers',
  parameters: [
    {
      name: 'condomínio',
      description: 'The name of the condominium',
      example: 'Residencial Aurora',
      type: 'text',
      required: true,
    },
    {
      name: 'síndico',
      description: 'Who answers for it',
      example: 'Maria Souza',
      type: 'text',
      required: false,
      default: 'a definir',
    },
  ],
  basedOn: null,
};

beforeEach(async () => {
  harness = buildTestApp();
  harness.verifier.issue(OWNER, { sub: 'user-owner', email: 'owner@example.com' });
  const created = await call(OWNER, '/access/subscriptions', { method: 'POST', body: {} });
  subscriptionId = (await json<{ subscriptionId: string }>(created)).subscriptionId;
  harness.verifier.issue('platform-token', {
    sub: 'platform-admin',
    email: 'admin@memorysmith.app',
    groups: ['platform-admin'],
  });
  await call('platform-token', `/access/platform/subscriptions/${subscriptionId}/approve`, {
    method: 'POST',
    body: { status: 'active' },
  });
  harness.verifier.issue(OWNER, {
    sub: 'user-owner',
    email: 'owner@example.com',
    subscription_id: subscriptionId,
    subscription_status: 'active',
  });
  notebookId = (
    await json<{ notebookId: string }>(
      await call(OWNER, '/knowledge/notebooks', {
        method: 'POST',
        body: { name: 'Condomínio modelo', description: 'Um condomínio, do jeito que funciona' },
      }),
    )
  ).notebookId;
  folderId = (
    await json<{ folderId: string }>(
      await call(OWNER, `/knowledge/notebooks/${notebookId}/folders`, {
        method: 'POST',
        body: { name: 'Assembleias', description: 'Uma ata por assembleia.' },
      }),
    )
  ).folderId;
  await call(OWNER, `/knowledge/notebooks/${notebookId}/notes`, {
    method: 'POST',
    body: {
      folderId,
      content: '---\nname: "Ata de exemplo de {{condomínio}}"\n---\n\nPresidida por {{síndico}}.\n',
    },
  });
});

describe('a notebook model (#353, #431)', () => {
  it('is declared by the owner, with its parameters, and keeps no copy of its notebook', async () => {
    const declared = await call(OWNER, `/portability/models/${notebookId}`, {
      method: 'PUT',
      body: declaration,
    });
    expect(declared.status).toBe(200);

    const model = await json<
      Record<string, unknown> & {
        objective: string;
        name: string;
        parameters: Array<{ name: string; required: boolean; default: unknown }>;
      }
    >(await call(OWNER, `/portability/models/${notebookId}`));
    expect(model.objective).toBe(declaration.objective);
    expect(model.name).toBe('Condomínio modelo');
    expect(model.parameters.map((each) => [each.name, each.required, each.default])).toEqual([
      ['condomínio', true, null],
      ['síndico', false, 'a definir'],
    ]);
    expect(model).not.toHaveProperty('versions');

    // Nothing is kept for it: no transfer, no archive.
    const transfers = await json<{ transfers: unknown[] }>(
      await call(OWNER, '/portability/transfers'),
    );
    expect(transfers.transfers).toEqual([]);
    // The route that froze a version is gone.
    expect(
      (
        await call(OWNER, `/portability/models/${notebookId}/versions`, {
          method: 'POST',
          body: {},
        })
      ).status,
    ).toBe(404);

    const listed = await json<{ models: Array<{ notebookId: string; name: string }> }>(
      await call(OWNER, '/portability/models'),
    );
    expect(listed.models).toEqual([
      expect.objectContaining({ notebookId, name: 'Condomínio modelo' }),
    ]);
  });

  it('is read whole as its notebook stands now', async () => {
    await call(OWNER, `/portability/models/${notebookId}`, { method: 'PUT', body: declaration });
    const before = await json<{ notes: Array<{ body: string }> }>(
      await call(OWNER, `/portability/models/${notebookId}/contents`),
    );
    expect(before.notes).toHaveLength(1);

    await call(OWNER, `/knowledge/notebooks/${notebookId}/notes`, {
      method: 'POST',
      body: { folderId, content: '---\nname: Ata nova\n---\n\nEscrita depois.\n' },
    });

    const view = await json<{
      parameters: Array<{ name: string }>;
      notebook: { name: string };
      folders: Array<{ name: string }>;
      notes: Array<{ body: string }>;
    }>(await call(OWNER, `/portability/models/${notebookId}/contents`));
    expect(view.notebook.name).toBe('Condomínio modelo');
    expect(view.folders.map((each) => each.name)).toEqual(['Assembleias']);
    expect(view.notes).toHaveLength(2);
    expect(view.notes.some((each) => each.body.includes('{{síndico}}'))).toBe(true);
    expect(view.parameters.map((each) => each.name)).toEqual(['condomínio', 'síndico']);
  });

  it('keeps the history of its notebook: when, through what, and the line left (#431)', async () => {
    await call(OWNER, `/portability/models/${notebookId}`, { method: 'PUT', body: declaration });
    await call(OWNER, `/knowledge/notebooks/${notebookId}/notes`, {
      method: 'POST',
      body: { folderId, content: '---\nname: Ata nova\n---\n\nEscrita depois.\n' },
    });
    await drainTrail();

    const history = await json<{
      changes: Array<{ type: string; name: string | null; agent: string | null; saves: number }>;
      truncated: boolean;
    }>(await call(OWNER, `/portability/models/${notebookId}/history`));
    expect(history.truncated).toBe(false);
    // The newest first: the note written last, by a person in the interface.
    expect(history.changes[0]).toEqual(
      expect.objectContaining({ type: 'NoteCreated', name: 'Ata nova', agent: null, saves: 1 }),
    );
    expect(history.changes.map((each) => each.type)).toEqual(
      expect.arrayContaining(['NotebookCreated', 'FolderAdded', 'NoteCreated']),
    );
  });

  it('refuses a declaration whose parameters are not ones', async () => {
    const refused = async (parameters: unknown[]) =>
      (
        await call(OWNER, `/portability/models/${notebookId}`, {
          method: 'PUT',
          body: { ...declaration, parameters },
        })
      ).status;
    expect(await refused([{ ...declaration.parameters[0], name: '123' }])).toBe(400);
    expect(await refused([declaration.parameters[0], { ...declaration.parameters[0] }])).toBe(400);
    expect(
      await refused([{ ...declaration.parameters[1], type: 'date', default: 'tomorrow' }]),
    ).toBe(400);
    expect(await refused([{ ...declaration.parameters[1], default: null }])).toBe(400);
  });

  it('goes with its notebook', async () => {
    await call(OWNER, `/portability/models/${notebookId}`, { method: 'PUT', body: declaration });
    expect(
      (await call(OWNER, `/knowledge/notebooks/${notebookId}`, { method: 'DELETE' })).status,
    ).toBe(204);
    expect((await call(OWNER, `/portability/models/${notebookId}`)).status).toBe(404);
    expect((await call(OWNER, `/portability/models/${notebookId}/contents`)).status).toBe(404);
    expect(
      (await json<{ models: unknown[] }>(await call(OWNER, '/portability/models'))).models,
    ).toEqual([]);
  });

  it('is the owner’s to declare, and a member reads it', async () => {
    await call(OWNER, `/portability/models/${notebookId}`, { method: 'PUT', body: declaration });
    // A member of the subscription, the way the only door that makes one
    // leaves it: an EDITOR (RN-ACC-002).
    harness.verifier.issue(MEMBER, {
      sub: 'user-member',
      email: 'member@example.com',
      subscription_id: subscriptionId,
      subscription_status: 'active',
    });
    const stored = harness.accessDb.subscriptions.get(`S#${subscriptionId}`);
    const member = UserId.create('user-member');
    const email = Email.create('member@example.com');
    if (!stored || !member.ok || !email.ok) throw new Error('Unreachable');
    stored.subscription.addMember(
      member.value,
      email.value,
      Role.EDITOR,
      null,
      Authorship.byHuman(member.value),
    );

    expect((await call(MEMBER, `/portability/models/${notebookId}`)).status).toBe(200);
    expect((await call(MEMBER, `/portability/models/${notebookId}/contents`)).status).toBe(200);
    expect((await call(MEMBER, `/portability/models/${notebookId}/history`)).status).toBe(200);
    expect(
      (
        await call(MEMBER, `/portability/models/${notebookId}`, {
          method: 'PUT',
          body: declaration,
        })
      ).status,
    ).toBe(403);
  });

  it('creates several independent notebooks from the notebook as it stands, each with its values (#359)', async () => {
    await call(OWNER, `/portability/models/${notebookId}`, { method: 'PUT', body: declaration });
    await call(OWNER, `/knowledge/notebooks/${notebookId}`, {
      method: 'PATCH',
      body: { name: 'Condomínio {{condomínio}}' },
    });

    const create = (values: Record<string, unknown>, name = '') =>
      call(OWNER, `/portability/models/${notebookId}/notebooks`, {
        method: 'POST',
        body: { name, values },
      });

    // A required parameter left out refuses the creation, naming it.
    const refused = await create({ síndico: 'Ana' });
    expect(refused.status).toBe(400);
    expect((await json<{ details?: { missing?: string[] } }>(refused)).details?.missing).toEqual([
      'condomínio',
    ]);

    for (const [condominium, manager] of [
      ['Aurora', 'Ana Lima'],
      ['Boreal', null],
    ] as const) {
      const started = await create({
        condomínio: condominium,
        ...(manager ? { síndico: manager } : {}),
      });
      expect(started.status).toBe(202);
      const transfer = await json<{ status: string; notebookId: string | null }>(started);
      expect(transfer.status).toBe('running');
    }

    const notebooks = await json<Array<{ notebookId: string; name: string }>>(
      await call(OWNER, '/knowledge/notebooks'),
    );
    const created = notebooks.filter((each) => each.notebookId !== notebookId);
    expect(created.map((each) => each.name).sort()).toEqual([
      'Condomínio Aurora',
      'Condomínio Boreal',
    ]);

    for (const each of created) {
      const notes = await json<Array<{ noteId: string; name: string }>>(
        await call(OWNER, `/knowledge/notebooks/${each.notebookId}/notes`),
      );
      expect(notes).toHaveLength(1);
      const note = await json<{ content: string }>(
        await call(OWNER, `/knowledge/notebooks/${each.notebookId}/notes/${notes[0]!.noteId}`),
      );
      expect(note.content).not.toContain('{{');
      if (each.name.endsWith('Aurora')) {
        expect(note.content).toContain('name: "Ata de exemplo de Aurora"');
        expect(note.content).toContain('Presidida por Ana Lima.');
      } else {
        expect(note.content).toContain('Presidida por a definir.');
      }
    }

    // Nothing of the creation is kept: the copy it read was an upload.
    expect(
      (
        await json<{ transfers: Array<{ kind: string }> }>(
          await call(OWNER, '/portability/transfers'),
        )
      ).transfers.filter((each) => each.kind === 'export'),
    ).toEqual([]);

    // Independent: the model goes, and they do not.
    await call(OWNER, `/knowledge/notebooks/${notebookId}`, { method: 'DELETE' });
    for (const each of created) {
      expect((await call(OWNER, `/knowledge/notebooks/${each.notebookId}`)).status).toBe(200);
    }
  });

  it('reports what its notebook writes and never declared', async () => {
    await call(OWNER, `/portability/models/${notebookId}`, {
      method: 'PUT',
      body: { ...declaration, parameters: [declaration.parameters[0]] },
    });
    const view = await json<{ references: { undeclared: string[]; unused: string[] } }>(
      await call(OWNER, `/portability/models/${notebookId}/contents`),
    );
    expect(view.references).toEqual({ undeclared: ['síndico'], unused: [] });
  });
});

describe('a model travels with its export (#397, RN-PRT-073)', () => {
  /** Exports the notebook whole and imports the archive in place, under a name of its own. */
  async function exportAndImport(token: string, name: string) {
    const started = await call(token, `/portability/notebooks/${notebookId}/export`, {
      method: 'POST',
    });
    const { transferId } = await json<{ transferId: string }>(started);
    const copied = await call(token, '/portability/imports/from-export', {
      method: 'POST',
      body: { transferId },
    });
    const { uploadKey } = await json<{ uploadKey: string }>(copied);
    const applied = await call(token, '/portability/imports/apply', {
      method: 'POST',
      body: { uploadKey, name },
    });
    const job = await json<{ transferId: string }>(applied);
    return json<{ status: string; notebookId: string }>(
      await call(token, `/portability/transfers/${job.transferId}`),
    );
  }

  it('arrives as a model, with what it declares, and creates notebooks as the first one did', async () => {
    await call(OWNER, `/portability/models/${notebookId}`, { method: 'PUT', body: declaration });

    const imported = await exportAndImport(OWNER, 'Condomínio modelo, trazido');
    expect(imported.status).toBe('ready');

    const model = await json<{ objective: string; parameters: Array<{ name: string }> }>(
      await call(OWNER, `/portability/models/${imported.notebookId}`),
    );
    expect(model.objective).toBe(declaration.objective);
    expect(model.parameters.map((each) => each.name)).toEqual(['condomínio', 'síndico']);

    const created = await call(OWNER, `/portability/models/${imported.notebookId}/notebooks`, {
      method: 'POST',
      body: { name: 'Residencial Aurora', values: { condomínio: 'Aurora' } },
    });
    expect(created.status).toBe(202);
  });

  it('leaves a notebook that is not a model exactly as it was', async () => {
    const imported = await exportAndImport(OWNER, 'Condomínio comum, trazido');
    expect(imported.status).toBe('ready');
    expect((await call(OWNER, `/portability/models/${imported.notebookId}`)).status).toBe(404);
  });

  it('is declared only by the owner: a member imports the notebook alone (RN-PRT-033)', async () => {
    await call(OWNER, `/portability/models/${notebookId}`, { method: 'PUT', body: declaration });
    harness.verifier.issue(MEMBER, {
      sub: 'user-member',
      email: 'member@example.com',
      subscription_id: subscriptionId,
      subscription_status: 'active',
    });
    const stored = harness.accessDb.subscriptions.get(`S#${subscriptionId}`);
    const member = UserId.create('user-member');
    const email = Email.create('member@example.com');
    if (!stored || !member.ok || !email.ok) throw new Error('Unreachable');
    stored.subscription.addMember(
      member.value,
      email.value,
      Role.EDITOR,
      null,
      Authorship.byHuman(member.value),
    );

    const imported = await exportAndImport(MEMBER, 'Condomínio do membro');
    expect(imported.status).toBe('ready');
    expect((await call(OWNER, `/portability/models/${imported.notebookId}`)).status).toBe(404);
  });
});

describe('the tables of a model (#366, RN-PRT-071)', () => {
  it('are read whole, with their rows (#405, RN-PRT-074)', async () => {
    await call(OWNER, `/knowledge/notebooks/${notebookId}/tables`, {
      method: 'POST',
      body: {
        name: 'gastos',
        schema: { type: 'object', properties: { valor: { type: 'number' } } },
      },
    });
    await call(OWNER, `/knowledge/notebooks/${notebookId}/tables/gastos/rows`, {
      method: 'POST',
      body: { rows: [{ valor: 10 }, { valor: 20 }] },
    });
    await call(OWNER, `/portability/models/${notebookId}`, { method: 'PUT', body: declaration });
    const contents = await json<{ tables: Array<{ name: string; rows: number }> }>(
      await call(OWNER, `/portability/models/${notebookId}/contents`),
    );
    expect(contents.tables).toEqual([expect.objectContaining({ name: 'gastos', rows: 2 })]);
  });

  it('go into a notebook created from it with their rows, the parameters filled in their names and descriptions only', async () => {
    await call(OWNER, `/knowledge/notebooks/${notebookId}/tables`, {
      method: 'POST',
      body: {
        name: 'fornecedores de {{condomínio}}',
        description: 'Quem atende o {{condomínio}}',
        schema: {
          type: 'object',
          properties: {
            nome: { type: 'string', description: 'O fornecedor do {{condomínio}}' },
            nota: { type: 'string' },
          },
        },
      },
    });
    await call(
      OWNER,
      `/knowledge/notebooks/${notebookId}/tables/${encodeURIComponent('fornecedores de {{condomínio}}')}/rows`,
      {
        method: 'POST',
        body: { rows: [{ nome: 'Elétrica Silva', nota: 'atende {{condomínio}} desde 2020' }] },
      },
    );
    await call(OWNER, `/portability/models/${notebookId}`, { method: 'PUT', body: declaration });

    await call(OWNER, `/portability/models/${notebookId}/notebooks`, {
      method: 'POST',
      body: { name: 'Aurora', values: { condomínio: 'Aurora' } },
    });
    const created = (
      await json<Array<{ notebookId: string; name: string }>>(
        await call(OWNER, '/knowledge/notebooks'),
      )
    ).find((each) => each.name === 'Aurora');
    const tables = await json<{
      tables: Array<{ name: string; description: string; schema: Record<string, unknown> }>;
    }>(await call(OWNER, `/knowledge/notebooks/${created?.notebookId}/tables`));
    expect(tables.tables[0]?.name).toBe('fornecedores de Aurora');
    expect(tables.tables[0]?.description).toBe('Quem atende o Aurora');
    expect(
      (tables.tables[0]?.schema['properties'] as Record<string, { description?: string }>)['nome']
        ?.description,
    ).toBe('O fornecedor do Aurora');
    const page = await json<{ rows: Array<{ values: Record<string, unknown> }> }>(
      await call(
        OWNER,
        `/knowledge/notebooks/${created?.notebookId}/tables/${encodeURIComponent('fornecedores de Aurora')}/query`,
        {
          method: 'POST',
          body: {},
        },
      ),
    );
    expect(page.rows[0]?.values['nota']).toBe('atende {{condomínio}} desde 2020');
  });
});
