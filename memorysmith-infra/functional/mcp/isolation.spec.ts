/**
 * Isolation through the connector (architecture-guide.md, rules 1, 2 and 9).
 *
 * The subscription of a connector is fixed when consent is given, and no
 * argument of any tool moves it. A notebook of another subscription is not
 * there for the agent, through any tool, and nothing it answers gives away
 * that it exists: a write into it fails, and the notebook is untouched for its
 * owner afterwards.
 */

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { test as base, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { apiToken } from '../support/accounts.js';
import { Api } from '../support/api.js';
import { readConnectorToken } from '../support/connector-state.js';
import { callTool, connectAgent } from '../support/mcp.js';
import { readState } from '../support/state.js';

interface Foreign {
  readonly owner: Api;
  readonly notebookId: string;
  readonly folderId: string;
  readonly noteId: string;
}

const test = base.extend<{ agent: Client; foreign: Foreign }>({
  // eslint-disable-next-line no-empty-pattern -- a fixture that depends on nothing
  agent: async ({}, use) => {
    const state = readState();
    const client = await connectAgent(state.surfaces.mcp, readConnectorToken().accessToken);
    try {
      await use(client);
    } finally {
      await client.close();
    }
  },
  // eslint-disable-next-line no-empty-pattern -- a fixture that depends on nothing
  foreign: async ({}, use) => {
    const state = readState();
    const owner = new Api(state.surfaces.api, await apiToken(state, state.accounts.other));
    const notebook = await owner.ok<{ notebookId: string }>('POST', '/knowledge/notebooks', {
      name: `Foreign ${randomBytes(4).toString('hex')}`,
      description: 'A notebook of another subscription.',
    });
    const folder = await owner.ok<{ folderId: string }>(
      'POST',
      `/knowledge/notebooks/${notebook.notebookId}/folders`,
      { name: 'Private', description: 'What the other subscription keeps to itself.' },
    );
    const note = await owner.ok<{ noteId: string }>(
      'POST',
      `/knowledge/notebooks/${notebook.notebookId}/notes`,
      {
        folderId: folder.folderId,
        content: '---\nname: Private note\n---\n\nNot for the agent of another subscription.\n',
      },
    );
    await use({
      owner,
      notebookId: notebook.notebookId,
      folderId: folder.folderId,
      noteId: note.noteId,
    });
  },
});

test('an agent finds nothing where a notebook of another subscription is, through any tool', async ({
  agent,
  foreign,
}) => {
  const notebook = { notebook: foreign.notebookId };
  const note = { ...notebook, note: foreign.noteId };
  const refused: Array<[string, Record<string, unknown>]> = [
    ['get_notebook_context', notebook],
    ['get_guidance', notebook],
    ['list_notes', notebook],
    ['read_note', note],
    ['backlinks', note],
    ['search_notes', { ...notebook, query: 'Private' }],
    [
      'create_note',
      { ...notebook, folder: foreign.folderId, content: '---\nname: Intrusion\n---\n' },
    ],
    ['delete_notebook', notebook],
  ];
  for (const [name, args] of refused) {
    const answer = await callTool(agent, name, args);
    expect(answer.isError, `${name} answered: ${answer.text}`).toBe(true);
    expect(answer.text, name).not.toContain('Private note');
  }

  // The trail is read under the subscription of the token, so another
  // subscription's note has no history here, rather than a refusal.
  const history = await callTool(agent, 'note_history', note);
  expect(
    history.isError || (JSON.parse(history.text) as { entries: unknown[] }).entries.length === 0,
  ).toBe(true);

  expect((await callTool(agent, 'list_notebooks')).text).not.toContain(foreign.notebookId);
  expect(
    (await foreign.owner.call('GET', `/knowledge/notebooks/${foreign.notebookId}`)).status,
  ).toBe(200);
});
