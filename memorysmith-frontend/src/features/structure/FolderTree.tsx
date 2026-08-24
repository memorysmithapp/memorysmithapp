import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { FolderNode } from '../../shared/types/api';

interface FolderTreeProps {
  vaultSlug: string;
  folders: FolderNode[];
}

function FolderItem({ vaultSlug, folder }: { vaultSlug: string; folder: FolderNode }) {
  const { '*': folderPath } = useParams();
  const [open, setOpen] = useState(false);
  const isActive = folderPath === folder.slugPath;

  return (
    <li>
      <div className={`tree-folder${isActive ? ' active' : ''}`}>
        <button
          type="button"
          className="tree-toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? '▾' : '▸'}
        </button>
        <Link to={`/vaults/${vaultSlug}/root/${folder.slugPath}`} title={folder.description}>
          {folder.name}
        </Link>
        <span className="tree-count">{folder.noteCount > 0 ? folder.noteCount : ''}</span>
      </div>
      {open && (
        <ul className="tree-children">
          {folder.children.map((child) => (
            <FolderItem key={child.id} vaultSlug={vaultSlug} folder={child} />
          ))}
          {folder.notes.map((note) => (
            <li key={note.id}>
              <Link
                className={`tree-note${folderPath === `${folder.slugPath}/${note.slug}` ? ' active' : ''}`}
                to={`/vaults/${vaultSlug}/root/${folder.slugPath}/${note.slug}`}
              >
                {note.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

// The tree opens at the vault content root, mirroring the /root namespace of
// the URL and the reserved crumb of the trail.
export function FolderTree({ vaultSlug, folders }: FolderTreeProps) {
  const { t } = useTranslation();
  const { '*': splat } = useParams();
  return (
    <ul className="tree-root">
      <li>
        <div className={`tree-folder${splat === '' ? ' active' : ''}`}>
          <Link to={`/vaults/${vaultSlug}/root`}>{t('structure.root')}</Link>
        </div>
        <ul className="tree-children">
          {folders.map((folder) => (
            <FolderItem key={folder.id} vaultSlug={vaultSlug} folder={folder} />
          ))}
        </ul>
      </li>
    </ul>
  );
}
