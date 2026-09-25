import { Fragment, type ReactNode, type Ref } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { FolderNode } from '../../shared/types/api';
import { folderAddress, notebookAddress } from '../../shared/api/note-address';
import type { NotebookOutletContext } from './NotebookLayout';
import { useNotebookId } from './route-ids';

export interface Crumb {
  label: string;
  /** Where the crumb leads. A crumb without one is the page that is open. */
  to?: string;
}

interface NotebookBreadcrumbProps {
  // Trail after the notebook root.
  items: Crumb[];
}

// Every page inside a notebook starts its trail at the notebook name, which
// links to the Notebook Context. The trail ends at the page that is open and no
// heading repeats it (#225); the note is the exception, whose trail stops at
// the folder that holds it, because its name is the title of the page. The
// trail of folders is read here, from the structure already loaded, and never
// from the address, which carries identifiers alone (RN-DSC-045).
export function NotebookBreadcrumb({ items }: NotebookBreadcrumbProps) {
  const { t } = useTranslation();
  const notebookId = useNotebookId();
  const { structure } = useOutletContext<NotebookOutletContext>();
  const trail: Crumb[] = [
    { label: structure.notebook.name, to: notebookAddress(notebookId) },
    ...items,
  ];
  const last = trail.length - 1;

  return (
    <nav className="notebook-breadcrumb" aria-label={t('structure.breadcrumb')}>
      {trail.map((crumb, index) => {
        // Only the notebook gives up width, and it says so with an ellipsis:
        // the crumbs after it are what places the page.
        const className = `crumb${index === 0 ? ' is-notebook' : ''}${index === last ? ' is-last' : ''}`;
        return (
          <Fragment key={`${index}-${crumb.label}`}>
            {index > 0 && (
              <span className="crumb-separator" aria-hidden="true">
                /
              </span>
            )}
            {crumb.to ? (
              <Link to={crumb.to} className={className} title={crumb.label}>
                {crumb.label}
              </Link>
            ) : (
              <span className={className} aria-current="page">
                {crumb.label}
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

export function folderCrumbs(notebookId: string, chain: FolderNode[]): Crumb[] {
  return chain.map((folder) => ({
    label: folder.name,
    to: folderAddress(notebookId, folder.id),
  }));
}

/**
 * The Guidance, the Templates and the page of the folders are parts of the
 * Context, and their trail says so: *Caderno / Contexto do caderno / Orientação*.
 */
export function contextCrumbs(notebookId: string, t: TFunction, page: string): Crumb[] {
  return [{ label: t('structure.heading'), to: notebookAddress(notebookId) }, { label: page }];
}

/**
 * The bar every screen of a notebook opens with (#225): fixed above the
 * content, the trail on the left, and on the right the actions of the page,
 * which only the note has. It is rendered by each page, before its article and
 * never inside it: `.content-pane` restyles every heading under it, and the
 * state the actions act on (editing, copied) belongs to the page.
 */
export function NotebookBar({ crumbs, children }: { crumbs: Crumb[]; children?: ReactNode }) {
  return (
    <div className="notebook-bar">
      <NotebookBreadcrumb items={crumbs} />
      {children ? <div className="notebook-bar-actions">{children}</div> : null}
    </div>
  );
}

/**
 * A button of the bar: its icon and its label on a computer, the icon alone on
 * a phone — where the label stays as the accessible name, hidden by CSS and
 * never removed.
 */
export function BarButton({
  icon,
  label,
  title,
  onClick,
  ref,
}: {
  icon: ReactNode;
  label: string;
  title?: string;
  onClick: () => void;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button ref={ref} type="button" className="bar-button" onClick={onClick} title={title ?? label}>
      {icon}
      <span className="bar-button-label">{label}</span>
    </button>
  );
}
