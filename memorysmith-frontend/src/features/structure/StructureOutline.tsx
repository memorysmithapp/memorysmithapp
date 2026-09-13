import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { FolderNode } from '../../shared/types/api';

interface StructureOutlineProps {
  notebookSlug: string;
  folders: FolderNode[];
}

export function templateAnchor(folder: Pick<FolderNode, 'slugPath'>): string {
  return `template-${folder.slugPath.replace(/\//g, '--')}`;
}

// Renders the notebook's folder tree from the structure object: each folder's
// name, description, note count and template flag. This is the same data
// get_notebook_context hands to agents; the Guidance text never repeats it.
export function StructureOutline({ notebookSlug, folders }: StructureOutlineProps) {
  const { t } = useTranslation();
  return (
    <ol className="outline-list">
      {folders.map((folder) => (
        <li key={folder.id} className="outline-item">
          <div className="outline-head">
            <Link
              to={`/notebooks/${notebookSlug}/root/${folder.slugPath}`}
              className="outline-name"
            >
              {folder.name}
            </Link>
            {folder.hasTemplate && (
              <Link
                to={`/notebooks/${notebookSlug}/templates#${templateAnchor(folder)}`}
                className="outline-badge"
                title={t('structure.templateOf', { folder: folder.name })}
              >
                {t('structure.hasTemplate')}
              </Link>
            )}
            <span className="outline-count">
              {folder.noteCount > 0 ? t('notebooks.noteCount', { count: folder.noteCount }) : ''}
            </span>
          </div>
          <p className="outline-desc">{folder.description}</p>
          {folder.children.length > 0 && (
            <StructureOutline notebookSlug={notebookSlug} folders={folder.children} />
          )}
        </li>
      ))}
    </ol>
  );
}
