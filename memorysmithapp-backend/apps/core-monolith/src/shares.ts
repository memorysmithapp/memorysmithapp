/**
 * The door through the boundary of a subscription, joined where the contexts
 * meet (INV-01, RN-ACC-024 to RN-ACC-028).
 *
 * Access keeps the shares and knows nothing of notebooks; Knowledge keeps the
 * notebooks and knows nothing of shares. This module is the only place both
 * are in view, and it is shared by production (handler.ts) and by the
 * in-memory wiring of the tests, so the two cannot open the door differently.
 */

import {
  type Authorship,
  type NotebookId,
  Role,
  SubscriptionContext,
  type SubscriptionId,
  type UserId,
} from '@memorysmithapp/kernel';
import type {
  AccountLookup,
  SharedNotebooks,
  SharedNotebookView,
  ShareRepository,
  SubscriptionRepository,
} from '@memorysmithapp/svc-access/domain/ports';
import type { Share } from '@memorysmithapp/svc-access/domain/share';
import {
  AnswerShare,
  AnswerShareIncrease,
  ChangeShareProfile,
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
} from '@memorysmithapp/svc-access/application/shares';
import type { AccessRequest, AccessUseCases } from '@memorysmithapp/svc-access/adapters/http';
import type { ModelSource, ModelSources } from '@memorysmithapp/svc-portability/application/models';
import type { ModelStore } from '@memorysmithapp/svc-portability/domain/model';
import type { KnowledgeRequest } from '@memorysmithapp/svc-knowledge/adapters/http';
import { DeleteNotebook } from '@memorysmithapp/svc-knowledge/application/notebooks';

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

/**
 * What a share asks of the model of a notebook (#355, #357), answered from
 * Portability, which Access may not import either: whether the notebook is
 * declared as one, whether its owner accepted CC0 1.0, and the acceptance.
 */
export interface ModelLicences {
  licenceOf(notebookId: string): Promise<{ readonly accepted: boolean } | null>;
  accept(notebookId: string, at: string): Promise<void>;
}

