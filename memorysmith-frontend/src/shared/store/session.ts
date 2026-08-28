// Mock session for the reading prototype: no real authentication happens.
// The shape mirrors what the Cognito-backed session will carry (§8.5).

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SessionUser {
  name: string;
  email: string;
  role: 'OWNER';
  /** The same shape the live session carries, so the menu reads one thing. */
  subscriptionType: 'individual';
  subscriptionQuota: '500MB' | '1GB' | '2GB';
  subscriptionStatus: 'active';
}

interface SessionState {
  user: SessionUser | null;
  signIn: (user: SessionUser) => void;
  signOut: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      signIn: (user) => set({ user }),
      signOut: () => set({ user: null }),
    }),
    { name: 'memorysmith.session' },
  ),
);
