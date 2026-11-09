import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { listNotebooks } from '../api/source';
import { queryKeys } from '../api/query-keys';
import { notebookAddress } from '../api/note-address';
import { useLiveInterval } from '../api/live';
import { intlLocale } from '../../i18n/intl-locale';
import { byName } from '../../features/dashboard/catalogue';
import { NARROW_NOTEBOOK, useMatchMedia } from '../lib/media';
import { ChevronRightIcon, MenuLinesIcon } from './icons';
import { Menu, MenuDivider, MenuItem } from './Menu';

/**
 * The menu of the product, in the header beside the brand (#418): where a
 * person goes from anywhere. Outside a notebook it is the only navigation, so
 * the page keeps the whole width; inside one the notebook's sidebar sits under
 * it. On a narrow window the five entries fold into one button.
 */
export function TopMenu() {
  const { t } = useTranslation();
  const narrow = useMatchMedia(NARROW_NOTEBOOK);
  if (narrow) return <CompactMenu />;

  return (
    <nav className="top-menu" aria-label={t('nav.label')}>
      <NotebookSwitcher />
      <NavLink to="/models" className="top-menu-item">
        {t('nav.models')}
      </NavLink>
      <NavLink to="/community" className="top-menu-item">
        {t('nav.community')}
      </NavLink>
      <NavLink to="/transfers" className="top-menu-item">
        {t('nav.transfers')}
      </NavLink>
      <NavLink to="/about" className="top-menu-item">
        {t('nav.about')}
      </NavLink>
    </nav>
  );
}

/**
 * Notebooks: a list to go from one notebook to another without Home, filtered
 * by name, and Home as its last entry. It lists the notebooks of the
 * subscription: one shared with the person appears only on their Home
 * (RN-ACC-030).
 */
function NotebookSwitcher() {
  const { t, i18n } = useTranslation();
  const locale = intlLocale(i18n.language);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);
  // The same request Home makes, so the two never disagree and one answers both.
  const query = useQuery({
    queryKey: queryKeys.notebooks(),
    queryFn: listNotebooks,
    refetchInterval: useLiveInterval(),
  });
  const shown = useMemo(() => {
    const wanted = filter.trim().toLocaleLowerCase(locale);
    const all = query.data ? byName(query.data, locale) : [];
    return wanted === ''
      ? all
      : all.filter((notebook) => notebook.name.toLocaleLowerCase(locale).includes(wanted));
  }, [query.data, filter, locale]);

  // The field takes the focus once the menu has taken it for itself.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => field.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  function go(to: string) {
    setOpen(false);
    setFilter('');
    navigate(to);
  }

  const here = pathname === '/' || pathname.startsWith('/notebooks/');

  return (
    <div className="top-menu-anchor">
      <button
        ref={trigger}
        type="button"
        className={`top-menu-item${here ? ' active' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {t('nav.notebooks')}
        <ChevronRightIcon className="top-menu-caret" width={12} height={12} strokeWidth={2.4} />
      </button>
      <Menu
        open={open}
        onClose={() => setOpen(false)}
        trigger={trigger}
        label={t('nav.notebooks')}
        className="notebook-switcher"
      >
        <input
          ref={field}
          type="search"
          className="notebook-switcher-filter"
          value={filter}
          placeholder={t('nav.filter')}
          aria-label={t('nav.filter')}
          onChange={(event) => setFilter(event.target.value)}
          onKeyDown={(event) => {
            // Enter opens the one notebook the filter left.
            if (event.key === 'Enter' && shown.length === 1 && shown[0]) {
              go(notebookAddress(shown[0].id));
            }
          }}
        />
        <div className="notebook-switcher-list">
          {shown.map((notebook) => (
            <MenuItem key={notebook.id} onSelect={() => go(notebookAddress(notebook.id))}>
              {notebook.name}
            </MenuItem>
          ))}
          {query.data && shown.length === 0 ? (
            <p className="notebook-switcher-empty">{t('nav.noMatch')}</p>
          ) : null}
        </div>
        <MenuDivider />
        <MenuItem onSelect={() => go('/')}>{t('nav.allNotebooks')}</MenuItem>
      </Menu>
    </div>
  );
}

/** The five entries behind one button, where the header has no room for them. */
function CompactMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <div className="top-menu-anchor">
      <button
        ref={trigger}
        type="button"
        className="icon-button top-menu-compact"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('nav.menu')}
        onClick={() => setOpen((value) => !value)}
      >
        <MenuLinesIcon />
      </button>
      <Menu
        open={open}
        onClose={() => setOpen(false)}
        trigger={trigger}
        label={t('nav.label')}
        closeLabel={t('common.close')}
      >
        <MenuItem onSelect={() => go('/')}>{t('nav.notebooks')}</MenuItem>
        <MenuItem onSelect={() => go('/models')}>{t('nav.models')}</MenuItem>
        <MenuItem onSelect={() => go('/community')}>{t('nav.community')}</MenuItem>
        <MenuItem onSelect={() => go('/transfers')}>{t('nav.transfers')}</MenuItem>
        <MenuItem onSelect={() => go('/about')}>{t('nav.about')}</MenuItem>
      </Menu>
    </div>
  );
}
