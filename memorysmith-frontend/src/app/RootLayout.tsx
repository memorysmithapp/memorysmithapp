import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { usePreferences, resolveTheme } from '../shared/store/preferences';
import { useSession } from '../shared/store/session';

// Applies the effective theme (light/dark/system) to the document root and
// re-applies it when the OS preference changes while in system mode.
export function RootLayout() {
  const theme = usePreferences((s) => s.theme);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(theme);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  return <Outlet />;
}

export function RequireSession() {
  const user = useSession((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
