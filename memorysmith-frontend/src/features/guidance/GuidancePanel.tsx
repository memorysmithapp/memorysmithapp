import { useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NoteContent } from '../../shared/components/NoteContent';
import { VaultBreadcrumb } from '../structure/VaultBreadcrumb';
import type { VaultOutletContext } from '../structure/VaultLayout';

export function GuidancePanel() {
  const { t } = useTranslation();
  const { vaultSlug = '' } = useParams();
  const { structure } = useOutletContext<VaultOutletContext>();

  return (
    <article className="content-pane">
      <VaultBreadcrumb items={[{ label: t('structure.guidance') }]} />
      <p className="content-kicker">{t('structure.guidance')}</p>
      {structure.guidance ? (
        <NoteContent body={structure.guidance} vaultSlug={vaultSlug} />
      ) : (
        <p className="status">{t('common.notFound')}</p>
      )}
    </article>
  );
}
