import { Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BrandMark } from './BrandMark';
import { UserMenu } from './UserMenu';

export function AppShell() {
  const { t } = useTranslation();

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          <BrandMark />
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
