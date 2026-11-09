import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpIcon } from '../../shared/components/icons';

const SEEN_PREFIX = 'memorysmith.shelfHelpSeen.';

function seen(page: string): boolean {
  try {
    return window.localStorage.getItem(SEEN_PREFIX + page) !== null;
  } catch {
    // A browser that refuses storage opens the help each time, which is the
    // harmless half of being wrong here.
    return false;
  }
}

function markSeen(page: string): void {
  try {
    window.localStorage.setItem(SEEN_PREFIX + page, '1');
  } catch {
    /* nothing to do: it opens once more */
  }
}

/**
 * The head of a shelf (#418): its name with how many it holds, the action
 * that adds one beside it, and a `?` that opens what the page is for. The
 * words help on a first visit and are in the way on every visit after, so
 * they wait behind the `?`, which opens by itself the first time this browser
 * shows the page.
 */
export function ShelfHeading({
  page,
  title,
  count,
  action,
  help,
}: {
  /** Which shelf, for remembering that its help was seen. */
  page: 'notebooks' | 'models' | 'community';
  title: string;
  /** How many it holds, once known. */
  count?: number;
  action?: ReactNode;
  help: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(() => !seen(page));
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    markSeen(page);
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
  }, [open, page]);

  return (
    <div className="shelf-heading">
      <h1>
        {title}
        {count !== undefined ? <span className="shelf-count"> ({count})</span> : null}
      </h1>
      {action}
      <div className="shelf-help-anchor">
        <button
          ref={trigger}
          type="button"
          className="icon-button is-bare shelf-help"
          aria-label={t('shelf.help')}
          title={t('shelf.help')}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((value) => !value)}
        >
          <HelpIcon />
        </button>
        {open ? (
          <div ref={box} id={id} className="shelf-help-box" role="note">
            <p>{help}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
