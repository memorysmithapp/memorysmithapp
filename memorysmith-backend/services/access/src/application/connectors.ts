/**
 * The connector behind a token of the connector proxy (RN-AGT-001,
 * architecture-guide.md, sections 12.1 and 13.3).
 *
 * Every token the proxy hands out is issued by Cognito to the proxy's own app
 * client, so nothing inside it says which connector asked for it, and Cognito
 * lets no trigger add that. The proxy is the one party that sees the connector
 * and the token together, at `/token`, and it records the pair through
 * BindConnector and RebindConnector. The core asks ResolveAuthorship on every
 * request that may write. The identity of the agent therefore comes from a
 * record the proxy wrote, and never from the shape of a string in the token.
 */

import {
  Authorship,
  DomainError,
  err,
  Instant,
  ok,
  type AgentIdentity,
  type Result,
  type UserId,
} from '@memorysmith/kernel';
import type { ConnectorBindingRepository } from '../domain/ports/index.js';
import { ACCESS_LIMITS } from '../domain/values.js';

/** What a session presents: the app client of its token, and the token itself. */
export interface TokenCredential {
  /** The app client the token was issued to, or null when the token names none. */
  readonly clientId: string | null;
  /** The `jti` of the token, which a binding is keyed by. */
  readonly tokenId: string | null;
}

/**
 * Why a write through an unidentified connector is refused, in words the
 * connector can act on. Recording the write as the person's alone is the defect
 * this exists to end, and recording it as an unknown agent would leave an
 * incomplete record in a trail nothing can correct: a refused write costs one
 * reconnection.
 */
export const UNIDENTIFIED_CONNECTOR =
  'This connection does not record which connector it is, so a write through it could not ' +
  'say who wrote. Nothing was written. Disconnect the connector and connect it again; reading ' +
  'keeps working in the meantime.';

const ALREADY_BOUND = 'This token is already bound to a connector';

async function agentBehind(
  bindings: ConnectorBindingRepository | null,
  connectorClientId: string,
  credential: TokenCredential,
  now: Instant,
): Promise<AgentIdentity | null> {
  if (!bindings || credential.clientId !== connectorClientId || !credential.tokenId) return null;
  return bindings.agentOfAccessToken(credential.tokenId, now);
}

/** The proxy records the connector a token was just issued to. */
export class BindConnector {
  constructor(private readonly bindings: ConnectorBindingRepository) {}

  async execute(input: {
    tokenId: string;
    tokenExpiresAt: Instant;
    agent: AgentIdentity;
    refreshTokenHash: string | null;
    now?: Instant;
  }): Promise<Result<void, DomainError>> {
    const now = input.now ?? Instant.now();
    const recorded = await this.bindings.bindAccessToken(
      input.tokenId,
      input.agent,
      input.tokenExpiresAt,
    );
    if (!recorded) return err(DomainError.conflict(ALREADY_BOUND));

    if (input.refreshTokenHash) {
      await this.bindings.bindRefreshToken(
        input.refreshTokenHash,
        input.agent,
        now.plusDays(ACCESS_LIMITS.connectorRefreshTokenDays),
      );
    }
    return ok();
  }
}

/**
 * A refreshed token is bound to the connector of the refresh token that renewed
 * it. The connector is never taken from the request: presenting a refresh token
 * gets exactly the connector it was issued to, or none.
 */
export class RebindConnector {
  constructor(private readonly bindings: ConnectorBindingRepository) {}

  async execute(input: {
    tokenId: string;
    tokenExpiresAt: Instant;
    refreshTokenHash: string;
    rotatedRefreshTokenHash: string | null;
    now?: Instant;
  }): Promise<Result<void, DomainError>> {
    const now = input.now ?? Instant.now();
    const agent = await this.bindings.agentOfRefreshToken(input.refreshTokenHash, now);
    if (!agent) return err(DomainError.notFound('No connector is bound to this refresh token'));

    const recorded = await this.bindings.bindAccessToken(
      input.tokenId,
      agent,
      input.tokenExpiresAt,
    );
    if (!recorded) return err(DomainError.conflict(ALREADY_BOUND));

    // With rotation, the next refresh presents the new token, so the binding
    // follows it. Without rotation there is nothing to follow.
    if (input.rotatedRefreshTokenHash) {
      await this.bindings.bindRefreshToken(
        input.rotatedRefreshTokenHash,
        agent,
        now.plusDays(ACCESS_LIMITS.connectorRefreshTokenDays),
      );
    }
    return ok();
  }
}

/**
 * The connector a session acts through. A session that is not a connector's,
 * or whose connector was never recorded, answers NOT_FOUND, so `whoami` says the
 * connector is unidentified instead of naming it by something else the token
 * carries.
 */
export class ConnectorOfSession {
  constructor(
    private readonly bindings: ConnectorBindingRepository | null,
    private readonly connectorClientId: string,
  ) {}

  async execute(
    credential: TokenCredential,
    now: Instant = Instant.now(),
  ): Promise<Result<AgentIdentity, DomainError>> {
    const agent = await agentBehind(this.bindings, this.connectorClientId, credential, now);
    return agent
      ? ok(agent)
      : err(DomainError.notFound('This session is not bound to a connector'));
  }
}

/**
 * Who a write of this session is by. A token of any other app client is a person
 * writing through the interface, and its authorship carries no agent. A token of
 * the connector proxy carries the connector it was bound to, and without a
 * binding the write is refused rather than recorded incomplete.
 */
export class ResolveAuthorship {
  constructor(
    private readonly bindings: ConnectorBindingRepository,
    private readonly connectorClientId: string,
  ) {}

  async execute(input: {
    user: UserId;
    credential: TokenCredential;
    now?: Instant;
  }): Promise<Result<Authorship, DomainError>> {
    const now = input.now ?? Instant.now();
    if (input.credential.clientId !== this.connectorClientId) {
      return ok(Authorship.byHuman(input.user, now));
    }
    const agent = await agentBehind(this.bindings, this.connectorClientId, input.credential, now);
    return agent
      ? ok(Authorship.byAgent(input.user, agent, now))
      : err(DomainError.preconditionFailed(UNIDENTIFIED_CONNECTOR));
  }
}
