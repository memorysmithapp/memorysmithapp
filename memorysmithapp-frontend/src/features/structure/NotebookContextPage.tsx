import type { ReactNode } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronRightIcon,
  CopyIcon,
  FolderIcon,
  GuidanceIcon,
  TemplateIcon,
} from '../../shared/components/icons';
import {
  foldersAddress,
  guidanceAddress,
  modelAddress,
  templatesAddress,
} from '../../shared/api/note-address';
import { useIsModel } from '../../shared/api/is-model';
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
// the Guidance, the Templates and the folders — each a page of its own (#227);
// in a notebook declared as a model, what it declares as a model is the first
// of them, as it is in the sidebar (#373, #422).
export function NotebookContextPage() {
  const { t } = useTranslation();
  const notebookId = useNotebookId();
  const { structure } = useOutletContext<NotebookOutletContext>();
  const templateCount = countTemplates(structure.folders);
  const isModel = useIsModel(notebookId);

  useDocumentTitle(structure.notebook.name);

  return (
    <>
      <NotebookBar crumbs={[{ label: t('structure.heading') }]} />
      <article className="content-pane context-page">
        <p className="page-intro">{t('structure.intro')}</p>
        <nav className="context-cards" aria-label={t('structure.heading')}>
          {isModel ? (
            <ContextCard
              to={modelAddress(notebookId)}
              icon={<CopyIcon />}
              title={t('model.title')}
              hint={t('structure.modelHint')}
            />
          ) : null}
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
