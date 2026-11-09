import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookIcon, CopyIcon, GlobeIcon, HomeIcon, InfoIcon, TransfersIcon } from './icons';

/**
 * The menu of the product (#418): the second row of the header, only for it,
 * centred, each entry with its icon. It is on every page of the frame and
 * never folds away; on a narrow window the row scrolls sideways instead.
 */
export function TopMenu() {
  const { t } = useTranslation();

  return (
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
    </nav>
  );
}
