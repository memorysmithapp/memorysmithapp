import { Fragment } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { FolderNode } from '../../shared/types/api';
import type { NotebookOutletContext } from './NotebookLayout';

export interface Crumb {
  label: string;
  to?: string;
}

interface NotebookBreadcrumbProps {
  // Trail after the notebook root; the last item is the current page.
  items: Crumb[];
  className?: string;
}

// Every page inside a notebook starts its trail at the notebook name (which links to
// the Structure page). The second level is a reserved namespace, never a notebook
// folder: Guidance, Templates or Root (plus the notebook graph), mirroring the
// URL, where all content lives under /root. The Root crumb links to the
// notebook root listing, so every level of the trail is navigable, and a folder
// named "Guidance", "Templates" or "Root" stays unambiguous. On the
// Structure page itself the trail is just the notebook name.
export function NotebookBreadcrumb({ items, className = '' }: NotebookBreadcrumbProps) {
  const { t } = useTranslation();
  const { notebookSlug = '' } = useParams();
  const { structure } = useOutletContext<NotebookOutletContext>();
  const trail: Crumb[] = [
    { label: structure.notebook.name, to: `/notebooks/${notebookSlug}` },
    ...items,
  ];
  const last = trail.length - 1;

  return (
    <nav
      className={`breadcrumb notebook-breadcrumb ${className}`.trim()}
      aria-label={t('structure.breadcrumb')}
    >
      {trail.map((crumb, index) => (
        <Fragment key={`${index}-${crumb.label}`}>
          {index > 0 && <span aria-hidden="true"> / </span>}
          {index < last && crumb.to ? (
            <Link to={crumb.to}>{crumb.label}</Link>
          ) : (
            <span aria-current={index === last ? 'page' : undefined}>{crumb.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}

export function folderCrumbs(notebookSlug: string, chain: FolderNode[]): Crumb[] {
  return chain.map((folder) => ({
    label: folder.name,
    to: `/notebooks/${notebookSlug}/root/${folder.slugPath}`,
  }));
}
