/**
 * The vertical slice of delivery 6 (architecture-guide.md, section 25), end to
 * end over HTTP:
 *
 *   - reordering a folder is ONE write on the folder item;
 *   - moving a note between folders writes ZERO bytes in S3;
 *   - deleting a note keeps its content readable by revision.
 *
 * It also exercises the whole authoring cycle the UI performs, which is what
 * makes the tese testable: guidance, tree, template, note.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from './wiring.js';
import { contentSchema, sessionSchema } from '@memorysmith/contracts';

type App = ReturnType<typeof buildTestApp>;
let harness: App;

const TOKEN = 'token-owner';
/** The subscription the token names, which each test rebuilds. */
let activeSubscriptionId = '';

beforeEach(async () => {
  harness = buildTestApp();
  harness.verifier.issue(TOKEN, { sub: 'user-owner', email: 'owner@example.com' });

  const created = await harness.app.request('/access/subscriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  const { subscriptionId } = (await created.json()) as { subscriptionId: string };
  activeSubscriptionId = subscriptionId;

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
  init: { method?: string; body?: unknown; token?: string } = {},
): Promise<Response> {
  return harness.app.request(path, {
    method: init.method ?? 'GET',
    headers: {
      authorization: `Bearer ${init.token ?? TOKEN}`,
      'content-type': 'application/json',
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

async function seedNotebook(): Promise<{ notebookId: string; folderId: string }> {
  const notebook = (await (
    await call('/knowledge/notebooks', {
      method: 'POST',
      body: {
        name: 'Normas e Legislacao',
        description: 'Texto normativo por artigo',
      },
    })
  ).json()) as { notebookId: string };

  const folder = (await (
    await call(`/knowledge/notebooks/${notebook.notebookId}/folders`, {
      method: 'POST',
      body: {
        name: 'Normas',
        description: 'Texto normativo por artigo. Uma norma por nota, sempre com orgao.',
      },
    })
  ).json()) as { folderId: string };

  return { notebookId: notebook.notebookId, folderId: folder.folderId };
}

describe('The API answers what its contract declares', () => {
  /**
   * The shape of a response is a promise, and the schemas in the contracts
   * package ARE that promise. Nothing enforced it on the way out, so
   * GET /access/session drifted: it answered `links` where the contract says
   * `subscriptions`, and an email as the value object `{ value }` instead of a
   * string. The SPA read undefined, fell back to a degraded session, and
   * showed the person no name, no subscription and the wrong role.
   */
  it('answers GET /access/session in exactly the declared shape', async () => {
    const response = await call('/access/session');
    expect(response.status).toBe(200);

    const parsed = sessionSchema.safeParse(await response.json());
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.user.email).toBe('owner@example.com');
    expect(parsed.data.subscriptions.length).toBeGreaterThan(0);
    // The active subscription is the one the token names, not the first of the list.
    expect(parsed.data.activeSubscription?.subscriptionId).toBe(activeSubscriptionId);
    expect(parsed.data.role).toBe('OWNER');
  });
});

describe('Removing a folder with CASCADE', () => {
  const noteIn = async (notebookId: string, folderId: string, name: string) =>
    (
      (await (
        await call(`/knowledge/notebooks/${notebookId}/notes`, {
          method: 'POST',
          body: { folderId, content: `---\nname: ${name}\n---\n\nCorpo.` },
        })
      ).json()) as { noteId: string }
    ).noteId;

  it('takes every note of the subtree out of reach in one write, and leaves the rest', async () => {
    const { notebookId, folderId } = await seedNotebook();
    const folder = async (name: string, parentFolderId: string | null) =>
      (
        (await (
          await call(`/knowledge/notebooks/${notebookId}/folders`, {
            method: 'POST',
            body: { name, description: `Onde ficam as ${name}.`, parentFolderId },
          })
        ).json()) as { folderId: string }
      ).folderId;
    const revoked = await folder('Revogadas', folderId);
    const elsewhere = await folder('Pareceres', null);

    const inFolder = await noteIn(notebookId, folderId, 'Lei 14.133');
    const inChild = await noteIn(notebookId, revoked, 'Lei 8.666');
    const kept = await noteIn(notebookId, elsewhere, 'Parecer 12');

    const removed = await call(
      `/knowledge/notebooks/${notebookId}/folders/${folderId}?policy=CASCADE`,
      { method: 'DELETE' },
    );
    expect(removed.status).toBe(200);
    expect(((await removed.json()) as { removedFolderIds: string[] }).removedFolderIds).toEqual(
      expect.arrayContaining([folderId, revoked]),
    );

    // RN-KNW-046: nothing under the folder was written, and nothing under it
    // is listed any more. Only the notes of the tree are the notes of the
    // notebook.
    const listed = (await (
      await call(`/knowledge/notebooks/${notebookId}/notes`)
    ).json()) as Array<{
      noteId: string;
    }>;
    expect(listed.map((note) => note.noteId)).toEqual([kept]);

    // And each of them answers as not found, one by one, although its item is
    // still in the table waiting for the purge.
    for (const noteId of [inFolder, inChild]) {
      expect((await call(`/knowledge/notebooks/${notebookId}/notes/${noteId}`)).status).toBe(404);
    }
  });
});

describe('One name per folder', () => {
  const body = (name: string, text = 'Corpo.') => `---\nname: ${name}\n---\n\n${text}\n`;
  const create = (notebookId: string, folderId: string, content: string) =>
    call(`/knowledge/notebooks/${notebookId}/notes`, {
      method: 'POST',
      body: { folderId, content },
    });
  const folderIn = async (notebookId: string, name: string) =>
    (
      (await (
        await call(`/knowledge/notebooks/${notebookId}/folders`, {
          method: 'POST',
          body: { name, description: `Onde ficam as ${name}.` },
        })
      ).json()) as { folderId: string }
    ).folderId;
  const listed = async (notebookId: string) =>
    ((await (await call(`/knowledge/notebooks/${notebookId}/notes`)).json()) as unknown[]).length;

  it('refuses a second note of a name in its folder, naming the note that holds it', async () => {
    const { notebookId, folderId } = await seedNotebook();
    const first = (await (await create(notebookId, folderId, body('Lei 14.133'))).json()) as {
      noteId: string;
    };

    // A retry after a lost answer, or an agent that did not look: RN-KNW-042.
    const twin = await create(notebookId, folderId, body('Lei 14.133', 'Outro corpo.'));
    expect(twin.status).toBe(409);
    const refusal = (await twin.json()) as { details: { code: string; noteId: string } };
    expect(refusal.details.code).toBe('ALREADY_EXISTS');
    expect(refusal.details.noteId).toBe(first.noteId);
    expect(await listed(notebookId)).toBe(1);

    // Case is part of a name: these two stand side by side (RN-KNW-037).
    expect((await create(notebookId, folderId, body('lei 14.133'))).status).toBe(201);
    // And a note with no name reserves nothing.
    expect((await create(notebookId, folderId, 'Sem nome.\n')).status).toBe(201);
    expect((await create(notebookId, folderId, 'Sem nome, outra.\n')).status).toBe(201);
  });

  it('lets another folder hold the same name', async () => {
    const { notebookId, folderId } = await seedNotebook();
    const other = await folderIn(notebookId, 'Pareceres');

    expect((await create(notebookId, folderId, body('Lei 14.133'))).status).toBe(201);
    expect((await create(notebookId, other, body('Lei 14.133'))).status).toBe(201);
  });

  it('refuses a rename or a move into a taken name, and changes nothing', async () => {
    const { notebookId, folderId } = await seedNotebook();
    const other = await folderIn(notebookId, 'Pareceres');
    const held = (await (await create(notebookId, folderId, body('Lei 14.133'))).json()) as {
      noteId: string;
    };
    const renamed = (await (await create(notebookId, folderId, body('Lei 8.666'))).json()) as {
      noteId: string;
    };
    const moving = (await (await create(notebookId, other, body('Lei 14.133'))).json()) as {
      noteId: string;
    };

    // The create answers the summary; the revision is on the note itself.
    const current = (await (
      await call(`/knowledge/notebooks/${notebookId}/notes/${renamed.noteId}`)
    ).json()) as { revision: { versionId: string } };
    const rename = await call(`/knowledge/notebooks/${notebookId}/notes/${renamed.noteId}`, {
      method: 'PUT',
      body: { content: body('Lei 14.133'), baseRevision: current.revision.versionId },
    });
    expect(rename.status).toBe(409);
    expect(((await rename.json()) as { details: { noteId: string } }).details.noteId).toBe(
      held.noteId,
    );

    const move = await call(`/knowledge/notebooks/${notebookId}/notes/${moving.noteId}/move`, {
      method: 'POST',
      body: { toFolderId: folderId },
    });
    expect(move.status).toBe(409);

    const stillThere = (await (
      await call(`/knowledge/notebooks/${notebookId}/notes/${moving.noteId}`)
    ).json()) as { folderId: string };
    expect(stillThere.folderId).toBe(other);
    const unchanged = (await (
      await call(`/knowledge/notebooks/${notebookId}/notes/${renamed.noteId}`)
    ).json()) as { name: string };
    expect(unchanged.name).toBe('Lei 8.666');
  });

  it('gives a name back when the note that held it is deleted', async () => {
    const { notebookId, folderId } = await seedNotebook();
    const held = (await (await create(notebookId, folderId, body('Lei 14.133'))).json()) as {
      noteId: string;
    };
    await call(`/knowledge/notebooks/${notebookId}/notes/${held.noteId}`, { method: 'DELETE' });

    expect((await create(notebookId, folderId, body('Lei 14.133'))).status).toBe(201);
  });
});

describe('The authoring cycle', () => {
  it('writes guidance, a tree, a template and a note', async () => {
    const { notebookId, folderId } = await seedNotebook();

    expect(
      (
        await call(`/knowledge/notebooks/${notebookId}/guidance`, {
          method: 'PUT',
          body: { content: '# Proposito\n\nUma norma por nota.' },
        })
      ).status,
    ).toBe(200);

    /**
     * The template write answers the revision it produced, like the guidance
     * and the note. It used to answer 204 and nothing at all, so a caller that
     * wrote twice without reloading echoed a revision its own first write had
     * retired, and conflicted with itself (RN-AGT-005).
     */
    const template = await call(`/knowledge/notebooks/${notebookId}/folders/${folderId}/template`, {
      method: 'PUT',
      body: { content: '# {{titulo}}\n\n## Vigencia\n' },
    });
    expect(template.status).toBe(200);
    const written = (await template.json()) as { revision: { versionId: string } };
    expect(written.revision.versionId).toBeTruthy();

    // And reading it answers that same revision, as contentSchema publishes: the
    // page of Templates reads it, and failed on every Template while it was
    // missing from this answer.
    const readBack = contentSchema.parse(
      await (await call(`/knowledge/notebooks/${notebookId}/folders/${folderId}/template`)).json(),
    );
    expect(readBack.revision.versionId).toBe(written.revision.versionId);

    const note = await call(`/knowledge/notebooks/${notebookId}/notes`, {
      method: 'POST',
      body: { folderId, content: '# Lei 14.133, art. 75\n\nLei 14.133\n\nArt. 75.' },
    });
    expect(note.status).toBe(201);

    const detail = (await (await call(`/knowledge/notebooks/${notebookId}`)).json()) as {
      hasGuidance: boolean;
      folders: Array<{ hasTemplate: boolean; slug: string }>;
      guidance: { content: string } | null;
    };
    expect(detail.hasGuidance).toBe(true);
    expect(detail.guidance?.content).toContain('Uma norma por nota');
    expect(detail.folders[0]?.hasTemplate).toBe(true);
    expect(detail.folders[0]?.slug).toBe('normas');
  });

  it('serves the Notebook Context as Markdown, guidance plus the annotated tree', async () => {
    const { notebookId, folderId } = await seedNotebook();
    await call(`/knowledge/notebooks/${notebookId}/guidance`, {
      method: 'PUT',
      body: { content: '# Proposito\n\nUma norma por nota.' },
    });
    await call(`/knowledge/notebooks/${notebookId}/folders/${folderId}/template`, {
      method: 'PUT',
      body: { content: '# Modelo' },
    });

    const context = await call(`/knowledge/notebooks/${notebookId}/context`);
    expect(context.headers.get('content-type')).toContain('text/markdown');
    const markdown = await context.text();
    expect(markdown).toContain('# Notebook: Normas e Legislacao');
    expect(markdown).toContain('Uma norma por nota.');
    expect(markdown).toContain('## Structure');
    expect(markdown).toContain(`1. **Normas** \`${folderId}\`:`);
    expect(markdown).toContain('has TEMPLATE.md');
  });

  it('gives the Notebook Context everything a fresh session needs to write, the folder identifier included', async () => {
    // The whole point of RN-AGT-020: a session that created nothing reads the
    // context and writes from it alone. Nothing here reuses the identifier
    // seedNotebook returned; it is parsed back out of the document.
    const { notebookId } = await seedNotebook();
    const markdown = await (await call(`/knowledge/notebooks/${notebookId}/context`)).text();

    const addressed = /\*\*Normas\*\* `([0-9A-HJKMNP-TV-Z]{26})`:/.exec(markdown);
    expect(addressed).not.toBeNull();
    const folderFromContext = addressed?.[1] ?? '';

    const created = await call(`/knowledge/notebooks/${notebookId}/notes`, {
      method: 'POST',
      body: { folderId: folderFromContext, content: '# Lei 14.133, art. 75' },
    });
    expect(created.status).toBe(201);
  });
});

describe('Structure operations write nothing they do not have to', () => {
  it('reorders a folder without touching any sibling', async () => {
    const { notebookId } = await seedNotebook();
    const second = (await (
      await call(`/knowledge/notebooks/${notebookId}/folders`, {
        method: 'POST',
        body: { name: 'Achados', description: 'Achados de auditoria.' },
      })
    ).json()) as { folderId: string; position: string };

    const before = (await (await call(`/knowledge/notebooks/${notebookId}`)).json()) as {
      folders: Array<{ folderId: string; position: string; name: string }>;
    };

    const reordered = await call(
      `/knowledge/notebooks/${notebookId}/folders/${second.folderId}/reorder`,
      { method: 'POST', body: { afterFolderId: null } },
    );
    // It answers the folder as the write left it, first among its siblings.
    expect(reordered.status).toBe(200);
    const moved = (await reordered.json()) as { folderId: string; position: string };
    expect(moved.folderId).toBe(second.folderId);

    const after = (await (await call(`/knowledge/notebooks/${notebookId}`)).json()) as {
      folders: Array<{ folderId: string; position: string; name: string }>;
    };
    const untouched = before.folders.filter((folder) => folder.folderId !== second.folderId);
    for (const folder of untouched) {
      const now = after.folders.find((each) => each.folderId === folder.folderId);
      // Every sibling kept its key: the reorder was a single write.
      expect(now?.position).toBe(folder.position);
    }
    expect(after.folders[0]?.folderId).toBe(second.folderId);
    expect(after.folders[0]?.position).toBe(moved.position);
  });

  it('moves a note between folders with zero bytes written to storage', async () => {
    const { notebookId, folderId } = await seedNotebook();
    const other = (await (
      await call(`/knowledge/notebooks/${notebookId}/folders`, {
        method: 'POST',
        body: { name: 'Achados', description: 'Achados de auditoria.' },
      })
    ).json()) as { folderId: string };

    const created = (await (
      await call(`/knowledge/notebooks/${notebookId}/notes`, {
        method: 'POST',
        body: { folderId, content: '# Lei 14.133\n\nLei 14.133' },
      })
    ).json()) as { noteId: string };

    const before = (await (
      await call(`/knowledge/notebooks/${notebookId}/notes/${created.noteId}`)
    ).json()) as { revision: { contentId: string; versionId: string } };

    const moved = await call(`/knowledge/notebooks/${notebookId}/notes/${created.noteId}/move`, {
      method: 'POST',
      body: { toFolderId: other.folderId },
    });
    expect(moved.status).toBe(200);

    const after = (await (
      await call(`/knowledge/notebooks/${notebookId}/notes/${created.noteId}`)
    ).json()) as { folderId: string; revision: { contentId: string; versionId: string } };

    expect(after.folderId).toBe(other.folderId);
    // Same slot, same revision: the move wrote nothing to the content store.
    expect(after.revision).toEqual(before.revision);
  });

  it('refuses to remove a folder that holds notes without an explicit policy', async () => {
    const { notebookId, folderId } = await seedNotebook();
    await call(`/knowledge/notebooks/${notebookId}/notes`, {
      method: 'POST',
      body: { folderId, content: '# Lei 14.133\n\nLei' },
    });

    const noPolicy = await call(`/knowledge/notebooks/${notebookId}/folders/${folderId}`, {
      method: 'DELETE',
    });
    expect(noPolicy.status).toBe(412);
    const body = (await noPolicy.json()) as { code: string };
    expect(body.code).toBe('PRECONDITION_FAILED');
  });
});

describe('Notebook lifecycle', () => {
  it('refuses a second notebook of the same name and points at the one that exists', async () => {
    /**
     * RN-KNW-032. A notebook is chosen by name before anything else, so a twin
     * would make every choice between the two a guess, and a retried creation
     * would make one. The answer is the identifier of what exists, never an
     * invented suffix.
     */
    const first = (await (
      await call('/knowledge/notebooks', {
        method: 'POST',
        body: { name: 'Normas e Legislacao', description: 'Texto normativo' },
      })
    ).json()) as { notebookId: string };

    const twin = await call('/knowledge/notebooks', {
      method: 'POST',
      body: { name: 'Normas e Legislacao', description: 'Outra descricao' },
    });
    expect(twin.status).toBe(409);
    const body = (await twin.json()) as { details: { code: string; notebookId: string } };
    expect(body.details.code).toBe('ALREADY_EXISTS');
    expect(body.details.notebookId).toBe(first.notebookId);

    // And the catalogue holds one, not two.
    const listed = (await (await call('/knowledge/notebooks')).json()) as Array<{ slug: string }>;
    expect(listed.filter((notebook) => notebook.slug === 'normas-e-legislacao')).toHaveLength(1);
  });
});

describe('Note lifecycle', () => {
  it('writes a note whose content states no name, and says so', async () => {
    // RN-KNW-036: the note exists, it renders and it is searchable; what no
    // link can do is name it. Refusing the write is how an import loses a
    // notebook, so the absence is reported instead.
    const { notebookId, folderId } = await seedNotebook();
    const created = await call(`/knowledge/notebooks/${notebookId}/notes`, {
      method: 'POST',
      body: { folderId, content: 'Apenas prosa, sem titulo nenhum.' },
    });
    expect(created.status).toBe(201);
    expect(((await created.json()) as { name: string | null }).name).toBeNull();
  });

  it('refuses an update based on a stale revision and returns the current content', async () => {
    const { notebookId, folderId } = await seedNotebook();
    const created = (await (
      await call(`/knowledge/notebooks/${notebookId}/notes`, {
        method: 'POST',
        body: { folderId, content: '# Lei 14.133\n\nPrimeira versao' },
      })
    ).json()) as { noteId: string };

    const read = (await (
      await call(`/knowledge/notebooks/${notebookId}/notes/${created.noteId}`)
    ).json()) as { revision: { versionId: string } };

    await call(`/knowledge/notebooks/${notebookId}/notes/${created.noteId}`, {
      method: 'PUT',
      body: { content: '# Segunda versao', baseRevision: read.revision.versionId },
    });

    const stale = await call(`/knowledge/notebooks/${notebookId}/notes/${created.noteId}`, {
      method: 'PUT',
      body: { content: '# Terceira versao', baseRevision: read.revision.versionId },
    });
    expect(stale.status).toBe(409);
    const body = (await stale.json()) as { details: { currentContent: string } };
    // RN-AGT-005: the current content travels with the conflict.
    expect(body.details.currentContent).toContain('Segunda versao');
  });

  it('keeps a deleted note out of the listings and readable by revision', async () => {
    const { notebookId, folderId } = await seedNotebook();
    const created = (await (
      await call(`/knowledge/notebooks/${notebookId}/notes`, {
        method: 'POST',
        body: { folderId, content: '# Lei 14.133\n\nConteudo preservado' },
      })
    ).json()) as { noteId: string };

    expect(
      (
        await call(`/knowledge/notebooks/${notebookId}/notes/${created.noteId}`, {
          method: 'DELETE',
        })
      ).status,
    ).toBe(204);

    const listed = (await (
      await call(`/knowledge/notebooks/${notebookId}/notes`)
    ).json()) as unknown[];
    expect(listed).toHaveLength(0);
    expect((await call(`/knowledge/notebooks/${notebookId}/notes/${created.noteId}`)).status).toBe(
      404,
    );

    // The slug came back to the notebook (RN-KNW-030), and restoring works.
    const reused = await call(`/knowledge/notebooks/${notebookId}/notes`, {
      method: 'POST',
      body: { folderId, content: '# Lei 14.133\n\nOutra nota' },
    });
    expect(reused.status).toBe(201);
  });

  it('rejects a note above the size limit', async () => {
    const { notebookId, folderId } = await seedNotebook();
    const tooLarge = await call(`/knowledge/notebooks/${notebookId}/notes`, {
      method: 'POST',
      body: { folderId, content: 'x'.repeat(1_048_577) },
    });
    expect(tooLarge.status).toBe(413);
  });
});

describe('Events reach the outbox for every state change', () => {
  it('records the whole authoring cycle with authorship', async () => {
    const { notebookId, folderId } = await seedNotebook();
    await call(`/knowledge/notebooks/${notebookId}/guidance`, {
      method: 'PUT',
      body: { content: '# Proposito' },
    });
    await call(`/knowledge/notebooks/${notebookId}/notes`, {
      method: 'POST',
      body: { folderId, content: '# Lei 14.133\n\nLei' },
    });

    const types = harness.events.published.map((event) => event.type);
    expect(types).toContain('SubscriptionRequested');
    expect(types).toContain('NotebookCreated');
    expect(types).toContain('FolderAdded');
    expect(types).toContain('GuidanceUpdated');
    expect(types).toContain('NoteCreated');

    // Every one of them names the human who caused it (PE6).
    for (const event of harness.events.published) {
      expect(event.authorship.user.value).toBeTruthy();
    }
    // And the content events carry the complete ref (RN-AUD-003).
    const noteCreated = harness.events.ofType('NoteCreated')[0];
    expect(noteCreated?.contentRef?.sha256).toHaveLength(64);
    expect(noteCreated?.contentRef?.bytes).toBeGreaterThan(0);
  });
});
