import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpIcon } from './icons';
import { InfoPopover } from './InfoPopover';

/**
 * The head of every page outside a notebook (#415): its name, with how many
 * it holds when it holds a list, the action that adds one beside it, a `?`
 * that opens what the page is for, and a line under it when the page has
 * something to say before its content. Inside a notebook the trail is the
 * head of every page, and no heading repeats it (#225).
 *
 * The `?` helps on a first visit and is in the way on every visit after, so
 * its words wait behind it, and it opens only when the person asks (#454):
 * it used to open by itself on the first visit of each browser (#418), which
 * came back on every device and interrupted the person entering a page. Its
 * classes keep the names of the shelves, where it was born.
 */
export function PageHeading({
  title,
  count,
  action,
  help,
  children,
}: {
  title: ReactNode;
  /** How many it holds, once known. */
  count?: number;
  action?: ReactNode;
  /** What the page is for, and the key its first opening is remembered by. */
  help?: { page: string; text: string };
  /** A line under the head. */
  children?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div className="shelf-heading">
        <h1>
          {title}
          {/* How many it holds, in a small seal beside the name (#418). */}
          {count !== undefined ? <span className="shelf-count">{count}</span> : null}
        </h1>
        {action}
        {help ? <PageHelp page={help.page}>{help.text}</PageHelp> : null}
      </div>
      {children ? <div className="page-heading-line">{children}</div> : null}
    </header>
  );
}

function PageHelp({ children }: { page: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <InfoPopover
      icon={<HelpIcon />}
      label={t('shelf.help')}
      className="shelf-help"
      boxClassName="shelf-help-box"
    >
      {children}
    </InfoPopover>
  );
}
