/**
 * The audit trail: who wrote what, and what a note said on a date
 * (software-vision.md, section 11; architecture-guide.md, section 12). The
 * trail is written by a consumer of the events, so every case waits for it.
 */

import { eventually } from '../support/eventually.js';
import { expect, test, type NotebookFixture } from './fixtures.js';
import type { Api } from '../support/api.js';

interface Entry {
  eventId: string;
  type: string;
  subjectId: string;
  occurredAt: string;
  authorship: { userId: string; agent: { clientId: string; clientName: string } | null };
  contentRef: { versionId: string } | null;
}

/** A note written, and then written again, with the revision of each write. */
async function writeTwice(owner: Api, notebook: NotebookFixture) {
  const path = `/knowledge/notebooks/${notebook.notebookId}/notes/${notebook.noteId}`;
  const first = await owner.ok<{ content: string; revision: { versionId: string } }>('GET', path);
  const second = await owner.ok<{ content: string; revision: { versionId: string } }>('PUT', path, {
    content: `${first.content}\nA second paragraph, written later.\n`,
    baseRevision: first.revision.versionId,
  });
  const history = await eventually(
    'both writes in the history',
    () =>
      owner.ok<{ entries: Entry[] }>(
        'GET',
        `/audit/notebooks/${notebook.notebookId}/notes/${notebook.noteId}/history`,
      ),
    (answer) => answer.entries.filter((entry) => entry.contentRef !== null).length >= 2,
  );
  return { first, second, entries: history.entries };
}

test.describe('the audit trail', () => {
  test('[route:GET /audit/notebooks/:v/notes/:n/history] records every write of a note, with the person who made it', async ({
    owner,
    notebook,
  }) => {
    const { entries } = await writeTwice(owner, notebook);
    const { user } = await owner.ok<{ user: { userId: string } }>('GET', '/access/session');

    for (const entry of entries) {
      expect(entry.authorship.userId).toBe(user.userId);
      expect(entry.authorship.agent).toBeNull();
    }
  });

  test('[route:GET /audit/notebooks/:v/notes/:n/revisions] answers what a note said at an instant', async ({
    owner,
    notebook,
  }) => {
    const { first, second, entries } = await writeTwice(owner, notebook);
    const written = entries.filter((entry) => entry.contentRef !== null);
    const at = (instant: string) =>
      owner.ok<{ content: string }>(
        'GET',
        `/audit/notebooks/${notebook.notebookId}/notes/${notebook.noteId}/revisions?asOf=${encodeURIComponent(instant)}`,
      );

    expect((await at(written[0]?.occurredAt ?? '')).content).toBe(first.content);
    expect((await at(new Date().toISOString())).content).toBe(second.content);
  });

  test('[route:GET /audit/notebooks/:v/notes/:n/revisions/:versionId] answers the content of one revision', async ({
    owner,
    notebook,
  }) => {
    const { first } = await writeTwice(owner, notebook);

    const revision = await owner.ok<{ content: string }>(
      'GET',
      `/audit/notebooks/${notebook.notebookId}/notes/${notebook.noteId}/revisions/${first.revision.versionId}`,
    );
    expect(revision.content).toBe(first.content);
  });

  test('[route:GET /audit/notebooks/:v/activity] lists what happened in a notebook, newest first', async ({
    owner,
    notebook,
  }) => {
    const from = new Date(Date.now() - 60 * 60_000).toISOString();
    await writeTwice(owner, notebook);

    const activity = await eventually(
      'the writes of the note in the activity',
      () =>
        owner.ok<{ entries: Entry[] }>(
          'GET',
          `/audit/notebooks/${notebook.notebookId}/activity?from=${encodeURIComponent(from)}`,
        ),
      (answer) => answer.entries.some((entry) => entry.subjectId === notebook.noteId),
    );
    const instants = activity.entries.map((entry) => entry.occurredAt);
    expect(instants).toEqual([...instants].sort().reverse());
  });
});
