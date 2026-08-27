import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePreferences, type ThemeChoice } from '../store/preferences';
import { useSession } from '../store/session';
import { useLiveSession, authConfig, type LiveSession } from '../auth/session';
import { signOut as endHostedSession } from '../auth/oauth';
import { isLive } from '../api/source';
import { markSignedOut } from '../../features/auth/LoginPage';
import { Avatar } from './Avatar';
import { MonitorIcon, MoonIcon, SunIcon } from './icons';

const THEME_OPTIONS: { value: ThemeChoice; Icon: typeof SunIcon }[] = [
  { value: 'light', Icon: SunIcon },
  { value: 'dark', Icon: MoonIcon },
  { value: 'system', Icon: MonitorIcon },
];

/** What the menu shows, whichever session is answering. */
interface Identity {
  readonly name: string;
  readonly email: string;
  readonly role: string;
  readonly subscriptionName: string | null;
}

/**
 * The chip shows the role in the subscription, which the API already resolved.
 * A vault ceiling can lower it for a given vault but never raise it
 * (RN-ACC-011), so it belongs on the vault screen and not here.
 */
function identityOf(live: LiveSession): Identity {
  return {
    name: live.name,
    email: live.email,
    role: live.role,
    subscriptionName: live.subscriptionName,
  };
}

export function UserMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  /**
   * Two sessions exist on purpose: the prototype over the seed simulates one,
   * and the live product carries the real one, minted by the identity
   * provider. The menu shows whichever is answering and, more importantly,
   * signs out through the same door the session came in: clearing a simulated
   * user would leave a real token in place, and the person would still be
   * signed in after being told they were not.
   */
  const simulated = useSession((s) => s.user);
  const endSimulated = useSession((s) => s.signOut);
  const live = useLiveSession((s) => s.session);

  const user: Identity | null = isLive
    ? live
      ? identityOf(live)
      : null
    : simulated
      ? { ...simulated, subscriptionName: simulated.subscriptionName }
      : null;
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
    if (isLive) {
      /**
       * NOTHING may change React state before the redirect. Clearing the
       * session here used to schedule a re-render that ran while the browser
       * was still on its way to the provider's logout: the guard saw no token,
       * sent the router to /login, and /login handed the browser BACK to the
       * provider, replacing the pending navigation. The logout was never
       * reached and the person came back signed in.
       *
       * So the order is the whole fix: mark the intent, then leave. The tokens
       * are cleared inside the redirect, and the page is going away anyway.
       */
      markSignedOut();
      endHostedSession(authConfig());
      return;
    }
    endSimulated();
    void navigate('/login');
  }

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
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
            {user.subscriptionName ? (
              <div className="user-menu-field">
                <span className="user-menu-field-label">{t('auth.subscription')}</span>
                <span className="chip">{user.subscriptionName}</span>
              </div>
            ) : null}
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
