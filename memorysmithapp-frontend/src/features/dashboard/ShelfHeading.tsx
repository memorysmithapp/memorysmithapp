import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpIcon } from '../../shared/components/icons';
import { InfoPopover } from '../../shared/components/InfoPopover';

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
  // Read once: whether this browser showed the page before.
  const [first] = useState(() => !seen(page));

  return (
    <div className="shelf-heading">
      <h1>
        {title}
        {count !== undefined ? <span className="shelf-count"> ({count})</span> : null}
      </h1>
      {action}
      <InfoPopover
        icon={<HelpIcon />}
        label={t('shelf.help')}
        className="shelf-help"
        boxClassName="shelf-help-box"
        initiallyOpen={first}
        onOpen={() => markSeen(page)}
      >
        {help}
      </InfoPopover>
    </div>
  );
}
