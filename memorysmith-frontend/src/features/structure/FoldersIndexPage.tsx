import { Link, useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { folderAddress } from '../../shared/api/note-address';
import { useDocumentTitle } from '../../shared/components/document-title';
import type { NotebookOutletContext } from './NotebookLayout';
import { NotebookBreadcrumb } from './NotebookBreadcrumb';
import { useNotebookId } from './route-ids';

// The root of the folders of a notebook: lists the top-level folders the same
// way a folder page lists its subfolders, so the Root crumb always has a real
// page behind it.
export function FoldersIndexPage() {
  const { t } = useTranslation();
  const notebookId = useNotebookId();
  const { structure } = useOutletContext<NotebookOutletContext>();

  useDocumentTitle(t('structure.root'), structure.notebook.name);

  return (
    <article className="content-pane">
      <NotebookBreadcrumb items={[{ label: t('structure.root') }]} />
      <h1>{t('structure.root')}</h1>
      <p className="folder-description">{t('structure.outlineHint')}</p>
      <ul className="note-list">
        {structure.folders.map((folder) => (
          <li key={folder.id}>
            <Link to={folderAddress(notebookId, folder.id)} className="note-list-folder">
              {folder.name}/
            </Link>
            <span className="note-list-desc">{folder.description}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
