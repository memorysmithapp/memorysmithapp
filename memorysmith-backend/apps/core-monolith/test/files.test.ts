/**
 * What a notebook keeps beside its notes, end to end over HTTP (#166).
 *
 * The three rules that run before a byte is stored are here, because each one
 * is a refusal somebody will meet: the type is on the list, the bytes support
 * the type they were declared under, and the notebook holds one file of each
 * name. And the one thing this feature exists for: the name addresses, the
 * path organises, and the extension decides nothing at all.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from './wiring.js';
import { fileListSchema, notebookFileSchema } from '@memorysmith/contracts';

type App = ReturnType<typeof buildTestApp>;
let harness: App;

const TOKEN = 'token-owner';

/** A PNG of one pixel: the signature is what the check reads, not the picture. */
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]).toString('base64');
const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n').toString('base64');
const HTML = Buffer.from('<!doctype html><script>alert(1)</script>').toString('base64');

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
  const notebook = (await (
    await call('/knowledge/notebooks', {
      method: 'POST',
      body: { name: 'Caderno com anexos', description: 'Notas e o que elas mostram' },
    })
  ).json()) as { notebookId: string };
  return notebook.notebookId;
}

const keep = async (notebookId: string, body: Record<string, unknown>): Promise<Response> =>
  call(`/knowledge/notebooks/${notebookId}/files`, { method: 'POST', body });

describe('a notebook keeps files', () => {
  it('keeps one under the name it was given, with no extension anywhere', async () => {
    const notebookId = await seedNotebook();

    const response = await keep(notebookId, {
      name: 'esquema de blocos',
      description: 'O desenho que a nota da arquitetura mostra',
      mimeType: 'image/png',
      tags: ['arquitetura', 'desenho'],
      path: '/desenhos/arquitetura',
      contentBase64: PNG,
    });
    expect(response.status).toBe(201);

    const file = notebookFileSchema.parse(await response.json());
    expect(file.name).toBe('esquema de blocos');
    expect(file.mimeType).toBe('image/png');
    expect(file.tags).toEqual(['arquitetura', 'desenho']);
    // Written `/desenhos/arquitetura`, kept exactly so: the path organises.
    expect(file.path).toBe('/desenhos/arquitetura');
    expect(file.bytes).toBeGreaterThan(0);

    const listed = fileListSchema.parse(
      await (await call(`/knowledge/notebooks/${notebookId}/files`)).json(),
    );
    expect(listed.files.map((each) => each.name)).toEqual(['esquema de blocos']);
  });

  it('normalises a path the way a path is written, and keeps a file at the root', async () => {
    const notebookId = await seedNotebook();

    const nested = notebookFileSchema.parse(
      await (
        await keep(notebookId, {
          name: 'primeiro',
          mimeType: 'application/pdf',
          path: 'pasta//sub/ ',
          contentBase64: PDF,
        })
      ).json(),
    );
    expect(nested.path).toBe('/pasta/sub');

    const root = notebookFileSchema.parse(
      await (
        await keep(notebookId, { name: 'segundo', mimeType: 'application/pdf', contentBase64: PDF })
      ).json(),
    );
    expect(root.path).toBe('/');
  });

  it('refuses a type that is not on the list, naming what is', async () => {
    const notebookId = await seedNotebook();

    const response = await keep(notebookId, {
      name: 'planilha antiga',
      mimeType: 'application/vnd.ms-excel',
      contentBase64: PDF,
    });
    expect(response.status).toBe(400);
    const { message } = (await response.json()) as { message: string };
    expect(message).toContain('image/png');
    expect(message).toContain('application/pdf');
  });

  it('refuses bytes that do not support the type they arrived under', async () => {
    const notebookId = await seedNotebook();

    // The whole reason the check exists: a page kept as a picture is harmless
    // until something decides to serve it as what it is.
    const response = await keep(notebookId, {
      name: 'inocente',
      mimeType: 'image/png',
      contentBase64: HTML,
    });
    expect(response.status).toBe(400);
    expect(((await response.json()) as { message: string }).message).toContain('image/png');
  });

  it('holds one file of each name, and says which one holds it', async () => {
    const notebookId = await seedNotebook();
    const first = notebookFileSchema.parse(
      await (
        await keep(notebookId, { name: 'diagrama', mimeType: 'image/png', contentBase64: PNG })
      ).json(),
    );

    // Another type, another path, the same name: still the same name.
    const second = await keep(notebookId, {
      name: 'diagrama',
      mimeType: 'application/pdf',
      path: '/outra',
      contentBase64: PDF,
    });
    expect(second.status).toBe(409);
    const refusal = (await second.json()) as { message: string; conflictingId?: string };
    expect(refusal.message).toContain('diagrama');
    expect(refusal.conflictingId ?? first.fileId).toBe(first.fileId);
  });

  it('answers a link a browser can follow, and stops answering one once the file is deleted', async () => {
    const notebookId = await seedNotebook();
    const file = notebookFileSchema.parse(
      await (
        await keep(notebookId, {
          name: 'gravacao',
          mimeType: 'application/pdf',
          contentBase64: PDF,
        })
      ).json(),
    );

    const link = (await (
      await call(`/knowledge/notebooks/${notebookId}/files/${file.fileId}/link`)
    ).json()) as { url: string; expiresAt: string };
    expect(link.url.length).toBeGreaterThan(0);
    expect(Date.parse(link.expiresAt)).toBeGreaterThan(Date.now());

    const deleted = await call(`/knowledge/notebooks/${notebookId}/files/${file.fileId}`, {
      method: 'DELETE',
    });
    expect(deleted.status).toBe(204);

    // Definitive: it leaves the listing at once, and its name is free again.
    const listed = fileListSchema.parse(
      await (await call(`/knowledge/notebooks/${notebookId}/files`)).json(),
    );
    expect(listed.files).toEqual([]);
    expect(
      (await call(`/knowledge/notebooks/${notebookId}/files/${file.fileId}/link`)).status,
    ).toBe(404);
    expect(
      (await keep(notebookId, { name: 'gravacao', mimeType: 'image/png', contentBase64: PNG }))
        .status,
    ).toBe(201);
  });

  it('answers not found for a notebook the session cannot see', async () => {
    const notebookId = await seedNotebook();
    harness.verifier.issue('token-stranger', {
      sub: 'user-stranger',
      email: 'stranger@example.com',
    });

    const response = await harness.app.request(`/knowledge/notebooks/${notebookId}/files`, {
      headers: { authorization: 'Bearer token-stranger' },
    });
    // Never 403: a refusal would confirm the notebook exists (rule 9).
    expect(response.status).toBe(404);
  });
});
