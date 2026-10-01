/**
 * Sharing a notebook with a person who holds another subscription
 * (RN-ACC-024 to RN-ACC-030).
 *
 * The owner shares, lists and revokes from their own subscription, the one of
 * their token. The grantee answers, leaves and dismisses from their own side,
 * which is keyed by their own identifier; the owner's subscription they reach
 * through is read from the stored share and never from the request.
 */

import {
  type Authorship,
  DomainError,
  err,
  Instant,
  type NotebookId,
  ok,
  type Result,
  type SubscriptionContext,
  type UserId,
} from '@memorysmith/kernel';
import { Share, type ShareAccess } from '../domain/share/Share.js';
import { Email } from '../domain/values.js';
import type {
  AccountLookup,
  SharedNotebooks,
  SharedNotebookView,
  ShareRepository,
  SubscriptionRepository,
} from '../domain/ports/index.js';
import { requireOwner } from './members.js';

/** What every use case of this file is built from. */
export interface ShareDependencies {
  readonly shares: ShareRepository;
  readonly notebooks: SharedNotebooks;
  readonly accounts: AccountLookup;
  /** The subscription of the session, for the owner's acts; null for a platform session. */
  readonly subscriptions: SubscriptionRepository | null;
}

async function ownerOf(
  deps: ShareDependencies,
  context: SubscriptionContext,
): Promise<Result<void, DomainError>> {
  if (!deps.subscriptions) {
    return err(DomainError.forbidden('This session carries no active subscription'));
  }
  const owned = await requireOwner(deps.subscriptions, context.userId);
  return owned.ok ? ok() : err(owned.error);
}

/**
 * Shares a notebook of the subscription with an e-mail (RN-ACC-024,
 * RN-ACC-025). Only its owner may, and only with read access.
 *
 * It answers the same thing whether the e-mail has an account or not, and
 * whether the notebook was already shared with it: an e-mail nobody holds
 * keeps nothing and sends nothing, and the answer cannot tell the two apart.
 */
export class ShareNotebook {
  constructor(private readonly deps: ShareDependencies) {}

  async execute(input: {
    context: SubscriptionContext;
    ownerEmail: string;
    notebookId: NotebookId;
    email: string;
    access: ShareAccess;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const owned = await ownerOf(this.deps, input.context);
    if (!owned.ok) return owned;

    if (input.access !== 'read') {
      return err(DomainError.validation('A notebook is shared with read access only'));
    }
    const notebook = await this.deps.notebooks.own(input.context, input.notebookId);
    if (!notebook) return err(DomainError.notFound('Notebook not found'));

    const email = Email.create(input.email);
    if (!email.ok) return email;
    const ownerEmail = Email.create(input.ownerEmail);
    if (!ownerEmail.ok) return ownerEmail;

    const grantee = await this.deps.accounts.userIdOf(email.value);
    // No account, or the owner's own: nothing is kept, and the answer is the
    // one every other e-mail gets (RN-ACC-025).
    if (!grantee || grantee.equals(input.context.userId)) return ok();

    const existing = await this.deps.shares.findOutgoing(input.context, input.notebookId, grantee);
    if (existing?.standsInTheWay) return ok();

    const share = Share.offer(
      {
        notebookId: input.notebookId,
        ownerSubscriptionId: input.context.subscriptionId,
        ownerUserId: input.context.userId,
        ownerEmail: ownerEmail.value,
        granteeUserId: grantee,
        granteeEmail: email.value,
        access: input.access,
      },
      input.by,
    );
    if (!share.ok) return share;
    await this.deps.shares.save(share.value);
    return ok();
  }
}

/** Every person a notebook is shared with, and where each one stands (RN-ACC-024). */
export class ListNotebookShares {
  constructor(private readonly deps: ShareDependencies) {}

  async execute(input: {
    context: SubscriptionContext;
    notebookId: NotebookId;
  }): Promise<Result<Share[], DomainError>> {
    const owned = await ownerOf(this.deps, input.context);
    if (!owned.ok) return owned;
    const notebook = await this.deps.notebooks.own(input.context, input.notebookId);
    if (!notebook) return err(DomainError.notFound('Notebook not found'));
    return ok(await this.deps.shares.listOutgoing(input.context, input.notebookId));
  }
}

/**
 * Every share of every notebook of the subscription, for the cards of Home,
 * which say which of the owner's notebooks are shared (RN-ACC-030). Only the
 * owner shares, so a member is answered an empty list rather than a refusal:
 * there is nothing of theirs to mark.
 */
export class ListSubscriptionShares {
  constructor(private readonly deps: ShareDependencies) {}

