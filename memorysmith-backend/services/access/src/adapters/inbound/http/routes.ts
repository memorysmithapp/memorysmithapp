/**
 * HTTP surface of svc-access (architecture-guide.md, section 14.1).
 *
 * NO ROUTE TAKES A subscriptionId: it always comes from the token. The single
 * exception is POST /session/subscription, which is a session operation, not a
 * business one, and it names the subscription the user is switching TO
 * (RN-SUB-013).
 *
 * The platform routes are the other named exception: they run under a session
 * with no subscription claim at all, and they read only subscription metadata.
 */

import { Hono } from 'hono';
import {
  Authorship,
  DomainError,
  httpStatusFor,
  SubscriptionId,
  UserId,
  type Result,
} from '@memorysmith/kernel';
import type { Context } from 'hono';
import type {
  RequestSubscription,
  GetSession,
  SwitchActiveSubscription,
} from '../../../application/onboarding.js';
import type { ListPlatformQueue, ReviewSubscription } from '../../../application/platform.js';
import type {
  AcceptInvite,
  ChangeMemberRole,
  ListMembers,
  InviteMember,
  RemoveMember,
  TransferOwnership,
} from '../../../application/members.js';
import type { UserProfile } from '../../../domain/ports/index.js';
import type { SubscriptionContext } from '@memorysmith/kernel';
import { sessionSchema } from '@memorysmith/contracts';

/** What the auth middleware puts on the request. */
export interface AccessRequest {
  readonly profile: UserProfile;
  readonly context: SubscriptionContext | null;
}

/**
 * Every use case is a FACTORY over the request, because the repositories
 * behind it are built per request from the subscription in the token (PE2).
 */
export interface AccessUseCases {
  readonly requestSubscription: (request: AccessRequest) => RequestSubscription;
  readonly getSession: (request: AccessRequest) => GetSession;
  readonly switchSubscription: (request: AccessRequest) => SwitchActiveSubscription;
  readonly listPlatformQueue: (request: AccessRequest) => ListPlatformQueue;
  readonly reviewSubscription: (request: AccessRequest) => ReviewSubscription;
  readonly listMembers: (request: AccessRequest) => ListMembers;
  readonly inviteMember: (request: AccessRequest) => InviteMember;
  readonly acceptInvite: (request: AccessRequest) => AcceptInvite;
  readonly changeMemberRole: (request: AccessRequest) => ChangeMemberRole;
  readonly removeMember: (request: AccessRequest) => RemoveMember;
  readonly transferOwnership: (request: AccessRequest) => TransferOwnership;
}

type Variables = { access: AccessRequest };

/** Translates the taxonomy into HTTP once, for every route (section 15). */
export function respond<T>(c: Context, result: Result<T, DomainError>, okStatus = 200): Response {
  if (result.ok) {
    return result.value === undefined
      ? new Response(null, { status: okStatus === 200 ? 204 : okStatus })
      : c.json(result.value as object, okStatus as 200);
  }
  const status = httpStatusFor(result.error);
  return c.json(
    {
      code: result.error.code,
      message: result.error.message,
      ...(result.error.details ? { details: result.error.details } : {}),
    },
    status as 400,
  );
}

function requireContext(request: AccessRequest): Result<SubscriptionContext, DomainError> {
  if (!request.context) {
    // A platform session carries no subscription: no key can be built, and the
    // failure happens before any role check (RN-SUB-016).
    return {
      ok: false,
      error: DomainError.forbidden('This session carries no active subscription'),
    };
  }
  return { ok: true, value: request.context };
}

