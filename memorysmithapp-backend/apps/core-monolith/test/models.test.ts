/**
 * Notebook models (#353): a notebook declared as a model by the owner of its
 * subscription, frozen into numbered versions that never change, read whole
 * before they are distributed, and gone with the notebook they came from.
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

describe('a notebook model (#353)', () => {
  it('is declared by the owner, with its parameters, and creates numbered versions', async () => {
    const declared = await call(OWNER, `/portability/models/${notebookId}`, {
      method: 'PUT',
      body: declaration,
    });
    expect(declared.status).toBe(200);

    const first = await call(OWNER, `/portability/models/${notebookId}/versions`, {
      method: 'POST',
      body: { changelog: 'The first version' },
    });
    expect(first.status).toBe(202);
    expect((await json<{ number: number }>(first)).number).toBe(1);
    const second = await call(OWNER, `/portability/models/${notebookId}/versions`, {
      method: 'POST',
      body: { changelog: 'Suppliers' },
    });
    expect((await json<{ number: number }>(second)).number).toBe(2);

    const model = await json<{
      objective: string;
      parameters: Array<{ name: string; required: boolean; default: unknown }>;
      versions: Array<{ number: number; status: string; changelog: string }>;
    }>(await call(OWNER, `/portability/models/${notebookId}`));
    expect(model.objective).toBe(declaration.objective);
    expect(model.parameters.map((each) => [each.name, each.required, each.default])).toEqual([
      ['condomínio', true, null],
      ['síndico', false, 'a definir'],
    ]);
    expect(model.versions.map((each) => [each.number, each.status, each.changelog])).toEqual([
      [2, 'ready', 'Suppliers'],
      [1, 'ready', 'The first version'],
    ]);

    // A version is the owner's, but not a transfer of theirs to look after.
    const transfers = await json<{ transfers: unknown[] }>(
      await call(OWNER, '/portability/transfers'),
    );
    expect(transfers.transfers).toEqual([]);

    const listed = await json<{ models: Array<{ notebookId: string; name: string }> }>(
      await call(OWNER, '/portability/models'),
    );
    expect(listed.models).toEqual([
      expect.objectContaining({ notebookId, name: 'Condomínio modelo' }),
    ]);
  });

  it('keeps a version as it was, whatever the notebook becomes afterwards', async () => {
    await call(OWNER, `/portability/models/${notebookId}`, { method: 'PUT', body: declaration });
    await call(OWNER, `/portability/models/${notebookId}/versions`, { method: 'POST', body: {} });
    await call(OWNER, `/knowledge/notebooks/${notebookId}/notes`, {
      method: 'POST',
      body: { folderId, content: '---\nname: Ata nova\n---\n\nEscrita depois.\n' },
    });

    const view = await json<{
      version: { number: number };
      parameters: Array<{ name: string }>;
      notebook: { name: string };
      folders: Array<{ name: string }>;
      notes: Array<{ body: string }>;
    }>(await call(OWNER, `/portability/models/${notebookId}/versions/1`));
    expect(view.version.number).toBe(1);
    expect(view.notebook.name).toBe('Condomínio modelo');
    expect(view.folders.map((each) => each.name)).toEqual(['Assembleias']);
    expect(view.notes).toHaveLength(1);
    expect(view.notes[0]?.body).toContain('{{síndico}}');
    expect(view.parameters.map((each) => each.name)).toEqual(['condomínio', 'síndico']);
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

  it('deletes a version, and the model and all of them with the notebook', async () => {
    await call(OWNER, `/portability/models/${notebookId}`, { method: 'PUT', body: declaration });
    await call(OWNER, `/portability/models/${notebookId}/versions`, { method: 'POST', body: {} });
    await call(OWNER, `/portability/models/${notebookId}/versions`, { method: 'POST', body: {} });
    expect(
      (await call(OWNER, `/portability/models/${notebookId}/versions/1`, { method: 'DELETE' }))
        .status,
    ).toBe(204);
    const model = await json<{ versions: Array<{ number: number }> }>(
      await call(OWNER, `/portability/models/${notebookId}`),
    );
    expect(model.versions.map((each) => each.number)).toEqual([2]);

    expect(
      (await call(OWNER, `/knowledge/notebooks/${notebookId}`, { method: 'DELETE' })).status,
    ).toBe(204);
    expect((await call(OWNER, `/portability/models/${notebookId}`)).status).toBe(404);
    expect(
      (await json<{ models: unknown[] }>(await call(OWNER, '/portability/models'))).models,
    ).toEqual([]);
  });

  it('is the owner’s to declare and version, and a member reads it', async () => {
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
    expect(
      (
        await call(MEMBER, `/portability/models/${notebookId}`, {
          method: 'PUT',
          body: declaration,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call(MEMBER, `/portability/models/${notebookId}/versions`, {
          method: 'POST',
          body: {},
        })
      ).status,
    ).toBe(403);
  });

  it('creates several independent notebooks from one private version, each with its values (#359)', async () => {
    await call(OWNER, `/portability/models/${notebookId}`, { method: 'PUT', body: declaration });
    await call(OWNER, `/knowledge/notebooks/${notebookId}`, {
      method: 'PATCH',
      body: { name: 'Condomínio {{condomínio}}' },
    });
    await call(OWNER, `/portability/models/${notebookId}/versions`, { method: 'POST', body: {} });

    const create = (values: Record<string, unknown>, name = '') =>
      call(OWNER, `/portability/models/${notebookId}/versions/1/notebooks`, {
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

    // Independent: the model changes and loses its version, and they do not.
    await call(OWNER, `/portability/models/${notebookId}/versions/1`, { method: 'DELETE' });
    await call(OWNER, `/knowledge/notebooks/${notebookId}`, { method: 'DELETE' });
    for (const each of created) {
      expect((await call(OWNER, `/knowledge/notebooks/${each.notebookId}`)).status).toBe(200);
    }
  });

  it('reports what a version writes and never declared', async () => {
    await call(OWNER, `/portability/models/${notebookId}`, {
      method: 'PUT',
      body: { ...declaration, parameters: [declaration.parameters[0]] },
    });
    await call(OWNER, `/portability/models/${notebookId}/versions`, { method: 'POST', body: {} });
    const view = await json<{ references: { undeclared: string[]; unused: string[] } }>(
      await call(OWNER, `/portability/models/${notebookId}/versions/1`),
    );
    expect(view.references).toEqual({ undeclared: ['síndico'], unused: [] });
  });
});
