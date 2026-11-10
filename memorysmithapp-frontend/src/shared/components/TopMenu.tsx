import { Link, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { identifierOf } from '../api/note-address';
import { useIsModel } from '../api/is-model';
import { BookIcon, CopyIcon, GlobeIcon, HomeIcon, InfoIcon, TransfersIcon } from './icons';

/**
 * The menu of the product (#418): the second row of the header, only for it,
 * centred, each entry with its icon. It is on every page of the frame; on a
 * phone it is a list in the menu of the ☰ (#419).
 */
export function TopMenu({ layout = 'row' }: { layout?: 'row' | 'list' }) {
  const { t } = useTranslation();
  // A model of one's own is read at the address of its notebook, and it is
  // still a model: Models is lit on its every page — its model, its notes, its
  // folders — never Notebooks (#422).
  const { pathname } = useLocation();
  const notebookId = identifierOf(/^\/notebooks\/([^/]+)/i.exec(pathname)?.[1]) ?? '';
  const isModel = useIsModel(notebookId);
  const inModel = isOwnModelAddress(pathname) || isModel === true;
  const inModels = inModel || /^\/models(\/|$)/i.test(pathname);
  // Inside a notebook not yet known to be one or the other, neither is lit.
  const inNotebooks =
    !inModel && /^\/notebooks(\/|$)/i.test(pathname) && (notebookId === '' || isModel === false);

  return (
    <nav
      className={layout === 'list' ? 'top-menu is-list' : 'top-menu'}
      aria-label={t('nav.label')}
    >
      <NavLink to="/" end className="top-menu-item">
        <HomeIcon />
        {t('nav.home')}
      </NavLink>
      <Link
        to="/notebooks"
        className={menuItemClass(inNotebooks)}
        aria-current={inNotebooks ? 'page' : undefined}
      >
        <BookIcon />
        {t('nav.notebooks')}
      </Link>
      <Link
        to="/models"
        className={menuItemClass(inModels)}
        aria-current={inModels ? 'page' : undefined}
      >
        <CopyIcon />
        {t('nav.models')}
      </Link>
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

/** `/notebooks/{id}/model` and below it: the pages of a model of one's own. */
function isOwnModelAddress(pathname: string): boolean {
  return /^\/notebooks\/[^/]+\/model(\/|$)/i.test(pathname);
}

function menuItemClass(active: boolean): string {
  return active ? 'top-menu-item active' : 'top-menu-item';
}
