import { Link, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { NotebookOutletContext } from './NotebookLayout';
import { NotebookBreadcrumb } from './NotebookBreadcrumb';

// The notebook root of the folders namespace: lists the top-level folders the
// same way a folder page lists its subfolders, so the Folders crumb always
// has a real page behind it.
export function FoldersIndexPage() {
  const { t } = useTranslation();
  const { notebookSlug = '' } = useParams();
  const { structure } = useOutletContext<NotebookOutletContext>();

  return (
    <article className="content-pane">
      <NotebookBreadcrumb items={[{ label: t('structure.root') }]} />
      <h1>{t('structure.root')}</h1>
      <p className="folder-description">{t('structure.outlineHint')}</p>
      <ul className="note-list">
        {structure.folders.map((folder) => (
          <li key={folder.id}>
            <Link
              to={`/notebooks/${notebookSlug}/root/${folder.slugPath}`}
              className="note-list-folder"
            >
              {folder.name}/
            </Link>
            <span className="note-list-desc">{folder.description}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
