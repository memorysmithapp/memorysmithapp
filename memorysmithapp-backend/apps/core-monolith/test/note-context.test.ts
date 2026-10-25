/**
 * A note written against a context that changed (#348): the Guidance, the
 * Template of its folder and the structure of the notebook, each by its
 * revision. The context is advisory: the write is saved, its answer says what
 * changed, and the listing marks the note until it is written again against
 * the current context. Nothing is refused, and nothing is recorded for a write
 * that declares nothing.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from './wiring.js';

type App = ReturnType<typeof buildTestApp>;
let harness: App;
let notebookId: string;
let folderId: string;

const TOKEN = 'token-owner';

async function call(path: string, init: { method?: string; body?: unknown } = {}) {
  return harness.app.request(path, {
    method: init.method ?? 'GET',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

interface Context {
  guidance: string | null;
  template: string | null;
  structure: string;
}

/** The context a caller reads before writing in the folder. */
async function read(folder = folderId): Promise<Context> {
  const detail = await json<{
    guidance: { revision: { versionId: string } } | null;
    structureRevision: string;
  }>(await call(`/knowledge/notebooks/${notebookId}`));
  const template = await call(`/knowledge/notebooks/${notebookId}/folders/${folder}/template`);
  // A folder with no Template answers its content as null, and no revision.
  const templateRevision =
    (await json<{ revision?: { versionId: string } }>(template)).revision?.versionId ?? null;
  return {
    guidance: detail.guidance?.revision.versionId ?? null,
    template: templateRevision,
    structure: detail.structureRevision,
  };
}

async function setGuidance(content: string): Promise<void> {
  const current = await read();
  const written = await call(`/knowledge/notebooks/${notebookId}/guidance`, {
    method: 'PUT',
    body: { content, baseRevision: current.guidance },
  });
  expect(written.status).toBeLessThan(300);
}

async function setTemplate(content: string, folder = folderId): Promise<void> {
  const current = await read(folder);
  const written = await call(`/knowledge/notebooks/${notebookId}/folders/${folder}/template`, {
    method: 'PUT',
    body: { content, baseRevision: current.template },
  });
  expect(written.status).toBeLessThan(300);
}

async function createNote(name: string, context?: Context) {
  return call(`/knowledge/notebooks/${notebookId}/notes`, {
    method: 'POST',
    body: {
      folderId,
      content: `---\nname: ${name}\n---\n\n# ${name}\n`,
      ...(context ? { context } : {}),
    },
  });
}

async function listed(): Promise<Array<{ noteId: string; name: string; staleContext?: string[] }>> {
  const answer = await json<
    | { notes: Array<{ noteId: string; name: string; staleContext?: string[] }> }
    | Array<{ noteId: string; name: string; staleContext?: string[] }>
  >(await call(`/knowledge/notebooks/${notebookId}/notes`));
  return Array.isArray(answer) ? answer : answer.notes;
}

beforeEach(async () => {
  harness = buildTestApp();
  harness.verifier.issue(TOKEN, { sub: 'user-owner', email: 'owner@example.com' });
  const created = await call('/access/subscriptions', { method: 'POST', body: {} });
  const { subscriptionId } = await json<{ subscriptionId: string }>(created);
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
    await json<{ notebookId: string }>(
      await call('/knowledge/notebooks', {
        method: 'POST',
        body: { name: 'Obras', description: 'Uma obra por nota' },
      }),
    )
  ).notebookId;
  folderId = (
    await json<{ folderId: string }>(
      await call(`/knowledge/notebooks/${notebookId}/folders`, {
        method: 'POST',
        body: { name: 'Visitas', description: 'Uma visita por nota.' },
      }),
    )
  ).folderId;
  await setGuidance('# Obras\n\nUma nota por visita.');
  await setTemplate('# Visita\n\n## O que se viu');
});

describe('a note written against its context (#348)', () => {
  it('answers nothing more when the context it read is the current one', async () => {
    const created = await createNote('Visita 1', await read());
    expect(created.status).toBe(201);
    expect((await json<{ contextChanged?: unknown }>(created)).contextChanged).toBeUndefined();
    expect((await listed())[0]?.staleContext).toBeUndefined();
  });

  it('saves a note written after the Guidance changed, says so, and marks it', async () => {
    const before = await read();
    await setGuidance('# Obras\n\nUma nota por visita, com fotos.');

    const created = await createNote('Visita 2', before);
    expect(created.status).toBe(201);
    const answer = await json<{
      noteId: string;
      contextChanged?: { changed: string[]; current: Context };
    }>(created);
    expect(answer.contextChanged?.changed).toEqual(['guidance']);
    expect(answer.contextChanged?.current).toEqual(await read());
    expect((await listed()).find((note) => note.noteId === answer.noteId)?.staleContext).toEqual([
      'guidance',
    ]);

    // Written again against the current context, the mark goes.
    const note = await json<{ revision: { versionId: string } }>(
      await call(`/knowledge/notebooks/${notebookId}/notes/${answer.noteId}`),
    );
    const updated = await call(`/knowledge/notebooks/${notebookId}/notes/${answer.noteId}`, {
      method: 'PUT',
      body: {
        content: '---\nname: Visita 2\n---\n\n# Visita 2\n\nCom fotos.\n',
        baseRevision: note.revision.versionId,
        context: await read(),
      },
    });
    expect(updated.status).toBe(200);
    expect((await json<{ contextChanged?: unknown }>(updated)).contextChanged).toBeUndefined();
    expect(
      (await listed()).find((each) => each.noteId === answer.noteId)?.staleContext,
    ).toBeUndefined();
  });

  it('names the Template of the folder, and the structure, when those changed', async () => {
    const before = await read();
    await setTemplate('# Visita\n\n## O que se viu\n\n## Fotos');
    await call(`/knowledge/notebooks/${notebookId}/folders`, {
      method: 'POST',
      body: { name: 'Orçamentos', description: 'Um orçamento por nota.' },
    });
    const created = await createNote('Visita 3', before);
    expect(
      (await json<{ contextChanged?: { changed: string[] } }>(created)).contextChanged?.changed,
    ).toEqual(['template', 'structure']);
  });

  it('records nothing for a write that declares nothing', async () => {
    const before = await read();
    await setGuidance('# Obras\n\nOutra orientação.');
    const created = await createNote('Visita 4');
    expect(created.status).toBe(201);
    expect((await json<{ contextChanged?: unknown }>(created)).contextChanged).toBeUndefined();
    expect((await listed())[0]?.staleContext).toBeUndefined();
    void before;
  });

  it('does not mark a note written before a later change of the context', async () => {
    await createNote('Visita 5', await read());
    await setGuidance('# Obras\n\nUma orientação mais nova.');
    expect((await listed())[0]?.staleContext).toBeUndefined();
  });

  it('refuses a context that is not one, saving nothing', async () => {
    const refused = await call(`/knowledge/notebooks/${notebookId}/notes`, {
      method: 'POST',
      body: {
        folderId,
        content: '---\nname: Visita 6\n---\n',
        context: { guidance: 1 },
      },
    });
    expect(refused.status).toBe(400);
    expect(await listed()).toEqual([]);
  });
});
