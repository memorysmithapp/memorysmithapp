/**
 * Sharing a notebook with a person who holds another subscription
 * (software-vision.md RN-ACC-024 to RN-ACC-030; architecture-guide.md §8.3).
 *
 * The owner of the run shares a notebook of its own with the other account of
 * the run, which holds a subscription of its own. Each case shares a notebook
 * it created for itself and closes the door before it ends, so the isolation
 * the other cases assert — no notebook of the owner reachable by the other —
 * holds for every notebook but the one a case opened, and only while it runs.
 */

import { expect, test, type NotebookFixture } from './fixtures.js';
import type { Api } from '../support/api.js';

interface Incoming {
  notebookId: string;
  name: string;
  state: string;
  ownerEmail: string;
  noteCount: number | null;
}

async function userIdOf(api: Api): Promise<string> {
  return (await api.ok<{ user: { userId: string } }>('GET', '/access/session')).user.userId;
}

async function shareWith(owner: Api, notebook: NotebookFixture, email: string): Promise<void> {
  const shared = await owner.call('POST', `/access/notebooks/${notebook.notebookId}/shares`, {
    email,
    access: 'read',
  });
  expect(shared.status).toBe(204);
}

/** Closes whatever door a case opened, whatever state it ended in. */
async function closeDoor(owner: Api, notebook: NotebookFixture, grantee: string): Promise<void> {
  await owner.call('DELETE', `/access/notebooks/${notebook.notebookId}/shares/${grantee}`);
}

