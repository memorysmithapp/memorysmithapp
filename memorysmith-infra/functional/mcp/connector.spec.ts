/**
 * The connector, as an agent uses it (software-vision.md, section 9;
 * architecture-guide.md, section 13): what it answers without a token, what it
 * tells an agent in the handshake, and every tool of its catalog, called
 * through the official MCP SDK with the token the OAuth flow handed the suite.
 *
 * Which tools there are is read from the live `tools/list`, so a tool added to
 * the catalog without a case here fails the suite.
 */

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { test as base, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readConnectorToken, type ConnectorToken } from '../support/connector-state.js';
import { coverageGap, declaredCases, describeGap } from '../support/coverage.js';
import { eventually } from '../support/eventually.js';
import { callTool, connectAgent, parsed } from '../support/mcp.js';
import { readState, type RunState } from '../support/state.js';

interface AgentNotebook {
  readonly notebookId: string;
  readonly folderId: string;
}

interface Fixtures {
  state: RunState;
  connector: ConnectorToken;
  agent: Client;
  notebook: AgentNotebook;
}

const unique = (what: string): string => `${what} ${randomBytes(4).toString('hex')}`;

const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern -- a fixture that depends on nothing
  state: async ({}, use) => {
    await use(readState());
  },
  // eslint-disable-next-line no-empty-pattern -- a fixture that depends on nothing
  connector: async ({}, use) => {
    await use(readConnectorToken());
  },
  agent: async ({ state, connector }, use) => {
    const client = await connectAgent(state.surfaces.mcp, connector.accessToken);
    try {
      await use(client);
    } finally {
      await client.close();
    }
  },
  notebook: async ({ agent }, use) => {
    const notebook = parsed<{ notebookId: string }>(
      await callTool(agent, 'create_notebook', {
        name: unique('Agent'),
        description: 'A notebook an agent case writes in.',
      }),
    );
    const folder = parsed<{ folderId: string }>(
      await callTool(agent, 'create_folder', {
        notebook: notebook.notebookId,
        name: 'Findings',
        description: 'What an agent found.',
      }),
    );
    await use({ notebookId: notebook.notebookId, folderId: folder.folderId });
  },
});

