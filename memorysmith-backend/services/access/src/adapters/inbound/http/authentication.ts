/**
 * Authentication middleware: where the token becomes a SubscriptionContext,
 * and the only place in the whole backend where that conversion happens
 * (RN-SUB-002, architecture-guide.md section 8.2).
 *
 * Two shapes of session come out of here:
 *
 *  - a business session, with a subscription_id claim, which yields a context;
 *  - a PLATFORM session, which carries no such claim and therefore yields
 *    NULL. Under it, no subscription-scoped repository is constructible, so no
 *    workspace, vault or note can be reached. The impossibility is the
 *    guarantee; a role check would not be (RN-SUB-016, section 8.4).
 */

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import {
  DomainError,
  SubscriptionContext,
  UserId,
  type Result,
  type TokenClaims,
} from '@memorysmith/kernel';
import { Email } from '../../../domain/values.js';
import type { UserProfile } from '../../../domain/ports/index.js';

export interface VerifiedToken extends TokenClaims {
  readonly email?: string | undefined;
  readonly name?: string | undefined;
  readonly groups?: readonly string[] | undefined;
}

/** The port; the Cognito implementation lives below. */
export interface TokenVerifier {
  verify(token: string): Promise<VerifiedToken | null>;
}

export interface AuthenticatedSession {
  readonly profile: UserProfile;
  /** Null for a platform session, which carries no subscription (8.4). */
  readonly context: SubscriptionContext | null;
}

const PLATFORM_ADMIN_GROUP = 'platform-admin';

export async function authenticate(
  verifier: TokenVerifier,
  authorizationHeader: string | undefined,
): Promise<Result<AuthenticatedSession, DomainError>> {
  const token = authorizationHeader?.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return { ok: false, error: DomainError.forbidden('Missing bearer token') };
  }
  const verified = await verifier.verify(token);
  if (!verified) {
    return { ok: false, error: DomainError.forbidden('Invalid bearer token') };
  }

  const userId = UserId.create(verified.sub);
  if (!userId.ok) return userId;
  const email = Email.create(verified.email ?? `${verified.sub}@users.memorysmith.app`);
  if (!email.ok) return email;

  const profile: UserProfile = {
    userId: userId.value,
    email: email.value,
    name: verified.name ?? email.value.value,
    isPlatformAdmin: (verified.groups ?? []).includes(PLATFORM_ADMIN_GROUP),
  };

  if (!verified.subscription_id) {
    // Platform session, or a user who has not been approved yet.
    return { ok: true, value: { profile, context: null } };
  }

  const context = SubscriptionContext.fromClaims(verified);
  if (!context.ok) return context;
  return { ok: true, value: { profile, context: context.value } };
}

/**
 * Verifies a Cognito access token against the JWKS of the user pool. The
 * subscription_id and subscription_status claims are injected by the
 * pre-token-generation trigger (section 8.5), so they arrive already signed.
 */
export class CognitoTokenVerifier implements TokenVerifier {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    private readonly issuer: string,
    private readonly audience?: string,
  ) {
    this.jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  }

  async verify(token: string): Promise<VerifiedToken | null> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, { issuer: this.issuer });
      if (typeof payload.sub !== 'string') return null;
      if (this.audience && payload['client_id'] !== this.audience) return null;
      return fromPayload(payload);
    } catch {
      return null;
    }
  }
}

function fromPayload(payload: JWTPayload): VerifiedToken {
  const groups = payload['cognito:groups'];
  return {
    sub: String(payload.sub),
    subscription_id:
      typeof payload['subscription_id'] === 'string' ? payload['subscription_id'] : undefined,
    subscription_status:
      typeof payload['subscription_status'] === 'string'
        ? payload['subscription_status']
        : undefined,
    client_id: typeof payload['client_id'] === 'string' ? payload['client_id'] : undefined,
    email: typeof payload['email'] === 'string' ? payload['email'] : undefined,
    name: typeof payload['name'] === 'string' ? payload['name'] : undefined,
    groups: Array.isArray(groups) ? groups.map(String) : undefined,
  };
}
