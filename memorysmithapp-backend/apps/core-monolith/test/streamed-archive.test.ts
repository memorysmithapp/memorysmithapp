/**
 * A `.notebook` of format `1.6` (#481): one zip, the document first and each
 * kept file an entry of its own beside it, stored, and named by the document
 * with its size and SHA-256 (RN-PRT-092). What is asserted here is the round
 * trip over the API, through the same use cases production runs: the files
 * come back byte for byte, by SHA-256, an archive of `1.5` with its bytes
 * base64 inside the document still imports, and an entry that does not hash
 * to what the document declares is refused with nothing written.
 */

import { createHash, randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createZip,
  readDirectory,
  bufferSource,
  readZip,
  zipStream,
  STORED,
} from '@memorysmithapp/svc-portability/adapters/zip';
import { buildTestApp } from './wiring.js';

type App = ReturnType<typeof buildTestApp>;
let harness: App;
const TOKEN = 'token-owner';

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

beforeEach(async () => {
  harness = buildTestApp();
  harness.verifier.issue(TOKEN, { sub: 'user-owner', email: 'owner@example.com' });
  const created = await call('/access/subscriptions', { method: 'POST', body: {} });
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

/** A PNG signature and random bytes after it: what the check of a type reads, and a body to hash. */
function png(size: number): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([signature, randomBytes(size - signature.length)]);
}

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** A notebook keeping two files, of these names and bytes. */
async function notebookWith(files: Record<string, Buffer>): Promise<string> {
  const { notebookId } = (await (
    await call('/knowledge/notebooks', {
      method: 'POST',
      body: { name: 'Acervo', description: 'Fotos e documentos.' },
    })
  ).json()) as { notebookId: string };
  for (const [name, bytes] of Object.entries(files)) {
    const kept = await call(`/knowledge/notebooks/${notebookId}/files`, {
      method: 'POST',
      body: {
        name,
        description: `O arquivo ${name}`,
        mimeType: 'image/png',
        tags: ['acervo'],
        path: '/fotos',
        contentBase64: bytes.toString('base64'),
      },
    });
    expect(kept.status).toBe(201);
  }
  return notebookId;
}

async function exported(notebookId: string): Promise<Buffer> {
  const started = await call(`/portability/notebooks/${notebookId}/export`, {
    method: 'POST',
    body: { selection: { guidance: true, history: false, folders: [], templates: [], notes: [] } },
  });
  expect(started.status).toBe(202);
  const key = [...harness.archives.keys()].pop() ?? '';
  return harness.archives.get(key) as Buffer;
}

async function imported(
  archive: Buffer,
  name: string,
): Promise<{ status: string; failure: string | null; notebookId: string }> {
  const { uploadKey } = (await (await call('/portability/imports', { method: 'POST' })).json()) as {
    uploadKey: string;
  };
  harness.uploads.set(uploadKey, archive);
  const started = await call('/portability/imports/apply', {
    method: 'POST',
    body: { uploadKey, name },
  });
  const { transferId } = (await started.json()) as { transferId: string };
  return (await (await call(`/portability/transfers/${transferId}`)).json()) as {
    status: string;
    failure: string | null;
    notebookId: string;
  };
}

async function keptFiles(
  notebookId: string,
): Promise<Array<{ name: string; bytes: number; sha256: string; path: string; tags: string[] }>> {
  const listed = (await (await call(`/knowledge/notebooks/${notebookId}/files`)).json()) as {
    files: Array<{ name: string; bytes: number; sha256: string; path: string; tags: string[] }>;
  };
  return listed.files;
}

interface DocumentFile {
  name: string;
  entry?: string;
  size?: number;
  sha256?: string;
  bytes?: string;
}

describe('an archive of format 1.6', () => {
  it('holds each file as a stored entry of its own, named by the document with its size and hash', async () => {
    const photo = png(3 * 1024 * 1024 + 5);
    const scan = png(70_000);
    const notebookId = await notebookWith({ 'foto: junho/1.png': photo, 'scan.png': scan });

    const archive = await exported(notebookId);
    const document = JSON.parse(readZip(archive)['notebook.json'] ?? '{}') as {
      documentVersion: string;
      files: DocumentFile[];
    };

    expect(document.documentVersion).toBe('1.6');
    // The document carries what each file is and where its bytes are, and
    // never the bytes (RN-PRT-092).
    expect(document.files).toEqual([
      expect.objectContaining({
        name: 'foto: junho/1.png',
        entry: 'files/1/foto- junho-1.png',
        size: photo.length,
        sha256: sha256(photo),
      }),
      expect.objectContaining({
        name: 'scan.png',
        entry: 'files/2/scan.png',
        size: scan.length,
        sha256: sha256(scan),
      }),
    ]);
    expect(document.files.every((file) => file.bytes === undefined)).toBe(true);

    // The document first, then each file, stored: a photo is compressed already.
    const entries = await readDirectory(bufferSource(archive));
    expect(entries.map((entry) => entry.name)).toEqual([
      'notebook.json',
      'files/1/foto- junho-1.png',
      'files/2/scan.png',
    ]);
    expect(entries.slice(1).map((entry) => [entry.method, entry.uncompressedSize])).toEqual([
      [STORED, photo.length],
      [STORED, scan.length],
    ]);
  });

  it('comes back with every file whole, byte for byte by SHA-256', async () => {
    const photo = png(3 * 1024 * 1024 + 5);
    const scan = png(70_000);
    const notebookId = await notebookWith({ 'foto.png': photo, 'scan.png': scan });

    const job = await imported(await exported(notebookId), 'Acervo (de volta)');

    expect(job.failure).toBeNull();
    expect(job.status).toBe('ready');
    const back = await keptFiles(job.notebookId);
    expect(back.map((file) => [file.name, file.bytes, file.sha256])).toEqual([
      ['foto.png', photo.length, sha256(photo)],
      ['scan.png', scan.length, sha256(scan)],
    ]);
    // What a file is travels with it.
    expect(back.every((file) => file.path === '/fotos' && file.tags[0] === 'acervo')).toBe(true);
  });

  it('refuses an entry that does not hash to what the document declares, and keeps no notebook', async () => {
    const photo = png(200_000);
    const notebookId = await notebookWith({ 'foto.png': photo });
    const archive = await exported(notebookId);
    const document = JSON.parse(readZip(archive)['notebook.json'] ?? '{}') as {
      files: DocumentFile[];
    };
    // The same document, with a byte of the file changed in the entry.
    const tampered = Buffer.from(photo);
    tampered[1000] = (tampered[1000] ?? 0) ^ 0xff;
    const chunks: Buffer[] = [];
    for await (const chunk of zipStream(
      [
        { path: 'notebook.json', content: JSON.stringify(document) },
        {
          path: document.files[0]?.entry ?? '',
          size: tampered.length,
          open: async () =>
            (async function* () {
              yield tampered;
            })(),
        },
      ],
      new Date(),
    )) {
      chunks.push(chunk);
    }
    const before = ((await (await call('/knowledge/notebooks')).json()) as unknown[]).length;

    const job = await imported(Buffer.concat(chunks), 'Acervo adulterado');

    expect(job.status).toBe('failed');
    expect(job.failure).toBe('HASH_MISMATCH');
    expect(((await (await call('/knowledge/notebooks')).json()) as unknown[]).length).toBe(before);
  });

  it('refuses a document that names an entry the archive does not hold, before the first write', async () => {
    const notebookId = await notebookWith({ 'foto.png': png(10_000) });
    const json = readZip(await exported(notebookId))['notebook.json'] ?? '{}';
    const before = ((await (await call('/knowledge/notebooks')).json()) as unknown[]).length;

    // The document alone, its file entry left out.
    const job = await imported(
      createZip([{ path: 'notebook.json', content: json }], new Date()),
      'Acervo sem foto',
    );

    expect(job.status).toBe('failed');
    expect(job.failure).toBe('BAD_FORMAT');
    expect(((await (await call('/knowledge/notebooks')).json()) as unknown[]).length).toBe(before);
  });
});

describe('an archive of format 1.5', () => {
  it('still imports, its files read base64 out of the document as they always were', async () => {
    const photo = png(150_000);
    const scan = png(9_000);
    const notebookId = await notebookWith({ 'foto.png': photo, 'scan.png': scan });
    const document = JSON.parse(readZip(await exported(notebookId))['notebook.json'] ?? '{}') as {
      documentVersion: string;
      files: DocumentFile[];
    };
    // The document as a `1.5` export wrote it: the bytes inside, one entry.
    const bytesOf: Record<string, Buffer> = { 'foto.png': photo, 'scan.png': scan };
    const old = {
      ...document,
      documentVersion: '1.5',
      files: document.files.map(({ entry: _entry, size: _size, sha256: _sha, ...file }) => ({
        ...file,
        bytes: (bytesOf[file.name] ?? Buffer.alloc(0)).toString('base64'),
      })),
    };
    const archive = createZip(
      [{ path: 'notebook.json', content: JSON.stringify(old, null, 2) }],
      new Date(),
    );

    const job = await imported(archive, 'Acervo de 1.5');

    expect(job.failure).toBeNull();
    expect(job.status).toBe('ready');
    expect((await keptFiles(job.notebookId)).map((file) => [file.name, file.sha256])).toEqual([
      ['foto.png', sha256(photo)],
      ['scan.png', sha256(scan)],
    ]);
  });
});
