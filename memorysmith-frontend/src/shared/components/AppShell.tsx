import { Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserMenu } from './UserMenu';

export function AppShell() {
  const { t } = useTranslation();

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          <img src="/symbol.svg" alt="" className="brand-symbol symbol-light" />
          <img src="/symbol-dark.svg" alt="" className="brand-symbol symbol-dark" />
          <span className="brand-word">
            MemorySmith<span className="brand-suffix">.app</span>
          </span>
        </Link>
        <span className="tagline">{t('app.tagline')}</span>
        <UserMenu />
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
