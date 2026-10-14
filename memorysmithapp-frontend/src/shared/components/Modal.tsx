import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CloseIcon } from './icons';

/**
 * A short question, asked over whatever is behind it (#169).
 *
 * Modal or nothing: `open` as an attribute renders a dialog inline, inside
 * whatever holds it, and `showModal()` puts it in the top layer, which no
 * ancestor can clip — the same reason the choice of a link is one (#144).
 *
 * It is not `TransferDialog`, and the difference is not plumbing. That one is
 * a room: three rows, one scroll, tuned to a tree of sixty-eight folders and
 * eight hundred notes. This one is a sentence and two buttons, and sizing it
 * like a room is how a one-line question ends up in the middle of 80vh of
 * empty surface.
 *
 * The modal of the Controles (#201): a title, a sentence, at most two fields,
 * and the actions at the foot on the right with the main one LAST. It closes
 * by its ×, by Esc (which the dialog element already does) and by the quiet
 * action beside the main one. On a phone it takes the whole screen.
 */
export function Modal({
  open,
  title,
  subtitle,
  children,
  actions,
  onClose,
  className = '',
}: {
  open: boolean;
  title: string;
  /** A line under the title: what the modal is about, as the name of a note. */
  subtitle?: string;
  children: ReactNode;
  /** The foot. A modal that only shows something closes by its × alone. */
  actions?: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = dialog.current;
    if (!node || !open) return;
    if (!node.open) node.showModal();
    document.body.classList.add('has-modal');
    return () => document.body.classList.remove('has-modal');
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialog}
      className={`ask-dialog ${className}`.trim()}
      aria-labelledby="ask-dialog-heading"
      onClose={onClose}
      onClick={(event) => {
        // The backdrop is the dialog element itself, outside its box.
        if (event.target === dialog.current) dialog.current?.close();
      }}
    >
      <div className="ask-dialog-box">
        <div className="ask-dialog-head">
          <div className="ask-dialog-titles">
            <h2 id="ask-dialog-heading">{title}</h2>
            {subtitle ? <p className="ask-dialog-subtitle">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="icon-button is-bare"
            aria-label={t('common.close')}
            onClick={() => dialog.current?.close()}
          >
            <CloseIcon />
          </button>
        </div>
        <div className="ask-dialog-body">{children}</div>
        {actions ? <div className="ask-dialog-foot">{actions}</div> : null}
      </div>
    </dialog>
  );
}
