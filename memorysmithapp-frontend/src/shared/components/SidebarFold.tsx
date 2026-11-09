import { useTranslation } from 'react-i18next';
import { usePreferences } from '../store/preferences';
import { SidebarFoldIcon, SidebarOpenIcon } from './icons';

/**
 * The last row of a sidebar, the shell's or a notebook's (#414): it folds the
 * column to its icons and opens it again. Both sidebars read the same choice,
 * so leaving a notebook never changes how wide the left column is.
 */
export function SidebarFold() {
  const { t } = useTranslation();
  const collapsed = usePreferences((s) => s.sidebarCollapsed);
  const setCollapsed = usePreferences((s) => s.setSidebarCollapsed);
  const label = t(collapsed ? 'sidebar.expand' : 'sidebar.collapse');

  return (
    <button
      type="button"
      className="sidebar-fold"
      aria-pressed={collapsed}
      aria-label={label}
      title={label}
      onClick={() => setCollapsed(!collapsed)}
    >
      {collapsed ? <SidebarOpenIcon /> : <SidebarFoldIcon />}
      <span className="nav-row-label">{label}</span>
    </button>
  );
}
