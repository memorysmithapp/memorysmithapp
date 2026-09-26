import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { FolderNode } from '../../shared/types/api';
import { folderAddress } from '../../shared/api/note-address';
import { FolderCount } from './FolderCount';

/** The anchor of the template of a folder on the Templates page, by its identifier. */
export function templateAnchor(folder: Pick<FolderNode, 'id'>): string {
  return `template-${folder.id.toLowerCase()}`;
}

/**
 * Folders as rows of one card (#227): the name, the *modelo* chip when the
 * folder declares a Template, how many notes it holds and what it is for. The
 * whole row opens the folder. It is the same data `get_notebook_context` hands
 * to agents, and the Guidance never repeats it.
 *
 * `nested` draws every subfolder as a row of the same card, indented one step
 * per level — the page of the folders. Without it only the folders given are
 * drawn, which is the page of a folder listing its children (#231).
 */
export function FolderRows({
  notebookId,
  folders,
  nested = true,
}: {
  notebookId: string;
  folders: FolderNode[];
  nested?: boolean;
}) {
  const rows: { folder: FolderNode; depth: number }[] = [];
  const walk = (level: FolderNode[], depth: number) => {
    for (const folder of level) {
      rows.push({ folder, depth });
      if (nested) walk(folder.children, depth + 1);
    }
  };
  walk(folders, 0);

  return (
    <ul className="row-card">
      {rows.map(({ folder, depth }) => (
        <li key={folder.id}>
          <FolderRow notebookId={notebookId} folder={folder} depth={depth} />
        </li>
      ))}
    </ul>
  );
}

function FolderRow({
  notebookId,
  folder,
  depth,
}: {
  notebookId: string;
  folder: FolderNode;
  depth: number;
}) {
  const { t } = useTranslation();
  return (
    <Link
      to={folderAddress(notebookId, folder.id)}
      className="folder-row"
      style={depth > 0 ? ({ '--depth': depth } as CSSProperties) : undefined}
    >
      <span className="folder-row-head">
        <span className="folder-row-name">{folder.name}</span>
        {folder.hasTemplate ? (
          <span className="chip folder-row-chip">{t('structure.hasTemplate')}</span>
        ) : null}
        <FolderCount folder={folder} className="folder-row-count" label />
      </span>
      <span className="folder-row-desc">{folder.description}</span>
    </Link>
  );
}
