/**
 * The whole flow of a notebook model (#361), across two people, their agents
 * and the public catalog, against the deployed environment: a regulated-domain
 * model with parameters, examples and a file, frozen into versions; notebooks
 * created from it, read and written as any other; shared with a named person
 * as a model reader and as an editor; published, found and used by that person
 * as a stranger would, derived and republished without credit, and withdrawn.
 * Storage is counted once for the author and once per created notebook, and
 * never for access.
 */

import { expect, test } from '@playwright/test';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { randomBytes } from 'node:crypto';
import { apiToken } from '../support/accounts.js';
import { Api } from '../support/api.js';
import { readConnectorToken } from '../support/connector-state.js';
import { eventually } from '../support/eventually.js';
import { callTool, connectAgent, parsed } from '../support/mcp.js';
import { readState } from '../support/state.js';

interface Usage {
  usedBytes: number;
  byType: { exports: { bytes: number } };
  notebooks: Array<{ notebookId: string; bytes: number }>;
}

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="#0f56d7"/></svg>';

/**
 * What one notebook occupies in a subscription, read from its usage. The run
 * writes in the same accounts from other cases at once, so the totals move
 * under any journey; a notebook's own line moves only with that notebook.
 */
async function bytesOf(api: Api, notebookId: string): Promise<number | null> {
  const usage = await api.ok<Usage>('GET', '/access/usage');
  return usage.notebooks.find((each) => each.notebookId === notebookId)?.bytes ?? null;
}

async function readyVersion(api: Api, notebookId: string, number: number): Promise<void> {
  await eventually(
    `version ${number} to be built`,
    () =>
      api.ok<{ versions: Array<{ number: number; status: string }> }>(
        'GET',
        `/portability/models/${notebookId}`,
      ),
    (model) => model.versions.some((each) => each.number === number && each.status === 'ready'),
    { timeoutMs: 120_000 },
  );
}

/** Every note of a notebook, whole, as an agent reads them. */
async function notesOf(agent: Client, notebook: string): Promise<string> {
  const listed = parsed<{ notes: Array<{ noteId: string }> }>(
    await callTool(agent, 'list_notes', { notebook }),
  );
  const bodies: string[] = [];
  for (const note of listed.notes) {
    bodies.push(
      parsed<{ content: string }>(
        await callTool(agent, 'read_note', { notebook, note: note.noteId }),
      ).content,
    );
  }
  return bodies.join('\n---\n');
}

