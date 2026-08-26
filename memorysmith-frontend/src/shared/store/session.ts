// Mock session for the reading prototype: no real authentication happens.
// The shape mirrors what the Cognito-backed session will carry (§8.5).

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SessionUser {
  name: string;
  email: string;
  role: 'OWNER';
  subscriptionName: string;
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
