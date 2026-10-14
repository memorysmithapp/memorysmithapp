import { useTranslation } from 'react-i18next';
import { BookIcon, SharedByMeIcon, SharedWithMeIcon } from '../../shared/components/icons';

export type Ownership = 'own' | 'sharedByMe' | 'sharedWithMe';

/**
 * Whose a notebook is, on its card (#256): mine, mine and shared with
 * somebody, or somebody's shared with me. The icon says it at a glance, and
 * the same words go to a screen reader and to the tooltip, because a shape
 * alone is a meaning only some people get.
 */
export function OwnershipMark({ ownership, owner }: { ownership: Ownership; owner?: string }) {
  const { t } = useTranslation();
  const label =
    ownership === 'own'
      ? t('sharing.ownership.own')
      : ownership === 'sharedByMe'
        ? t('sharing.ownership.sharedByMe')
        : t('sharing.ownership.sharedWithMe', { owner: owner ?? '' });

  return (
    <span className="ownership-mark" data-ownership={ownership} title={label}>
      {ownership === 'own' ? (
        <BookIcon />
      ) : ownership === 'sharedByMe' ? (
        <SharedByMeIcon />
      ) : (
        <SharedWithMeIcon />
      )}
      <span className="visually-hidden">{label}</span>
    </span>
  );
}
