/**
 * The thesis of the product, across its surfaces (software-vision.md,
 * section 1): a notebook carries its own instructions, an agent that reads them
 * writes the way its owner would, a person reads what the agent wrote and acts
 * on it, and the record of the note keeps both of them apart.
 */

import { expect, test } from '@playwright/test';
import { apiToken } from '../support/accounts.js';
import { Api } from '../support/api.js';
import { readConnectorToken } from '../support/connector-state.js';
import { eventually } from '../support/eventually.js';
import { callTool, connectAgent, parsed } from '../support/mcp.js';
import { readState } from '../support/state.js';
import { openAs, writeNotebook } from '../web/fixtures.js';

test('an agent writes by the Guidance and the Template, a person ticks a box on the web, and the history names both', async ({
  page,
}) => {
  const state = readState();
  const connector = readConnectorToken();
  const owner = new Api(state.surfaces.api, await apiToken(state, state.accounts.owner));
  const notebook = await writeNotebook(owner, state);

  const agent = await connectAgent(state.surfaces.mcp, connector.accessToken);
  try {
    // The agent reads before it writes: the Guidance, the folder, its Template.
    const context = await callTool(agent, 'get_notebook_context', {
      notebook: notebook.notebookId,
    });
    expect(context.text).toContain('say how it was verified');
    const template = await callTool(agent, 'get_template', {
      notebook: notebook.notebookId,
      folder: notebook.folderId,
    });
    expect(template.text).toContain('## Verification');

    const written = parsed<{ noteId: string }>(
      await callTool(agent, 'create_note', {
        notebook: notebook.notebookId,
        folder: notebook.folderId,
        content:
          '---\nname: Agent finding\n---\n\n## Finding\n\nThe agent found it.\n\n## Verification\n\n- [ ] reproduced by a person\n',
      }),
    );

    // A person reads it on the web, and ticks the box the agent left.
    await openAs(page, state, state.accounts.owner, 'en_US');
    await page.goto(notebook.page(`/notes/${written.noteId.toLowerCase()}`));
    await expect(page.getByRole('heading', { level: 1, name: 'Agent finding' })).toBeVisible();
    await page
      .locator('li.task-item', { hasText: 'reproduced by a person' })
      .getByRole('checkbox')
      .check();
    await expect(page.locator('.write-status')).toHaveAttribute('data-state', 'saved', {
      timeout: 15_000,
    });

    // The record keeps them apart: the same person, once through the connector.
    const history = await eventually(
      'both writes in the history of the note',
      async () =>
        parsed<{
          entries: Array<{
            contentRef: unknown;
            authorship: { userId: string; agent: { clientId: string } | null };
          }>;
        }>(
          await callTool(agent, 'note_history', {
            notebook: notebook.notebookId,
            note: written.noteId,
          }),
        ),
      (answer) => answer.entries.filter((entry) => entry.contentRef !== null).length >= 2,
    );
    const writes = history.entries.filter((entry) => entry.contentRef !== null);
    expect(writes[0]?.authorship.agent?.clientId).toBe(connector.clientId);
    expect(writes[writes.length - 1]?.authorship.agent).toBeNull();
    expect(writes[0]?.authorship.userId).toBe(writes[writes.length - 1]?.authorship.userId);
  } finally {
    await agent.close();
  }
});
