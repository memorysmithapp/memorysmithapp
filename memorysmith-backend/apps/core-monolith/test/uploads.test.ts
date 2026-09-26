/**
 * An upload in parts, end to end over HTTP (#240, RN-PRT-027, RN-PRT-028,
 * RN-PRT-029, RN-SUB-025).
 *
 * The cases follow what an agent does: it declares the file with the hash of
 * the whole, sends the parts — inline, each with its own hash, or by the
 * addresses the store signed — asks what is missing, and finishes. And what a
 * person sees: the upload in Transfers, as *agent*, reserving its room, gone
 * once it is a file, kept as a notice when its bytes were wrong, and pointed at
 * another notebook when its own became unavailable.
 */

import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  fileListSchema,
  finishedUploadSchema,
  subscriptionUsageSchema,
  transferListSchema,
  uploadStatusSchema,
  type UploadStatusDto,
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

async function begin(body: Record<string, unknown>): Promise<Response> {
  return call('/portability/uploads', { method: 'POST', body });
}

async function sendInline(
  transferId: string,
  whole: Buffer,
  partSize: number,
): Promise<UploadStatusDto> {
  let status: UploadStatusDto | null = null;
  for (let part = 1; part * partSize - partSize < whole.length; part += 1) {
    const bytes = whole.subarray((part - 1) * partSize, part * partSize);
    const response = await call(`/portability/uploads/${transferId}/parts/${part}`, {
      method: 'PUT',
      body: { sha256: sha(bytes), contentBase64: bytes.toString('base64') },
    });
    expect(response.status).toBe(200);
    status = uploadStatusSchema.parse(await response.json());
  }
  return status as UploadStatusDto;
}

