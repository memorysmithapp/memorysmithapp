import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { FolderNode } from '../../shared/types/api';

interface FolderTreeProps {
  vaultSlug: string;
  folders: FolderNode[];
}

function FolderItem({ vaultSlug, folder }: { vaultSlug: string; folder: FolderNode }) {
  const { noteSlug, '*': folderPath } = useParams();
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
        <Link to={`/vaults/${vaultSlug}/folders/${folder.slugPath}`} title={folder.description}>
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
                className={`tree-note${noteSlug === note.slug ? ' active' : ''}`}
                to={`/vaults/${vaultSlug}/notes/${note.slug}`}
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

export function FolderTree({ vaultSlug, folders }: FolderTreeProps) {
  return (
    <ul className="tree-root">
      {folders.map((folder) => (
        <FolderItem key={folder.id} vaultSlug={vaultSlug} folder={folder} />
      ))}
    </ul>
  );
}
