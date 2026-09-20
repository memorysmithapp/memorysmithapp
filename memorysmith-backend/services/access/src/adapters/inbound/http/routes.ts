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
  AgentIdentity,
  Authorship,
  DomainError,
  err,
  httpStatusFor,
  Instant,
  SubscriptionContext,
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
  ChangeMemberRole,
  ListMembers,
  RemoveMember,
  TransferOwnership,
} from '../../../application/members.js';
import type {
  BindConnector,
  ConnectorOfSession,
  RebindConnector,
  TokenCredential,
} from '../../../application/connectors.js';
import type { ChooseLanguage, RecordWelcome } from '../../../application/account.js';
import type { UserProfile } from '../../../domain/ports/index.js';
import { connectorBindingRequestSchema, sessionSchema } from '@memorysmith/contracts';
import type { TokenVerifier } from './authentication.js';

/** What the auth middleware puts on the request. */
export interface AccessRequest {
  readonly profile: UserProfile;
  readonly context: SubscriptionContext | null;
  /** The app client and the identifier of the token this request carries. */
  readonly credential: TokenCredential;
}

/**
 * Every use case is a FACTORY over the request, because the repositories
 * behind it are built per request from the subscription in the token (PE2).
 */
export interface AccessUseCases {
  readonly requestSubscription: (request: AccessRequest) => RequestSubscription;
  readonly getSession: (request: AccessRequest) => GetSession;
  readonly switchSubscription: (request: AccessRequest) => SwitchActiveSubscription;
  readonly chooseLanguage: (request: AccessRequest) => ChooseLanguage;
  readonly recordWelcome: (request: AccessRequest) => RecordWelcome;
  readonly listPlatformQueue: (request: AccessRequest) => ListPlatformQueue;
  readonly reviewSubscription: (request: AccessRequest) => ReviewSubscription;
  readonly listMembers: (request: AccessRequest) => ListMembers;
  readonly changeMemberRole: (request: AccessRequest) => ChangeMemberRole;
  readonly removeMember: (request: AccessRequest) => RemoveMember;
  readonly transferOwnership: (request: AccessRequest) => TransferOwnership;
  readonly connectorOfSession: (request: AccessRequest) => ConnectorOfSession;
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
      usedBytes: view.value.usedBytes,
      welcomeSeen: view.value.welcomeSeen,
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

  /**
   * The language of the account, which every message the product sends it is
   * written in (RN-ACC-018). The interface records it when the person chooses a
   * language, and a session with no subscription records it like any other.
   */
  app.put('/session/locale', async (c) => {
    const request = c.get('access');
    const body = (await c.req.json().catch(() => ({}))) as { locale?: string };
    return respond(
      c,
      await useCases.chooseLanguage(request).execute({
        profile: request.profile,
        locale: String(body.locale ?? ''),
      }),
      204,
    );
  });

  /**
   * The person has been shown what the product is (#167). Recorded when the
   * welcome surface opens by itself, and never when it is opened from the user
   * menu: what this date answers is whether it still has to open on its own.
   */
  app.post('/session/welcomed', async (c) => {
    const request = c.get('access');
    return respond(
      c,
      await useCases.recordWelcome(request).execute({ profile: request.profile }),
      204,
    );
  });

  /**
   * The connector this session acts through, which `whoami` names. A session
   * that is not a connector's, or whose connector was never recorded, answers
   * NOT_FOUND: the connector is then unidentified, and nothing else the token
   * carries is named in its place.
   */
  app.get('/connector', async (c) => {
    const request = c.get('access');
    const found = await useCases.connectorOfSession(request).execute(request.credential);
    return respond(c, found.ok ? { ok: true as const, value: found.value.toJSON() } : found);
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

/** What the route the connector proxy binds a token through needs. */
export interface ConnectorBindingDependencies {
  readonly verifier: TokenVerifier;
  /** The app client of the connector proxy: the only one whose tokens are bound. */
  readonly connectorClientId: string;
  /**
   * Whether the gateway authenticated this request with IAM (section 14.1).
   * The route is authorized by IAM before it reaches the function, and this is
   * the check that it was: without it, whoever holds a token of the proxy could
   * bind it to any connector they liked.
   */
  readonly signedWithIam: (c: Context) => boolean;
  readonly bindConnector: (context: SubscriptionContext) => BindConnector;
  readonly rebindConnector: (context: SubscriptionContext) => RebindConnector;
}

/**
 * `POST /access/connector-bindings`: the connector proxy records which connector
 * a token it has just handed out belongs to (architecture-guide.md, 13.3).
 *
 * It is mounted apart from every other route of Access, because no person calls
 * it: it carries no session, it is signed by the proxy, and the token it binds
 * travels in the body. The subscription and the identifier are read from that
 * token's own verified claims and never from the body, so a token can only be
 * bound under the subscription it names.
 */
export function createConnectorBindingRoutes(deps: ConnectorBindingDependencies): Hono {
  const app = new Hono();

  app.post('/', async (c) => {
    // To anyone but the proxy, this route does not exist.
    if (!deps.signedWithIam(c)) return respond(c, err(DomainError.forbidden('Not found')));

    const parsed = connectorBindingRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return respond(
        c,
        err(DomainError.validation('Not a connector binding', parsed.error.issues)),
      );
    }
    const binding = parsed.data;

    const token = await deps.verifier.verify(binding.accessToken);
    if (
      !token ||
      token.client_id !== deps.connectorClientId ||
      token.token_use !== 'access' ||
      !token.jti ||
      token.exp === undefined
    ) {
      return respond(
        c,
        err(
          DomainError.validation('The token to bind is not an access token of the connector proxy'),
        ),
      );
    }
    const context = SubscriptionContext.fromClaims(token);
    if (!context.ok) return respond(c, context);
    const expiresAt = Instant.fromEpochMillis(token.exp * 1000);
    if (!expiresAt.ok) return respond(c, expiresAt);

    if (binding.grant === 'authorization_code') {
      const agent = AgentIdentity.create(binding.connector.clientId, binding.connector.clientName);
      if (!agent.ok) return respond(c, agent);
      return respond(
        c,
        await deps.bindConnector(context.value).execute({
          tokenId: token.jti,
          tokenExpiresAt: expiresAt.value,
          agent: agent.value,
          refreshTokenHash: binding.refreshTokenHash,
        }),
        204,
      );
    }

    return respond(
      c,
      await deps.rebindConnector(context.value).execute({
        tokenId: token.jti,
        tokenExpiresAt: expiresAt.value,
        refreshTokenHash: binding.refreshTokenHash,
        rotatedRefreshTokenHash: binding.rotatedRefreshTokenHash,
      }),
      204,
    );
  });

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
