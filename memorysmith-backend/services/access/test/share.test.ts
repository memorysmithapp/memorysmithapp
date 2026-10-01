/**
 * The share of a notebook with a person of another subscription
 * (RN-ACC-024 to RN-ACC-028): its transitions, and when the owner has a
 * notice waiting.
 */

import { describe, expect, it } from 'vitest';
import { Authorship, NotebookId, SubscriptionId, UserId } from '@memorysmith/kernel';
import { Share } from '../src/domain/share/Share.js';
import { Email } from '../src/domain/values.js';

function value<T>(result: { ok: true; value: T } | { ok: false }): T {
  if (!result.ok) throw new Error('unexpected failure');
  return result.value;
}

const OWNER = value(UserId.create('user-owner'));
const GRANTEE = value(UserId.create('user-grantee'));

function offered(access: 'read' | 'read-write' = 'read') {
  return Share.offer(
    {
      notebookId: value(NotebookId.create('01JBQ2X0000000000000000001')),
      ownerSubscriptionId: value(SubscriptionId.fromClaim('01JBQ2X0000000000000000002')),
      ownerUserId: OWNER,
      ownerEmail: value(Email.create('owner@example.com')),
      granteeUserId: GRANTEE,
      granteeEmail: value(Email.create('grantee@example.com')),
      access,
    },
    Authorship.byHuman(OWNER),
  );
}

describe('a share of a notebook', () => {
  it('is offered with read access only, and waits for an answer', () => {
    expect(offered('read-write').ok).toBe(false);
    const share = value(offered());
    expect(share.state).toBe('pending');
    expect(share.isOpen).toBe(false);
    expect(share.standsInTheWay).toBe(true);
    expect(share.pullEvents().map((event) => event.type)).toEqual(['NotebookShared']);
  });

  it('opens only when accepted, and tells the owner', () => {
    const share = value(offered());
    expect(share.accept(Authorship.byHuman(GRANTEE)).ok).toBe(true);
    expect(share.isOpen).toBe(true);
    expect(share.ownerHasNotice).toBe(true);
    expect(share.accept(Authorship.byHuman(GRANTEE)).ok).toBe(false);
  });

  it('no longer stands in the way of a new share once rejected', () => {
    const share = value(offered());
    share.reject(Authorship.byHuman(GRANTEE));
    expect(share.standsInTheWay).toBe(false);
    expect(share.ownerHasNotice).toBe(true);
  });

  it('tells the owner of a departure only when the grantee chose to', () => {
    const silent = value(offered());
    silent.accept(Authorship.byHuman(GRANTEE));
    silent.leave(false, Authorship.byHuman(GRANTEE));
    expect(silent.state).toBe('left');
    expect(silent.ownerHasNotice).toBe(false);

    const told = value(offered());
    told.accept(Authorship.byHuman(GRANTEE));
    told.leave(true, Authorship.byHuman(GRANTEE));
    expect(told.ownerHasNotice).toBe(true);
  });

  it('leaves only a notebook that was accepted', () => {
    const share = value(offered());
    expect(share.leave(true, Authorship.byHuman(GRANTEE)).ok).toBe(false);
  });

  it('is revoked whatever stood behind it, and never after it closed', () => {
    const pending = value(offered());
    expect(pending.revoke(Authorship.byHuman(OWNER)).ok).toBe(true);
    expect(pending.state).toBe('revoked');

    const rejected = value(offered());
    rejected.reject(Authorship.byHuman(GRANTEE));
    expect(rejected.revoke(Authorship.byHuman(OWNER)).ok).toBe(false);
  });

  it('is not offered to its own owner', () => {
    const own = Share.offer(
      {
        notebookId: value(NotebookId.create('01JBQ2X0000000000000000001')),
        ownerSubscriptionId: value(SubscriptionId.fromClaim('01JBQ2X0000000000000000002')),
        ownerUserId: OWNER,
        ownerEmail: value(Email.create('owner@example.com')),
        granteeUserId: OWNER,
        granteeEmail: value(Email.create('owner@example.com')),
        access: 'read',
      },
      Authorship.byHuman(OWNER),
    );
    expect(own.ok).toBe(false);
  });
});
