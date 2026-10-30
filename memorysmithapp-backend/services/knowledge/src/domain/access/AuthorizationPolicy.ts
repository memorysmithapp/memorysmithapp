/**
 * AuthorizationPolicy: stage 2 of the two-stage authorization (INV-09).
 *
 * It is a DOMAIN SERVICE, not an infrastructure port: it takes no I/O and
 * makes no network call. The three inputs arrive at no extra cost - isOwner
 * and the role come from the context the authorizer injected, and the
 * ceilings come from the same Query that already loaded the notebook. No extra
 * read enters the hot path because of authorization.
 *
 * Fixed rule, no exception: every Knowledge use case loads the notebook and calls
 * require() BEFORE anything else.
 */

import {
  DomainError,
  err,
  ok,
  Role,
  type NotebookId,
  type Result,
  type UserId,
} from '@memorysmithapp/kernel';
import type { Notebook } from '../notebook/Notebook.js';

/**
 * What a request does to a notebook. Writing is two actions, because a share
 * may grant one without the other (#346): `write-content` is the notes, their
 * order and their moves, the numbers a folder issues and the kept files;
 * `maintain` is the notebook's structure and authoring context, its folders,
 * its Guidance and its Templates. A member of the subscription holds both or
 * neither, by role. `administer` is the owner's alone.
 */
export type Action = 'read' | 'write-content' | 'maintain' | 'administer';

/** The access a share grants, as its owner chose it. */
export type ShareProfile = 'reader' | 'content-editor' | 'notebook-editor';

const SHARE_ALLOWS: Record<ShareProfile, readonly Action[]> = {
  reader: ['read'],
  'content-editor': ['read', 'write-content'],
  'notebook-editor': ['read', 'write-content', 'maintain'],
};

/** What a profile lets its grantee do, as a person reads it in a refusal. */
const SHARE_REFUSES: Record<ShareProfile, string> = {
  reader: 'with read access, and cannot be written',
  'content-editor':
    'as a content editor, which lets you work with its notes and files but not change its folders, Guidance or Templates',
  'notebook-editor': 'as a notebook editor, which does not let you administer it',
};

/**
 * A share the request reaches the notebook through, from another subscription.
 * It is bound to ONE notebook: the request that opened it may act on that
 * notebook and on no other of its owner's, whatever its profile.
 */
export interface ShareAccess {
  readonly notebookId: NotebookId;
  /** The e-mail of the owner, which a refusal names (RN-ACC-027). */
  readonly owner: string;
  readonly profile: ShareProfile;
}

/** What the authorizer injected into the request (cached for 5 min). */
export interface RequestContext {
  readonly user: UserId;
  /** The subscription owner reaches everything in it (RN-ACC-013). */
  readonly isOwner: boolean;
  /**
   * The role in the subscription: one role, not one per recorte. There is no
   * level between the subscription and the notebook, so the only thing that
   * can narrow this is the ceiling of a given notebook (INV-13).
   */
  readonly role: Role;
  /**
   * Present when this session reaches the notebook through a share accepted
   * from another subscription. The role is VIEWER then, so nothing a share
   * grants ever reads as a role of the subscription: what it may write is
   * its profile's, and only on its own notebook.
   */
  readonly share?: ShareAccess;
}

export const AuthorizationPolicy = {
  /**
   * The effective role, in one expression: the lower of the subscription role
   * and the notebook ceiling, with ownership above both. A share reaches only
   * its own notebook.
   */
  effectiveRole(ctx: RequestContext, notebook: Notebook): Role {
    if (ctx.isOwner) return Role.OWNER;
    if (ctx.share && !ctx.share.notebookId.equals(notebook.id)) return Role.NONE;
    if (!ctx.role.canRead()) return Role.NONE;
    return Role.min(ctx.role, notebook.limitFor(ctx.user));
  },

  /** Whether the request may do this, without saying why not. */
  allows(ctx: RequestContext, notebook: Notebook, action: Action): boolean {
    return AuthorizationPolicy.require(ctx, notebook, action).ok;
  },

  require(ctx: RequestContext, notebook: Notebook, action: Action): Result<Role, DomainError> {
    const role = AuthorizationPolicy.effectiveRole(ctx, notebook);

    if (!role.canRead()) {
      // A forbidden resource is indistinguishable from a missing one: a 403
      // here would confirm the existence of a notebook the caller cannot see
      // (RN-SUB-004).
      return err(DomainError.forbidden('Notebook not found'));
    }
    if (action === 'read') return ok(role);

    if (ctx.share) {
      // Shared from another subscription: the notebook is on the grantee's
      // screen, so this is the visible refusal, and it says why and whose it
      // is (RN-ACC-027).
      if (SHARE_ALLOWS[ctx.share.profile].includes(action)) return ok(role);
      return err(
        DomainError.forbiddenVisible(
          `This notebook is shared with you by ${ctx.share.owner} ${SHARE_REFUSES[ctx.share.profile]}`,
          {
            shared: true,
            owner: ctx.share.owner,
            access: ctx.share.profile === 'reader' ? 'read' : ctx.share.profile,
          },
        ),
      );
    }

    if (action === 'administer' && !role.equals(Role.OWNER)) {
      return err(
        DomainError.forbiddenVisible('Only the subscription owner can administer this notebook'),
      );
    }
    if (!role.canWrite()) {
      // The one deliberate exception to the 404: the member already sees this
      // notebook in their list, because a ceiling never hides it (RN-ACC-012).
      // Answering 404 here would protect nothing and produce a notebook that
      // appears on screen and vanishes on write.
      return err(
        DomainError.forbiddenVisible(
          notebook.hasLimitFor(ctx.user)
            ? 'Your role in this notebook is limited to VIEWER'
            : 'Writing in this notebook requires the EDITOR role',
        ),
      );
    }
    return ok(role);
  },
};
