import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePreferences, type ThemeChoice } from '../store/preferences';
import { useSession } from '../store/session';
import { Avatar } from './Avatar';
import { MonitorIcon, MoonIcon, SunIcon } from './icons';

const THEME_OPTIONS: { value: ThemeChoice; Icon: typeof SunIcon }[] = [
  { value: 'light', Icon: SunIcon },
  { value: 'dark', Icon: MoonIcon },
  { value: 'system', Icon: MonitorIcon },
];

export function UserMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useSession((s) => s.user);
  const signOut = useSession((s) => s.signOut);
  const theme = usePreferences((s) => s.theme);
  const setTheme = usePreferences((s) => s.setTheme);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  if (!user) return null;

  function handleSignOut() {
    signOut();
    void navigate('/login');
  }

  return (
    <div className="user-menu" ref={rootRef}>
      <button type="button" className="user-menu-trigger" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Avatar email={user.email} size={32} />
      </button>
      {open && (
        <div className="user-menu-panel">
          <div className="user-menu-identity">
            <Avatar email={user.email} size={48} />
            <div>
              <strong>{user.name}</strong>
              <div className="user-menu-email">{user.email}</div>
            </div>
          </div>

          <div className="user-menu-fields">
            <div className="user-menu-field">
              <span className="user-menu-field-label">{t('auth.role')}</span>
              <span className="chip">{user.role}</span>
            </div>
            <div className="user-menu-field">
              <span className="user-menu-field-label">{t('auth.subscription')}</span>
              <span className="chip">{user.subscriptionName}</span>
            </div>
          </div>

          <div className="user-menu-section">
            <p className="user-menu-caption">{t('theme.heading')}</p>
            <div className="theme-options">
              {THEME_OPTIONS.map(({ value, Icon }) => (
                <button
                  key={value}
                  type="button"
                  className={theme === value ? 'active' : ''}
                  onClick={() => setTheme(value)}
                  title={t(`theme.${value}`)}
                  aria-label={t(`theme.${value}`)}
                >
                  <Icon />
                </button>
              ))}
            </div>
          </div>

          <div className="user-menu-section">
            <button type="button" className="user-menu-signout" onClick={handleSignOut}>
              {t('auth.signOut')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
