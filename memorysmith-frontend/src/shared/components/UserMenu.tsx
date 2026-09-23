import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LOCALES, setLocale, type Locale } from '../../i18n';
import { recordAccountLocale } from '../api/backend';
import { usePreferences, type ThemeChoice } from '../store/preferences';
import {
  useLiveSession,
  authConfig,
  type LiveSession,
  type StorageQuota,
  type SubscriptionStatus,
  type SubscriptionType,
} from '../auth/session';
import { signOut as endHostedSession } from '../auth/oauth';
import { loadedRuntimeConfig } from '../config/runtime-config';
import { gravatarDisplayName } from '../auth/gravatar';
import { clearHandover } from '../../features/auth/LoginPage';
import { Avatar, type AvatarSource } from './Avatar';
import { StorageBar } from './StorageBar';
import { ChevronRightIcon, MonitorIcon, MoonIcon, SignOutIcon, SunIcon } from './icons';
import { Menu, MenuDivider, MenuItem } from './Menu';
import { Segmented } from './Segmented';

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
  readonly subscriptionType: SubscriptionType | null;
  readonly subscriptionQuota: StorageQuota | null;
  readonly subscriptionQuotaBytes: number | null;
  readonly usedBytes: number | null;
  readonly subscriptionStatus: SubscriptionStatus | null;
  readonly avatar: AvatarSource;
  readonly picture: string | null;
}

/**
 * The chip shows the role in the subscription, which the API already resolved.
 * A notebook ceiling can lower it for a given notebook but never raise it
 * (RN-ACC-011), so it belongs on the notebook screen and not here.
 */
function identityOf(live: LiveSession): Identity {
  return {
    name: live.name,
    email: live.email,
    role: live.role,
    subscriptionType: live.subscriptionType,
    subscriptionQuota: live.subscriptionQuota,
    subscriptionQuotaBytes: live.subscriptionQuotaBytes,
    usedBytes: live.usedBytes,
    subscriptionStatus: live.subscriptionStatus,
    avatar: live.avatar,
    picture: live.picture,
  };
}