export function createAccessRoutes(useCases: AccessUseCases): Hono<{ Variables: Variables }> {
  const app = new Hono<{ Variables: Variables }>();

  // ---- Session -------------------------------------------------------------

  /**
   * The one call the SPA makes to render its shell. The use case answers in
   * the vocabulary of the domain, where an email is a value object and the
   * links are links; the DTO is the vocabulary of the contract, and mapping
   * between the two is the job of this adapter. Handing the domain view
   * straight to `c.json` is how an email reaches the browser as `{value: ...}`
   * and a declared field arrives under another name.
   */
  app.get('/session', async (c) => {
    const request = c.get('access');
    const view = await useCases
      .getSession(request)
      .execute({ profile: request.profile, context: request.context });
    if (!view.ok) return respond(c, view);

    const activeId = request.context?.subscriptionId.value ?? null;
    const dto = {
      user: {
        userId: view.value.user.userId.value,
        email: view.value.user.email.value,
        name: view.value.user.name,
        isPlatformAdmin: view.value.user.isPlatformAdmin,
      },
      // The active subscription is the one the TOKEN names, never the one the
      // list happens to start with (RN-SUB-002).
      activeSubscription: view.value.links.find((link) => link.subscriptionId === activeId) ?? null,
      subscriptions: view.value.links,
      role: view.value.role,
    };
    // Parsed, not cast. A cast would let the shape drift from the declared
    // contract in silence, which is exactly how this response came to send
    // `links` where the contract says `subscriptions`.
    return c.json(sessionSchema.parse(dto), 200);
  });

  app.post('/session/subscription', async (c) => {
    const request = c.get('access');
    const body = (await c.req.json().catch(() => ({}))) as { subscriptionId?: string };
    const subscriptionId = SubscriptionId.fromClaim(String(body.subscriptionId ?? ''));
    if (!subscriptionId.ok) return respond(c, subscriptionId);
    return respond(
      c,
      await useCases.switchSubscription(request).execute({
        user: request.profile.userId,
        subscriptionId: subscriptionId.value,
      }),
      204,
    );
  });

  // ---- Onboarding ----------------------------------------------------------

  app.post('/subscriptions', async (c) => {
    const request = c.get('access');
    const body = (await c.req.json().catch(() => ({}))) as {
      type?: string;
      quota?: string;
    };
    const created = await useCases.requestSubscription(request).execute({
      profile: request.profile,
      // Absent is not the same as invalid: the use case reads it as "the
      // default plan", and only a value that exists is validated. A request
      // with no body at all is therefore a valid one.
      ...(body.type ? { type: String(body.type) } : {}),
      ...(body.quota ? { quota: String(body.quota) } : {}),
      by: Authorship.byHuman(request.profile.userId),
    });
    return respond(
      c,
      created.ok
        ? { ok: true as const, value: { subscriptionId: created.value.subscriptionId.value } }
        : created,
      201,
    );
  });

  // ---- Members -------------------------------------------------------------

  app.get('/members', async (c) => {
    const request = c.get('access');
    const context = requireContext(request);
    if (!context.ok) return respond(c, context);

    const listed = await useCases.listMembers(request).execute({ context: context.value });
    return respond(
      c,
      listed.ok
        ? {
            ok: true as const,
            value: listed.value.map((member) => ({
              userId: member.userId.value,
              email: member.email.value,
              role: member.role.name,
              invitedBy: member.invitedBy?.value ?? null,
              joinedAt: member.joinedAt.toISOString(),
            })),
          }
        : listed,
    );
  });

  app.post('/members', async (c) => {
    const request = c.get('access');
    const context = requireContext(request);
    if (!context.ok) return respond(c, context);

    const body = (await c.req.json().catch(() => ({}))) as { email?: string; role?: string };
    const invited = await useCases.inviteMember(request).execute({
      context: context.value,
      email: String(body.email ?? ''),
      role: String(body.role ?? ''),
      by: Authorship.byHuman(request.profile.userId),
    });
    return respond(
      c,
      invited.ok ? { ok: true as const, value: { token: invited.value.token.value } } : invited,
      201,
    );
  });

  app.patch('/members/:user', async (c) => {
    const request = c.get('access');
    const context = requireContext(request);
    if (!context.ok) return respond(c, context);

    const userId = UserId.create(c.req.param('user'));
    if (!userId.ok) return respond(c, userId);

    const body = (await c.req.json().catch(() => ({}))) as { role?: string };
    return respond(
      c,
      await useCases.changeMemberRole(request).execute({
        context: context.value,
        userId: userId.value,
        role: String(body.role ?? ''),
        by: Authorship.byHuman(request.profile.userId),
      }),
      204,
    );
  });

  app.delete('/members/:user', async (c) => {
    const request = c.get('access');
    const context = requireContext(request);
    if (!context.ok) return respond(c, context);

    const userId = UserId.create(c.req.param('user'));
    if (!userId.ok) return respond(c, userId);

    return respond(
      c,
      await useCases.removeMember(request).execute({
        context: context.value,
        userId: userId.value,
        by: Authorship.byHuman(request.profile.userId),
      }),
      204,
    );
  });

  app.post('/subscriptions/:s/ownership', async (c) => {
    const request = c.get('access');
    const context = requireContext(request);
    if (!context.ok) return respond(c, context);
    // The path carries the subscription for readability, but the operation
    // acts on the one in the token: a different id is simply not found.
    if (c.req.param('s') !== context.value.subscriptionId.value) {
      return respond(c, { ok: false, error: DomainError.notFound('Subscription not found') });
    }

    const body = (await c.req.json().catch(() => ({}))) as { toUserId?: string };
    const toUserId = UserId.create(String(body.toUserId ?? ''));
    if (!toUserId.ok) return respond(c, toUserId);

    return respond(
      c,
      await useCases.transferOwnership(request).execute({
        context: context.value,
        toUserId: toUserId.value,
        by: Authorship.byHuman(request.profile.userId),
      }),
      204,
    );
  });

  app.post('/invites/:token/accept', async (c) => {
    const request = c.get('access');
    const accepted = await useCases.acceptInvite(request).execute({
      profile: request.profile,
      token: c.req.param('token'),
      by: Authorship.byHuman(request.profile.userId),
    });
    return respond(
      c,
      accepted.ok
        ? {
            ok: true as const,
            value: { subscriptionId: accepted.value.subscriptionId, role: accepted.value.role },
          }
        : accepted,
    );
  });

  // ---- Platform ------------------------------------------------------------

  app.get('/platform/subscriptions', async (c) => {
    const request = c.get('access');
    return respond(
      c,
      await useCases.listPlatformQueue(request).execute({
        actor: {
          userId: request.profile.userId,
          isPlatformAdmin: request.profile.isPlatformAdmin,
        },
        status: c.req.query('status') ?? 'pending_approval',
      }),
    );
  });

  app.post('/platform/subscriptions/:s/approve', async (c) =>
    platformAction(c, useCases, 'approve'),
  );
  app.post('/platform/subscriptions/:s/reject', async (c) => platformAction(c, useCases, 'reject'));
  app.post('/platform/subscriptions/:s/suspend', async (c) =>
    platformAction(c, useCases, 'suspend'),
  );
  app.post('/platform/subscriptions/:s/reactivate', async (c) =>
    platformAction(c, useCases, 'reactivate'),
  );
  /**
   * The administrative override, and the one route that sets a status with no
   * transition machine in the way (RN-SUB-018). It is a PUT and not a POST
   * because it names the state it wants, not the review that led to it.
   */
  app.put('/platform/subscriptions/:s/status', async (c) => platformAction(c, useCases, 'status'));
  app.patch('/platform/subscriptions/:s/plan', async (c) => platformAction(c, useCases, 'plan'));

  return app;
}

