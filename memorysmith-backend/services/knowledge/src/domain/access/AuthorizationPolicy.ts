/**
 * AuthorizationPolicy: stage 2 of the two-stage authorization
 * (architecture-guide.md, section 14.2).
 *
 * It is a DOMAIN SERVICE, not an infrastructure port: it takes no I/O and
 * makes no network call. The three inputs arrive at no extra cost - isOwner
 * and the role come from the context the authorizer injected, and the
 * ceilings come from the same Query that already loaded the notebook
 * (section 9.3). No extra read enters the hot path because of authorization.
 *
 * Fixed rule, no exception: every Knowledge use case loads the notebook and calls
 * require() BEFORE anything else.
 */

import { DomainError, err, ok, Role, type Result, type UserId } from '@memorysmith/kernel';
import type { Notebook } from '../notebook/Notebook.js';

export type Action = 'read' | 'write' | 'administer';

/** What the authorizer injected into the request (cached for 5 min). */
export interface RequestContext {
  readonly user: UserId;
  /** The subscription owner reaches everything in it (RN-ACC-013). */
  readonly isOwner: boolean;
  /**
   * The role in the subscription: one role, not one per recorte. There is no
   * level between the subscription and the notebook (software-vision.md 4.3), so
   * the only thing that can narrow this is the ceiling of a given notebook.
   */
  readonly role: Role;
}

export const AuthorizationPolicy = {
  /**
   * The effective role, in one expression: the lower of the subscription role
   * and the notebook ceiling, with ownership above both.
   */
  effectiveRole(ctx: RequestContext, notebook: Notebook): Role {
    if (ctx.isOwner) return Role.OWNER;
    if (!ctx.role.canRead()) return Role.NONE;
    return Role.min(ctx.role, notebook.limitFor(ctx.user));
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
