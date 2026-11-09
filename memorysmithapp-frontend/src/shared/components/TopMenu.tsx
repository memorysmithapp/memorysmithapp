import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookIcon, CopyIcon, GlobeIcon, HomeIcon, InfoIcon, TransfersIcon } from './icons';

/**
 * The menu of the product (#418): the second row of the header, only for it,
 * centred, each entry with its icon. It is on every page of the frame; on a
 * phone it is a list in the menu of the ☰ (#419).
 */
export function TopMenu({ layout = 'row' }: { layout?: 'row' | 'list' }) {
  const { t } = useTranslation();

  return (
    <nav
      className={layout === 'list' ? 'top-menu is-list' : 'top-menu'}
      aria-label={t('nav.label')}
    >
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
    </nav>
  );
}
