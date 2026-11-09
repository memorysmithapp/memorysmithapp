import { useTranslation } from 'react-i18next';
import {
  BookIcon,
  GlobeIcon,
  SharedByMeIcon,
  SharedWithMeIcon,
} from '../../shared/components/icons';

export type Ownership = 'own' | 'sharedByMe' | 'sharedWithMe' | 'community';

/**
 * Whose a notebook is, on its card (#256): mine, mine and shared with
 * somebody, or somebody's shared with me; and whose a model is, on the cards
 * of the models and of the community, where it may be somebody's published
 * (#418). The icon says it at a glance, and the same words go to a screen
 * reader and to the tooltip, because a shape alone is a meaning only some
 * people get.
 */
export function OwnershipMark({
  ownership,
  owner,
  label: said,
}: {
  ownership: Ownership;
  owner?: string;
  /** What the mark says, where the card is not a notebook: a model, a community model (#418). */
  label?: string;
}) {
  const { t } = useTranslation();
  const label =
    said ??
    (ownership === 'own'
      ? t('sharing.ownership.own')
      : ownership === 'sharedByMe'
        ? t('sharing.ownership.sharedByMe')
        : ownership === 'community'
          ? t('sharing.ownership.community', { owner: owner ?? '' })
          : t('sharing.ownership.sharedWithMe', { owner: owner ?? '' }));

  return (
    <span className="ownership-mark" data-ownership={ownership} title={label}>
      {ownership === 'own' ? (
        <BookIcon />
      ) : ownership === 'sharedByMe' ? (
        <SharedByMeIcon />
      ) : ownership === 'community' ? (
        <GlobeIcon />
      ) : (
        <SharedWithMeIcon />
      )}
      <span className="visually-hidden">{label}</span>
    </span>
  );
}
