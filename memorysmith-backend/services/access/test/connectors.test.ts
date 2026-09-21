/**
 * The connector behind a token of the connector proxy (RN-AGT-001).
 *
 * Every write through the connector used to be recorded as the person's alone,
 * because no token of the proxy can say which connector it was issued to. The
 * proxy now records it, and these are the rules of that record: bound once,
 * carried by the refresh token, found only under the subscription of the token,
 * and a write through a token with no record is refused rather than recorded
 * incomplete.
 */

import { describe, expect, it } from 'vitest';
import {
  AgentIdentity,
  Instant,
  SubscriptionContext,
  SubscriptionId,
  UserId,
  type Result,
} from '@memorysmith/kernel';
import {
  InMemoryAccessDatabase,
  InMemoryConnectorBindingRepository,
} from '../src/adapters/outbound/memory/InMemoryAccess.js';
import {
  BindConnector,
  ConnectorOfSession,
  RebindConnector,
  ResolveAuthorship,
  UNIDENTIFIED_CONNECTOR,
} from '../src/application/connectors.js';

function unwrap<T>(result: Result<T, { message: string }>): T {
  if (!result.ok) throw new Error(`Expected ok, got: ${result.error.message}`);
  return result.value;
}

const PROXY = 'cimd-proxy-client';
const WEB = 'memorysmith-web';
const NOW = unwrap(Instant.fromISO('2026-09-13T12:00:00.000Z'));
const IN_AN_HOUR = unwrap(Instant.fromISO('2026-09-13T13:00:00.000Z'));
const user = unwrap(UserId.create('user-owner'));
const claude = unwrap(
  AgentIdentity.create('https://claude.ai/oauth/mcp-oauth-client-metadata', 'Claude'),
);
const other = unwrap(AgentIdentity.create('https://other.example.com/metadata.json', 'Other'));
const REFRESH_1 = 'a'.repeat(64);
const REFRESH_2 = 'b'.repeat(64);

function contextOf(subscriptionId: SubscriptionId = SubscriptionId.generate()) {
  return unwrap(
    SubscriptionContext.fromClaims({
      sub: user.value,
      subscription_id: subscriptionId.value,
      subscription_status: 'active',
    }),
  );
}

function bindings(db: InMemoryAccessDatabase, context = contextOf()) {
  return new InMemoryConnectorBindingRepository(context, db);
}

const connectorToken = (tokenId: string) => ({ clientId: PROXY, tokenId });

describe('who a write is by', () => {
  it('is the person alone for a token of the interface', async () => {
    const resolved = await new ResolveAuthorship(
      bindings(new InMemoryAccessDatabase()),
      PROXY,
    ).execute({ user, credential: { clientId: WEB, tokenId: 'web-token' }, now: NOW });
    expect(unwrap(resolved).agent).toBeNull();
    expect(unwrap(resolved).user.equals(user)).toBe(true);
  });

  it('is the person and the connector for a token the proxy bound', async () => {
    const repository = bindings(new InMemoryAccessDatabase());
    unwrap(
      await new BindConnector(repository).execute({
        tokenId: 'jti-1',
        tokenExpiresAt: IN_AN_HOUR,
        agent: claude,
        refreshTokenHash: REFRESH_1,
        now: NOW,
      }),
    );

    const authorship = unwrap(
      await new ResolveAuthorship(repository, PROXY).execute({
        user,
        credential: connectorToken('jti-1'),
        now: NOW,
      }),
    );
    expect(authorship.agent?.toJSON()).toEqual({
      clientId: 'https://claude.ai/oauth/mcp-oauth-client-metadata',
      clientName: 'Claude',
    });
  });

  it('is refused, with a reason a connector can act on, for a token nothing bound', async () => {
    const resolved = await new ResolveAuthorship(
      bindings(new InMemoryAccessDatabase()),
      PROXY,
    ).execute({ user, credential: connectorToken('jti-unbound'), now: NOW });
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.error.code).toBe('PRECONDITION_FAILED');
      expect(resolved.error.message).toBe(UNIDENTIFIED_CONNECTOR);
    }
  });

  it('is refused for a token of the proxy that carries no identifier', async () => {
    const resolved = await new ResolveAuthorship(
      bindings(new InMemoryAccessDatabase()),
      PROXY,
    ).execute({ user, credential: { clientId: PROXY, tokenId: null }, now: NOW });
    expect(resolved.ok).toBe(false);
  });
});