async function platformAction(
  c: Context<{ Variables: Variables }>,
  useCases: AccessUseCases,
  action: 'approve' | 'reject' | 'suspend' | 'reactivate' | 'status' | 'plan',
): Promise<Response> {
  const request = c.get('access');
  const subscriptionId = SubscriptionId.fromClaim(c.req.param('s') ?? '');
  if (!subscriptionId.ok) return respond(c, subscriptionId);

  const actor = {
    userId: request.profile.userId,
    isPlatformAdmin: request.profile.isPlatformAdmin,
  };
  const by = Authorship.byHuman(request.profile.userId);
  const body = (await c.req.json().catch(() => ({}))) as {
    status?: string;
    reason?: string;
    type?: string;
    quota?: string;
  };

  switch (action) {
    case 'approve':
      return respond(
        c,
        await useCases.reviewSubscription(request).approve({
          actor,
          subscriptionId: subscriptionId.value,
          status: String(body.status ?? 'active'),
          by,
        }),
        204,
      );
    case 'reject':
      return respond(
        c,
        await useCases.reviewSubscription(request).reject({
          actor,
          subscriptionId: subscriptionId.value,
          reason: String(body.reason ?? ''),
          by,
        }),
        204,
      );
    case 'suspend':
      return respond(
        c,
        await useCases.reviewSubscription(request).suspend({
          actor,
          subscriptionId: subscriptionId.value,
          by,
        }),
        204,
      );
    case 'reactivate':
      return respond(
        c,
        await useCases.reviewSubscription(request).reactivate({
          actor,
          subscriptionId: subscriptionId.value,
          status: String(body.status ?? 'active'),
          by,
        }),
        204,
      );
    case 'status':
      return respond(
        c,
        await useCases.reviewSubscription(request).setStatus({
          actor,
          subscriptionId: subscriptionId.value,
          status: String(body.status ?? ''),
          by,
        }),
        204,
      );
    case 'plan':
      return respond(
        c,
        await useCases.reviewSubscription(request).changePlan({
          actor,
          subscriptionId: subscriptionId.value,
          ...(body.type ? { type: String(body.type) } : {}),
          ...(body.quota ? { quota: String(body.quota) } : {}),
          by,
        }),
        204,
      );
  }
}
