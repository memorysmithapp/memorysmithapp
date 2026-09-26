import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { useTranslation } from 'react-i18next';

/** How far the handle has to travel down before letting go closes the sheet. */
const CLOSE_AFTER_PX = 80;

/**
 * The sheet of the Controles that is not a menu (#226, #229): it rises from the
 * foot of a phone over a dimmed page, opens on its handle, and closes by
 * dragging the handle down, by a tap outside, by Esc and by its quiet button
 * when it has one. What it holds is the caller's; a menu keeps `Menu`, whose
 * items move with the arrows.
 */
export function Sheet({
  open,
  onClose,
  label,
  title,
  closeLabel,
  className = '',
  returnFocus,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** What the sheet is, for whoever hears it read out. */
  label: string;
  /** The line it opens on, in small caps. */
  title?: string;
  /** The quiet button at the foot, when the sheet has one: Fechar. */
  closeLabel?: string;
  className?: string;
  /** Where the focus goes back to when it closes. */
  returnFocus?: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useSheetDrag(onClose);

  useEffect(() => {
    if (!open) return;
    const back = returnFocus?.current;
    box.current?.focus({ preventScroll: true });
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      back?.focus({ preventScroll: true });
    };
  }, [open, onClose, returnFocus]);

  if (!open) return null;

  return (
    <>
      <div className="sheet-scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={box}
        className={`sheet ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        style={drag.offset > 0 ? { transform: `translateY(${drag.offset}px)` } : undefined}
      >
        <SheetHandle drag={drag} />
        {title ? <p className="sheet-title">{title}</p> : null}
        {children}
        {closeLabel ? (
          <button type="button" className="button is-quiet is-wide sheet-close" onClick={onClose}>
            {closeLabel}
          </button>
        ) : null}
      </div>
    </>
  );
}

export interface SheetDrag {
  offset: number;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
}

/**
 * Dragging a handle: down closes past a threshold, anything shorter springs
 * back. `onUp` is told about a drag up, which is how a closed sheet is raised.
 */
export function useSheetDrag(onDown: () => void, onUp?: () => void): SheetDrag {
  const start = useRef<number | null>(null);
  const [offset, setOffset] = useState(0);
  return {
    offset,
    onPointerDown(event) {
      start.current = event.clientY;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event) {
      if (start.current === null) return;
      setOffset(Math.max(0, event.clientY - start.current));
    },
    onPointerUp(event) {
      if (start.current === null) return;
      const moved = event.clientY - start.current;
      start.current = null;
      setOffset(0);
      if (moved > CLOSE_AFTER_PX) onDown();
      else if (moved < -CLOSE_AFTER_PX / 2) onUp?.();
    },
  };
}

/** The handle of a sheet, and the area a thumb drags it by. */
export function SheetHandle({ drag }: { drag: SheetDrag }) {
  const { t } = useTranslation();
  return (
    <div
      className="sheet-grip"
      aria-hidden="true"
      title={t('common.close')}
      onPointerDown={drag.onPointerDown}
      onPointerMove={drag.onPointerMove}
      onPointerUp={drag.onPointerUp}
      onPointerCancel={drag.onPointerUp}
    >
      <span className="sheet-handle" />
    </div>
  );
}
