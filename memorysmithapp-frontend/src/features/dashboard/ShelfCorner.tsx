import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { MoreIcon } from '../../shared/components/icons';
import { Menu } from '../../shared/components/Menu';

/**
 * The corner of a card of the shelves (#199, #418): whose it is, then a `⋯`
 * with what can be done to it, the same on a notebook, a model and a community
 * model. The items are the caller's, and are handed a way to close the menu.
 */
export function ShelfCorner({
  mark,
  title,
  children,
}: {
  mark: ReactNode;
  /** The line a sheet opens on, on a phone: what the card is. */
  title: string;
  /** The items of the ⋯, handed a way to close it; none, and there is no ⋯. */
  children: ((close: () => void) => ReactNode) | null;
}) {
  const { t } = useTranslation();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  if (!children) return <div className="notebook-card-corner">{mark}</div>;

  return (
    <div className="notebook-card-corner">
      {mark}
      <button
        ref={trigger}
        type="button"
        className="icon-button is-bare notebook-card-more"
        aria-label={t('dashboard.card.more')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreIcon />
      </button>
      <Menu
        open={open}
        onClose={close}
        trigger={trigger}
        label={t('dashboard.card.more')}
        title={title}
        className="notebook-card-menu"
      >
        {children(close)}
      </Menu>
    </div>
  );
}
