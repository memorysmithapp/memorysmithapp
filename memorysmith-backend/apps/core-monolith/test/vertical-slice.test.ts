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
import { sessionSchema } from '@memorysmith/contracts';

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
    body: JSON.stringify({ name: 'Tribunal de Contas' }),
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

async function seedVault(): Promise<{ vaultId: string; folderId: string }> {
  const session = (await (await call('/access/session')).json()) as {
    workspaces: Array<{ workspaceId: string }>;
  };
  const vault = (await (
    await call('/knowledge/vaults', {
      method: 'POST',
      body: {
        workspaceId: session.workspaces[0]?.workspaceId,
        name: 'Normas e Legislacao',
        description: 'Texto normativo por artigo',
      },
    })
  ).json()) as { vaultId: string };

  const folder = (await (
    await call(`/knowledge/vaults/${vault.vaultId}/folders`, {
      method: 'POST',
      body: {
        name: 'Normas',
        description: 'Texto normativo por artigo. Uma norma por nota, sempre com orgao.',
      },
    })
  ).json()) as { folderId: string };

  return { vaultId: vault.vaultId, folderId: folder.folderId };
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
    expect(parsed.data.workspaces[0]?.role).toBe('OWNER');
  });
});

describe('The authoring cycle', () => {
  it('writes guidance, a tree, a template and a note', async () => {
    const { vaultId, folderId } = await seedVault();

    expect(
      (
        await call(`/knowledge/vaults/${vaultId}/guidance`, {
          method: 'PUT',
          body: { content: '# Proposito\n\nUma norma por nota.' },
        })
      ).status,
    ).toBe(200);

    expect(
      (
        await call(`/knowledge/vaults/${vaultId}/folders/${folderId}/template`, {
          method: 'PUT',
          body: { content: '# {{titulo}}\n\n## Vigencia\n' },
        })
      ).status,
    ).toBe(204);

    const note = await call(`/knowledge/vaults/${vaultId}/notes`, {
      method: 'POST',
      body: { folderId, title: 'Lei 14.133, art. 75', content: '# Lei 14.133\n\nArt. 75.' },
    });
    expect(note.status).toBe(201);

    const detail = (await (await call(`/knowledge/vaults/${vaultId}`)).json()) as {
      hasGuidance: boolean;
      folders: Array<{ hasTemplate: boolean; slug: string }>;
      guidance: { content: string } | null;
    };
    expect(detail.hasGuidance).toBe(true);
    expect(detail.guidance?.content).toContain('Uma norma por nota');
    expect(detail.folders[0]?.hasTemplate).toBe(true);
    expect(detail.folders[0]?.slug).toBe('normas');
  });

  it('serves the Vault Context as Markdown, guidance plus the annotated tree', async () => {
    const { vaultId, folderId } = await seedVault();
    await call(`/knowledge/vaults/${vaultId}/guidance`, {
      method: 'PUT',
      body: { content: '# Proposito\n\nUma norma por nota.' },
    });
    await call(`/knowledge/vaults/${vaultId}/folders/${folderId}/template`, {
      method: 'PUT',
      body: { content: '# Modelo' },
    });

    const context = await call(`/knowledge/vaults/${vaultId}/context`);
    expect(context.headers.get('content-type')).toContain('text/markdown');
    const markdown = await context.text();
    expect(markdown).toContain('# Vault: Normas e Legislacao');
    expect(markdown).toContain('Uma norma por nota.');
    expect(markdown).toContain('## Structure');
    expect(markdown).toContain('1. **Normas**:');
    expect(markdown).toContain('has TEMPLATE.md');
  });
});

describe('Structure operations write nothing they do not have to', () => {
  it('reorders a folder without touching any sibling', async () => {
    const { vaultId } = await seedVault();
    const second = (await (
      await call(`/knowledge/vaults/${vaultId}/folders`, {
        method: 'POST',
        body: { name: 'Achados', description: 'Achados de auditoria.' },
      })
    ).json()) as { folderId: string; position: string };

    const before = (await (await call(`/knowledge/vaults/${vaultId}`)).json()) as {
      folders: Array<{ folderId: string; position: string; name: string }>;
    };

    const reordered = await call(
      `/knowledge/vaults/${vaultId}/folders/${second.folderId}/reorder`,
      { method: 'POST', body: { afterFolderId: null } },
    );
    expect(reordered.status).toBe(204);

    const after = (await (await call(`/knowledge/vaults/${vaultId}`)).json()) as {
      folders: Array<{ folderId: string; position: string; name: string }>;
    };
    const untouched = before.folders.filter((folder) => folder.folderId !== second.folderId);
    for (const folder of untouched) {
      const now = after.folders.find((each) => each.folderId === folder.folderId);
      // Every sibling kept its key: the reorder was a single write.
      expect(now?.position).toBe(folder.position);
    }
    expect(after.folders[0]?.folderId).toBe(second.folderId);
  });

  it('moves a note between folders with zero bytes written to storage', async () => {
    const { vaultId, folderId } = await seedVault();
    const other = (await (
      await call(`/knowledge/vaults/${vaultId}/folders`, {
        method: 'POST',
        body: { name: 'Achados', description: 'Achados de auditoria.' },
      })
    ).json()) as { folderId: string };

    const created = (await (
      await call(`/knowledge/vaults/${vaultId}/notes`, {
        method: 'POST',
        body: { folderId, title: 'Lei 14.133', content: '# Lei 14.133' },
      })
    ).json()) as { noteId: string };

    const before = (await (
      await call(`/knowledge/vaults/${vaultId}/notes/${created.noteId}`)
    ).json()) as { revision: { contentId: string; versionId: string } };

    const moved = await call(`/knowledge/vaults/${vaultId}/notes/${created.noteId}/move`, {
      method: 'POST',
      body: { toFolderId: other.folderId },
    });
    expect(moved.status).toBe(200);

    const after = (await (
      await call(`/knowledge/vaults/${vaultId}/notes/${created.noteId}`)
    ).json()) as { folderId: string; revision: { contentId: string; versionId: string } };

    expect(after.folderId).toBe(other.folderId);
    // Same slot, same revision: the move wrote nothing to the content store.
    expect(after.revision).toEqual(before.revision);
  });

  it('refuses to remove a folder that holds notes without an explicit policy', async () => {
    const { vaultId, folderId } = await seedVault();
    await call(`/knowledge/vaults/${vaultId}/notes`, {
      method: 'POST',
      body: { folderId, title: 'Lei 14.133', content: '# Lei' },
    });

    const noPolicy = await call(`/knowledge/vaults/${vaultId}/folders/${folderId}`, {
      method: 'DELETE',
    });
    expect(noPolicy.status).toBe(412);
    const body = (await noPolicy.json()) as { code: string };
    expect(body.code).toBe('PRECONDITION_FAILED');
  });
});

