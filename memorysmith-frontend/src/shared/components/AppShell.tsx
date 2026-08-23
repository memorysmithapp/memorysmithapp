import { Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LOCALES, setLocale, type Locale } from '../../i18n';
import { UserMenu } from './UserMenu';

export function AppShell() {
  const { t, i18n } = useTranslation();

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
        <nav className="locale-switch" aria-label="Locale">
          {SUPPORTED_LOCALES.map((locale: Locale) => (
            <button
              key={locale}
              type="button"
              className={i18n.language === locale ? 'active' : ''}
              onClick={() => setLocale(locale)}
            >
              {locale === 'pt_BR' ? 'PT' : 'EN'}
            </button>
          ))}
        </nav>
        <UserMenu />
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