test.describe('the connector before a tool is called', () => {
  test('refuses a request without a token, and says where to authorize', async ({ state }) => {
    const refused = await fetch(`${state.surfaces.mcp}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(refused.status).toBe(401);
    expect(refused.headers.get('www-authenticate')).toContain(
      `resource_metadata="${state.surfaces.mcp}/.well-known/oauth-protected-resource"`,
    );

    const resource = (await (
      await fetch(`${state.surfaces.mcp}/.well-known/oauth-protected-resource`)
    ).json()) as { resource: string };
    const server = (await (
      await fetch(`${state.surfaces.mcp}/.well-known/oauth-authorization-server`)
    ).json()) as Record<string, unknown>;
    expect(resource.resource).toBe(`${state.surfaces.mcp}/mcp`);
    expect(server['client_id_metadata_document_supported']).toBe(true);
    expect(server['code_challenge_methods_supported']).toEqual(['S256']);
    expect(server['registration_endpoint']).toBeUndefined();
  });

  test('tells an agent which environment this is and which version it runs (RN-AGT-026)', async ({
    agent,
    state,
  }) => {
    if (state.version) expect(agent.getServerVersion()?.version).toBe(state.version);
    expect(agent.getInstructions()).toContain(
      `This is the ${state.environment} environment of MemorySmith`,
    );
  });

  test('has a case for every tool it lists, and none for a tool that is gone', async ({
    agent,
  }) => {
    const { tools } = await agent.listTools();
    const here = dirname(fileURLToPath(import.meta.url));
    const sources = readdirSync(here)
      .filter((file) => file.endsWith('.spec.ts'))
      .map((file) => readFileSync(join(here, file), 'utf8'));

    expect(
      describeGap(
        'tool',
        coverageGap(
          tools.map((tool) => tool.name),
          declaredCases(sources).tool,
        ),
      ),
    ).toBeNull();
  });
});

test.describe('the tools', () => {
  test('[tool:whoami] names where this is before anything else, then the person and the connector', async ({
    agent,
    state,
    connector,
  }) => {
    const answer = await callTool(agent, 'whoami');

    expect(answer.isError).toBe(false);
    expect(answer.text).toContain(state.accounts.owner.email);
    expect(answer.text).toContain(`**Connector**: ${connector.clientName}`);
    const where = answer.text.indexOf('## Where this is');
    expect(where).toBeGreaterThanOrEqual(0);
    expect(where).toBeLessThan(answer.text.indexOf('## Who is acting'));
  });

  test('[tool:get_skill] teaches the method of a task by name, and lists the names when one is wrong', async ({
    agent,
  }) => {
    const skill = await callTool(agent, 'get_skill', { name: 'design-notebook' });
    const wrong = await callTool(agent, 'get_skill', { name: 'no-such-skill' });

    expect(skill.isError).toBe(false);
    expect(skill.text.length).toBeGreaterThan(200);
    expect(wrong.isError).toBe(true);
    expect(wrong.text).toContain('write-notes');
  });

  test('[tool:create_notebook] [tool:list_notebooks] [tool:delete_notebook] creates a notebook once, finds it listed, and takes it out of every listing', async ({
    agent,
  }) => {
    const name = unique('Listed');
    const created = parsed<{ notebookId: string }>(
      await callTool(agent, 'create_notebook', { name, description: 'Created by an agent case.' }),
    );
    const again = await callTool(agent, 'create_notebook', { name, description: 'The same name.' });

    expect(again.isError).toBe(true);
    expect(again.text).toContain(created.notebookId);
    expect((await callTool(agent, 'list_notebooks')).text).toContain(created.notebookId);
    expect(
      (await callTool(agent, 'delete_notebook', { notebook: created.notebookId })).isError,
    ).toBe(false);
    expect((await callTool(agent, 'list_notebooks')).text).not.toContain(created.notebookId);
  });

  test('[tool:get_guidance] [tool:set_guidance] [tool:get_notebook_context] writes the Guidance on the revision it read, and the context carries it', async ({
    agent,
    notebook,
  }) => {
    const empty = await callTool(agent, 'get_guidance', { notebook: notebook.notebookId });
    expect(empty.text).toContain('baseRevision: null');

    const guidance = '# Guidance\n\nOne finding per note, linked to its evidence.\n';
    const written = await callTool(agent, 'set_guidance', {
      notebook: notebook.notebookId,
      content: guidance,
      baseRevision: null,
    });
    const read = parsed<{ content: string }>(
      await callTool(agent, 'get_guidance', { notebook: notebook.notebookId }),
    );
    const stale = await callTool(agent, 'set_guidance', {
      notebook: notebook.notebookId,
      content: '# A guidance that saw nothing\n',
      baseRevision: null,
    });
    const context = await callTool(agent, 'get_notebook_context', {
      notebook: notebook.notebookId,
    });

    expect(written.isError).toBe(false);
    expect(read.content).toBe(guidance);
    expect(stale.isError).toBe(true);
    expect(stale.text).toContain('CONFLICT');
    expect(context.text).toContain('One finding per note');
    expect(context.text).toContain(notebook.folderId);
  });

  test('[tool:create_folder] [tool:set_template] [tool:get_template] [tool:delete_folder] builds a folder with a Template, and removes a folder only under a policy', async ({
    agent,
    notebook,
  }) => {
    const child = parsed<{ folderId: string }>(
      await callTool(agent, 'create_folder', {
        notebook: notebook.notebookId,
        name: 'Evidence',
        description: 'What a finding rests on.',
        parent: notebook.folderId,
      }),
    );
    const template = '---\nname:\n---\n\n## Evidence\n';
    const set = await callTool(agent, 'set_template', {
      notebook: notebook.notebookId,
      folder: child.folderId,
      content: template,
      baseRevision: null,
    });
    const read = await callTool(agent, 'get_template', {
      notebook: notebook.notebookId,
      folder: child.folderId,
    });
    const refused = await callTool(agent, 'delete_folder', {
      notebook: notebook.notebookId,
      folder: notebook.folderId,
      policy: 'REJECT_IF_NOT_EMPTY',
    });
    const removed = parsed<{ removedFolderIds: string[] }>(
      await callTool(agent, 'delete_folder', {
        notebook: notebook.notebookId,
        folder: notebook.folderId,
        policy: 'CASCADE',
      }),
    );

    expect(set.isError).toBe(false);
    expect(read.text).toBe(template);
    expect(refused.isError).toBe(true);
    expect(removed.removedFolderIds).toEqual(
      expect.arrayContaining([notebook.folderId, child.folderId]),
    );
  });

  test('[tool:create_note] [tool:list_notes] [tool:read_note] [tool:update_note] [tool:delete_note] writes a note, edits it on the revision it read, and deletes it', async ({
    agent,
    notebook,
  }) => {
    const where = { notebook: notebook.notebookId };
    const created = parsed<{ noteId: string; name: string | null }>(
      await callTool(agent, 'create_note', {
        ...where,
        folder: notebook.folderId,
        content: '---\nname: Agent finding\n---\n\nWritten by an agent.\n',
      }),
    );
    expect(created.name).toBe('Agent finding');
    expect(
      (await callTool(agent, 'list_notes', { ...where, folder: notebook.folderId })).text,
    ).toContain(created.noteId);

    const note = { ...where, note: created.noteId };
    const read = parsed<{ content: string; revision: { versionId: string } }>(
      await callTool(agent, 'read_note', note),
    );
    const updated = parsed<{ content: string }>(
      await callTool(agent, 'update_note', {
        ...note,
        content: `${read.content}\nEdited on the revision it read.\n`,
        baseRevision: read.revision.versionId,
      }),
    );
    const stale = await callTool(agent, 'update_note', {
      ...note,
      content: 'An edit that saw nothing.\n',
      baseRevision: read.revision.versionId,
    });
    expect(updated.content).toContain('Edited on the revision it read.');
    expect(stale.isError).toBe(true);
    expect(stale.text).toContain('CONFLICT');

    expect((await callTool(agent, 'delete_note', note)).isError).toBe(false);
    expect(
      (await callTool(agent, 'list_notes', { ...where, folder: notebook.folderId })).text,
    ).not.toContain(created.noteId);
  });

  test('[tool:search_notes] [tool:related_notes] [tool:backlinks] finds a note by its text and follows its links, once the projection has them', async ({
    agent,
    notebook,
  }) => {
    const word = `basalt${randomBytes(3).toString('hex')}`;
    const write = async (content: string) =>
      parsed<{ noteId: string }>(
        await callTool(agent, 'create_note', {
          notebook: notebook.notebookId,
          folder: notebook.folderId,
          content,
        }),
      );
    const beta = await write(`---\nname: Beta\n---\n\nThe ${word} evidence.\n`);
    const alpha = await write('---\nname: Alpha\n---\n\nIt rests on [[Beta]].\n');
    const where = { notebook: notebook.notebookId };

    await eventually(
      `the note carrying ${word} in search`,
      () => callTool(agent, 'search_notes', { ...where, query: word }),
      (answer) => answer.text.includes(beta.noteId),
    );
    await eventually(
      'Beta beneath Alpha',
      () => callTool(agent, 'related_notes', { ...where, note: alpha.noteId, depth: 1 }),
      (answer) => !answer.isError && answer.text.includes(beta.noteId),
    );
    await eventually(
      'Alpha among the backlinks of Beta',
      () => callTool(agent, 'backlinks', { ...where, note: beta.noteId }),
      (answer) => answer.text.includes(alpha.noteId),
    );
  });

  test('[tool:note_history] [tool:read_note] records the connector of every write, and reads a note as it was', async ({
    agent,
    notebook,
    connector,
  }) => {
    const created = parsed<{ noteId: string }>(
      await callTool(agent, 'create_note', {
        notebook: notebook.notebookId,
        folder: notebook.folderId,
        content: '---\nname: Dated finding\n---\n\nAs first written.\n',
      }),
    );
    const note = { notebook: notebook.notebookId, note: created.noteId };
    const first = parsed<{ content: string; revision: { versionId: string } }>(
      await callTool(agent, 'read_note', note),
    );
    parsed(
      await callTool(agent, 'update_note', {
        ...note,
        content: '---\nname: Dated finding\n---\n\nAs written later.\n',
        baseRevision: first.revision.versionId,
      }),
    );

    const history = await eventually(
      'both writes in the history',
      async () =>
        parsed<{
          entries: Array<{
            occurredAt: string;
            contentRef: unknown;
            authorship: { agent: { clientId: string } | null };
          }>;
        }>(await callTool(agent, 'note_history', note)),
      (answer) => answer.entries.filter((entry) => entry.contentRef !== null).length >= 2,
    );
    for (const entry of history.entries) {
      expect(entry.authorship.agent?.clientId).toBe(connector.clientId);
    }

    const earliest = history.entries.find((entry) => entry.contentRef !== null);
    const asItWas = parsed<{ content: string }>(
      await callTool(agent, 'read_note', { ...note, asOf: earliest?.occurredAt }),
    );
    expect(asItWas.content).toBe(first.content);
  });
});
