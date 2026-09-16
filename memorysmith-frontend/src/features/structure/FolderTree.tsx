import { FolderCount } from './FolderCount';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { FolderNode } from '../../shared/types/api';
import {
  folderAddress,
  foldersAddress,
  identifierOf,
  noteAddress,
} from '../../shared/api/note-address';
import { folderTrailForNote, folderTrailOf } from './trail';

interface FolderTreeProps {
  notebookId: string;
  folders: FolderNode[];
}

/** What the page open right now points at, by identifier. */
interface Active {
  readonly folderId: string | null;
  readonly noteId: string | null;
  /** Every folder above what is open, which is what the tree unfolds. */
  readonly path: ReadonlySet<string>;
}

// The tree follows the route: whatever opened the current page (a link in the
// center pane, a breadcrumb, a pasted URL), every folder on the active path
// expands and the active item scrolls into view. Manual toggles still work;
// entering a folder's subtree just forces it open again. What is active is
// decided by identifier, which is the only thing the address carries.
function TreeNote({
  notebookId,
  note,
  active,
}: {
  notebookId: string;
  note: FolderNode['notes'][number];
  active: Active;
}) {
  const { t } = useTranslation();
  const isActive = active.noteId === note.id;
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (isActive) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [isActive]);

  return (
    <li>
      <Link
        ref={ref}
        className={`tree-note${isActive ? ' active' : ''}`}
        to={noteAddress(notebookId, note.id)}
      >
        {note.name ?? t('note.unnamed')}
      </Link>
    </li>
  );
}

function FolderItem({
  notebookId,
  folder,
  active,
}: {
  notebookId: string;
  folder: FolderNode;
  active: Active;
}) {
  const isActive = active.folderId === folder.id;
  const onActivePath = active.path.has(folder.id);
  const [open, setOpen] = useState(onActivePath);
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (onActivePath) setOpen(true);
  }, [onActivePath]);

  useEffect(() => {
    if (isActive) linkRef.current?.scrollIntoView({ block: 'nearest' });
  }, [isActive]);

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
        <Link ref={linkRef} to={folderAddress(notebookId, folder.id)} title={folder.description}>
          {folder.name}
        </Link>
        <FolderCount folder={folder} className="tree-count" />
      </div>
      {open && (
        <ul className="tree-children">
          {folder.children.map((child) => (
            <FolderItem key={child.id} notebookId={notebookId} folder={child} active={active} />
          ))}
          {folder.notes.map((note) => (
            <TreeNote key={note.id} notebookId={notebookId} note={note} active={active} />
          ))}
        </ul>
      )}
    </li>
  );
}

// The tree opens at the root of the folders of the notebook, the page the Root
// crumb of the trail leads to.
export function FolderTree({ notebookId, folders }: FolderTreeProps) {
  const { t } = useTranslation();
  const params = useParams();
  const { pathname } = useLocation();
  const folderId = identifierOf(params['folderId']);
  const noteId = identifierOf(params['noteId']);
  const trail = folderId
    ? folderTrailOf(folders, folderId)
    : noteId
      ? folderTrailForNote(folders, noteId)
      : [];
  const active: Active = { folderId, noteId, path: new Set(trail.map((each) => each.id)) };
  const atRoot = pathname.replace(/\/+$/, '').toLowerCase() === foldersAddress(notebookId);

  return (
    <ul className="tree-root">
      <li>
        <div className={`tree-folder${atRoot ? ' active' : ''}`}>
          <Link to={foldersAddress(notebookId)}>{t('structure.root')}</Link>
        </div>
        <ul className="tree-children">
          {folders.map((folder) => (
            <FolderItem key={folder.id} notebookId={notebookId} folder={folder} active={active} />
          ))}
        </ul>
      </li>
    </ul>
  );
}
