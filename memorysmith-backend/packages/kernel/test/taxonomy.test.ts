import { describe, expect, it } from 'vitest';
import { ConcurrencyError, DomainError, httpStatusFor } from '../src/errors.js';
import { Role, VaultRoleLimit } from '../src/role.js';
import { ContentRef } from '../src/content-ref.js';
import { ContentId, SubscriptionId, UserId } from '../src/ids.js';
import { AgentIdentity, Authorship } from '../src/authorship.js';
import { createEvent } from '../src/domain-event.js';
import { SubscriptionStatus } from '../src/subscription-status.js';

const SHA = 'a'.repeat(64);

describe('error taxonomy', () => {
  it('maps every code to its status', () => {
    expect(httpStatusFor(DomainError.validation('x'))).toBe(400);
    expect(httpStatusFor(DomainError.notFound('x'))).toBe(404);
    expect(httpStatusFor(DomainError.conflict('x'))).toBe(409);
    expect(httpStatusFor(DomainError.preconditionFailed('x'))).toBe(412);
    expect(httpStatusFor(DomainError.limitExceeded('x'))).toBe(413);
    expect(httpStatusFor(DomainError.internal('x'))).toBe(500);
  });

  it('answers a forbidden resource with 404, so 403 never leaks its existence', () => {
    const error = DomainError.forbidden('vault of another subscription');
    expect(error.code).toBe('FORBIDDEN');
    expect(httpStatusFor(error)).toBe(404);
  });

  it('answers a write refused by a vault ceiling with a real 403', () => {
    // The member already sees the vault in their list (RN-ACC-012), so hiding
    // it here would protect nothing.
    const error = DomainError.forbiddenVisible('write refused by the vault role limit');
    expect(httpStatusFor(error)).toBe(403);
  });

  it('reports a lost optimistic lock as a conflict', () => {
    expect(httpStatusFor(new ConcurrencyError())).toBe(409);
  });
});

describe('Role', () => {
  it('is ordered', () => {
    expect(Role.OWNER.atLeast(Role.EDITOR)).toBe(true);
    expect(Role.EDITOR.atLeast(Role.VIEWER)).toBe(true);
    expect(Role.VIEWER.atLeast(Role.EDITOR)).toBe(false);
    expect(Role.NONE.canRead()).toBe(false);
  });

  it('expresses the vault ceiling as a minimum, so it can only demote', () => {
    expect(Role.min(Role.EDITOR, Role.VIEWER)).toBe(Role.VIEWER);
    expect(Role.min(Role.VIEWER, Role.EDITOR)).toBe(Role.VIEWER);
    expect(Role.min(Role.EDITOR, Role.EDITOR)).toBe(Role.EDITOR);
  });

  it('refuses OWNER as a workspace membership', () => {
    expect(Role.membership('EDITOR').ok).toBe(true);
    expect(Role.membership('VIEWER').ok).toBe(true);
    expect(Role.membership('OWNER').ok).toBe(false);
  });

  it('admits VIEWER as the only vault role limit', () => {
    expect(VaultRoleLimit.create('VIEWER').ok).toBe(true);
    expect(VaultRoleLimit.create('EDITOR').ok).toBe(false);
    expect(VaultRoleLimit.create('NONE').ok).toBe(false);
  });
});

describe('ContentRef', () => {
  const contentId = ContentId.generate();

  it('carries slot, revision, hash and size', () => {
    const ref = ContentRef.create({ contentId, versionId: 'v1', sha256: SHA, bytes: 120 });
    expect(ref.ok).toBe(true);
    if (!ref.ok) return;
    expect(ref.value.contentId.equals(contentId)).toBe(true);
    expect(ref.value.toJSON()).toEqual({
      contentId: contentId.value,
      versionId: 'v1',
      sha256: SHA,
      bytes: 120,
    });
  });

  it('rejects a malformed hash or size', () => {
    expect(ContentRef.create({ contentId, versionId: 'v1', sha256: 'nope', bytes: 1 }).ok).toBe(
      false,
    );
    expect(ContentRef.create({ contentId, versionId: '', sha256: SHA, bytes: 1 }).ok).toBe(false);
    expect(ContentRef.create({ contentId, versionId: 'v1', sha256: SHA, bytes: -1 }).ok).toBe(
      false,
    );
  });

  it('detects identical content, which is what skips a pointless revision', () => {
    const first = ContentRef.create({ contentId, versionId: 'v1', sha256: SHA, bytes: 10 });
    const second = ContentRef.create({ contentId, versionId: 'v2', sha256: SHA, bytes: 10 });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.hasSameContentAs(second.value)).toBe(true);
    expect(first.value.equals(second.value)).toBe(false);
    expect(first.value.pointsAtSameSlotAs(second.value)).toBe(true);
  });

  it('round-trips through its stored form', () => {
    const ref = ContentRef.create({ contentId, versionId: 'v9', sha256: SHA, bytes: 3 });
    expect(ref.ok).toBe(true);
    if (!ref.ok) return;
    const restored = ContentRef.fromJSON(ref.value.toJSON());
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.value.equals(ref.value)).toBe(true);
  });
});

describe('Authorship', () => {
  const user = UserId.create('user-1');

  it('records a UI write with no agent', () => {
    expect(user.ok).toBe(true);
    if (!user.ok) return;
    const authorship = Authorship.byHuman(user.value);
    expect(authorship.agent).toBeNull();
    expect(authorship.isAgentWrite).toBe(false);
  });

  it('records an agent write with the human who authorized it', () => {
    const agent = AgentIdentity.create('https://claude.ai/mcp-client', 'Claude');
    expect(user.ok && agent.ok).toBe(true);
    if (!user.ok || !agent.ok) return;
    const authorship = Authorship.byAgent(user.value, agent.value);
    expect(authorship.isAgentWrite).toBe(true);
    expect(authorship.toJSON().agent).toEqual({
      clientId: 'https://claude.ai/mcp-client',
      clientName: 'Claude',
    });
    expect(authorship.toJSON().userId).toBe('user-1');
  });
});

describe('domain events', () => {
  it('always carries the subscription and the authorship', () => {
    const user = UserId.create('user-1');
    expect(user.ok).toBe(true);
    if (!user.ok) return;
    const subscriptionId = SubscriptionId.generate();
    const event = createEvent({
      type: 'NoteCreated',
      subscriptionId,
      subject: 'NOTE',
      subjectId: 'note-1',
      authorship: Authorship.byHuman(user.value),
      payload: { title: 'Lei 14.133' },
    });
    expect(event.subscriptionId).toBe(subscriptionId);
    expect(event.authorship.user.value).toBe('user-1');
    expect(event.contentRef).toBeNull();
    expect(event.eventId).toHaveLength(26);
  });
});

describe('SubscriptionStatus', () => {
  it('grants operational access only in trial and active', () => {
    expect(SubscriptionStatus.TRIAL.grantsOperationalAccess).toBe(true);
    expect(SubscriptionStatus.ACTIVE.grantsOperationalAccess).toBe(true);
    for (const status of [
      SubscriptionStatus.PENDING_APPROVAL,
      SubscriptionStatus.REJECTED,
      SubscriptionStatus.SUSPENDED,
      SubscriptionStatus.CANCELED,
    ]) {
      expect(status.grantsOperationalAccess).toBe(false);
    }
  });

  it('rejects an unknown status', () => {
    expect(SubscriptionStatus.create('paused').ok).toBe(false);
  });
});
