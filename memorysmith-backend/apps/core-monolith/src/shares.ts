/**
 * The door through the boundary of a subscription, joined where the contexts
 * meet (RN-ACC-024 to RN-ACC-028, architecture-guide.md section 8.3).
 *
 * Access keeps the shares and knows nothing of notebooks; Knowledge keeps the
 * notebooks and knows nothing of shares. This module is the only place both
 * are in view, and it is shared by production (handler.ts) and by the
 * in-memory wiring of the tests, so the two cannot open the door differently.
 */

import {
  type NotebookId,
  Role,
  SubscriptionContext,
  type SubscriptionId,
  type UserId,
} from '@memorysmith/kernel';
import type {
  AccountLookup,
  SharedNotebooks,
  SharedNotebookView,
  ShareRepository,
  SubscriptionRepository,
} from '@memorysmith/svc-access/domain/ports';
import type { Share } from '@memorysmith/svc-access/domain/share';
import {
  AnswerShare,
  DismissRevokedShare,
  DismissShareAnswer,
  LeaveShare,
  ListIncomingShares,
  ListNotebookShares,
  ListNotifications,
  ListSubscriptionShares,
  OpenSharedNotebook,
  RevokeShare,
  ShareNotebook,
  type ShareDependencies,
} from '@memorysmith/svc-access/application/shares';
import type { AccessRequest, AccessUseCases } from '@memorysmith/svc-access/adapters/http';
import type { KnowledgeRequest } from '@memorysmith/svc-knowledge/adapters/http';
import { DeleteNotebook } from '@memorysmith/svc-knowledge/application/notebooks';

/** The part of the Knowledge repositories a share reads: the notebook itself. */
export interface NotebookReader {
  findById(id: NotebookId): Promise<{
    readonly isDeleted: boolean;
    readonly name: { readonly value: string };
    readonly description: { readonly value: string };
    readonly noteCount: number;
    readonly updatedAt: { toISOString(): string };
  } | null>;
}

/** Only trial and active grant access to anybody (RN-SUB-007). */
const GRANTING = new Set(['trial', 'active']);

/**
 * The context a share reads its notebook under: the grantee, in the
 * subscription the stored share names. The status is asserted as active
 * because whether the owner's subscription grants access is asked separately,
 * before this is ever built.
 */
export function contextThrough(share: Share): SubscriptionContext {
  const context = SubscriptionContext.fromAcceptedShare({
    granteeUserId: share.granteeUserId.value,
    ownerSubscriptionId: share.ownerSubscriptionId.value,
    ownerStatus: 'active',
  });
  if (!context.ok)
    throw new Error(`A share named an unusable subscription: ${context.error.message}`);
  return context.value;
}

/** What Access asks about the notebooks it shares, answered from Knowledge. */
export class KnowledgeSharedNotebooks implements SharedNotebooks {
  constructor(
    private readonly notebooksOf: (context: SubscriptionContext) => NotebookReader,
    /** The status of a subscription by identifier, or null when there is none. */
    private readonly statusOf: (id: SubscriptionId) => Promise<string | null>,
  ) {}

  async own(
    owner: SubscriptionContext,
    notebookId: NotebookId,
  ): Promise<SharedNotebookView | null> {
    return this.view(this.notebooksOf(owner), notebookId);
  }

  async through(share: Share): Promise<SharedNotebookView | null> {
    return this.view(this.notebooksOf(contextThrough(share)), share.notebookId);
  }

  async ownerGrantsAccess(share: Share): Promise<boolean> {
    const status = await this.statusOf(share.ownerSubscriptionId);
    return status !== null && GRANTING.has(status);
  }

  private async view(
    notebooks: NotebookReader,
    notebookId: NotebookId,
  ): Promise<SharedNotebookView | null> {
    const notebook = await notebooks.findById(notebookId);
    if (!notebook || notebook.isDeleted) return null;
    return {
      name: notebook.name.value,
      description: notebook.description.value,
      noteCount: notebook.noteCount,
      updatedAt: notebook.updatedAt.toISOString(),
    };
  }
}

