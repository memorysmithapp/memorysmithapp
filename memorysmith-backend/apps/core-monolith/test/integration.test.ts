/**
 * The full slice, over HTTP, across four contexts: a vault is authored, the
 * events it produced feed the audit trail and the discovery projections, and
 * the reads come back through the API the UI and the connector use.
 *
 * This is what "the whole thing works" means before any of it is deployed.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from './wiring.js';

type App = ReturnType<typeof buildTestApp>;
let harness: App;
const TOKEN = 'token-owner';

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

/** Drains what the writes published into the projections, as the bus would. */
async function drainEvents(): Promise<void> {
  const envelopes = harness.events.published.map((event) => ({
    eventId: event.eventId,
    type: event.type,
    occurredAt: event.occurredAt.toISOString(),
    subscriptionId: event.subscriptionId.value,
    subject: event.subject,
    subjectId: event.subjectId,
    authorship: event.authorship.toJSON(),
    contentRef: event.contentRef ? event.contentRef.toJSON() : null,
    payload: event.payload,
  }));

  await harness.auditConsumer.consume(envelopes);

  for (const event of harness.events.published) {
    const payload = event.payload as Record<string, string>;
    if (event.type === 'VaultCreated') {
      await harness.projectStructure.onVault(String(payload['vaultId']), String(payload['name']));
    }
    if (event.type === 'FolderAdded') {
      await harness.projectStructure.onFolder(String(payload['vaultId']), {
        folderId: String(payload['folderId']),
        name: String(payload['name']),
        description: String(payload['description']),
        parentFolderId: payload['parentFolderId'] ? String(payload['parentFolderId']) : null,
      });
    }
    if (event.type === 'NoteCreated' || event.type === 'NoteUpdated') {
      await harness.projectNote.onWritten({
        vaultId: String(payload['vaultId']),
        noteId: String(payload['noteId']),
        folderId: String(payload['folderId']),
        title: String(payload['title']),
        slug: String(payload['slug']),
        contentRef: event.contentRef
          ? { contentId: event.contentRef.contentId.value, versionId: event.contentRef.versionId }
          : null,
      });
    }
  }
  harness.events.published.length = 0;
}

async function seed(): Promise<{
  vaultId: string;
  folderId: string;
  notes: Record<string, string>;
}> {
  const vault = (await (
    await call('/knowledge/vaults', {
      method: 'POST',
      body: {
        name: 'Normas e Legislacao',
        description: 'Texto normativo por artigo',
      },
    })
  ).json()) as { vaultId: string };

  const folder = (await (
    await call(`/knowledge/vaults/${vault.vaultId}/folders`, {
      method: 'POST',
      body: { name: 'Normas', description: 'Texto normativo por artigo. Uma norma por nota.' },
    })
  ).json()) as { folderId: string };

  const achado = (await (
    await call(`/knowledge/vaults/${vault.vaultId}/notes`, {
      method: 'POST',
      body: {
        folderId: folder.folderId,
        title: 'Achado 12',
        content:
          '---\nmaturity: seed\nreviewed: false\n---\n\n# Achado 12\n\nFundamento: [[lei-14133]].',
      },
    })
  ).json()) as { noteId: string };

  const lei = (await (
    await call(`/knowledge/vaults/${vault.vaultId}/notes`, {
      method: 'POST',
      body: {
        folderId: folder.folderId,
        title: 'Lei 14.133',
        content: '---\nmaturity: evergreen\nreviewed: true\n---\n\n# Lei 14.133\n\nArt. 75.',
      },
    })
  ).json()) as { noteId: string };

  await drainEvents();
  return {
    vaultId: vault.vaultId,
    folderId: folder.folderId,
    notes: { achado: achado.noteId, lei: lei.noteId },
  };
}

beforeEach(async () => {
  harness = buildTestApp();
  harness.verifier.issue(TOKEN, { sub: 'user-owner', email: 'owner@example.com' });

  const created = await call('/access/subscriptions', {
    method: 'POST',
    body: { name: 'Tribunal de Contas' },
  });
  const { subscriptionId } = (await created.json()) as { subscriptionId: string };

  harness.verifier.issue('platform-token', {
    sub: 'platform-admin',
    email: 'admin@memorysmith.app',
    groups: ['platform-admin'],
  });
  await call(`/access/platform/subscriptions/${subscriptionId}/approve`, {
    method: 'POST',
    body: { status: 'active' },
    token: 'platform-token',
  });
  harness.verifier.issue(TOKEN, {
    sub: 'user-owner',
    email: 'owner@example.com',
    subscription_id: subscriptionId,
    subscription_status: 'active',
  });
});

