/**
 * A file an agent asks the person for, end to end over HTTP (#253, RN-PRT-030).
 *
 * The cases follow what happens when an agent cannot send a file: it asks for
 * it, from nothing or from the upload it could not finish, and the person keeps
 * it from the interface through the same upload in parts, under the name the
 * request gave it.
 */

import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  fileListSchema,
  finishedUploadSchema,
  transferListSchema,
  transferSchema,
  uploadStatusSchema,
} from '@memorysmith/contracts';
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

async function notebook(name = 'Caderno de fotos'): Promise<string> {
  const created = (await (
    await call('/knowledge/notebooks', {
      method: 'POST',
      body: { name, description: 'Onde as fotos ficam' },
    })
  ).json()) as { notebookId: string };
  return created.notebookId;
}

/** A PNG signature followed by bytes enough to need several parts. */
function picture(size: number): Buffer {
  const bytes = Buffer.alloc(size);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
  for (let index = 8; index < size; index += 1) bytes[index] = (index * 31) % 251;
  return bytes;
}

const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

async function ask(body: Record<string, unknown>): Promise<Response> {
  return call('/portability/requests', { method: 'POST', body });
}

async function transfers() {
  return transferListSchema.parse(await (await call('/portability/transfers')).json());
}

/** The person keeps the file a request names, inline for the test's sake. */
async function fulfil(request: string, whole: Buffer, mimeType = 'image/png'): Promise<Response> {
  const begun = await call('/portability/uploads', {
    method: 'POST',
    body: {
      request,
      // What the browser sends; the request decides where and under what name.
      notebookId: '01JBQ2X00000000000000000V1',
      name: 'foto-do-disco.png',
      mimeType,
      purpose: 'Pedido pelo agente',
      size: whole.length,
      sha256: sha(whole),
      transport: 'inline',
      partSize: 2048,
    },
  });
  if (begun.status !== 201) return begun;
  const status = uploadStatusSchema.parse(await begun.json());
  for (let part = 1; (part - 1) * 2048 < whole.length; part += 1) {
    const bytes = whole.subarray((part - 1) * 2048, part * 2048);
    await call(`/portability/uploads/${status.transfer.transferId}/parts/${part}`, {
      method: 'PUT',
      body: { sha256: sha(bytes), contentBase64: bytes.toString('base64') },
    });
  }
  return call(`/portability/uploads/${status.transfer.transferId}/finish`, { method: 'POST' });
}

describe('an agent asks the person for a file (#253, RN-PRT-030)', () => {
  it('records a request the person sees, which reserves no room', async () => {
    const notebookId = await notebook();
    const asked = await ask({
      notebookId,
      name: 'quadro da reunião.png',
      mimeType: 'image/png',
      purpose: 'A foto do quadro, para a ata',
      tags: ['ata'],
      size: 1_935_884,
    });
    expect(asked.status).toBe(201);
    const request = transferSchema.parse(await asked.json());
    expect(request).toMatchObject({
      kind: 'request',
      status: 'running',
      notebookId,
      fileName: 'quadro da reunião.png',
      request: {
        mimeType: 'image/png',
        purpose: 'A foto do quadro, para a ata',
        tags: ['ata'],
        expectedSize: 1_935_884,
        expectedSha256: null,
      },
    });
    const listed = await transfers();
    expect(listed.transfers.map((each) => each.kind)).toEqual(['request']);
    expect(listed.transitBytes).toBe(0);

    // The connector finds it where it finds its uploads.
    const open = (await (await call(`/portability/uploads?notebookId=${notebookId}`)).json()) as {
      transfers: Array<{ kind: string }>;
    };
    expect(open.transfers.map((each) => each.kind)).toEqual(['request']);
  });

  it('answers the same request when the same name is asked for twice', async () => {
    const notebookId = await notebook();
    const body = { notebookId, name: 'foto.png', mimeType: 'image/png', purpose: 'Uma foto' };
    const first = transferSchema.parse(await (await ask(body)).json());
    const second = transferSchema.parse(await (await ask(body)).json());
    expect(second.transferId).toBe(first.transferId);
    expect((await transfers()).transfers).toHaveLength(1);
  });

  it('replaces an upload the agent could not finish, and gives its room back', async () => {
    const notebookId = await notebook();
    const whole = picture(5000);
    const begun = uploadStatusSchema.parse(
      await (
        await call('/portability/uploads', {
          method: 'POST',
          body: {
            notebookId,
            name: 'quadro.png',
            mimeType: 'image/png',
            purpose: 'O quadro, para a ata',
            size: whole.length,
            sha256: sha(whole),
            transport: 'url',
          },
        })
      ).json(),
    );
    expect((await transfers()).transitBytes).toBe(5000);

    const asked = await ask({ fromUpload: begun.transfer.transferId });
    expect(asked.status).toBe(201);
    const request = transferSchema.parse(await asked.json());
    expect(request).toMatchObject({
      kind: 'request',
      fileName: 'quadro.png',
      request: {
        purpose: 'O quadro, para a ata',
        expectedSize: 5000,
        expectedSha256: sha(whole),
      },
    });
    const listed = await transfers();
    expect(listed.transfers.map((each) => each.transferId)).toEqual([request.transferId]);
    expect(listed.transitBytes).toBe(0);
  });

  it('is fulfilled by the person under the name it asked for, and ends', async () => {
    const notebookId = await notebook();
    const request = transferSchema.parse(
      await (
        await ask({ notebookId, name: 'quadro.png', mimeType: 'image/png', purpose: 'O quadro' })
      ).json(),
    );
    const finished = await fulfil(request.transferId, picture(5000));
    expect(finished.status).toBe(200);
    expect(finishedUploadSchema.parse(await finished.json())).toMatchObject({
      name: 'quadro.png',
      notebookId,
      bytes: 5000,
    });
    const files = fileListSchema.parse(
      await (await call(`/knowledge/notebooks/${notebookId}/files`)).json(),
    );
    expect(files.files.map((each) => [each.name, each.description])).toEqual([
      ['quadro.png', 'O quadro'],
    ]);
    expect((await transfers()).transfers).toEqual([]);
  });

  it('refuses a file of another type than the one it asks for', async () => {
    const notebookId = await notebook();
    const request = transferSchema.parse(
      await (
        await ask({ notebookId, name: 'ata.pdf', mimeType: 'application/pdf', purpose: 'A ata' })
      ).json(),
    );
    const refused = await fulfil(request.transferId, picture(3000), 'image/png');
    expect(refused.status).toBe(400);
    expect(((await refused.json()) as { details?: { reason?: string } }).details?.reason).toBe(
      'REQUEST_TYPE_MISMATCH',
    );
  });

  it('is dismissed by deleting its row', async () => {
    const notebookId = await notebook();
    const request = transferSchema.parse(
      await (
        await ask({ notebookId, name: 'foto.png', mimeType: 'image/png', purpose: 'Uma foto' })
      ).json(),
    );
    const deleted = await call(`/portability/transfers/${request.transferId}`, {
      method: 'DELETE',
    });
    expect(deleted.status).toBe(204);
    expect((await transfers()).transfers).toEqual([]);
  });

  it('needs the notebook, the name, the type and a purpose when no upload is named', async () => {
    const notebookId = await notebook();
    const refused = await ask({ notebookId, name: 'foto.png' });
    expect(refused.status).toBe(400);
  });
});
