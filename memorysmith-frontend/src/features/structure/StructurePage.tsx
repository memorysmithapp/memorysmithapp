import { Link, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GuidanceIcon, TemplateIcon } from '../../shared/components/icons';
import type { FolderNode } from '../../shared/types/api';
import { StructureOutline } from './StructureOutline';
import type { VaultOutletContext } from './VaultLayout';

function countTemplates(folders: FolderNode[]): number {
  return folders.reduce(
    (total, folder) => total + (folder.hasTemplate ? 1 : 0) + countTemplates(folder.children),
    0,
  );
}

// The vault's self-description as the agent receives it from get_vault_context:
// the Guidance and the Templates as entry points, and the folder tree with the
// description of every folder as the structure itself.
export function StructurePage() {
  const { t } = useTranslation();
  const { vaultSlug = '' } = useParams();
  const { structure } = useOutletContext<VaultOutletContext>();
  const templateCount = countTemplates(structure.folders);

  return (
    <article className="content-pane">
      <p className="content-kicker">{t('structure.heading')}</p>
      <h1>{structure.vault.name}</h1>
      <p className="hint">{t('structure.intro')}</p>

      <div className="structure-actions">
        <Link to={`/vaults/${vaultSlug}/guidance`} className="structure-action">
          <GuidanceIcon />
          <span>
            <strong>{t('structure.guidance')}</strong>
            <small>{t('structure.guidanceHint')}</small>
          </span>
        </Link>
        <Link to={`/vaults/${vaultSlug}/templates`} className="structure-action">
          <TemplateIcon />
          <span>
            <strong>{t('structure.templates')}</strong>
            <small>{t('structure.templatesHint', { count: templateCount })}</small>
          </span>
        </Link>
      </div>

      <h2>{t('structure.folders')}</h2>
      <p className="hint">{t('structure.outlineHint')}</p>
      <StructureOutline vaultSlug={vaultSlug} folders={structure.folders} />
    </article>
  );
}
