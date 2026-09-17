/**
 * Isolation, whose failure is the one no release can take back
 * (architecture-guide.md, rules 1, 2, 9 and 12).
 *
 * A subscription asking for the notebook of another finds nothing there, and
 * finds it as a 404 rather than a 403, through every context that reads a
 * notebook: a 403 would confirm the notebook exists. A platform administrator
 * reaches no notebook at all, because the session carries no subscription to
 * build a repository under.
 */

import { expect, test } from './fixtures.js';

test.describe('isolation', () => {
  test('another subscription finds nothing where a notebook of this one is', async ({
    other,
    notebook,
  }) => {
    const v = notebook.notebookId;
    const reads: Array<[string, string]> = [
      ['GET', `/knowledge/notebooks/${v}`],
      ['GET', `/knowledge/notebooks/${v}/context`],
      ['GET', `/knowledge/notebooks/${v}/notes/${notebook.noteId}`],
      ['PUT', `/knowledge/notebooks/${v}/guidance`],
      ['GET', `/discovery/notebooks/${v}/graph`],
      ['POST', `/discovery/notebooks/${v}/search`],
      ['POST', `/portability/notebooks/${v}/export`],
    ];
    for (const [method, path] of reads) {
      const body = method === 'GET' ? undefined : { content: 'x', baseRevision: null, query: 'x' };
      expect((await other.call(method, path, body)).status, `${method} ${path}`).toBe(404);
    }

    const listed = await other.ok<Array<{ notebookId: string }>>('GET', '/knowledge/notebooks');
    expect(listed.map((each) => each.notebookId)).not.toContain(v);
    // The trail of a note of another subscription is not an empty history: it
    // is a note that does not exist, because the notebook it is addressed
    // through does not exist here (rule 9).
    const history = await other.call(
      'GET',
      `/audit/notebooks/${notebook.notebookId}/notes/${notebook.noteId}/history`,
    );
    expect(history.status).toBe(404);
  });

  test('a platform administrator reaches no notebook, because the session carries no subscription', async ({
    admin,
    notebook,
  }) => {
    for (const path of [
      '/knowledge/notebooks',
      `/knowledge/notebooks/${notebook.notebookId}`,
      `/discovery/notebooks/${notebook.notebookId}/graph`,
    ]) {
      expect((await admin.call('GET', path)).status, path).toBe(404);
    }
  });
});