describe('Discovery answers over the API', () => {
  it('resolves a link written before its target existed', async () => {
    const { vaultId, notes } = await seed();

    const backlinks = (await (
      await call(`/discovery/vaults/${vaultId}/notes/${notes['lei']}/backlinks`)
    ).json()) as { backlinks: Array<{ noteId: string }> };

    // The link was pending when the achado was written and resolved on its own
    // when the lei was created (RN-DSC-004).
    expect(backlinks.backlinks.map((note) => note.noteId)).toEqual([notes['achado']]);
  });

  it('walks the dependency tree from a note', async () => {
    const { vaultId, notes } = await seed();
    const tree = (await (
      await call(`/discovery/vaults/${vaultId}/notes/${notes['achado']}/graph?depth=2`)
    ).json()) as { note: { noteId: string }; children: Array<{ note: { noteId: string } }> };

    expect(tree.note.noteId).toBe(notes['achado']);
    expect(tree.children.map((child) => child.note.noteId)).toEqual([notes['lei']]);
  });

  it('searches by meaning and cites the section it came from', async () => {
    const { vaultId, notes } = await seed();
    const found = (await (
      await call(`/discovery/vaults/${vaultId}/search`, {
        method: 'POST',
        body: { query: 'Art. 75', mode: 'semantic' },
      })
    ).json()) as { hits: Array<{ noteId: string; section: string | null }> };

    expect(found.hits.length).toBeGreaterThan(0);
    expect(found.hits[0]?.noteId).toBe(notes['lei']);
    expect(found.hits[0]?.section).toBe('Lei 14.133');
  });

  it('counts the curation facets of the vault', async () => {
    const { vaultId } = await seed();
    const stats = (await (await call(`/discovery/vaults/${vaultId}/facets`)).json()) as {
      noteCount: number;
      facets: Array<{ facet: string; values: Array<{ value: string; count: number }> }>;
    };

    expect(stats.noteCount).toBe(2);
    const maturity = stats.facets.find((facet) => facet.facet === 'maturity');
    expect(maturity?.values.map((value) => value.value).sort()).toEqual(['evergreen', 'seed']);
    const reviewed = stats.facets.find((facet) => facet.facet === 'reviewed');
    expect(reviewed?.values).toHaveLength(2);
  });

  it('answers 404 for a vault of another subscription', async () => {
    const { vaultId } = await seed();
    harness.verifier.issue('token-b', { sub: 'user-b', email: 'b@example.com' });
    const other = await call('/access/subscriptions', {
      method: 'POST',
      body: { name: 'Outra' },
      token: 'token-b',
    });
    const { subscriptionId } = (await other.json()) as { subscriptionId: string };
    await call(`/access/platform/subscriptions/${subscriptionId}/approve`, {
      method: 'POST',
      body: { status: 'active' },
      token: 'platform-token',
    });
    harness.verifier.issue('token-b', {
      sub: 'user-b',
      email: 'b@example.com',
      subscription_id: subscriptionId,
      subscription_status: 'active',
    });

    const attempt = await call(`/discovery/vaults/${vaultId}/facets`, { token: 'token-b' });
    expect(attempt.status).toBe(404);
  });
});

describe('Audit answers over the API', () => {
  it('serves the timeline of a note with authorship', async () => {
    const { notes } = await seed();
    const history = (await (await call(`/audit/notes/${notes['lei']}/history`)).json()) as {
      entries: Array<{ type: string; authorship: { userId: string; agent: unknown } }>;
    };

    expect(history.entries.map((entry) => entry.type)).toContain('NoteCreated');
    expect(history.entries[0]?.authorship.userId).toBe('user-owner');
    // Written through the UI, so no agent (section 12.1).
    expect(history.entries[0]?.authorship.agent).toBeNull();
  });

  it('records the whole authoring cycle, not only the notes', async () => {
    const { vaultId } = await seed();
    const activity = (await (await call(`/audit/vaults/${vaultId}/activity`)).json()) as {
      entries: Array<{ type: string }>;
    };
    const types = activity.entries.map((entry) => entry.type);
    expect(types).toContain('VaultCreated');
    expect(types).toContain('FolderAdded');
    expect(types).toContain('NoteCreated');
  });

  it('keeps the timeline after the note is deleted', async () => {
    const { vaultId, notes } = await seed();
    await call(`/knowledge/vaults/${vaultId}/notes/${notes['lei']}`, { method: 'DELETE' });
    await drainEvents();

    // The note is gone from the listings and the history is still there.
    expect((await call(`/knowledge/vaults/${vaultId}/notes/${notes['lei']}`)).status).toBe(404);
    const history = (await (await call(`/audit/notes/${notes['lei']}/history`)).json()) as {
      entries: Array<{ type: string }>;
    };
    expect(history.entries.map((entry) => entry.type)).toContain('NoteDeleted');
  });
});
