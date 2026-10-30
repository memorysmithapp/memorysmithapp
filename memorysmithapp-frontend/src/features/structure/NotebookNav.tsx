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
/**
 * The pages of a notebook beyond its Context, in one list, so the sidebar and
 * the sheet of a phone can never disagree on what a notebook has (#375).
 */
export function useNotebookPages(notebookId: string): Array<{
  key: 'model' | 'attachments' | 'tables' | 'dashboards' | 'graph';
  to: string;
  label: string;
  icon: ReactNode;
}> {
  const { t } = useTranslation();
  // What the notebook is as a model, to copy (#353), shown only where it is one (#373).
  const model = useQuery({
    queryKey: queryKeys.model(notebookId),
    queryFn: () => getModel(notebookId),
  });
  return [
    ...(model.data
      ? [
          {
            key: 'model' as const,
            to: modelAddress(notebookId),
            label: t('model.title'),
            icon: <CopyIcon />,
          },
        ]
      : []),
    {
      key: 'attachments' as const,
      to: attachmentsAddress(notebookId),
      label: t('attachments.navLabel'),
      icon: <PaperclipIcon />,
    },
    // The tables an agent keeps in the notebook (#366).
    {
      key: 'tables' as const,
      to: tablesAddress(notebookId),
      label: t('tables.navLabel'),
      icon: <TableIcon />,
    },
    // What an agent built over the tables, to look at (#368).
    {
      key: 'dashboards' as const,
      to: dashboardsAddress(notebookId),
      label: t('dashboards.navLabel'),
      icon: <DashboardIcon />,
    },
    {
      key: 'graph' as const,
      to: graphAddress(notebookId),
      label: t('graph.navLabel'),
      icon: <GraphIcon />,
    },
  ];
}

export function NotebookNav({ notebookId }: { notebookId: string }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const parts = [guidanceAddress, templatesAddress, foldersAddress].map((address) =>
    address(notebookId),
  );
  const inPart = parts.includes(pathname) || pathname.startsWith(modelAddress(notebookId));
  /**
   * The chevron folds the parts, and the group starts open. Folding it
   * never hides what is open: arriving at one of the parts opens it again,
   * the way the tree reopens the path to the open note.
   */
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (inPart) setOpen(true);
  }, [inPart]);
  const pages = useNotebookPages(notebookId);
  const model = pages.find((page) => page.key === 'model');

  return (
    <nav className="notebook-nav" aria-label={t('structure.openNavigation')}>
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
          {/* A notebook that is a model is one more part of its Context (#373). */}
          {model ? (
            <NavItem to={model.to} icon={model.icon} child>
              {model.label}
            </NavItem>
          ) : null}
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
      {pages
        .filter((page) => page.key !== 'model')
        .map((page) => (
          <NavItem key={page.key} to={page.to} icon={page.icon}>
            {page.label}
          </NavItem>
        ))}
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
