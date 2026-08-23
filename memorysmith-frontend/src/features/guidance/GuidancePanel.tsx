import { useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { resolveNoteUrl } from '../../shared/api/client';
import { resolveWikilinks } from '../../shared/api/markdown';
import { Markdown } from '../../shared/components/Markdown';
import type { VaultOutletContext } from '../structure/VaultLayout';

export function GuidancePanel() {
  const { t } = useTranslation();
  const { vaultSlug = '' } = useParams();
  const { structure } = useOutletContext<VaultOutletContext>();

  if (!structure.guidance) return <p className="status">{t('common.notFound')}</p>;

  const body = resolveWikilinks(structure.guidance, (slug) => resolveNoteUrl(vaultSlug, slug));

  return (
    <article className="content-pane">
      <p className="content-kicker">{t('structure.guidance')}</p>
      <Markdown>{body}</Markdown>
    </article>
  );
}
