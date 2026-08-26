/**
 * The HTTP app of the modular monolith. It mounts each bounded context under
 * its own prefix, which is exactly the routing CloudFront does when the
 * contexts become separate deployables: `api.memorysmith.app/knowledge/*` goes
 * on meaning the same thing (architecture-guide.md, sections 14.1 and 24).
 *
 * The middleware chain is the two-stage authorization of section 14.2:
 *   1. authenticate  -> claims, and a SubscriptionContext when there is one;
 *   2. resolve       -> ownership and workspace roles, cached five minutes.
 * A third stage does not exist here: the decision about a vault belongs to the
 * service that owns the vault, and it happens inside its use cases.
 */

import { Hono, type Context, type Next } from 'hono';
import { type DomainError, httpStatusFor } from '@memorysmith/kernel';
import { authenticate, type TokenVerifier } from '@memorysmith/svc-access/adapters/auth';
import {
  createAccessRoutes,
  type AccessRequest,
  type AccessUseCases,
} from '@memorysmith/svc-access/adapters/http';
import {
  createKnowledgeRoutes,
  type KnowledgeRequest,
  type KnowledgeUseCases,
} from '@memorysmith/svc-knowledge/adapters/http';
import {
  createAuditRoutes,
  type AuditRequest,
  type AuditUseCases,
} from '@memorysmith/svc-audit/adapters/http';
import {
  createDiscoveryRoutes,
  type DiscoveryRequest,
  type DiscoveryUseCases,
} from '@memorysmith/svc-discovery/adapters/http';

export interface AppDependencies {
  readonly verifier: TokenVerifier;
  /** Factories: the repositories behind them are built per request. */
  readonly accessUseCases: AccessUseCases;
  readonly knowledgeUseCases: KnowledgeUseCases;
  readonly auditUseCases: AuditUseCases;
  readonly discoveryUseCases: DiscoveryUseCases;
  /** Stage 1 of authorization, for the routes that need a vault decision. */
  readonly resolveContext: (
    request: AccessRequest,
  ) => Promise<{ ok: true; value: KnowledgeRequest } | { ok: false; error: DomainError }>;
  /**
   * Whether this session may read a given vault. Discovery answers about
   * vaults it does not own, so the decision comes from whoever does.
   */
  readonly canReadVault: (request: KnowledgeRequest, vaultId: string) => Promise<boolean>;
}

type Variables = {
  access: AccessRequest;
  knowledge: KnowledgeRequest;
  audit: AuditRequest;
  discovery: DiscoveryRequest;
};

function fail(c: Context, error: DomainError): Response {
  return c.json(
    {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
    httpStatusFor(error) as 400,
  );
}

export function createApp(deps: AppDependencies): Hono<{ Variables: Variables }> {
  const app = new Hono<{ Variables: Variables }>();

  app.get('/health', (c) => c.json({ status: 'ok' }));

  /**
   * The preflight. The HTTP API is what adds the CORS headers, but the default
   * route captures every method, so OPTIONS still reaches us and has to be
   * answered: a 404 here fails the preflight, and with it every browser call
   * that carries an Authorization header, which is all of them.
   *
   * No CORS header is written here on purpose. Two sources writing the same
   * header is worse than none: the browser rejects a duplicated
   * Access-Control-Allow-Origin outright.
   */
  app.options('*', () => new Response(null, { status: 204 }));

  app.use('/access/*', async (c: Context<{ Variables: Variables }>, next: Next) => {
    const session = await authenticate(deps.verifier, c.req.header('authorization'));
    if (!session.ok) return fail(c, session.error);
    c.set('access', session.value);
    await next();
  });

  /**
   * Knowledge, Discovery, Audit and Portability all need the vault decision,
   * so they share the same second stage. A platform session carries no
   * subscription, so nothing downstream is even constructible: it fails HERE,
   * at composition, and not at a role check (RN-SUB-016).
   */
  app.use(
    '/:context{knowledge|discovery|audit}/*',
    async (c: Context<{ Variables: Variables }>, next: Next) => {
      const session = await authenticate(deps.verifier, c.req.header('authorization'));
      if (!session.ok) return fail(c, session.error);
      c.set('access', session.value);

      const resolved = await deps.resolveContext(session.value);
      if (!resolved.ok) return fail(c, resolved.error);
      c.set('knowledge', resolved.value);
      c.set('audit', { subscription: resolved.value.subscription });
      c.set('discovery', {
        subscription: resolved.value.subscription,
        // Discovery holds no vault, so whether the caller may read one is
        // answered by the context that owns it.
        canRead: (vaultId: string) => deps.canReadVault(resolved.value, vaultId),
      });
      await next();
    },
  );

  app.route('/access', createAccessRoutes(deps.accessUseCases));
  app.route('/knowledge', createKnowledgeRoutes(deps.knowledgeUseCases));
  app.route('/discovery', createDiscoveryRoutes(deps.discoveryUseCases));
  app.route('/audit', createAuditRoutes(deps.auditUseCases));

  return app;
}
