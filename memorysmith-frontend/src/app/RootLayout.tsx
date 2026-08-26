import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { usePreferences, resolveTheme } from '../shared/store/preferences';
import { useSession } from '../shared/store/session';
import { useLiveSession } from '../shared/auth/session';
import { readTokens } from '../shared/auth/oauth';
import { isLive } from '../shared/api/source';

// Applies the effective theme (light/dark/system) to the document root and
// re-applies it when the OS preference changes while in system mode.
export function RootLayout() {
  const theme = usePreferences((s) => s.theme);
  const load = useLiveSession((state) => state.load);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(theme);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    // With the backend live the session comes from the token; the prototype
    // keeps its simulated one.
    if (isLive) void load();
  }, [load]);

  return <Outlet />;
}

/**
 * The guard. With the backend live it answers three questions in order: is
 * there a token, does it carry a subscription, and does that subscription
 * grant operational access. A subscription outside trial or active goes to the
 * onboarding screen rather than to an empty vault list, because "there is
 * nothing here" and "your access is suspended" are different things
 * (software-vision.md, section 13.2).
 */
export function RequireSession() {
  const simulated = useSession((s) => s.user);
  const live = useLiveSession((state) => state.session);
  const loading = useLiveSession((state) => state.loading);
  const location = useLocation();

  if (!isLive) {
    return simulated ? <Outlet /> : <Navigate to="/login" replace />;
  }

  if (!readTokens()) return <Navigate to="/login" replace />;
  if (loading && !live) return <div className="loading-screen" />;
  if (!live) return <Navigate to="/login" replace />;

  const needsOnboarding = live.subscriptionState !== 'active';
  const onOnboarding = location.pathname.startsWith('/onboarding');
  if (needsOnboarding && !onOnboarding) return <Navigate to="/onboarding" replace />;
  if (!needsOnboarding && onOnboarding) return <Navigate to="/" replace />;

  return <Outlet />;
}
