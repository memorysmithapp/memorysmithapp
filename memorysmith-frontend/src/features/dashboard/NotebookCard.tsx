import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { intlLocale } from '../../i18n/intl-locale';
import { notebookAddress } from '../../shared/api/note-address';
import type { NotebookSummary } from '../../shared/types/api';
import { CardGraphDrawing } from './card-graphs';

/** A day as the design writes it: 22/09/2026, 09/22/2026. */
function formatDay(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

/**
 * One notebook on the Home screen (#198): a strip of the brand on top, the
 * drawing, the name, the description, and a footer with how many notes it
 * holds, when it last changed, and the way in.
 *
 * The whole card opens the notebook, through the one link of its footer
 * stretched over it, so a control in a corner of the card (the `⋯` of #199)
 * is a control of its own and not a button inside a link.
 */
export function NotebookCard({
  notebook,
  strip,
  corner,
  children,
}: {
  notebook: NotebookSummary;
  /** The strip on top: the brand, or the red of a card that is asking. */
  strip: 'blue' | 'orange' | 'danger';
  /** What sits in the top-right corner: the actions of the card. */
  corner?: ReactNode;
  /** What replaces the body, when the card is asking something. */
  children?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const locale = intlLocale(i18n.language);
  const day = formatDay(notebook.updatedAt, locale);
  const notes = t('notebooks.noteCount', { count: notebook.noteCount });

  return (
    <article className="notebook-card" data-strip={strip}>
      {children ?? (
        <>
          <CardGraphDrawing notebookId={notebook.id} />
          <div className="notebook-card-text">
            <h2>{notebook.name}</h2>
            {notebook.description ? <p>{notebook.description}</p> : null}
          </div>
          <footer>
            <span className="notebook-card-meta">
              {notes}
              {' · '}
              <span className="is-long">{t('notebooks.updatedAt', { date: day })}</span>
              <span className="is-short">{day}</span>
            </span>
            <Link to={notebookAddress(notebook.id)} className="notebook-open">
              <span className="is-long">{t('notebooks.open')}</span>
              <span className="is-short">{t('notebooks.openShort')}</span> →
            </Link>
          </footer>
        </>
      )}
      {corner}
    </article>
  );
}
