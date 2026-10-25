/**
 * Collaboration across two subscriptions (#351): the owner of a notebook and a
 * person of another subscription, each with an agent of their own through the
 * connector, the owner on the web as well, writing in the same notebook at
 * once. What unit suites against DynamoDB Local cannot show is shown here,
 * against the deployed environment: concurrent writes, conflicts, the notice
 * of a changed context, the life of a share, and the record of who wrote.
 */

import { expect, test, type Page } from '@playwright/test';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { randomBytes } from 'node:crypto';
import { apiToken } from '../support/accounts.js';
import { Api } from '../support/api.js';
import { readConnectorToken } from '../support/connector-state.js';
import { eventually } from '../support/eventually.js';
import { callTool, connectAgent, parsed } from '../support/mcp.js';
import { readState } from '../support/state.js';
import { openAs } from '../web/fixtures.js';

interface Revisions {
  guidance: string | null;
  template: string | null;
  structure: string;
}

/** The revisions the end of get_notebook_context hands an agent to declare. */
async function contextOf(agent: Client, notebook: string, folder: string): Promise<Revisions> {
  const context = await callTool(agent, 'get_notebook_context', { notebook });
  const json = /```json\n([\s\S]*?)\n```/.exec(context.text.split('## Context revisions')[1] ?? '');
  const read = JSON.parse(json?.[1] ?? '{}') as Omit<Revisions, 'template'>;
  const template = await callTool(agent, 'get_template', { notebook, folder });
  const revision = template.text.startsWith('{')
    ? (JSON.parse(template.text) as { revision: string }).revision
    : null;
  return { guidance: read.guidance ?? null, template: revision, structure: read.structure };
}

/** The other person answers on their Home, in the browser, as a person does. */
async function acceptOnHome(page: Page, site: string, name: string): Promise<void> {
  await page.goto(`${site}/`);
  const card = page.locator('article', { hasText: name }).first();
  await card.getByRole('button', { name: 'Accept', exact: true }).click({ timeout: 60_000 });
  await expect(page.getByRole('button', { name: 'Accept', exact: true })).toHaveCount(0, {
    timeout: 30_000,
  });
}

