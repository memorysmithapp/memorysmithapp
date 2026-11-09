import { useMemo, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { listNotebooks } from '../api/source';
import { queryKeys } from '../api/query-keys';
import { notebookAddress } from '../api/note-address';
import { useLiveInterval } from '../api/live';
import { usePreferences } from '../store/preferences';
import { intlLocale } from '../../i18n/intl-locale';
import { byName } from '../../features/dashboard/catalogue';
import { BookIcon, GlobeIcon } from './icons';
import { SidebarFold } from './SidebarFold';

/**
 * The sidebar of every page outside a notebook (#414): Home, the profile,
 * the transfers, About. Inside a notebook the notebook's own sidebar takes this
 * column, so the left of the window is always a way somewhere.
 *
 * It lists the notebooks of the subscription, by name, so moving from one to
 * another no longer goes through Home. The notebooks shared with me stay on
 * Home, where accepting a share and reading a model-only share are answered.
 */
export function AppSidebar() {
  const { t, i18n } = useTranslation();
  const locale = intlLocale(i18n.language);
  const collapsed = usePreferences((s) => s.sidebarCollapsed);
  // The same request Home makes, so the two never disagree and one answers both.
  const query = useQuery({
    queryKey: queryKeys.notebooks(),
    queryFn: listNotebooks,
    refetchInterval: useLiveInterval(),
  });
  const notebooks = useMemo(
    () => (query.data ? byName(query.data, locale) : []),
    [query.data, locale],
  );

  return (
    <aside
      className={`app-sidebar${collapsed ? ' is-collapsed' : ''}`}
      id="app-sidebar"
      aria-label={t('sidebar.navigation')}
    >
      <p className="sidebar-caption">{t('sidebar.library')}</p>
      <nav className="notebook-nav" aria-label={t('sidebar.library')}>
        <Row to="/" end icon={<BookIcon />} label={t('sidebar.myNotebooks')} />
        <Row
          to="/transfers"
          icon={
            <span className="nav-glyph" aria-hidden="true">
              ⇅
            </span>
          }
          label={t('transfers.heading')}
        />
        <Row to="/community" icon={<GlobeIcon />} label={t('sidebar.community')} />
      </nav>
      {notebooks.length > 0 ? (
        <div className="sidebar-notebooks">
          <hr className="sidebar-rule" />
          <p className="sidebar-caption">{t('sidebar.notebooks')}</p>
          <nav className="notebook-nav" aria-label={t('sidebar.notebooks')}>
            {notebooks.map((notebook) => (
              <Row
                key={notebook.id}
                to={notebookAddress(notebook.id)}
                icon={<span className="nav-square" aria-hidden="true" />}
                label={notebook.name}
              />
            ))}
          </nav>
        </div>
      ) : null}
      <SidebarFold />
    </aside>
  );
}

function Row({
  to,
  icon,
  label,
  end = false,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  end?: boolean;
}) {
  return (
    <NavLink to={to} end={end} className="nav-row" title={label}>
      {icon}
      <span className="nav-row-label">{label}</span>
    </NavLink>
  );
}
