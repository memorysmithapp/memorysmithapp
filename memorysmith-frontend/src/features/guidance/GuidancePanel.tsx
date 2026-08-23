import { useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { resolveNoteUrl } from '../../shared/api/client';
import { resolveWikilinks } from '../../shared/api/markdown';
import { Markdown } from '../../shared/components/Markdown';
import { StructureOutline } from '../structure/StructureOutline';
import type { VaultOutletContext } from '../structure/VaultLayout';

export function GuidancePanel() {
  const { t } = useTranslation();
  const { vaultSlug = '' } = useParams();
  const { structure } = useOutletContext<VaultOutletContext>();

  const body = structure.guidance
    ? resolveWikilinks(structure.guidance, (slug) => resolveNoteUrl(vaultSlug, slug))
    : null;

  return (
    <article className="content-pane">
      <p className="content-kicker">{t('structure.guidance')}</p>
      {body ? <Markdown>{body}</Markdown> : <p className="status">{t('common.notFound')}</p>}
      <StructureOutline vaultSlug={vaultSlug} folders={structure.folders} />
    </article>
  );
}
