import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { FolderNode } from '../../shared/types/api';
import { folderAddress, templatesAddress } from '../../shared/api/note-address';

interface StructureOutlineProps {
  notebookId: string;
  folders: FolderNode[];
}

/** The anchor of the template of a folder on the Templates page, by its identifier. */
export function templateAnchor(folder: Pick<FolderNode, 'id'>): string {
  return `template-${folder.id.toLowerCase()}`;
}

// Renders the notebook's folder tree from the structure object: each folder's
// name, description, note count and template flag. This is the same data
// get_notebook_context hands to agents; the Guidance text never repeats it.
export function StructureOutline({ notebookId, folders }: StructureOutlineProps) {
  const { t } = useTranslation();
  return (
    <ol className="outline-list">
      {folders.map((folder) => (
        <li key={folder.id} className="outline-item">
          <div className="outline-head">
            <Link to={folderAddress(notebookId, folder.id)} className="outline-name">
              {folder.name}
            </Link>
            {folder.hasTemplate && (
              <Link
                to={`${templatesAddress(notebookId)}#${templateAnchor(folder)}`}
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
            <StructureOutline notebookId={notebookId} folders={folder.children} />
          )}
        </li>
      ))}
    </ol>
  );
}
