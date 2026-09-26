import type { ReactNode } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronRightIcon,
  FolderIcon,
  GuidanceIcon,
  TemplateIcon,
} from '../../shared/components/icons';
import { foldersAddress, guidanceAddress, templatesAddress } from '../../shared/api/note-address';
import { useDocumentTitle } from '../../shared/components/document-title';
import type { FolderNode } from '../../shared/types/api';
import { NotebookBar } from './NotebookBreadcrumb';
import type { NotebookOutletContext } from './NotebookLayout';
import { useNotebookId } from './route-ids';

function countTemplates(folders: FolderNode[]): number {
  return folders.reduce(
    (total, folder) => total + (folder.hasTemplate ? 1 : 0) + countTemplates(folder.children),
    0,
  );
}

// The Notebook Context, in its navigable form: the same object
// get_notebook_context returns as Markdown, as three parts of the same weight —
// the Guidance, the Templates and the folders — each a page of its own (#227).
export function NotebookContextPage() {
  const { t } = useTranslation();
  const notebookId = useNotebookId();
  const { structure } = useOutletContext<NotebookOutletContext>();
  const templateCount = countTemplates(structure.folders);

  useDocumentTitle(structure.notebook.name);

  return (
    <>
      <NotebookBar crumbs={[{ label: t('structure.heading') }]} />
      <article className="content-pane context-page">
        <p className="page-intro">{t('structure.intro')}</p>
        <nav className="context-cards" aria-label={t('structure.heading')}>
          <ContextCard
            to={guidanceAddress(notebookId)}
            icon={<GuidanceIcon />}
            title={t('structure.guidance')}
            hint={t('structure.guidanceHint')}
          />
          <ContextCard
            to={templatesAddress(notebookId)}
            icon={<TemplateIcon />}
            title={t('structure.templates')}
            hint={t('structure.templatesHint', { count: templateCount })}
          />
          <ContextCard
            to={foldersAddress(notebookId)}
            icon={<FolderIcon />}
            title={t('structure.folders')}
            hint={t('structure.foldersHint')}
          />
        </nav>
      </article>
    </>
  );
}

function ContextCard({
  to,
  icon,
  title,
  hint,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <Link to={to} className="context-card">
      <span className="context-card-icon">{icon}</span>
      <span className="context-card-text">
        <span className="context-card-title">{title}</span>
        <span className="context-card-hint">{hint}</span>
      </span>
      <ChevronRightIcon className="context-card-chevron" />
    </Link>
  );
}