describe('an upload whose parts travel inline', () => {
  it('becomes a file once every part arrived and the whole hashes to what was declared', async () => {
    const notebookId = await notebook();
    const whole = picture(5000);

    const started = await begin({
      notebookId,
      name: 'quadro da reunião',
      mimeType: 'image/png',
      purpose: 'A foto do quadro, para a ata',
      size: whole.length,
      sha256: sha(whole),
      transport: 'inline',
      partSize: 2048,
    });
    expect(started.status).toBe(201);
    const status = uploadStatusSchema.parse(await started.json());
    expect(status.transfer.kind).toBe('agent');
    expect(status.transfer.upload?.partCount).toBe(3);
    expect(status.missing).toEqual([1, 2, 3]);
    expect(status.targets).toEqual([]);

    // The room is reserved from the start, as in transit (RN-SUB-025).
    const usage = subscriptionUsageSchema.parse(await (await call('/access/usage')).json());
    expect(usage.byType.transit).toEqual({ count: 1, bytes: 5000 });

    const sent = await sendInline(status.transfer.transferId, whole, 2048);
    expect(sent.missing).toEqual([]);
    expect(sent.transfer.upload?.received).toEqual([1, 2, 3]);

    const finished = await call(`/portability/uploads/${status.transfer.transferId}/finish`, {
      method: 'POST',
    });
    expect(finished.status).toBe(200);
    const file = finishedUploadSchema.parse(await finished.json());
    expect(file).toMatchObject({ name: 'quadro da reunião', bytes: 5000, notebookId });

    // It is a file of the notebook now, described by what it was for.
    const listed = fileListSchema.parse(
      await (await call(`/knowledge/notebooks/${notebookId}/files`)).json(),
    );
    expect(listed.files.map((each) => [each.name, each.description])).toEqual([
      ['quadro da reunião', 'A foto do quadro, para a ata'],
    ]);

    // Ready means gone: the record leaves Transfers, and the room it reserved
    // is the file's now (RN-PRT-028).
    const transfers = transferListSchema.parse(await (await call('/portability/transfers')).json());
    expect(transfers.transfers).toEqual([]);
    expect(transfers.transitBytes).toBe(0);
  });

  it('refuses a mistyped part and keeps nothing of it', async () => {
    const notebookId = await notebook();
    const whole = picture(3000);
    const status = uploadStatusSchema.parse(
      await (
        await begin({
          notebookId,
          name: 'foto',
          mimeType: 'image/png',
          purpose: 'Uma foto',
          size: whole.length,
          sha256: sha(whole),
          transport: 'inline',
          partSize: 2048,
        })
      ).json(),
    );
    const first = whole.subarray(0, 2048);
    const typo = Buffer.from(first);
    typo[100] = (typo[100] ?? 0) ^ 0xff;

    const refused = await call(`/portability/uploads/${status.transfer.transferId}/parts/1`, {
      method: 'PUT',
      body: { sha256: sha(first), contentBase64: typo.toString('base64') },
    });
    expect(refused.status).toBe(400);
    const body = (await refused.json()) as { details?: { reason?: string } };
    expect(body.details?.reason).toBe('PART_HASH_MISMATCH');

    const after = uploadStatusSchema.parse(
      await (await call(`/portability/uploads/${status.transfer.transferId}`)).json(),
    );
    expect(after.missing).toEqual([1, 2]);

    // Finishing with parts missing names them, and ends nothing.
    const early = await call(`/portability/uploads/${status.transfer.transferId}/finish`, {
      method: 'POST',
    });
    expect(early.status).toBe(409);
    expect(((await early.json()) as { details: { missing: number[] } }).details.missing).toEqual([
      1, 2,
    ]);
  });

  it('ends as failed, with its reason and without its bytes, when the whole is not what was declared', async () => {
    const notebookId = await notebook();
    const whole = picture(1500);
    const status = uploadStatusSchema.parse(
      await (
        await begin({
          notebookId,
          name: 'foto errada',
          mimeType: 'image/png',
          purpose: 'Uma foto',
          size: whole.length,
          // The hash of other bytes: every part is right, the whole is not.
          sha256: sha(Buffer.from('something else')),
          transport: 'inline',
          partSize: 1024,
        })
      ).json(),
    );
    await sendInline(status.transfer.transferId, whole, 1024);

    const finished = await call(`/portability/uploads/${status.transfer.transferId}/finish`, {
      method: 'POST',
    });
    expect(finished.status).toBe(400);

    const transfers = transferListSchema.parse(await (await call('/portability/transfers')).json());
    expect(transfers.transfers).toHaveLength(1);
    expect(transfers.transfers[0]).toMatchObject({ status: 'failed', failure: 'HASH_MISMATCH' });
    expect(transfers.transitBytes).toBe(0);
    const files = fileListSchema.parse(
      await (await call(`/knowledge/notebooks/${notebookId}/files`)).json(),
    );
    expect(files.files).toEqual([]);
    // Nothing of it is left in the store.
    expect([...harness.parts.objects.keys()]).toEqual([]);

    // Deleting the notice is all that is left to do.
    expect(
      (await call(`/portability/transfers/${status.transfer.transferId}`, { method: 'DELETE' }))
        .status,
    ).toBe(204);
  });

  it('refuses before a byte travels: too large inline, no room, a name the notebook keeps', async () => {
    const notebookId = await notebook();
    const base = {
      notebookId,
      name: 'foto',
      mimeType: 'image/png',
      purpose: 'Uma foto',
      sha256: sha(Buffer.from('x')),
    };
    expect(
      (await begin({ ...base, size: 5 * 1024 * 1024, transport: 'inline', partSize: 1024 * 1024 }))
        .status,
    ).toBe(413);
    expect((await begin({ ...base, size: 4096, transport: 'inline', partSize: 10 })).status).toBe(
      400,
    );
    expect(
      (await begin({ ...base, size: 4096, transport: 'url', mimeType: 'text/html' })).status,
    ).toBe(400);

    harness.storage.limitBytes = 1000;
    expect((await begin({ ...base, size: 4096, transport: 'url' })).status).toBe(413);
    harness.storage.limitBytes = Number.MAX_SAFE_INTEGER;

    await call(`/knowledge/notebooks/${notebookId}/files`, {
      method: 'POST',
      body: {
        name: 'foto',
        description: '',
        mimeType: 'image/png',
        contentBase64: picture(64).toString('base64'),
      },
    });
    expect((await begin({ ...base, size: 4096, transport: 'url' })).status).toBe(409);
  });
});

