import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookIcon,
  CopyIcon,
  GlobeIcon,
  HomeIcon,
  InfoIcon,
  SearchIcon,
  TransfersIcon,
} from './icons';
import { GlobalSearch } from './GlobalSearch';

/** ⌘K with a Command key, Ctrl K everywhere else. */
export const SHORTCUT = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? '')
  ? '⌘K'
  : 'Ctrl K';

/**
 * The menu of the product (#418): the second row of the header, only for it,
 * each entry with its icon. It is on every page of the frame and never folds
 * away; on a narrow window the row scrolls sideways instead. Search is its last
 * entry, and Ctrl K opens it from anywhere.
 */
export function TopMenu() {
  const { t } = useTranslation();
  const [searching, setSearching] = useState(false);
  const close = useCallback(() => setSearching(false), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      setSearching(true);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
      <nav className="top-menu" aria-label={t('nav.label')}>
        <NavLink to="/" end className="top-menu-item">
          <HomeIcon />
          {t('nav.home')}
        </NavLink>
        <NavLink to="/notebooks" className="top-menu-item">
          <BookIcon />
          {t('nav.notebooks')}
        </NavLink>
        <NavLink to="/models" className="top-menu-item">
          <CopyIcon />
          {t('nav.models')}
        </NavLink>
        <NavLink to="/community" className="top-menu-item">
          <GlobeIcon />
          {t('nav.community')}
        </NavLink>
        <NavLink to="/transfers" className="top-menu-item">
          <TransfersIcon />
          {t('nav.transfers')}
        </NavLink>
        <NavLink to="/about" className="top-menu-item">
          <InfoIcon />
          {t('nav.about')}
        </NavLink>
        <button
          type="button"
          className="top-menu-item top-menu-search"
          aria-haspopup="dialog"
          aria-expanded={searching}
          title={`${t('nav.search')} (${SHORTCUT})`}
          onClick={() => setSearching(true)}
        >
          <SearchIcon />
          {t('nav.search')}
          <kbd className="top-menu-key">{SHORTCUT}</kbd>
        </button>
      </nav>
      <GlobalSearch open={searching} onClose={close} />
    </>
  );
}
