/**
 * The notebooks shared with a person, and the notices of the bell, are read
 * at once, not one after another (#420): a person with many shares waited for
 * the sum of their reads, and the status of an owner's subscription was asked
 * again for every share it owned.
 */

import { describe, expect, it } from 'vitest';
import { Authorship, NotebookId, SubscriptionId, UserId } from '@memorysmithapp/kernel';
import { ListIncomingShares, ListNotifications } from '../src/application/shares.js';
import type { SharedNotebooks, ShareRepository } from '../src/domain/ports/index.js';
import { Share } from '../src/domain/share/Share.js';
import { Email } from '../src/domain/values.js';

function value<T>(result: { ok: true; value: T } | { ok: false }): T {
  if (!result.ok) throw new Error('A value of the test was refused');
  return result.value;
}

const GRANTEE = value(UserId.create('user-grantee'));
const GRANTING = '01JBQ2X00000000000000000A1';
const SUSPENDED = '01JBQ2X00000000000000000B1';

function shareOf(notebook: string, subscription: string, accepted: boolean): Share {
  const share = value(
    Share.offer(
      {
        notebookId: value(NotebookId.create(notebook)),
        ownerSubscriptionId: value(SubscriptionId.fromClaim(subscription)),
        ownerUserId: value(UserId.create(`user-${subscription}`)),
        ownerEmail: value(Email.create('owner@example.com')),
        granteeUserId: GRANTEE,
        granteeEmail: value(Email.create('grantee@example.com')),
        profile: 'reader',
      },
      Authorship.byHuman(value(UserId.create(`user-${subscription}`))),
    ),
  );
  if (accepted) share.accept(Authorship.byHuman(GRANTEE));
  return share;
}

/** Notebooks that take a moment to read, and count how many were read at once. */
function slowNotebooks() {
  const asked: string[] = [];
  let reading = 0;
  let mostAtOnce = 0;
  const notebooks: SharedNotebooks = {
    own: async () => null,
    ownerGrantsAccess: async (share) => {
      asked.push(share.ownerSubscriptionId.value);
      return share.ownerSubscriptionId.value === GRANTING;
    },
    through: async (share) => {
      reading += 1;
      mostAtOnce = Math.max(mostAtOnce, reading);
      await new Promise((resolve) => setTimeout(resolve, 5));
      reading -= 1;
      return {
        name: `Notebook ${share.notebookId.value.slice(-2)}`,
        description: '',
        noteCount: 1,
        updatedAt: '2026-11-10T00:00:00.000Z',
        model: null,
      };
    },
    acceptModelLicence: async () => undefined,
  };
  return { notebooks, asked, mostAtOnce: () => mostAtOnce };
}

function depsOf(shares: Share[], notebooks: SharedNotebooks) {
  return {
    shares: { listIncoming: async () => shares } as unknown as ShareRepository,
    notebooks,
    accounts: {} as never,
    subscriptions: null,
  };
}

const SHARES = [
  shareOf('01JBQ2X0000000000000000001', GRANTING, true),
  shareOf('01JBQ2X0000000000000000002', SUSPENDED, true),
  shareOf('01JBQ2X0000000000000000003', GRANTING, false),
  shareOf('01JBQ2X0000000000000000004', GRANTING, true),
];

describe('the notebooks shared with a person', () => {
  it('are read at once, in the order they were listed, each owner asked once', async () => {
    const slow = slowNotebooks();
    const listed = value(
      await new ListIncomingShares(depsOf(SHARES, slow.notebooks)).execute({ user: GRANTEE }),
    );

    // The suspended owner's notebook is not among them (RN-SUB-007).
    expect(listed.map(({ notebook }) => notebook.name)).toEqual([
      'Notebook 01',
      'Notebook 03',
      'Notebook 04',
    ]);
    expect(slow.mostAtOnce()).toBe(3);
    expect([...slow.asked].sort()).toEqual([GRANTING, SUSPENDED]);
  });

  it('wait for an answer at once on the bell, each owner asked once', async () => {
    const slow = slowNotebooks();
    const notices = value(
      await new ListNotifications(depsOf(SHARES, slow.notebooks)).execute({
        user: GRANTEE,
        context: null,
      }),
    );

    // Only the pending share of a granting owner waits for an answer.
    expect(notices.map((notice) => [notice.kind, notice.notebookName])).toEqual([
      ['shared', 'Notebook 03'],
    ]);
    expect(slow.asked.filter((id) => id === GRANTING)).toHaveLength(1);
  });
});
