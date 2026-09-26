import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '../../shared/components/document-title';
import { FolderRows } from './FolderRows';
import { NotebookBar, contextCrumbs } from './NotebookBreadcrumb';
import type { NotebookOutletContext } from './NotebookLayout';
import { useNotebookId } from './route-ids';

/**
 * The folders of the notebook, each with what is kept in it (#227). It is the
 * third part of the Notebook Context, beside the Guidance and the Templates:
 * the tree an agent reads to decide where a note goes. It used to close the
 * page of the Context, which now leads here.
 */
export function FoldersPage() {
  const { t } = useTranslation();
  const notebookId = useNotebookId();
  const { structure } = useOutletContext<NotebookOutletContext>();

  useDocumentTitle(t('structure.folders'), structure.notebook.name);

  return (
    <>
      <NotebookBar crumbs={contextCrumbs(notebookId, t, t('structure.folders'))} />
      <article className="content-pane folders-page">
        <p className="page-intro">{t('structure.outlineHint')}</p>
        {structure.folders.length === 0 ? (
          <p>{t('structure.noFolders')}</p>
        ) : (
          <FolderRows notebookId={notebookId} folders={structure.folders} />
        )}
      </article>
    </>
  );
}