/** What a share asks of a model, over the models of one subscription. */
export function modelLicencesOf(models: ModelStore): ModelLicences {
  return {
    licenceOf: async (notebookId) => {
      const model = await models.get(notebookId);
      return model ? { accepted: model.licenceAcceptedAt !== null } : null;
    },
    accept: async (notebookId, at) => {
      const model = await models.get(notebookId);
      if (model && !model.licenceAcceptedAt) await models.put({ ...model, licenceAcceptedAt: at });
    },
  };
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
    /** The models of a subscription, by the context that holds them. */
    private readonly licencesOf: (context: SubscriptionContext) => ModelLicences,
  ) {}

  async own(
    owner: SubscriptionContext,
    notebookId: NotebookId,
  ): Promise<SharedNotebookView | null> {
    return this.view(owner, notebookId);
  }

  async through(share: Share): Promise<SharedNotebookView | null> {
    return this.view(contextThrough(share), share.notebookId);
  }

  async acceptModelLicence(
    owner: SubscriptionContext,
    notebookId: NotebookId,
    by: Authorship,
  ): Promise<void> {
    await this.licencesOf(owner).accept(notebookId.value, by.at.toISOString());
  }

  async ownerGrantsAccess(share: Share): Promise<boolean> {
    const status = await this.statusOf(share.ownerSubscriptionId);
    return status !== null && GRANTING.has(status);
  }

  private async view(
    context: SubscriptionContext,
    notebookId: NotebookId,
  ): Promise<SharedNotebookView | null> {
    const notebook = await this.notebooksOf(context).findById(notebookId);
    if (!notebook || notebook.isDeleted) return null;
    const licence = await this.licencesOf(context).licenceOf(notebookId.value);
    return {
      name: notebook.name.value,
      description: notebook.description.value,
      noteCount: notebook.noteCount,
      updatedAt: notebook.updatedAt.toISOString(),
      model: licence ? { licenceAccepted: licence.accepted } : null,
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
  // A model reader never reaches the notebook, only its model (#355): the
  // request goes on in the session's own subscription, where it is missing.
  if (!share || share.profile === 'model-reader') return null;
  return {
    ctx: {
      user: request.ctx.user,
      isOwner: false,
      role: Role.VIEWER,
      share: { notebookId, owner: share.ownerEmail.value, profile: share.profile },
    },
    subscription: contextThrough(share),
    authorship: request.authorship,
    subscriptionRole: Role.VIEWER,
  };
}

/**
 * Whether a notebook is shared with this person and open to them (an export
 * asks). A model reader's share opens no notebook (#355).
 */
export async function openShareOf(
  user: UserId,
  notebookId: NotebookId,
  deps: { readonly shares: ShareRepository; readonly notebooks: SharedNotebooks },
): Promise<Share | null> {
  const share = await new OpenSharedNotebook(deps).execute({ user, notebookId });
  return share && share.profile !== 'model-reader' ? share : null;
}

/**
 * The share a model is read through (#355): any accepted share of its notebook
 * opens its model, a model reader's included, because whoever reads the
 * notebook reads its model.
 */
export async function openModelShareOf(
  user: UserId,
  notebookId: NotebookId,
  deps: { readonly shares: ShareRepository; readonly notebooks: SharedNotebooks },
): Promise<Share | null> {
  return new OpenSharedNotebook(deps).execute({ user, notebookId });
}

/** Every share accepted by this person and open now, the notebook of each a candidate model. */
export async function openSharesOf(
  user: UserId,
  deps: { readonly shares: ShareRepository; readonly notebooks: SharedNotebooks },
): Promise<Share[]> {
  const open: Share[] = [];
  for (const share of await deps.shares.listIncoming(user)) {
    if (share.isOpen && (await deps.notebooks.ownerGrantsAccess(share))) open.push(share);
  }
  return open;
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
  | 'changeShareProfile'
  | 'answerShareIncrease'
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
    changeShareProfile: (request) => new ChangeShareProfile(of(request)),
    answerShareIncrease: (request) => new AnswerShareIncrease(of(request)),
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
    /**
     * What else goes with the notebook: its model and every version of it
     * (#353), which belong to Portability.
     */
    private readonly alsoForget: (notebookId: NotebookId) => Promise<void> = async () => undefined,
  ) {
    super(deps);
  }

  override async execute(
    input: Parameters<DeleteNotebook['execute']>[0],
  ): ReturnType<DeleteNotebook['execute']> {
    const deleted = await super.execute(input);
    if (deleted.ok) {
      await this.shares.removeAllOf(this.owner, input.notebookId);
      await this.alsoForget(input.notebookId);
    }
    return deleted;
  }
}

/**
 * Where a model is read from, for one session (#355): a notebook of its own
 * subscription it may read, or a notebook shared with this person, by any
 * accepted share, read in the subscription the stored share names (INV-02).
 */
export function modelSourcesOf(input: {
  readonly user: UserId;
  readonly own: SubscriptionContext;
  /** Whether the session's own subscription holds this notebook, alive. */
  readonly holds: (notebookId: string) => Promise<boolean>;
  /** Whether the session may read a notebook of its own subscription. */
  readonly canRead: (notebookId: string) => Promise<boolean>;
  readonly depsOf: (context: SubscriptionContext) => ModelSource['deps'];
  readonly sharing: { readonly shares: ShareRepository; readonly notebooks: SharedNotebooks };
  readonly parse: (raw: string) => NotebookId | null;
}): ModelSources {
  return {
    of: async (notebookId) => {
      if (await input.holds(notebookId)) {
        if (!(await input.canRead(notebookId))) return null;
        return {
          subscriptionId: input.own.subscriptionId.value,
          deps: input.depsOf(input.own),
          sharedBy: null,
        };
      }
      const parsed = input.parse(notebookId);
      if (!parsed) return null;
      const share = await openModelShareOf(input.user, parsed, input.sharing);
      if (!share) return null;
      return {
        subscriptionId: share.ownerSubscriptionId.value,
        deps: input.depsOf(contextThrough(share)),
        sharedBy: share.ownerEmail.value,
      };
    },
    shared: async () => {
      const found: Awaited<ReturnType<ModelSources['shared']>> = [];
      for (const share of await openSharesOf(input.user, input.sharing)) {
        const model = await input.depsOf(contextThrough(share)).models.get(share.notebookId.value);
        if (!model) continue;
        const view = await input.sharing.notebooks.through(share);
        if (view) found.push({ model, name: view.name, sharedBy: share.ownerEmail.value });
      }
      return found;
    },
  };
}
