import {
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

/**
 * An icon that opens a few words about what it stands for (#418): the `?` of
 * a page, and the mark of whose a card is. A mouse resting on it opens the box
 * under it at once, and leaving the icon and the box puts it away (#422); a
 * click or a tap keeps it open, which is how a phone and a keyboard reach it,
 * and Esc or a click elsewhere puts it away. It replaces a tooltip, which a
 * phone never shows and a mouse shows only after a wait.
 */

/** How long the box waits for the mouse to cross from the icon into it. */
const LEAVE_MS = 150;

/** Closed; open while a mouse rests on it; or kept open by a click. */
type Shown = 'closed' | 'hover' | 'kept';
export function InfoPopover({
  icon,
  label,
  children,
  className = '',
  boxClassName = '',
  initiallyOpen = false,
  onOpen,
  data,
}: {
  icon: ReactNode;
  /** What the button is, for whoever hears it read out. */
  label: string;
  children: ReactNode;
  className?: string;
  boxClassName?: string;
  initiallyOpen?: boolean;
  onOpen?: () => void;
  /** Attributes the caller styles by, such as whose a card is. */
  data?: Record<`data-${string}`, string>;
}) {
  const [shown, setShown] = useState<Shown>(initiallyOpen ? 'kept' : 'closed');
  const open = shown !== 'closed';
  const leaving = useRef<ReturnType<typeof setTimeout> | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  // Read when it opens, so a caller's new function does not open it again.
  const opened = useRef(onOpen);
  opened.current = onOpen;

  // A box the mouse left waits no longer once the component is gone.
  useEffect(
    () => () => {
      if (leaving.current) clearTimeout(leaving.current);
    },
    [],
  );

  function stay() {
    if (leaving.current) clearTimeout(leaving.current);
    leaving.current = null;
  }
  function onEnter(event: ReactPointerEvent) {
    if (event.pointerType !== 'mouse') return;
    stay();
    setShown((value) => (value === 'closed' ? 'hover' : value));
  }
  function onLeave(event: ReactPointerEvent) {
    if (event.pointerType !== 'mouse') return;
    stay();
    leaving.current = setTimeout(
      () => setShown((value) => (value === 'hover' ? 'closed' : value)),
      LEAVE_MS,
    );
  }

  useEffect(() => {
    if (!open) return;
    opened.current?.();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setShown('closed');
      trigger.current?.focus();
    }
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (box.current?.contains(target) || trigger.current?.contains(target)) return;
      setShown('closed');
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  return (
    <span
      className={`info-anchor${open ? ' is-open' : ''}`}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
    >
      <button
        ref={trigger}
        type="button"
        className={`icon-button is-bare info-trigger ${className}`.trim()}
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        // A click keeps open what the mouse opened, and closes what it kept.
        onClick={() => setShown((value) => (value === 'kept' ? 'closed' : 'kept'))}
        {...data}
      >
        {icon}
      </button>
      {open ? (
        <span ref={box} id={id} className={`info-box ${boxClassName}`.trim()} role="note">
          {children}
        </span>
      ) : null}
    </span>
  );
}