/**
 * The request a session makes on a notebook shared with it, or null when no
 * accepted share opens it (RN-ACC-026).
 *
 * It is ONE read of the grantee's own side, keyed by the person of the token
 * and the notebook of the path; when it finds no accepted share the request
 * goes on in the session's own subscription, untouched. When it does, the
 * request reads the owner's subscription as the grantee, with the VIEWER role
 * and the owner named, so every write is refused by the notebook's own policy
 * with the reason (RN-ACC-027).
 */
export async function openShared(
  request: KnowledgeRequest,
  rawNotebookId: string,
  deps: {
    readonly shares: ShareRepository;
    readonly notebooks: SharedNotebooks;
    readonly parse: (raw: string) => NotebookId | null;
  },
): Promise<KnowledgeRequest | null> {
  const notebookId = deps.parse(rawNotebookId);
  if (!notebookId) return null;
  const share = await new OpenSharedNotebook(deps).execute({
    user: request.subscription.userId,
    notebookId,
  });
  if (!share) return null;
  return {
    ctx: {
      user: request.ctx.user,
      isOwner: false,
      role: Role.VIEWER,
      sharedBy: share.ownerEmail.value,
    },
    subscription: contextThrough(share),
    authorship: request.authorship,
    subscriptionRole: Role.VIEWER,
  };
}

/** Whether a notebook is shared with this person and open to them (an export asks). */
export async function openShareOf(
  user: UserId,
  notebookId: NotebookId,
  deps: { readonly shares: ShareRepository; readonly notebooks: SharedNotebooks },
): Promise<Share | null> {
  return new OpenSharedNotebook(deps).execute({ user, notebookId });
}

/**
 * The share use cases of Access, each built per request from the same
 * dependencies, for production and for the in-memory wiring alike.
 */
export function shareUseCasesOf(deps: {
  readonly shares: ShareRepository;
  readonly notebooks: SharedNotebooks;
  readonly accounts: AccountLookup;
  /** The subscription of the session, for the owner's acts. */
  readonly subscriptionsOf: (request: AccessRequest) => SubscriptionRepository | null;
}): Pick<
  AccessUseCases,
  | 'shareNotebook'
  | 'listNotebookShares'
  | 'listSubscriptionShares'
  | 'revokeShare'
  | 'dismissShareAnswer'
  | 'listIncomingShares'
  | 'answerShare'
  | 'leaveShare'
  | 'dismissRevokedShare'
  | 'listNotifications'
> {
  const of = (request: AccessRequest): ShareDependencies => ({
    shares: deps.shares,
    notebooks: deps.notebooks,
    accounts: deps.accounts,
    subscriptions: deps.subscriptionsOf(request),
  });
  return {
    shareNotebook: (request) => new ShareNotebook(of(request)),
    listNotebookShares: (request) => new ListNotebookShares(of(request)),
    listSubscriptionShares: (request) => new ListSubscriptionShares(of(request)),
    revokeShare: (request) => new RevokeShare(of(request)),
    dismissShareAnswer: (request) => new DismissShareAnswer(of(request)),
    listIncomingShares: (request) => new ListIncomingShares(of(request)),
    answerShare: (request) => new AnswerShare(of(request)),
    leaveShare: (request) => new LeaveShare(of(request)),
    dismissRevokedShare: (request) => new DismissRevokedShare(of(request)),
    listNotifications: (request) => new ListNotifications(of(request)),
  };
}

/**
 * Deleting a notebook takes every share of it, both sides (RN-ACC-028). The
 * deletion is Knowledge's and the shares are Access's, so the cleanup follows
 * the deletion here, where both are in view. A grantee would find nothing
 * through a share of a deleted notebook anyway: a deleted notebook answers as
 * missing to every context.
 */
export class DeleteNotebookAndShares extends DeleteNotebook {
  constructor(
    deps: ConstructorParameters<typeof DeleteNotebook>[0],
    private readonly owner: SubscriptionContext,
    private readonly shares: ShareRepository,
  ) {
    super(deps);
  }

  override async execute(
    input: Parameters<DeleteNotebook['execute']>[0],
  ): ReturnType<DeleteNotebook['execute']> {
    const deleted = await super.execute(input);
    if (deleted.ok) await this.shares.removeAllOf(this.owner, input.notebookId);
    return deleted;
  }
}