test('a regulated-domain model goes from its author to a named person and to the community, and back (#361)', async () => {
  test.setTimeout(600_000);
  const state = readState();
  const owner = new Api(state.surfaces.api, await apiToken(state, state.accounts.owner));
  const other = new Api(state.surfaces.api, await apiToken(state, state.accounts.other));
  const ownerAgent = await connectAgent(
    state.surfaces.mcp,
    readConnectorToken('owner').accessToken,
  );
  const otherAgent = await connectAgent(
    state.surfaces.mcp,
    readConnectorToken('other').accessToken,
  );
  const otherUser = (await other.ok<{ user: { userId: string } }>('GET', '/access/session')).user
    .userId;
  for (const [api, name] of [
    [owner, 'Ana Pereira'],
    [other, 'Bruno Costa'],
  ] as const) {
    const profile = await api.ok<{ name: string; email: string }>('GET', '/access/profile');
    if (!profile.name.trim() || profile.name === profile.email) {
      await api.ok('PUT', '/access/profile', { name, avatar: 'initials' });
    }
  }

  const marker = randomBytes(4).toString('hex');
  const toDelete: Array<[Api, string]> = [];
  try {
    // ---- The model: a procurement notebook, generalised by parameters ------
    const model = parsed<{ notebookId: string }>(
      await callTool(ownerAgent, 'create_notebook', {
        name: `Licitações ${marker} {{orgao}}`,
        description: 'Acompanhamento das licitações de {{orgao}}',
      }),
    ).notebookId;
    toDelete.push([owner, model]);
    await callTool(ownerAgent, 'set_guidance', {
      notebook: model,
      content:
        '# Orientação\n\nEste caderno acompanha as licitações de {{orgao}} sob a Lei 14.133. Uma nota por edital, com prazo e situação.\n',
      baseRevision: null,
    });
    const folder = parsed<{ folderId: string }>(
      await callTool(ownerAgent, 'create_folder', {
        notebook: model,
        name: 'Editais',
        description: 'Um edital por nota, de {{orgao}}.',
      }),
    ).folderId;
    await callTool(ownerAgent, 'set_template', {
      notebook: model,
      folder,
      content: '---\nsituacao: aberto\n---\n\n## Objeto\n\n## Prazo\n',
      baseRevision: null,
    });
    await callTool(ownerAgent, 'create_note', {
      notebook: model,
      folder,
      content:
        '---\nname: Edital de exemplo\norgao: "{{orgao}}"\nmodalidades: {{modalidades}}\neletronico: {{eletronico}}\nabertura: {{abertura}}\n---\n\n## Objeto\n\nCompra de material por {{orgao}}, ver [[Glossário de {{orgao}}]].\n\n![[organograma]]\n',
    });
    await callTool(ownerAgent, 'create_note', {
      notebook: model,
      folder,
      content: '---\nname: Glossário de {{orgao}}\n---\n\nTermos usados por {{orgao}}.\n',
    });
    expect(
      (
        await callTool(ownerAgent, 'keep_file', {
          notebook: model,
          name: 'organograma',
          mimeType: 'image/svg+xml',
          content: SVG,
        })
      ).isError,
    ).toBe(false);
    expect(
      (
        await callTool(ownerAgent, 'declare_model', {
          notebook: model,
          objective: 'Acompanhar as licitações de um órgão público sob a Lei 14.133',
          audience: 'Analistas de compras públicas',
          parameters: [
            {
              name: 'orgao',
              description: 'O órgão',
              example: 'Prefeitura de Itu',
              type: 'text',
              required: true,
            },
            {
              name: 'modalidades',
              description: 'As modalidades acompanhadas',
              type: 'list',
              required: false,
              default: ['pregão'],
            },
            {
              name: 'eletronico',
              description: 'Se é eletrônico',
              type: 'boolean',
              required: false,
              default: true,
            },
            { name: 'abertura', description: 'Desde quando', type: 'date', required: true },
          ],
        })
      ).isError,
    ).toBe(false);

    await callTool(ownerAgent, 'create_model_version', {
      notebook: model,
      changelog: 'Primeira versão',
    });
    await readyVersion(owner, model, 1);
    const version = parsed<{
      references: { undeclared: string[]; unused: string[] };
      files: unknown[];
    }>(await callTool(ownerAgent, 'read_model_version', { notebook: model, version: 1 }));
    expect(version.references).toEqual({ undeclared: [], unused: [] });
    expect(version.files).toHaveLength(1);
    // The version counts once in the author's storage, as a kept export.
    // The version is counted once, with its author, as a kept export of its size.
    const counted = await owner.ok<{ versions: Array<{ number: number; bytes: number }> }>(
      'GET',
      `/portability/models/${model}`,
    );
    expect(counted.versions.find((each) => each.number === 1)?.bytes).toBeGreaterThan(0);

    // ---- Two independent notebooks of the author, each with its values ------
    const fromOwn: string[] = [];
    for (const orgao of ['Prefeitura de Itu', 'Câmara de Sorocaba']) {
      const answer = parsed<{ notebook?: string; status: string }>(
        await callTool(ownerAgent, 'create_notebook_from_model', {
          notebook: model,
          version: 1,
          values: { orgao, abertura: '2026-01-15', modalidades: ['pregão', 'concorrência'] },
        }),
      );
      expect(answer.status).toBe('ready');
      fromOwn.push(answer.notebook ?? '');
      toDelete.push([owner, answer.notebook ?? '']);
    }
    const itu = await notesOf(ownerAgent, fromOwn[0] ?? '');
    expect(itu).toContain('orgao: "Prefeitura de Itu"');
    expect(itu).toContain('modalidades: ["pregão", "concorrência"]');
    expect(itu).toContain('eletronico: true');
    expect(itu).toContain('abertura: 2026-01-15');
    expect(itu).toContain('[[Glossário de Prefeitura de Itu]]');
    expect(itu).not.toContain('{{');
    expect(await notesOf(ownerAgent, fromOwn[1] ?? '')).toContain('Câmara de Sorocaba');
    const ituDetail = await owner.ok<{
      name: string;
      folders: Array<{ folderId: string; description: string }>;
    }>('GET', `/knowledge/notebooks/${fromOwn[0]}`);
    expect(ituDetail.name).toBe(`Licitações ${marker} Prefeitura de Itu`);
    expect(ituDetail.folders[0]?.description).toBe('Um edital por nota, de Prefeitura de Itu.');
    // Read and written as any notebook: a note, and the link it fills resolves.
    expect(
      (
        await callTool(ownerAgent, 'create_note', {
          notebook: fromOwn[0],
          folder: ituDetail.folders[0]?.folderId,
          content: '---\nname: Pregão 12/2026\nsituacao: aberto\n---\n\n## Objeto\n\nCadeiras.\n',
        })
      ).isError,
    ).toBe(false);
    const files = await callTool(ownerAgent, 'list_files', { notebook: fromOwn[0] });
    expect(files.text).toContain('organograma');

    // The model changes; the notebooks made from it do not.
    await callTool(ownerAgent, 'create_note', {
      notebook: model,
      folder,
      content: '---\nname: Contratos de {{orgao}}\n---\n\nOs contratos.\n',
    });
    await callTool(ownerAgent, 'create_model_version', { notebook: model, changelog: 'Contratos' });
    await readyVersion(owner, model, 2);
    expect(await notesOf(ownerAgent, fromOwn[0] ?? '')).not.toContain('Contratos de');

    // ---- Shared with a named person, as a model reader -----------------------
    const shares = `/access/notebooks/${model}/shares`;
    const modelBytes = await bytesOf(owner, model);
    expect(modelBytes).toBeGreaterThan(0);
    await owner.ok('POST', shares, {
      email: state.accounts.other.email,
      profile: 'model-reader',
      acceptLicence: true,
    });
    await other.ok('POST', `/access/shared/${model}/accept`);
    // Sharing and accepting move nothing: the model stays counted once, with its author.
    expect(await bytesOf(owner, model)).toBe(modelBytes);
    expect(await bytesOf(other, model)).toBeNull();
    expect((await callTool(otherAgent, 'list_models')).text).toContain(model);
    expect((await callTool(otherAgent, 'get_notebook_context', { notebook: model })).isError).toBe(
      true,
    );
    const sharedCopy = parsed<{ notebook?: string; status: string }>(
      await callTool(otherAgent, 'create_notebook_from_model', {
        notebook: model,
        version: 2,
        values: { orgao: 'Prefeitura de Salto', abertura: '2026-03-01' },
      }),
    );
    expect(sharedCopy.status).toBe('ready');
    toDelete.push([other, sharedCopy.notebook ?? '']);
    await eventually(
      'the copy to be counted in the subscription of whoever made it',
      () => bytesOf(other, sharedCopy.notebook ?? ''),
      (bytes) => (bytes ?? 0) > 0,
    );
    expect(await bytesOf(owner, sharedCopy.notebook ?? '')).toBeNull();

    // ---- The same person as an editor of the model notebook -----------------
    await owner.ok('PUT', `${shares}/${otherUser}/profile`, { profile: 'notebook-editor' });
    await other.ok('POST', `/access/shared/${model}/increase/accept`);
    expect(
      (
        await callTool(otherAgent, 'create_note', {
          notebook: model,
          folder,
          content: '---\nname: Atas de {{orgao}}\n---\n\nAs atas.\n',
        })
      ).isError,
    ).toBe(false);
    expect(
      (await callTool(otherAgent, 'create_model_version', { notebook: model, changelog: 'Minha' }))
        .isError,
    ).toBe(true);
    await owner.ok('DELETE', `${shares}/${otherUser}`);

    // ---- Published, found and used as a stranger would ----------------------
    const publishingBytes = await bytesOf(owner, model);
    const versionsBefore = (
      await owner.ok<{ versions: unknown[] }>('GET', `/portability/models/${model}`)
    ).versions.length;
    const published = parsed<{ publicId: string }>(
      await callTool(ownerAgent, 'publish_model', {
        notebook: model,
        language: 'pt-BR',
        acceptLicence: true,
      }),
    );
    // Publishing copies nothing: the notebook and its versions are as they were.
    expect(await bytesOf(owner, model)).toBe(publishingBytes);
    const found = await eventually(
      'the model to be found in the community',
      async () =>
        parsed<{ models: Array<{ publicId: string; versions: Array<{ number: number }> }> }>(
          await callTool(otherAgent, 'search_community_models', {
            query: `licitações ${marker}`,
            language: 'pt',
          }),
        ),
      (answer) => answer.models.length > 0,
    );
    expect(found.models[0]?.publicId).toBe(published.publicId);
    expect(found.models[0]?.versions.map((each) => each.number)).toEqual([2, 1]);
    const anonymous = await fetch(`${state.surfaces.api}/public/catalog/${published.publicId}`);
    expect(anonymous.status).toBe(200);
    expect(await anonymous.text()).not.toContain(state.accounts.owner.email);
    const community = parsed<{ notebook?: string; status: string }>(
      await callTool(otherAgent, 'create_notebook_from_community_model', {
        model: published.publicId,
        version: 2,
        values: { orgao: 'Prefeitura de Indaiatuba', abertura: '2026-04-01' },
      }),
    );
    expect(community.status).toBe('ready');
    const strangerCopy = community.notebook ?? '';
    toDelete.push([other, strangerCopy]);

    // Derived and republished by that person, with no credit; the original stays.
    await callTool(otherAgent, 'declare_model', {
      notebook: strangerCopy,
      objective: 'Licitações de uma prefeitura do interior',
      parameters: [],
      basedOn: null,
    });
    await callTool(otherAgent, 'create_model_version', {
      notebook: strangerCopy,
      changelog: 'Derivado',
    });
    await readyVersion(other, strangerCopy, 1);
    const derived = parsed<{ publicId: string; author: string; basedOn: string | null }>(
      await callTool(otherAgent, 'publish_model', {
        notebook: strangerCopy,
        language: 'pt-BR',
        acceptLicence: true,
      }),
    );
    expect(derived.basedOn).toBeNull();
    const original = parsed<{ versions: Array<{ number: number }>; author: string }>(
      await callTool(otherAgent, 'read_community_model', { model: published.publicId }),
    );
    expect(original.versions.map((each) => each.number)).toEqual([2, 1]);
    expect(original.author).not.toBe(derived.author);

    // ---- Withdrawn: gone from the catalog, nothing created from it touched ---
    expect((await callTool(ownerAgent, 'withdraw_model', { notebook: model })).isError).toBe(false);
    expect((await fetch(`${state.surfaces.api}/public/catalog/${published.publicId}`)).status).toBe(
      404,
    );
    expect(await bytesOf(owner, model)).toBe(publishingBytes);
    expect(
      (await owner.ok<{ versions: unknown[] }>('GET', `/portability/models/${model}`)).versions,
    ).toHaveLength(versionsBefore);
    expect(await notesOf(otherAgent, strangerCopy)).toContain('Prefeitura de Indaiatuba');
    await callTool(otherAgent, 'withdraw_model', { notebook: strangerCopy });
  } finally {
    for (const [api, notebook] of toDelete.reverse()) {
      if (notebook) await api.call('DELETE', `/knowledge/notebooks/${notebook}`);
    }
    await ownerAgent.close();
    await otherAgent.close();
  }
});
