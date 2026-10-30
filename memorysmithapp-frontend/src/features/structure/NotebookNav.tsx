import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  attachmentsAddress,
  tablesAddress,
  dashboardsAddress,
  foldersAddress,
  graphAddress,
  guidanceAddress,
  modelAddress,
  notebookAddress,
  templatesAddress,
} from '../../shared/api/note-address';
import { queryKeys } from '../../shared/api/query-keys';
import { getModel } from '../../shared/api/source';
import {
  ChevronRightIcon,
  ContextIcon,
  CopyIcon,
  FolderIcon,
  GraphIcon,
  GuidanceIcon,
  PaperclipIcon,
  TableIcon,
  DashboardIcon,
  TemplateIcon,
} from '../../shared/components/icons';

/**
 * The navigation of a notebook (#228): the Notebook Context, with its three
 * parts nested under it on the guide line of the tree, the attachments (#307)
 * and the graph. What is
 * open is told by weight alone — 600 and a thicker icon among rows at 400 —
 * never by a rule and never in blue; the fill is only the cursor.
 */
export function NotebookNav({
  notebookId,
  folded = false,
}: {
  notebookId: string;
  /** The parts of the Context start closed, where height is short (#375). */
  folded?: boolean;
}) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const parts = [guidanceAddress, templatesAddress, foldersAddress].map((address) =>
    address(notebookId),
  );
  const inPart = parts.includes(pathname);
  /**
   * The chevron folds the three parts, and the group starts open. Folding it
   * never hides what is open: arriving at one of the parts opens it again,
   * the way the tree reopens the path to the open note.
   */
  const [open, setOpen] = useState(!folded);
  // What the notebook is as a model, to copy (#353), shown only where it is one (#373).
  const model = useQuery({
    queryKey: queryKeys.model(notebookId),
    queryFn: () => getModel(notebookId),
  });
  useEffect(() => {
    if (inPart) setOpen(true);
  }, [inPart]);

  return (
    <nav className="notebook-nav" aria-label={t('structure.openNavigation')}>
      {model.data ? (
        <NavItem to={modelAddress(notebookId)} icon={<CopyIcon />}>
          {t('model.title')}
        </NavItem>
      ) : null}
      <div className="nav-row-wrap">
        <NavItem to={notebookAddress(notebookId)} end icon={<ContextIcon />}>
          {t('structure.heading')}
        </NavItem>
        <button
          type="button"
          className={`nav-fold${open ? ' is-open' : ''}`}
          aria-expanded={open}
          aria-controls="notebook-nav-parts"
          aria-label={t('structure.contextParts')}
          onClick={() => setOpen((value) => !value)}
        >
          <ChevronRightIcon width={13} height={13} strokeWidth={2.2} />
        </button>
      </div>
      {open ? (
        <div className="nav-children" id="notebook-nav-parts">
          <NavItem to={guidanceAddress(notebookId)} icon={<GuidanceIcon />} child>
            {t('structure.guidance')}
          </NavItem>
          <NavItem to={templatesAddress(notebookId)} icon={<TemplateIcon />} child>
            {t('structure.templates')}
          </NavItem>
          <NavItem to={foldersAddress(notebookId)} icon={<FolderIcon />} child>
            {t('structure.folders')}
          </NavItem>
        </div>
      ) : null}
      <NavItem to={attachmentsAddress(notebookId)} icon={<PaperclipIcon />}>
        {t('attachments.navLabel')}
      </NavItem>
      {/* The tables an agent keeps in the notebook (#366). */}
      <NavItem to={tablesAddress(notebookId)} icon={<TableIcon />}>
        {t('tables.navLabel')}
      </NavItem>
      {/* What an agent built over the tables, to look at (#368). */}
      <NavItem to={dashboardsAddress(notebookId)} icon={<DashboardIcon />}>
        {t('dashboards.navLabel')}
      </NavItem>
      <NavItem to={graphAddress(notebookId)} icon={<GraphIcon />}>
        {t('graph.navLabel')}
      </NavItem>
    </nav>
  );
}

function NavItem({
  to,
  icon,
  end = false,
  child = false,
  children,
}: {
  to: string;
  icon: ReactNode;
  end?: boolean;
  child?: boolean;
  children: ReactNode;
}) {
  return (
    <NavLink to={to} end={end} className={`nav-row${child ? ' is-child' : ''}`}>
      {icon}
      <span className="nav-row-label">{children}</span>
    </NavLink>
  );
}
