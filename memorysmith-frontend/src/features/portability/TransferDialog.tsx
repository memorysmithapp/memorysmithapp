import { useEffect, useRef, type ReactNode } from 'react';

/**
 * The one shape a transfer is asked for (#160).
 *
 * Exporting opened a modal and importing was a page, so the same job — decide
 * what travels, then watch it travel — was asked for in two shapes, and
 * starting an export from the panel left a panel open behind a modal holding a
 * chooser with a scroll of its own. Three surfaces and three scrolls for one
 * decision.
 *
 * There is one surface now, and it is a dialog for both: **the decision is a
 * dialog, and following it is the Transfers page**. What it needed to become is
 * large — a tree of sixty-eight folders and eight hundred notes was being read
 * through a window a hundred and eighty pixels tall.
 *
 * One scroll, in the body. The head says what is being decided and the foot
 * carries the actions, and neither of them moves while the body scrolls.
 */
export function TransferDialog({
  open,
  title,
  children,
  actions,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  /** The foot of the dialog: what commits, and what leaves. */
  actions: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  /**
   * Modal or nothing: `open` as an attribute renders it inline, inside
   * whatever holds it, and `showModal()` puts it in the top layer, which no
   * ancestor can clip — the same reason the choice of a link is one (#144).
   */
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
      className="transfer-dialog"
      aria-labelledby="transfer-dialog-heading"
      onClose={onClose}
      onClick={(event) => {
        // The backdrop is the dialog element itself, outside its box.
        if (event.target === dialog.current) dialog.current?.close();
      }}
    >
      <div className="transfer-dialog-box">
        <header className="transfer-dialog-head">
          <h2 id="transfer-dialog-heading">{title}</h2>
        </header>
        <div className="transfer-dialog-body">{children}</div>
        <footer className="transfer-dialog-foot">{actions}</footer>
      </div>
    </dialog>
  );
}
