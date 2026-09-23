import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The menu of the Controles (#201): opened from a `⋯` or from the avatar,
 * items of one line, the destructive one last under a divider. On a phone it
 * is a SHEET that rises from the bottom, over a dimmed page, with rows a thumb
 * can hit and a quiet button that closes it.
 *
 * It closes on Esc, on a click outside, and when an item is chosen. Arrows
 * move between the items, which is what `role="menu"` promises whoever
 * navigates it with a keyboard or hears it read out.
 */

/** The width under which a menu is a sheet: a phone, not a narrow window. */
export const SHEET_QUERY = '(max-width: 40rem)';

/** Whether this window is a phone's, followed as it changes. */
export function useSheetLayout(): boolean {
  const [sheet, setSheet] = useState(() =>
    typeof window === 'undefined' || typeof window.matchMedia !== 'function'
      ? false
      : window.matchMedia(SHEET_QUERY).matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(SHEET_QUERY);
    const follow = () => setSheet(media.matches);
    follow();
    media.addEventListener('change', follow);
    return () => media.removeEventListener('change', follow);
  }, []);
  return sheet;
}

const ITEMS = '[role="menuitem"]:not(:disabled), [role="menuitemradio"]:not(:disabled)';

/**
 * Up and down between the items, and to either end. A segmented control inside
 * a menu is a row of `menuitemradio`, so Left and Right move along the row the
 * way Up and Down move along the column.
 */
export function moveWithArrows(event: ReactKeyboardEvent<HTMLElement>) {
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>(ITEMS)];
  if (items.length === 0) return;
  const at = items.indexOf(document.activeElement as HTMLElement);
  const next = (() => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        return at < 0 ? 0 : (at + 1) % items.length;
      case 'ArrowUp':
      case 'ArrowLeft':
        return at < 0 ? items.length - 1 : (at - 1 + items.length) % items.length;
      case 'Home':
        return 0;
      case 'End':
        return items.length - 1;
      default:
        return null;
    }
  })();
  if (next === null) return;
  event.preventDefault();
  items[next]?.focus();
}

/**
 * A menu anchored to its trigger on the desktop, and a sheet on a phone. The
 * trigger is the caller's: it says whether the menu is open (`aria-expanded`)
 * and passes its ref, so a click on it is not a click outside and the focus
 * goes back to it on close.
 */
export function Menu({
  open,
  onClose,
  trigger,
  label,
  title,
  className = '',
  closeLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  trigger: RefObject<HTMLElement | null>;
  /** What the menu is, for whoever hears it read out. */
  label: string;
  /** The line a sheet opens on, in small caps: the notebook it acts on. */
  title?: string;
  className?: string;
  /** What the quiet button of the sheet says: Cancelar, or Fechar. */
  closeLabel?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const sheet = useSheetLayout();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      // Taken here, so nothing behind the menu closes on the same key.
      event.preventDefault();
      onClose();
      trigger.current?.focus();
    }
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (box.current?.contains(target) || trigger.current?.contains(target)) return;
      onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open, onClose, trigger]);

  // The keyboard lands on the first item, so the arrows have somewhere to start.
  useEffect(() => {
    if (!open) return;
    box.current?.querySelector<HTMLElement>(ITEMS)?.focus({ preventScroll: true });
  }, [open, sheet]);

  if (!open) return null;

  if (sheet) {
    return (
      <>
        <div className="sheet-scrim" onClick={onClose} aria-hidden="true" />
        <div
          ref={box}
          className={`sheet ${className}`.trim()}
          role="menu"
          aria-label={label}
          onKeyDown={moveWithArrows}
        >
          <span className="sheet-handle" aria-hidden="true" />
          {title ? <p className="sheet-title">{title}</p> : null}
          {children}
          <button type="button" className="button is-quiet is-wide sheet-close" onClick={onClose}>
            {closeLabel ?? t('common.cancel')}
          </button>
        </div>
      </>
    );
  }

  return (
    <div
      ref={box}
      className={`menu ${className}`.trim()}
      role="menu"
      aria-label={label}
      onKeyDown={moveWithArrows}
    >
      {children}
    </div>
  );
}

/** One line of a menu, and the danger it may carry. */
export function MenuItem({
  onSelect,
  danger = false,
  icon,
  trailing,
  children,
}: {
  onSelect: () => void;
  danger?: boolean;
  icon?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`menu-item${danger ? ' is-danger' : ''}`}
      onClick={onSelect}
    >
      {icon}
      <span className="menu-item-label">{children}</span>
      {trailing}
    </button>
  );
}

export function MenuDivider({ className = '' }: { className?: string }) {
  return <div className={`menu-divider ${className}`.trim()} role="separator" />;
}