test.describe('a notebook shared with another subscription', () => {
  test('[route:POST /access/notebooks/:v/shares] [route:GET /access/shared] [route:POST /access/shared/:v/accept] [route:GET /access/notebooks/:v/shares] [route:GET /access/notifications] [route:POST /access/notebooks/:v/shares/:user/seen] is read whole once accepted, and never written', async ({
    owner,
    other,
    notebook,
    state,
  }) => {
    const grantee = await userIdOf(other);
    try {
      await shareWith(owner, notebook, state.accounts.other.email);

      // Before the answer: the name and the description, and nothing else.
      const pending = await other.ok<Incoming[]>('GET', '/access/shared');
      expect(pending.find((each) => each.notebookId === notebook.notebookId)).toMatchObject({
        name: notebook.name,
        state: 'pending',
        ownerEmail: state.accounts.owner.email,
        noteCount: null,
      });
      expect((await other.call('GET', `/knowledge/notebooks/${notebook.notebookId}`)).status).toBe(
        404,
      );

      expect(
        (await other.call('POST', `/access/shared/${notebook.notebookId}/accept`)).status,
      ).toBe(204);

      // Everything a reader reaches, as a reader.
      const read = await other.ok<{ effectiveRole: string }>(
        'GET',
        `/knowledge/notebooks/${notebook.notebookId}`,
      );
      expect(read.effectiveRole).toBe('VIEWER');
      expect(
        (
          await other.call(
            'GET',
            `/knowledge/notebooks/${notebook.notebookId}/notes/${notebook.noteId}`,
          )
        ).status,
      ).toBe(200);

      // A write is refused where it is seen, naming the owner.
      const write = await other.call<{ message: string }>(
        'POST',
        `/knowledge/notebooks/${notebook.notebookId}/folders`,
        { name: 'Not mine', description: 'A grantee may not write here.' },
      );
      expect(write.status).toBe(403);
      expect(write.body.message).toContain(state.accounts.owner.email);

      // The owner sees it accepted, and is told.
      const lines = await owner.ok<Array<{ granteeUserId: string; state: string }>>(
        'GET',
        `/access/notebooks/${notebook.notebookId}/shares`,
      );
      expect(lines).toEqual([
        expect.objectContaining({ granteeUserId: grantee, state: 'accepted' }),
      ]);
      const notices = await owner.ok<{
        notifications: Array<{ kind: string; notebookId: string }>;
      }>('GET', '/access/notifications');
      expect(notices.notifications).toContainEqual(
        expect.objectContaining({ kind: 'accepted', notebookId: notebook.notebookId }),
      );

      // Dismissing the notice takes it away, and only it.
      expect(
        (
          await owner.call(
            'POST',
            `/access/notebooks/${notebook.notebookId}/shares/${grantee}/seen`,
          )
        ).status,
      ).toBe(204);
      const after = await owner.ok<{ notifications: Array<{ kind: string; notebookId: string }> }>(
        'GET',
        '/access/notifications',
      );
      expect(after.notifications.filter((each) => each.notebookId === notebook.notebookId)).toEqual(
        [],
      );
    } finally {
      await closeDoor(owner, notebook, grantee);
    }
  });

  test('[route:POST /access/shared/:v/reject] answers no, which the owner is told of and may ask again', async ({
    owner,
    other,
    notebook,
    state,
  }) => {
    const grantee = await userIdOf(other);
    try {
      await shareWith(owner, notebook, state.accounts.other.email);
      expect(
        (await other.call('POST', `/access/shared/${notebook.notebookId}/reject`)).status,
      ).toBe(204);
      const lines = await owner.ok<Array<{ state: string }>>(
        'GET',
        `/access/notebooks/${notebook.notebookId}/shares`,
      );
      expect(lines.map((line) => line.state)).toEqual(['rejected']);

      await shareWith(owner, notebook, state.accounts.other.email);
      const again = await owner.ok<Array<{ state: string }>>(
        'GET',
        `/access/notebooks/${notebook.notebookId}/shares`,
      );
      expect(again.map((line) => line.state)).toEqual(['pending']);
    } finally {
      await closeDoor(owner, notebook, grantee);
    }
  });

  test('[route:DELETE /access/notebooks/:v/shares/:user] [route:DELETE /access/shared/:v] closes on a revocation, which the grantee is told of until dismissing it', async ({
    owner,
    other,
    notebook,
    state,
  }) => {
    const grantee = await userIdOf(other);
    await shareWith(owner, notebook, state.accounts.other.email);
    await other.ok('POST', `/access/shared/${notebook.notebookId}/accept`);

    expect(
      (await owner.call('DELETE', `/access/notebooks/${notebook.notebookId}/shares/${grantee}`))
        .status,
    ).toBe(204);
    expect((await other.call('GET', `/knowledge/notebooks/${notebook.notebookId}`)).status).toBe(
      404,
    );

    const notices = await other.ok<{ notifications: Array<{ kind: string; notebookId: string }> }>(
      'GET',
      '/access/notifications',
    );
    expect(notices.notifications).toContainEqual(
      expect.objectContaining({ kind: 'revoked', notebookId: notebook.notebookId }),
    );
    expect((await other.call('DELETE', `/access/shared/${notebook.notebookId}`)).status).toBe(204);
  });

  test('[route:POST /access/shared/:v/leave] lets the grantee leave without a word, and the owner still sees it', async ({
    owner,
    other,
    notebook,
    state,
  }) => {
    const grantee = await userIdOf(other);
    try {
      await shareWith(owner, notebook, state.accounts.other.email);
      await other.ok('POST', `/access/shared/${notebook.notebookId}/accept`);
      expect(
        (
          await other.call('POST', `/access/shared/${notebook.notebookId}/leave`, {
            notifyOwner: false,
          })
        ).status,
      ).toBe(204);
      expect((await other.call('GET', `/knowledge/notebooks/${notebook.notebookId}`)).status).toBe(
        404,
      );
      const lines = await owner.ok<Array<{ state: string }>>(
        'GET',
        `/access/notebooks/${notebook.notebookId}/shares`,
      );
      expect(lines.map((line) => line.state)).toEqual(['left']);
    } finally {
      await closeDoor(owner, notebook, grantee);
    }
  });

  test('answers an e-mail nobody holds exactly as any other, and keeps nothing', async ({
    owner,
    notebook,
  }) => {
    await shareWith(owner, notebook, `nobody-${notebook.notebookId.toLowerCase()}@example.com`);
    expect(
      await owner.ok<unknown[]>('GET', `/access/notebooks/${notebook.notebookId}/shares`),
    ).toEqual([]);
  });
});