describe('a binding', () => {
  it('is written once: a token never changes connector', async () => {
    const repository = bindings(new InMemoryAccessDatabase());
    const bind = new BindConnector(repository);
    unwrap(
      await bind.execute({
        tokenId: 'jti-1',
        tokenExpiresAt: IN_AN_HOUR,
        agent: claude,
        refreshTokenHash: null,
        now: NOW,
      }),
    );

    const second = await bind.execute({
      tokenId: 'jti-1',
      tokenExpiresAt: IN_AN_HOUR,
      agent: other,
      refreshTokenHash: null,
      now: NOW,
    });

    expect(second.ok).toBe(false);
    expect((await repository.agentOfAccessToken('jti-1', NOW))?.clientName).toBe('Claude');
  });

  it('follows a refreshed token to the connector of the refresh token that renewed it', async () => {
    const repository = bindings(new InMemoryAccessDatabase());
    unwrap(
      await new BindConnector(repository).execute({
        tokenId: 'jti-1',
        tokenExpiresAt: IN_AN_HOUR,
        agent: claude,
        refreshTokenHash: REFRESH_1,
        now: NOW,
      }),
    );

    unwrap(
      await new RebindConnector(repository).execute({
        tokenId: 'jti-2',
        tokenExpiresAt: IN_AN_HOUR,
        refreshTokenHash: REFRESH_1,
        rotatedRefreshTokenHash: null,
        now: NOW,
      }),
    );

    expect((await repository.agentOfAccessToken('jti-2', NOW))?.clientName).toBe('Claude');
  });

  it('is carried forward to a rotated refresh token', async () => {
    const repository = bindings(new InMemoryAccessDatabase());
    const rebind = new RebindConnector(repository);
    unwrap(
      await new BindConnector(repository).execute({
        tokenId: 'jti-1',
        tokenExpiresAt: IN_AN_HOUR,
        agent: claude,
        refreshTokenHash: REFRESH_1,
        now: NOW,
      }),
    );
    unwrap(
      await rebind.execute({
        tokenId: 'jti-2',
        tokenExpiresAt: IN_AN_HOUR,
        refreshTokenHash: REFRESH_1,
        rotatedRefreshTokenHash: REFRESH_2,
        now: NOW,
      }),
    );

    unwrap(
      await rebind.execute({
        tokenId: 'jti-3',
        tokenExpiresAt: IN_AN_HOUR,
        refreshTokenHash: REFRESH_2,
        rotatedRefreshTokenHash: null,
        now: NOW,
      }),
    );

    expect((await repository.agentOfAccessToken('jti-3', NOW))?.clientName).toBe('Claude');
  });

  it('is never made up for a refresh token nothing was bound to', async () => {
    const repository = bindings(new InMemoryAccessDatabase());
    const renewed = await new RebindConnector(repository).execute({
      tokenId: 'jti-2',
      tokenExpiresAt: IN_AN_HOUR,
      refreshTokenHash: REFRESH_1,
      rotatedRefreshTokenHash: null,
      now: NOW,
    });

    expect(renewed.ok).toBe(false);
    if (!renewed.ok) expect(renewed.error.code).toBe('NOT_FOUND');
    expect(await repository.agentOfAccessToken('jti-2', NOW)).toBeNull();
  });

  it('answers for nothing once it expired', async () => {
    const repository = bindings(new InMemoryAccessDatabase());
    unwrap(
      await new BindConnector(repository).execute({
        tokenId: 'jti-1',
        tokenExpiresAt: IN_AN_HOUR,
        agent: claude,
        refreshTokenHash: null,
        now: NOW,
      }),
    );

    const later = await new ResolveAuthorship(repository, PROXY).execute({
      user,
      credential: connectorToken('jti-1'),
      now: IN_AN_HOUR,
    });
    expect(later.ok).toBe(false);
  });

  it('is found only under the subscription of the token', async () => {
    const db = new InMemoryAccessDatabase();
    unwrap(
      await new BindConnector(bindings(db, contextOf())).execute({
        tokenId: 'jti-1',
        tokenExpiresAt: IN_AN_HOUR,
        agent: claude,
        refreshTokenHash: REFRESH_1,
        now: NOW,
      }),
    );

    const elsewhere = bindings(db, contextOf());
    expect(await elsewhere.agentOfAccessToken('jti-1', NOW)).toBeNull();
    expect(await elsewhere.agentOfRefreshToken(REFRESH_1, NOW)).toBeNull();
  });
});

describe('the connector of a session', () => {
  it('is the one the proxy bound, and not-found for a session of the interface', async () => {
    const repository = bindings(new InMemoryAccessDatabase());
    unwrap(
      await new BindConnector(repository).execute({
        tokenId: 'jti-1',
        tokenExpiresAt: IN_AN_HOUR,
        agent: claude,
        refreshTokenHash: null,
        now: NOW,
      }),
    );
    const connectorOf = new ConnectorOfSession(repository, PROXY);

    expect(unwrap(await connectorOf.execute(connectorToken('jti-1'), NOW)).clientName).toBe(
      'Claude',
    );
    const web = await connectorOf.execute({ clientId: WEB, tokenId: 'jti-1' }, NOW);
    expect(web.ok).toBe(false);
    if (!web.ok) expect(web.error.code).toBe('NOT_FOUND');
  });

  it('is not-found for a session with no subscription to look under', async () => {
    const found = await new ConnectorOfSession(null, PROXY).execute(connectorToken('jti-1'), NOW);
    expect(found.ok).toBe(false);
  });
});