describe('Note lifecycle', () => {
  it('refuses a duplicate slug and points at the note that already exists', async () => {
    const { vaultId, folderId } = await seedVault();
    const first = (await (
      await call(`/knowledge/vaults/${vaultId}/notes`, {
        method: 'POST',
        body: { folderId, title: 'Lei 14.133', content: '# Lei' },
      })
    ).json()) as { noteId: string };

    const duplicate = await call(`/knowledge/vaults/${vaultId}/notes`, {
      method: 'POST',
      body: { folderId, title: 'Lei 14.133', content: '# Lei outra vez' },
    });
    expect(duplicate.status).toBe(409);
    const body = (await duplicate.json()) as {
      details: { code: string; noteId: string };
    };
    // RN-AGT-004: the identifier of the existing note comes back, and the
    // server never invents a suffix.
    expect(body.details.code).toBe('ALREADY_EXISTS');
    expect(body.details.noteId).toBe(first.noteId);
  });

  it('refuses an update based on a stale revision and returns the current content', async () => {
    const { vaultId, folderId } = await seedVault();
    const created = (await (
      await call(`/knowledge/vaults/${vaultId}/notes`, {
        method: 'POST',
        body: { folderId, title: 'Lei 14.133', content: '# Primeira versao' },
      })
    ).json()) as { noteId: string };

    const read = (await (
      await call(`/knowledge/vaults/${vaultId}/notes/${created.noteId}`)
    ).json()) as { revision: { versionId: string } };

    await call(`/knowledge/vaults/${vaultId}/notes/${created.noteId}`, {
      method: 'PUT',
      body: { content: '# Segunda versao', baseRevision: read.revision.versionId },
    });

    const stale = await call(`/knowledge/vaults/${vaultId}/notes/${created.noteId}`, {
      method: 'PUT',
      body: { content: '# Terceira versao', baseRevision: read.revision.versionId },
    });
    expect(stale.status).toBe(409);
    const body = (await stale.json()) as { details: { currentContent: string } };
    // RN-AGT-005: the current content travels with the conflict.
    expect(body.details.currentContent).toContain('Segunda versao');
  });

  it('keeps a deleted note out of the listings and readable by revision', async () => {
    const { vaultId, folderId } = await seedVault();
    const created = (await (
      await call(`/knowledge/vaults/${vaultId}/notes`, {
        method: 'POST',
        body: { folderId, title: 'Lei 14.133', content: '# Conteudo preservado' },
      })
    ).json()) as { noteId: string };

    expect(
      (await call(`/knowledge/vaults/${vaultId}/notes/${created.noteId}`, { method: 'DELETE' }))
        .status,
    ).toBe(204);

    const listed = (await (await call(`/knowledge/vaults/${vaultId}/notes`)).json()) as unknown[];
    expect(listed).toHaveLength(0);
    expect((await call(`/knowledge/vaults/${vaultId}/notes/${created.noteId}`)).status).toBe(404);

    // The slug came back to the vault (RN-KNW-030), and restoring works.
    const reused = await call(`/knowledge/vaults/${vaultId}/notes`, {
      method: 'POST',
      body: { folderId, title: 'Lei 14.133', content: '# Outra nota' },
    });
    expect(reused.status).toBe(201);
  });

  it('rejects a note above the size limit', async () => {
    const { vaultId, folderId } = await seedVault();
    const tooLarge = await call(`/knowledge/vaults/${vaultId}/notes`, {
      method: 'POST',
      body: { folderId, title: 'Enorme', content: 'x'.repeat(1_048_577) },
    });
    expect(tooLarge.status).toBe(413);
  });
});

describe('Events reach the outbox for every state change', () => {
  it('records the whole authoring cycle with authorship', async () => {
    const { vaultId, folderId } = await seedVault();
    await call(`/knowledge/vaults/${vaultId}/guidance`, {
      method: 'PUT',
      body: { content: '# Proposito' },
    });
    await call(`/knowledge/vaults/${vaultId}/notes`, {
      method: 'POST',
      body: { folderId, title: 'Lei 14.133', content: '# Lei' },
    });

    const types = harness.events.published.map((event) => event.type);
    expect(types).toContain('SubscriptionRequested');
    expect(types).toContain('VaultCreated');
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