  async execute(input: { context: SubscriptionContext }): Promise<Result<Share[], DomainError>> {
    const owned = await ownerOf(this.deps, input.context);
    if (!owned.ok) return ok([]);
    return ok(await this.deps.shares.listOutgoing(input.context, null));
  }
}

/** The owner closes the door; the grantee is told (RN-ACC-028, RN-ACC-029). */
export class RevokeShare {
  constructor(private readonly deps: ShareDependencies) {}

  async execute(input: {
    context: SubscriptionContext;
    notebookId: NotebookId;
    grantee: UserId;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const owned = await ownerOf(this.deps, input.context);
    if (!owned.ok) return owned;
    const share = await this.deps.shares.findOutgoing(
      input.context,
      input.notebookId,
      input.grantee,
    );
    if (!share) return err(DomainError.notFound('This notebook is not shared with that person'));

    // A rejection or a departure is a line of the list, and revoking it just
    // takes the line away: the grantee has nothing left to be told.
    if (!share.standsInTheWay) {
      await this.deps.shares.removeOutgoing(share);
      return ok();
    }
    const revoked = share.revoke(input.by);
    if (!revoked.ok) return revoked;
    await this.deps.shares.saveRevoked(share);
    return ok();
  }
}

/** The owner dismisses the notice of an answer (RN-ACC-029). */
export class DismissShareAnswer {
  constructor(private readonly deps: ShareDependencies) {}

  async execute(input: {
    context: SubscriptionContext;
    notebookId: NotebookId;
    grantee: UserId;
  }): Promise<Result<void, DomainError>> {
    const owned = await ownerOf(this.deps, input.context);
    if (!owned.ok) return owned;
    const share = await this.deps.shares.findOutgoing(
      input.context,
      input.notebookId,
      input.grantee,
    );
    if (!share) return err(DomainError.notFound('This notebook is not shared with that person'));
    share.markSeen(Instant.now());
    await this.deps.shares.saveOwnerSide(share);
    return ok();
  }
}

/** A notebook shared with the person asking, as their Home draws it. */
export interface IncomingShare {
  readonly share: Share;
  readonly notebook: SharedNotebookView;
}

/**
 * The notebooks shared with this person that they can see: pending ones and
 * accepted ones, whose owner's subscription grants access and which still
 * exist (RN-ACC-026, RN-ACC-028). A revocation is a notice, not a notebook.
 */
export class ListIncomingShares {
  constructor(private readonly deps: ShareDependencies) {}

  async execute(input: { user: UserId }): Promise<Result<IncomingShare[], DomainError>> {
    const found: IncomingShare[] = [];
    for (const share of await this.deps.shares.listIncoming(input.user)) {
      if (share.state !== 'pending' && share.state !== 'accepted') continue;
      if (!(await this.deps.notebooks.ownerGrantsAccess(share))) continue;
      const notebook = await this.deps.notebooks.through(share);
      if (notebook) found.push({ share, notebook });
    }
    return ok(found);
  }
}

/** The grantee's answer to a share that waits for one (RN-ACC-026). */
export class AnswerShare {
  constructor(private readonly deps: ShareDependencies) {}

  async execute(input: {
    user: UserId;
    notebookId: NotebookId;
    accept: boolean;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const share = await this.visible(input.user, input.notebookId);
    if (!share) return err(DomainError.notFound('Notebook not found'));
    if (input.accept) {
      const accepted = share.accept(input.by);
      if (!accepted.ok) return accepted;
      await this.deps.shares.save(share);
      return ok();
    }
    const rejected = share.reject(input.by);
    if (!rejected.ok) return rejected;
    await this.deps.shares.saveClosedByGrantee(share);
    return ok();
  }

  private async visible(user: UserId, notebookId: NotebookId): Promise<Share | null> {
    const share = await this.deps.shares.findIncoming(user, notebookId);
    if (!share || share.state === 'revoked') return null;
    if (!(await this.deps.notebooks.ownerGrantsAccess(share))) return null;
    return share;
  }
}

/** The grantee leaves a notebook they accepted, and says whether the owner is told. */
export class LeaveShare {
  constructor(private readonly deps: ShareDependencies) {}

