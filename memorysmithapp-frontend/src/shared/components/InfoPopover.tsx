import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/**
 * An icon that opens a few words about what it stands for (#418): the `?` of
 * a page, and the mark of whose a card is. A click opens the box under it;
 * Esc or a click elsewhere puts it away. It replaces a tooltip, which a phone
 * never shows and a mouse shows only after a wait.
 */
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
  const [open, setOpen] = useState(initiallyOpen);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  // Read when it opens, so a caller's new function does not open it again.
  const opened = useRef(onOpen);
  opened.current = onOpen;

  useEffect(() => {
    if (!open) return;
    opened.current?.();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    }
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (box.current?.contains(target) || trigger.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  return (
    <span className={`info-anchor${open ? ' is-open' : ''}`}>
      <button
        ref={trigger}
        type="button"
        className={`icon-button is-bare info-trigger ${className}`.trim()}
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
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
