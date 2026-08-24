import { useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NotePage } from '../note/NotePage';
import { FolderPage } from './FolderPage';
import { FoldersIndexPage } from './FoldersIndexPage';
import { folderTrail } from './trail';
import type { VaultOutletContext } from './VaultLayout';

// The folders/* namespace holds the whole vault content, so folder and note
// names can never collide with reserved pages: an empty path is the vault
// root listing, a full match on folder slugs is a folder page, and one extra
// trailing segment is a note inside the matched folder.
export function FolderRoute() {
  const { t } = useTranslation();
  const { '*': splat = '' } = useParams();
  const { structure } = useOutletContext<VaultOutletContext>();
  const path = splat.replace(/\/+$/, '');

  if (!path) return <FoldersIndexPage />;
  if (folderTrail(structure.folders, path).length) return <FolderPage />;

  const cut = path.lastIndexOf('/');
  const folderPath = cut >= 0 ? path.slice(0, cut) : '';
  const noteSlug = cut >= 0 ? path.slice(cut + 1) : path;
  const chain = folderPath ? folderTrail(structure.folders, folderPath) : [];
  const folder = chain[chain.length - 1];
  if (folder?.notes.some((note) => note.slug === noteSlug)) return <NotePage noteSlug={noteSlug} />;
  return <p className="status">{t('common.notFound')}</p>;
}