test('two people of two subscriptions, each with an agent, write one notebook at once (#351)', async ({
  page,
}) => {
  test.setTimeout(300_000);
  const state = readState();
  const owner = new Api(state.surfaces.api, await apiToken(state, state.accounts.owner));
  const other = new Api(state.surfaces.api, await apiToken(state, state.accounts.other));
  const ownerAgent = await connectAgent(
    state.surfaces.mcp,
    readConnectorToken('owner').accessToken,
  );
  const otherAgent = await connectAgent(
    state.surfaces.mcp,
    readConnectorToken('other').accessToken,
  );
  const ownerUser = (await owner.ok<{ user: { userId: string } }>('GET', '/access/session')).user
    .userId;
  const otherUser = (await other.ok<{ user: { userId: string } }>('GET', '/access/session')).user
    .userId;

  const name = `Shared ${randomBytes(4).toString('hex')}`;
  const { notebookId } = await owner.ok<{ notebookId: string }>('POST', '/knowledge/notebooks', {
    name,
    description: 'A notebook two people write together.',
  });
  const path = `/knowledge/notebooks/${notebookId}`;
  const shares = `/access/notebooks/${notebookId}/shares`;
  try {
    await owner.ok('PUT', `${path}/guidance`, {
      content: '# Guidance\n\nOne finding per note.\n',
      baseRevision: null,
    });
    const { folderId } = await owner.ok<{ folderId: string }>('POST', `${path}/folders`, {
      name: 'Findings',
      description: 'What either of them found.',
    });
    await owner.ok('PUT', `${path}/folders/${folderId}/template`, {
      content: '## Finding\n',
      baseRevision: null,
    });
    const otherUsageBefore = (await other.ok<{ usedBytes: number }>('GET', '/access/usage'))
      .usedBytes;

    // ---- A content editor, accepted on the web ------------------------------
    await owner.ok('POST', shares, {
      email: state.accounts.other.email,
      profile: 'content-editor',
    });
    // Past the welcome of a first visit, which is not what this journey is about.
    await other.ok('POST', '/access/session/welcomed');
    await openAs(page, state, state.accounts.other, 'en_US');
    await acceptOnHome(page, state.surfaces.site, name);
    const listed = await callTool(otherAgent, 'list_notebooks');
    expect(listed.text).toContain(notebookId);
    expect(listed.text).toContain('content-editor');

    // ---- Concurrent creation of different notes, by two agents --------------
    const [mine, theirs] = await Promise.all([
      callTool(ownerAgent, 'create_note', {
        notebook: notebookId,
        folder: folderId,
        content: '---\nname: Owner finding\n---\n\n## Finding\n\nFound by the owner.\n',
      }),
      callTool(otherAgent, 'create_note', {
        notebook: notebookId,
        folder: folderId,
        content: '---\nname: Guest finding\n---\n\n## Finding\n\nFound by the guest.\n',
      }),
    ]);
    const ownerNote = parsed<{ noteId: string }>(mine).noteId;
    const guestNote = parsed<{ noteId: string }>(theirs).noteId;

    // ---- One name, written by both at once: one note keeps it ---------------
    const colliding = await Promise.all(
      [ownerAgent, otherAgent].map((agent) =>
        callTool(agent, 'create_note', {
          notebook: notebookId,
          folder: folderId,
          content: '---\nname: Same name\n---\n\n## Finding\n\nWritten twice at once.\n',
        }),
      ),
    );
    expect(colliding.filter((answer) => !answer.isError)).toHaveLength(1);
    const notes = await owner.ok<Array<{ name: string }>>(
      'GET',
      `${path}/notes?folderId=${folderId}`,
    );
    expect(notes.filter((note) => note.name === 'Same name')).toHaveLength(1);

    // ---- Concurrent edits of different notes, then a stale edit of one ------
    const read = (agent: Client, note: string) =>
      callTool(agent, 'read_note', { notebook: notebookId, note }).then((answer) =>
        parsed<{ content: string; revision: string }>(answer),
      );
    const [ownerRead, guestRead] = await Promise.all([
      read(ownerAgent, ownerNote),
      read(otherAgent, guestNote),
    ]);
    const edits = await Promise.all([
      callTool(ownerAgent, 'update_note', {
        notebook: notebookId,
        note: ownerNote,
        content: `${ownerRead.content}\nEdited by the owner.\n`,
        baseRevision: ownerRead.revision,
      }),
      callTool(otherAgent, 'update_note', {
        notebook: notebookId,
        note: guestNote,
        content: `${guestRead.content}\nEdited by the guest.\n`,
        baseRevision: guestRead.revision,
      }),
    ]);
    expect(edits.map((answer) => answer.isError)).toEqual([false, false]);

    const shared = await read(ownerAgent, guestNote);
    const both = await Promise.all(
      [
        [ownerAgent, 'the owner'],
        [otherAgent, 'the guest'],
      ].map(([agent, who]) =>
        callTool(agent as Client, 'update_note', {
          notebook: notebookId,
          note: guestNote,
          content: `${shared.content}\nThe stale edit of ${String(who)}.\n`,
          baseRevision: shared.revision,
        }),
      ),
    );
    expect(both.filter((answer) => answer.isError)).toHaveLength(1);
    expect(both.find((answer) => answer.isError)?.text).toContain('CONFLICT');
    const kept = await read(ownerAgent, guestNote);
    const accepted = both.findIndex((answer) => !answer.isError);
    expect(kept.content).toContain(accepted === 0 ? 'of the owner' : 'of the guest');

    // ---- What a content editor may not write, said with the owner ----------
    const refusedGuidance = await callTool(otherAgent, 'set_guidance', {
      notebook: notebookId,
      content: '# Mine\n',
      baseRevision: null,
    });
    expect(refusedGuidance.isError).toBe(true);
    expect(refusedGuidance.text).toContain(state.accounts.owner.email);

    // ---- An increase waits for the person to accept it ---------------------
    await owner.ok('PUT', `${shares}/${otherUser}/profile`, { profile: 'notebook-editor' });
    expect(
      (
        await callTool(otherAgent, 'set_template', {
          notebook: notebookId,
          folder: folderId,
          content: '## Finding\n\n## Evidence\n',
          baseRevision: null,
        })
      ).isError,
    ).toBe(true);
    await other.ok('POST', `/access/shared/${notebookId}/increase/accept`);

    // ---- Stale edits of the Guidance and of a Template, at once -------------
    const guidance = parsed<{ content: string; revision: string }>(
      await callTool(otherAgent, 'get_guidance', { notebook: notebookId }),
    );
    const guidanceWrites = await Promise.all(
      [ownerAgent, otherAgent].map((agent, index) =>
        callTool(agent, 'set_guidance', {
          notebook: notebookId,
          content: `${guidance.content}\nWritten by agent ${index}.\n`,
          baseRevision: guidance.revision,
        }),
      ),
    );
    expect(guidanceWrites.filter((answer) => answer.isError)).toHaveLength(1);
    const template = parsed<{ content: string; revision: string }>(
      await callTool(otherAgent, 'get_template', { notebook: notebookId, folder: folderId }),
    );
    const templateWrites = await Promise.all(
      [ownerAgent, otherAgent].map((agent, index) =>
        callTool(agent, 'set_template', {
          notebook: notebookId,
          folder: folderId,
          content: `${template.content}\n## Written by agent ${index}\n`,
          baseRevision: template.revision,
        }),
      ),
    );
    expect(templateWrites.filter((answer) => answer.isError)).toHaveLength(1);
    expect(templateWrites.find((answer) => answer.isError)?.text).toContain('CONFLICT');

    // ---- A note written after the other person changed the context ---------
    const declared = await contextOf(otherAgent, notebookId, folderId);
    const current = parsed<{ content: string; revision: string }>(
      await callTool(ownerAgent, 'get_guidance', { notebook: notebookId }),
    );
    await callTool(ownerAgent, 'set_guidance', {
      notebook: notebookId,
      content: `${current.content}\nEvery finding names its evidence.\n`,
      baseRevision: current.revision,
    });
    const late = await callTool(otherAgent, 'create_note', {
      notebook: notebookId,
      folder: folderId,
      content: '---\nname: Late finding\n---\n\n## Finding\n\nWritten on an old context.\n',
      context: declared,
    });
    expect(late.isError).toBe(false);
    const lateNote = parsed<{ noteId: string; contextChanged?: unknown }>(late);
    expect(lateNote.contextChanged).toBeTruthy();
    const check = await callTool(ownerAgent, 'check_notebook', { notebook: notebookId });
    expect(check.text).toContain('staleContext');
    expect(check.text).toContain(lateNote.noteId);

    // ---- A reduction applies from the next request of the same session ------
    await owner.ok('PUT', `${shares}/${otherUser}/profile`, { profile: 'reader' });
    const reduced = await callTool(otherAgent, 'create_note', {
      notebook: notebookId,
      folder: folderId,
      content: '---\nname: After the reduction\n---\n\n## Finding\n',
    });
    expect(reduced.isError).toBe(true);
    expect(reduced.text).toContain(state.accounts.owner.email);
    expect(
      (await callTool(otherAgent, 'read_note', { notebook: notebookId, note: ownerNote })).isError,
    ).toBe(false);

    // ---- The record names each person and each agent ------------------------
    type Entry = { authorship: { userId: string; agent: { clientName: string } | null } };
    const history = await eventually(
      'the history of the shared note to record both writers',
      () =>
        owner.ok<{ entries: Entry[] }>(
          'GET',
          `/audit/notebooks/${notebookId}/notes/${guestNote}/history`,
        ),
      (each) => {
        const writers = new Set(each.entries.map((entry) => entry.authorship.userId));
        return writers.has(otherUser) && (accepted !== 0 || writers.has(ownerUser));
      },
    );
    // Every write came through an agent, and each names the person behind it:
    // the guest who wrote the note, and the owner when the owner's edit won.
    expect(history.entries.every((entry) => entry.authorship.agent?.clientName)).toBe(true);
    expect(new Set(history.entries.map((entry) => entry.authorship.userId))).toEqual(
      new Set(accepted === 0 ? [ownerUser, otherUser] : [otherUser]),
    );
    const ownerHistory = await owner.ok<{ entries: Entry[] }>(
      'GET',
      `/audit/notebooks/${notebookId}/notes/${ownerNote}/history`,
    );
    expect(new Set(ownerHistory.entries.map((entry) => entry.authorship.userId))).toEqual(
      new Set([ownerUser]),
    );

    // ---- Storage stays with the owner ---------------------------------------
    const ownerUsage = await eventually(
      'the notebook to be counted in the owner subscription',
      () =>
        owner.ok<{ notebooks: Array<{ notebookId: string; bytes: number }> }>(
          'GET',
          '/access/usage',
        ),
      (usage) => (usage.notebooks.find((each) => each.notebookId === notebookId)?.bytes ?? 0) > 0,
    );
    expect(ownerUsage.notebooks.some((each) => each.notebookId === notebookId)).toBe(true);
    const otherUsageAfter = (await other.ok<{ usedBytes: number }>('GET', '/access/usage'))
      .usedBytes;
    expect(otherUsageAfter).toBe(otherUsageBefore);

    // ---- A revocation closes the notebook from the next request -------------
    await owner.ok('DELETE', `${shares}/${otherUser}`);
    const revoked = await callTool(otherAgent, 'read_note', {
      notebook: notebookId,
      note: ownerNote,
    });
    expect(revoked.isError).toBe(true);
    expect(revoked.text).toContain('NOT_FOUND');
  } finally {
    await owner.call('DELETE', path);
    await ownerAgent.close();
    await otherAgent.close();
  }
});
