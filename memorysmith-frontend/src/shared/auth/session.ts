// The session, as the token tells it.
//
// With the backend live, everything here comes from the claims and from
// GET /access/session. Without it, the prototype keeps its simulated session,
// and the screens cannot tell the difference.
//
// The subscription is never chosen by the SPA: it is the claim the token
// carries (RN-SUB-002), and switching it is an explicit call that mints a new
// token (RN-SUB-013).

import { create } from 'zustand';
import type { SessionDto } from '@memorysmith/contracts';
import { claimsOf, readTokens, type AuthConfig } from './oauth';
import { getSession } from '../api/backend';

export type SubscriptionState =
  | 'none' // signed in, has not asked for a subscription yet
  | 'pending' // asked, waiting for a platform admin
  | 'blocked' // rejected, suspended or cancelled
  | 'active'; // trial or active: the product is usable

export interface LiveSession {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly isPlatformAdmin: boolean;
  readonly subscriptionState: SubscriptionState;
  readonly subscriptionName: string | null;
  readonly workspaces: SessionDto['workspaces'];
  readonly subscriptions: SessionDto['subscriptions'];
}

interface SessionStore {
  session: LiveSession | null;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  clear: () => void;
}

function stateOf(status: string | undefined): SubscriptionState {
  if (!status) return 'none';
  if (status === 'trial' || status === 'active') return 'active';
  if (status === 'pending_approval') return 'pending';
  return 'blocked';
}

export const useLiveSession = create<SessionStore>((set) => ({
  session: null,
  loading: false,
  error: null,

  async load(): Promise<void> {
    const tokens = readTokens();
    if (!tokens) {
      set({ session: null, loading: false });
      return;
    }
    set({ loading: true, error: null });

    const claims = claimsOf(tokens.accessToken) ?? claimsOf(tokens.idToken);
    try {
      const dto = await getSession();
      const active =
        dto.activeSubscription ??
        dto.subscriptions.find((link) => link.subscriptionId === claims?.subscriptionId);
      set({
        loading: false,
        session: {
          userId: dto.user.userId,
          email: dto.user.email,
          name: dto.user.name,
          isPlatformAdmin: dto.user.isPlatformAdmin,
          // The status in the token is what governs access, and it ages with
          // the token: a suspension takes effect on the next refresh (§8.5).
          subscriptionState: stateOf(claims?.subscriptionStatus ?? active?.status),
          subscriptionName: active?.name ?? dto.subscriptions[0]?.name ?? null,
          workspaces: dto.workspaces,
          subscriptions: dto.subscriptions,
        },
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'unknown',
        session: claims
          ? {
              userId: claims.sub,
              email: claims.email ?? '',
              name: claims.name ?? claims.email ?? '',
              isPlatformAdmin: claims.groups.includes('platform-admin'),
              subscriptionState: stateOf(claims.subscriptionStatus),
              subscriptionName: null,
              workspaces: [],
              subscriptions: [],
            }
          : null,
      });
    }
  },

  clear(): void {
    set({ session: null, error: null, loading: false });
  },
}));

export function authConfig(): AuthConfig {
  const env = import.meta.env as Record<string, string | undefined>;
  return {
    domain: (env['VITE_COGNITO_DOMAIN'] ?? '').replace(/\/$/, ''),
    clientId: env['VITE_COGNITO_CLIENT_ID'] ?? '',
    redirectUri: `${window.location.origin}/auth/callback`,
    scopes: 'openid email profile',
  };
}
