/**
 * Notebook models through the connector (#353, #354, #359) and the community
 * catalog (#360), as an agent works with them: a notebook declared as a model,
 * read whole as it stands with its history (#431) and used to create a notebook; then
 * published, found, read and created from as a community model, and withdrawn.
 */

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { test as base, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { apiToken } from '../support/accounts.js';
import { Api } from '../support/api.js';
import { readConnectorToken, type ConnectorToken } from '../support/connector-state.js';
import { eventually } from '../support/eventually.js';
import { callTool, connectAgent, parsed } from '../support/mcp.js';
import { readState, type RunState } from '../support/state.js';

interface Fixtures {
  state: RunState;
  connector: ConnectorToken;
  agent: Client;
}

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
});

interface Model {
  contents: { notes: Array<{ body: string }> };
  history: { changes: Array<{ type: string }>; truncated: boolean };
}

test.describe('notebook models through the connector', () => {
  test('[tool:declare_model] [tool:get_model] [tool:list_models] [tool:create_notebook_from_model] [tool:publish_model] [tool:search_community_models] [tool:read_community_model] [tool:create_notebook_from_community_model] [tool:withdraw_model] declares a model, reads it as it stands with its history, creates from it, and publishes it to the community', async ({
    agent,
    state,
  }) => {
    test.setTimeout(240_000);
    const marker = `model${randomBytes(4).toString('hex')}`;
    const { notebookId } = parsed<{ notebookId: string }>(
      await callTool(agent, 'create_notebook', {
        name: `Findings ${marker} {{team}}`,
        description: 'A model an agent case declares.',
      }),
    );
    const { folderId } = parsed<{ folderId: string }>(
      await callTool(agent, 'create_folder', {
        notebook: notebookId,
        name: 'Findings',
        description: 'One finding per note.',
      }),
    );
    await callTool(agent, 'create_note', {
      notebook: notebookId,
      folder: folderId,
      content: '---\nname: An example finding\n---\n\nFound by {{team}}.\n',
    });
    const created: string[] = [];

    try {
      expect(
        (
          await callTool(agent, 'declare_model', {
            notebook: notebookId,
            objective: 'Keep the findings of one team',
            parameters: [{ name: 'team', description: 'The team', type: 'text', required: true }],
          })
        ).isError,
      ).toBe(false);
      expect((await callTool(agent, 'list_models')).text).toContain(notebookId);

      // The model as its notebook stands, and the trail of it, which follows
      // a write within seconds.
      const model = await eventually(
        'the history of the model to hold its note',
        async () => parsed<Model>(await callTool(agent, 'get_model', { notebook: notebookId })),
        (each) => each.history.changes.some((change) => change.type === 'NoteCreated'),
      );
      expect(model.contents.notes[0]?.body).toContain('{{team}}');
      expect(model).not.toHaveProperty('versions');

      const own = parsed<{ notebook?: string; status: string }>(
        await callTool(agent, 'create_notebook_from_model', {
          notebook: notebookId,
          name: `From the model ${marker}`,
          values: { team: 'Agents' },
        }),
      );
      expect(own.status).toBe('ready');
      if (own.notebook) created.push(own.notebook);

      // The catalog shows the name of the account, never the e-mail.
      const owner = new Api(state.surfaces.api, await apiToken(state, state.accounts.owner));
      const profile = await owner.ok<{ name: string; email: string }>('GET', '/access/profile');
      if (!profile.name.trim() || profile.name === profile.email) {
        await owner.ok('PUT', '/access/profile', { name: 'Functional Owner', avatar: 'initials' });
      }

      const unlicensed = await callTool(agent, 'publish_model', {
        notebook: notebookId,
        language: 'en',
      });
      const published = unlicensed.isError
        ? parsed<{ publicId: string }>(
            await callTool(agent, 'publish_model', {
              notebook: notebookId,
              language: 'en',
              acceptLicence: true,
            }),
          )
        : parsed<{ publicId: string }>(unlicensed);

      const found = await eventually(
        'the model to be found in the community',
        async () =>
          parsed<{ models: Array<{ publicId: string }> }>(
            await callTool(agent, 'search_community_models', { query: marker }),
          ),
        (answer) => answer.models.length > 0,
      );
      expect(found.models.map((each) => each.publicId)).toEqual([published.publicId]);
      const community = parsed<{
        contents: { notes: Array<{ body: string }> };
        history: { changes: Array<Record<string, unknown>> };
      }>(await callTool(agent, 'read_community_model', { model: published.publicId }));
      expect(community.contents.notes[0]?.body).toContain('{{team}}');
      // When and what, never who (#431).
      for (const change of community.history.changes) expect(change).not.toHaveProperty('agent');
      const fromCommunity = parsed<{ notebook?: string; status: string }>(
        await callTool(agent, 'create_notebook_from_community_model', {
          model: published.publicId,
          name: `From the community ${marker}`,
          values: { team: 'Community' },
        }),
      );
      expect(fromCommunity.status).toBe('ready');
      if (fromCommunity.notebook) created.push(fromCommunity.notebook);

      expect((await callTool(agent, 'withdraw_model', { notebook: notebookId })).isError).toBe(
        false,
      );
      expect(
        (await callTool(agent, 'read_community_model', { model: published.publicId })).isError,
      ).toBe(true);
    } finally {
      for (const each of created) await callTool(agent, 'delete_notebook', { notebook: each });
      await callTool(agent, 'delete_notebook', { notebook: notebookId });
    }
  });
});
