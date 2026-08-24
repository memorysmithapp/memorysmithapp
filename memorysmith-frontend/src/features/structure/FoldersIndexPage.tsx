import { Link, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { VaultOutletContext } from './VaultLayout';
import { VaultBreadcrumb } from './VaultBreadcrumb';

// The vault root of the folders namespace: lists the top-level folders the
// same way a folder page lists its subfolders, so the Folders crumb always
// has a real page behind it.
export function FoldersIndexPage() {
  const { t } = useTranslation();
  const { vaultSlug = '' } = useParams();
  const { structure } = useOutletContext<VaultOutletContext>();

  return (
    <article className="content-pane">
      <VaultBreadcrumb items={[{ label: t('structure.folders') }]} />
      <h1>{t('structure.folders')}</h1>
      <p className="folder-description">{t('structure.outlineHint')}</p>
      <ul className="note-list">
        {structure.folders.map((folder) => (
          <li key={folder.id}>
            <Link to={`/vaults/${vaultSlug}/folders/${folder.slugPath}`} className="note-list-folder">
              {folder.name}/
            </Link>
            <span className="note-list-desc">{folder.description}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