  async execute(input: {
    user: UserId;
    notebookId: NotebookId;
    notifyOwner: boolean;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const share = await this.deps.shares.findIncoming(input.user, input.notebookId);
    if (!share || share.state !== 'accepted')
      return err(DomainError.notFound('Notebook not found'));
    const left = share.leave(input.notifyOwner, input.by);
    if (!left.ok) return left;
    await this.deps.shares.saveClosedByGrantee(share);
    return ok();
  }
}

/** The grantee dismisses the notice of a revocation (RN-ACC-029). */
export class DismissRevokedShare {
  constructor(private readonly deps: ShareDependencies) {}

  async execute(input: {
    user: UserId;
    notebookId: NotebookId;
  }): Promise<Result<void, DomainError>> {
    const share = await this.deps.shares.findIncoming(input.user, input.notebookId);
    if (!share || share.state !== 'revoked') return err(DomainError.notFound('Notice not found'));
    await this.deps.shares.dismissIncoming(input.user, input.notebookId);
    return ok();
  }
}

export interface ShareNotice {
  readonly kind: 'shared' | 'revoked' | 'accepted' | 'rejected' | 'left';
  readonly share: Share;
  readonly notebookName: string | null;
}

/**
 * What the notifications button lists (RN-ACC-029): on the grantee's side the
 * shares waiting for an answer and the revocations not yet dismissed; on the
 * owner's side the answers not yet dismissed, a silent departure excepted.
 */
export class ListNotifications {
  constructor(private readonly deps: ShareDependencies) {}

  async execute(input: {
    user: UserId;
    context: SubscriptionContext | null;
  }): Promise<Result<ShareNotice[], DomainError>> {
    const notices: ShareNotice[] = [];

    for (const share of await this.deps.shares.listIncoming(input.user)) {
      if (share.state === 'revoked') {
        const notebook = await this.deps.notebooks.through(share);
        notices.push({ kind: 'revoked', share, notebookName: notebook?.name ?? null });
        continue;
      }
      if (share.state !== 'pending') continue;
      if (!(await this.deps.notebooks.ownerGrantsAccess(share))) continue;
      const notebook = await this.deps.notebooks.through(share);
      if (notebook) notices.push({ kind: 'shared', share, notebookName: notebook.name });
    }

    if (input.context && this.deps.subscriptions) {
      const owned = await requireOwner(this.deps.subscriptions, input.context.userId);
      if (owned.ok) {
        for (const share of await this.deps.shares.listOutgoing(input.context, null)) {
          if (!share.ownerHasNotice) continue;
          const notebook = await this.deps.notebooks.own(input.context, share.notebookId);
          notices.push({
            kind: share.state as 'accepted' | 'rejected' | 'left',
            share,
            notebookName: notebook?.name ?? null,
          });
        }
      }
    }

    // The newest first: what changed last is what the person came to see.
    notices.sort((a, b) => noticeAt(b).localeCompare(noticeAt(a)));
    return ok(notices);
  }
}

function noticeAt(notice: ShareNotice): string {
  return (notice.share.answeredAt ?? notice.share.sharedAt).toISOString();
}

/**
 * The door a request on a notebook of another subscription goes through
 * (RN-ACC-026): the share of that notebook with this person, accepted, whose
 * owner's subscription grants access. Anything else answers null, and the
 * caller answers as for a notebook that does not exist (RN-SUB-004).
 */
export class OpenSharedNotebook {
  constructor(private readonly deps: Pick<ShareDependencies, 'shares' | 'notebooks'>) {}

  async execute(input: { user: UserId; notebookId: NotebookId }): Promise<Share | null> {
    const share = await this.deps.shares.findIncoming(input.user, input.notebookId);
    if (!share?.isOpen) return null;
    if (!(await this.deps.notebooks.ownerGrantsAccess(share))) return null;
    return share;
  }
}
