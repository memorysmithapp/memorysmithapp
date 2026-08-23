import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { FolderNode } from '../../shared/types/api';

interface StructureOutlineProps {
  vaultSlug: string;
  folders: FolderNode[];
}

// Renders the vault's folder tree from the structure object: each folder's
// name, description, note count and template flag. This is the same data
// get_vault_context hands to agents; the Guidance text never repeats it.
function OutlineList({ vaultSlug, folders }: StructureOutlineProps) {
  const { t } = useTranslation();
  return (
    <ol className="outline-list">
      {folders.map((folder) => (
        <li key={folder.id} className="outline-item">
          <div className="outline-head">
            <Link to={`/vaults/${vaultSlug}/folders/${folder.slugPath}`} className="outline-name">
              {folder.name}
            </Link>
            {folder.hasTemplate && <span className="outline-badge">{t('structure.hasTemplate')}</span>}
            <span className="outline-count">
              {folder.noteCount > 0 ? t('vaults.noteCount', { count: folder.noteCount }) : ''}
            </span>
          </div>
          <p className="outline-desc">{folder.description}</p>
          {folder.children.length > 0 && <OutlineList vaultSlug={vaultSlug} folders={folder.children} />}
        </li>
      ))}
    </ol>
  );
}

export function StructureOutline({ vaultSlug, folders }: StructureOutlineProps) {
  const { t } = useTranslation();
  return (
    <section className="structure-outline">
      <h2>{t('structure.folders')}</h2>
      <p className="hint">{t('structure.outlineHint')}</p>
      <OutlineList vaultSlug={vaultSlug} folders={folders} />
    </section>
  );
}