export function UserMenu() {
  const { t, i18n } = useTranslation();
  /** The session is the one the identity provider minted, and there is no other. */
  const live = useLiveSession((s) => s.session);

  const user: Identity | null = live ? identityOf(live) : null;
  const theme = usePreferences((s) => s.theme);
  const setTheme = usePreferences((s) => s.setTheme);
  const [open, setOpen] = useState(false);
  const [borrowedName, setBorrowedName] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  /**
   * The identity provider has no name for everyone, and when it has none the
   * API answers with the e-mail, which is why this menu used to print the same
   * line twice. Gravatar is asked ONLY in that case: a name the person gave
   * the identity provider always wins over one a third party knows about them.
   */
  const nameIsMissing = user !== null && user.name === user.email;
  useEffect(() => {
    if (!nameIsMissing || user === null) return;
    let alive = true;
    void gravatarDisplayName(user.email).then((name) => {
      if (alive) setBorrowedName(name);
    });
    return () => {
      alive = false;
    };
  }, [nameIsMissing, user?.email]);

  const shownName = user === null ? '' : nameIsMissing ? (borrowedName ?? '') : user.name;

  const close = useCallback(() => setOpen(false), []);

  if (!user) return null;

  /**
   * NOTHING may change React state before the redirect. Clearing the session
   * here used to schedule a re-render that ran while the browser was still on
   * its way to the provider's logout: the guard saw no token, sent the router
   * to /login, and /login handed the browser BACK to the provider, replacing
   * the pending navigation. The logout was never reached and the person came
   * back signed in.
   *
   * So the order is the whole fix: lower the guard, then leave. The tokens
   * are cleared inside the redirect, and the page is going away anyway.
   *
   * Lowering the handover guard is what makes signing out start a fresh
   * attempt: the sign-in screen hands the browser to the provider without
   * asking, and it may only do that on a first arrival.
   */
  function handleSignOut() {
    clearHandover();
    endHostedSession(authConfig());
  }

  function go(to: string) {
    setOpen(false);
    navigate(to);
  }

  return (
    <div className="user-menu">
      <button
        ref={trigger}
        type="button"
        className="user-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('auth.menu')}
      >
        <Avatar
          email={user.email}
          size={32}
          source={user.avatar}
          picture={user.picture}
          name={shownName || user.name}
        />
      </button>
      {/*
        A menu of the Controles, and a sheet on a phone (#201): the same content
        and the same routes as before, built only out of the common controls.
      */}
      <Menu
        open={open}
        onClose={close}
        trigger={trigger}
        label={t('auth.menu')}
        className="user-menu-panel"
        closeLabel={t('common.close')}
      >
        <div className="user-menu-top" role="none">
          <div className="user-menu-identity">
            <Avatar
              email={user.email}
              size={44}
              source={user.avatar}
              picture={user.picture}
              name={shownName || user.name}
            />
            <div className="user-menu-who">
              {/*
                One line per thing. With no name to show, the e-mail is the
                identity and stands alone, instead of being printed twice.
              */}
              {shownName ? <strong>{shownName}</strong> : null}
              <span className={shownName ? 'user-menu-email' : 'user-menu-email is-alone'}>
                {user.email}
              </span>
            </div>
          </div>

          {/*
            Every value here is a term of the domain, and none of them is shown
            as the code spells it: OWNER and individual are symbols, not words
            a person reads. They go through i18n, and the key is the symbol.

            THE SUBSCRIPTION HAS NO NAME to show (RN-SUB-020): what identifies
            it is the perpetual id, and who holds it is the person reading this
            menu. What is worth saying about it is the plan and the quota.

            They are data, so they are neutral chips, never blue. The status is
            shown only for `trial`, which is a fact worth saying; `active` adds
            nothing, and no other status reaches this menu (RN-SUB-007).
          */}
          <div className="user-menu-chips">
            <span className="chip">{t(`roles.${user.role}`)}</span>
            {user.subscriptionType ? (
              <span className="chip">{t(`dashboard.plan.${user.subscriptionType}`)}</span>
            ) : null}
            {user.subscriptionStatus === 'trial' ? (
              <span className="chip">{t('subscriptionStatus.trial')}</span>
            ) : null}
            {user.subscriptionQuota && (user.usedBytes === null || !user.subscriptionQuotaBytes) ? (
              <span className="chip">{t(`storageQuota.${user.subscriptionQuota}`)}</span>
            ) : null}
          </div>

          {/*
            The plan's ceiling alone answers a question nobody asks. What is
            worth knowing is how much of it is left, so when the API says how
            much is stored the chip becomes a bar; the plain chip above stays as
            the fallback for a session answering from the token alone.
          */}
          {user.subscriptionQuota && user.usedBytes !== null && user.subscriptionQuotaBytes ? (
            <StorageBar usedBytes={user.usedBytes} quotaBytes={user.subscriptionQuotaBytes} />
          ) : null}
        </div>

        <MenuDivider />

        {/*
          The language belongs beside the theme, because both are the same kind
          of thing: how this person wants to be shown the product. Each language
          is named in itself, so the option a person is looking for reads the
          same whichever locale is active when they open the menu. Both take
          effect at once, with nothing to save.
        */}
        <div className="user-menu-settings" role="none">
          <div className="user-menu-setting">
            <p className="user-menu-caption">{t('theme.heading')}</p>
            <Segmented
              inMenu
              label={t('theme.heading')}
              value={theme}
              onChange={setTheme}
              options={THEME_OPTIONS.map(({ value, Icon }) => ({
                value,
                label: t(`theme.${value}`),
                icon: <Icon width={14} height={14} />,
              }))}
            />
          </div>
          <div className="user-menu-setting">
            <p className="user-menu-caption">{t('language.heading')}</p>
            <Segmented
              inMenu
              label={t('language.heading')}
              value={
                (SUPPORTED_LOCALES as readonly string[]).includes(i18n.language)
                  ? (i18n.language as Locale)
                  : 'en_US'
              }
              onChange={(locale: Locale) => {
                setLocale(locale);
                // Recorded on the account too, because every message the product
                // sends this person is written in it (RN-ACC-018). The screen has
                // already changed language, so a failure here changes nothing on it.
                void recordAccountLocale(locale).catch(() => undefined);
              }}
              // The language of the product first, then the other one.
              options={[...SUPPORTED_LOCALES].reverse().map((locale: Locale) => ({
                value: locale,
                label: t(`language.${locale}`),
              }))}
            />
          </div>
        </div>

        <MenuDivider />

        {/*
          The profile holds where the welcome surface lives after it has opened
          once (#167), which is the only place that says where the connector of
          this environment answers.
        */}
        <div className="user-menu-items" role="none">
          <MenuItem
            onSelect={() => go('/profile')}
            trailing={<ChevronRightIcon width={12} height={12} />}
          >
            {t('profile.menu')}
          </MenuItem>
          <MenuItem
            onSelect={() => go('/profile/password')}
            trailing={<ChevronRightIcon width={12} height={12} />}
          >
            {t('password.menu')}
          </MenuItem>
          {/* Where the connector of this environment is published, which is
              what an agent is pointed at: an item like the others, and not a
              footnote beside the version (#210). */}
          <MenuItem
            onSelect={() => go('/about')}
            trailing={<ChevronRightIcon width={12} height={12} />}
          >
            {t('about.menu')}
          </MenuItem>
          <MenuDivider />
          <MenuItem onSelect={handleSignOut} icon={<SignOutIcon width={14} height={14} />}>
            {t('auth.signOut')}
          </MenuItem>
        </div>

        <MenuDivider className="user-menu-foot-divider" />

        {/*
          The version, at the foot of the menu and in the quietest type on it.
          It is the first thing anyone is asked for when something looks wrong,
          and the last thing anyone needs while reading a notebook, so it is
          present and never in the way.
        */}
        <div className="user-menu-foot" role="none">
          <p className="user-menu-version">
            {t('app.version', { version: loadedRuntimeConfig()?.version ?? '' })}
          </p>
        </div>
      </Menu>
    </div>
  );
}
