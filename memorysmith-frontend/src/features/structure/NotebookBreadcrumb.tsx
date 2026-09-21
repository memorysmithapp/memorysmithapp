import { Fragment } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { FolderNode } from '../../shared/types/api';
import { folderAddress, notebookAddress } from '../../shared/api/note-address';
import type { NotebookOutletContext } from './NotebookLayout';
import { useNotebookId } from './route-ids';

export interface Crumb {
  label: string;
  to?: string;
}

interface NotebookBreadcrumbProps {
  // Trail after the notebook root; the last item is the current page.
  items: Crumb[];
  className?: string;
}

// Every page inside a notebook starts its trail at the notebook name, which
// links to the Notebook Context. The second level is a page of the notebook,
// never a folder of it: Guidance, Templates, Root or the graph. The trail of
// folders is read here, from the structure already loaded, and never from the
// address, which carries identifiers alone (RN-DSC-045).
export function NotebookBreadcrumb({ items, className = '' }: NotebookBreadcrumbProps) {
  const { t } = useTranslation();
  const notebookId = useNotebookId();
  const { structure } = useOutletContext<NotebookOutletContext>();
  const trail: Crumb[] = [
    { label: structure.notebook.name, to: notebookAddress(notebookId) },
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

export function folderCrumbs(notebookId: string, chain: FolderNode[]): Crumb[] {
  return chain.map((folder) => ({
    label: folder.name,
    to: folderAddress(notebookId, folder.id),
  }));
}
