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
import {
  fileLinkSchema,
  fileListSchema,
  notebookFileSchema,
  noteLinksSchema,
} from '@memorysmith/contracts';
import { MAX_INLINE_BYTES } from '@memorysmith/svc-knowledge/application/files';
import { ProjectFiles } from '@memorysmith/svc-discovery/application/projections';
import { dispatch } from '@memorysmith/svc-discovery/adapters/dispatch';

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

  /**
   * The ceiling this door declares has to be a ceiling this door can reach
   * (#172). It said 8 MB while the request carrying the bytes is a synchronous
   * invocation that stops at 6 MB — and base64 costs a third on top of the
   * file — so every file between 4.4 MB and 8 MB was refused by the platform,
   * with a `413` naming nothing, before the message explaining the limit could
   * run. A declared limit nobody can hit is not a limit.
   */
  /**
   * A card offers two verbs and they were one link (#171). The disposition was
   * chosen by the type rather than by the verb, so every card was signed as an
   * attachment and `Abrir` opened a tab that downloaded the file and closed.
   */
  it('answers where a file is shown and where it is saved, and says which shows anything', async () => {
    const notebookId = await seedNotebook();
    const pdf = notebookFileSchema.parse(
      await (
        await keep(notebookId, { name: 'slide', mimeType: 'application/pdf', contentBase64: PDF })
      ).json(),
    );
    const sheet = notebookFileSchema.parse(
      await (
        await keep(notebookId, {
          name: 'planilha',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          contentBase64: Buffer.from([0x50, 0x4b, 0x03, 0x04]).toString('base64'),
        })
      ).json(),
    );

    // A PDF: shown inline where it is opened, saved where it is downloaded.
    const shown = fileLinkSchema.parse(
      await (await call(`/knowledge/notebooks/${notebookId}/files/${pdf.fileId}/link`)).json(),
    );
    expect(shown.opens).toBe(true);
    expect(shown.url).toContain('/inline/');
    expect(shown.downloadUrl).toContain('/attachment/');

    // A spreadsheet: nothing displays it, so both addresses save it and the
    // card is told not to offer the verb it could not keep.
    const saved = fileLinkSchema.parse(
      await (await call(`/knowledge/notebooks/${notebookId}/files/${sheet.fileId}/link`)).json(),
    );
    expect(saved.opens).toBe(false);
    expect(saved.url).toContain('/attachment/');
    expect(saved.downloadUrl).toContain('/attachment/');
  });

  it('declares a ceiling the transport can carry', () => {
    const INVOCATION_LIMIT = 6 * 1024 * 1024;
    const encoded = Math.ceil(MAX_INLINE_BYTES / 3) * 4;
    // What travels beside the bytes: the name, the description, the tags, the
    // path and the field names of the envelope.
    const envelope = 8 * 1024;

    expect(encoded + envelope).toBeLessThan(INVOCATION_LIMIT);
  });

  it('refuses a file above the ceiling with the limit, not with a platform error', async () => {
    const notebookId = await seedNotebook();
    const tooLarge = Buffer.alloc(MAX_INLINE_BYTES + 1);
    // A PNG signature, so the size is what refuses it and not the type.
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(tooLarge);

    const response = await keep(notebookId, {
      name: 'grande-demais.png',
      mimeType: 'image/png',
      contentBase64: tooLarge.toString('base64'),
    });

    expect(response.status).toBe(413);
    const body = (await response.json()) as { message: string };
    expect(body.message).toContain(`${MAX_INLINE_BYTES / (1024 * 1024)} MB`);
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

/**
 * Where the links of a note go, and what each one reaches (#186).
 *
 * The contract declares `kind` for every target and the graph computes it,
 * and the route dropped it on the way out: an embedded file and a pending
 * link answered the same object, and `read_note` told an agent the picture it
 * had just embedded was pending.
 */
describe('the links of a note that embeds a file', () => {
  it('say which target is a note, which is a file and which is pending', async () => {
    const notebookId = await seedNotebook();
    await keep(notebookId, { name: 'esquema.png', mimeType: 'image/png', contentBase64: PNG });
    const folder = (await (
      await call(`/knowledge/notebooks/${notebookId}/folders`, {
        method: 'POST',
        body: { name: 'Notas', description: 'Notas que mostram arquivos' },
      })
    ).json()) as { folderId: string };
    const note = (await (
      await call(`/knowledge/notebooks/${notebookId}/notes`, {
        method: 'POST',
        body: {
          folderId: folder.folderId,
          content: '---\nname: Capa\n---\n\n![[esquema.png]]\n\nVer [[Ninguem ainda]].\n',
        },
      })
    ).json()) as { noteId: string };

    // Through the dispatch the projector runs, file events included, and not
    // a copy of it: a copy is how an event nobody routes still passes.
    const projectors = {
      note: harness.projectNote,
      structure: harness.projectStructure,
      files: new ProjectFiles(harness.discovery.graph),
    };
    for (const event of harness.events.published) {
      await dispatch(projectors, {
        eventId: event.eventId,
        type: event.type,
        occurredAt: event.occurredAt.toISOString(),
        subscriptionId: event.subscriptionId.value,
        subject: event.subject,
        subjectId: event.subjectId,
        authorship: event.authorship.toJSON(),
        contentRef: event.contentRef ? event.contentRef.toJSON() : null,
        payload: event.payload,
      } as Parameters<typeof dispatch>[1]);
    }

    const links = noteLinksSchema.parse(
      await (await call(`/discovery/notebooks/${notebookId}/notes/${note.noteId}/links`)).json(),
    );
    expect(links.links.map((link) => [link.target, link.kind, link.by])).toEqual([
      ['esquema.png', 'attachment', null],
      ['Ninguem ainda', 'pending', null],
    ]);
  });
});
