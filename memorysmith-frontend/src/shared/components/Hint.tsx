import { useEffect, useId, useRef, useState } from 'react';
import { InfoIcon } from './icons';

/**
 * A short explanation behind an (i), a toggletip (#273). The pointer shows it
 * while it rests on the icon; a click or a tap keeps it open until Esc, a
 * click outside or the icon again, because a phone has no hover.
 *
 * The text stays in the page while it is closed, only hidden, so the control
 * it explains can name it as its `aria-describedby` and a screen reader hears
 * it without opening anything. The caller passes that identifier as `id`.
 */
export function Hint({ id, label, text }: { id?: string; label: string; text: string }) {
  const own = useId();
  const bubbleId = id ?? own;
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const open = pinned || hovered;

  useEffect(() => {
    if (!pinned) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPinned(false);
        setHovered(false);
      }
    };
    const onDown = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setPinned(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [pinned]);

  return (
    <span
      className="hint-anchor"
      ref={root}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        className="hint-trigger"
        aria-label={label}
        aria-expanded={open}
        aria-controls={bubbleId}
        onClick={() => {
          // A tap fires no hover on a phone, and a click with the pointer
          // already resting turns a shown hint into a kept one.
          setPinned((was) => !was);
          setHovered(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setPinned(false);
            setHovered(false);
          }
        }}
      >
        <InfoIcon />
      </button>
      <span id={bubbleId} className="hint-bubble" role="note" hidden={!open}>
        {text}
      </span>
    </span>
  );
}