describe('an upload whose parts travel by URL', () => {
  it('signs an address per missing part, and the store says which arrived', async () => {
    const notebookId = await notebook();
    const whole = picture(20 * 1024 * 1024);

    const status = uploadStatusSchema.parse(
      await (
        await begin({
          notebookId,
          name: 'foto grande',
          mimeType: 'image/png',
          purpose: 'A foto inteira, sem recorte',
          size: whole.length,
          sha256: sha(whole),
          transport: 'url',
        })
      ).json(),
    );
    // 8 MiB a part: three parts, an address for each.
    expect(status.transfer.upload?.partCount).toBe(3);
    expect(status.targets.map((each) => each.part)).toEqual([1, 2, 3]);

    const multipartId = /uploadId=([^&]+)/.exec(status.targets[0]?.url ?? '')?.[1] ?? '';
    const size = 8 * 1024 * 1024;
    harness.parts.receivePart(multipartId, 1, whole.subarray(0, size));
    harness.parts.receivePart(multipartId, 3, whole.subarray(2 * size));

    const halfway = uploadStatusSchema.parse(
      await (await call(`/portability/uploads/${status.transfer.transferId}`)).json(),
    );
    expect(halfway.missing).toEqual([2]);
    expect(halfway.targets.map((each) => each.part)).toEqual([2]);
    // The row shows how far it got, read from the store.
    const listed = transferListSchema.parse(await (await call('/portability/transfers')).json());
    expect(listed.transfers[0]?.done).toBe(2);
    expect(listed.transfers[0]?.upload?.lastPartAt).not.toBeNull();

    harness.parts.receivePart(multipartId, 2, whole.subarray(size, 2 * size));
    const finished = await call(`/portability/uploads/${status.transfer.transferId}/finish`, {
      method: 'POST',
    });
    expect(finished.status).toBe(200);
    expect(finishedUploadSchema.parse(await finished.json()).bytes).toBe(whole.length);
    expect(harness.parts.openMultiparts).toBe(0);
  });
});

describe('an upload whose notebook became unavailable', () => {
  it('outlives its notebook, and is pointed at another one to finish there', async () => {
    const first = await notebook('Caderno que vai embora');
    const whole = picture(1200);
    const status = uploadStatusSchema.parse(
      await (
        await begin({
          notebookId: first,
          name: 'foto do quadro',
          mimeType: 'image/png',
          purpose: 'Para a ata',
          size: whole.length,
          sha256: sha(whole),
          transport: 'inline',
          partSize: 1024,
        })
      ).json(),
    );
    const transferId = status.transfer.transferId;
    await sendInline(transferId, whole, 1024);

    expect((await call(`/knowledge/notebooks/${first}`, { method: 'DELETE' })).status).toBe(204);

    // Its notebook is gone, and so finishing there is refused; the upload
    // stays open and holds its room.
    const refused = await call(`/portability/uploads/${transferId}/finish`, { method: 'POST' });
    expect(refused.status).toBe(404);
    const kept = transferListSchema.parse(await (await call('/portability/transfers')).json());
    expect(kept.transfers[0]).toMatchObject({
      status: 'running',
      notebookName: 'Caderno que vai embora',
    });
    expect(kept.transitBytes).toBe(1200);

    const second = await notebook('Caderno que ficou');
    const linked = await call(`/portability/uploads/${transferId}/link`, {
      method: 'POST',
      body: { notebookId: second },
    });
    expect(linked.status).toBe(200);

    const finished = await call(`/portability/uploads/${transferId}/finish`, { method: 'POST' });
    expect(finished.status).toBe(200);
    expect(finishedUploadSchema.parse(await finished.json()).notebookId).toBe(second);
  });

  it('is thrown away whole when its row is deleted, room included', async () => {
    const notebookId = await notebook();
    const whole = picture(1500);
    const status = uploadStatusSchema.parse(
      await (
        await begin({
          notebookId,
          name: 'foto',
          mimeType: 'image/png',
          purpose: 'Uma foto',
          size: whole.length,
          sha256: sha(whole),
          transport: 'inline',
          partSize: 1024,
        })
      ).json(),
    );
    await sendInline(status.transfer.transferId, whole.subarray(0, 1024), 1024);

    expect(
      (await call(`/portability/transfers/${status.transfer.transferId}`, { method: 'DELETE' }))
        .status,
    ).toBe(204);
    const after = transferListSchema.parse(await (await call('/portability/transfers')).json());
    expect(after.transfers).toEqual([]);
    expect(after.transitBytes).toBe(0);
    expect([...harness.parts.objects.keys()]).toEqual([]);
  });
});
