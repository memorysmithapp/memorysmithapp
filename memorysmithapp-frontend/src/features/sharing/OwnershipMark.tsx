import { useTranslation } from 'react-i18next';
import {
  BookIcon,
  GlobeIcon,
  SharedByMeIcon,
  SharedWithMeIcon,
} from '../../shared/components/icons';
import { InfoPopover } from '../../shared/components/InfoPopover';

export type Ownership = 'own' | 'sharedByMe' | 'sharedWithMe' | 'community';

/** What the card shows: a notebook, a model, or a model of the community (#418). */
export type Owned = 'notebook' | 'model' | 'community';

/**
 * Whose a card is (#256, #418): mine, mine and shared with somebody,
 * somebody's shared with me, or somebody's published in the community. The
 * icon says it at a glance, and a click on it opens the words of what that
 * means for this card, as the `?` of a page does: a tooltip is never seen on
 * a phone, and a shape alone is a meaning only some people get.
 */
export function OwnershipMark({
  ownership,
  owner,
  kind = 'notebook',
}: {
  ownership: Ownership;
  owner?: string;
  kind?: Owned;
}) {
  const { t } = useTranslation();
  const values = { owner: owner ?? '' };

  return (
    <InfoPopover
      icon={
        ownership === 'own' ? (
          <BookIcon />
        ) : ownership === 'sharedByMe' ? (
          <SharedByMeIcon />
        ) : ownership === 'community' ? (
          <GlobeIcon />
        ) : (
          <SharedWithMeIcon />
        )
      }
      label={t(`ownership.${kind}.${ownership}.label`, values)}
      className="ownership-mark"
      boxClassName="ownership-box"
      data={{ 'data-ownership': ownership }}
    >
      {t(`ownership.${kind}.${ownership}.explain`, values)}
    </InfoPopover>
  );
}
