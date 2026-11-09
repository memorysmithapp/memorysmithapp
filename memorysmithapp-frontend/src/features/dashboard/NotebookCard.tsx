import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { intlLocale } from '../../i18n/intl-locale';
import { notebookAddress } from '../../shared/api/note-address';
import type { NotebookSummary } from '../../shared/types/api';
import { CardGraphDrawing } from './card-graphs';

/** A day as the design writes it: 22/09/2026, 09/22/2026. */
export function formatDay(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

/**
 * The card of a shelf (#418): a strip of the brand on top, the drawing, the
 * name, what it is, and a footer with what it holds and the way in. Notebooks,
 * models and community models are the same card, so the three pages read as
 * one product.
 *
 * The whole card opens what it shows, through the one link of its footer
 * stretched over it, so a control in a corner of the card (the `⋯` of #199)
 * is a control of its own and not a button inside a link.
 */
export function ShelfCard({
  seed,
  name,
  description,
  byline,
  meta,
  shortMeta,
  to,
  openLabel,
  openShort,
  strip,
  corner,
  children,
}: {
  /** What draws the decoration: the same seed, the same drawing. */
  seed: string;
  name: string;
  description?: string | null;
  /** A line under the description: whose it is. */
  byline?: string | null;
  /** The footer on a wide card, and on a narrow one. */
  meta: ReactNode;
  shortMeta?: ReactNode;
  to: string;
  openLabel: string;
  openShort: string;
  /** The strip on top: the brand, or the red of a card that is asking. */
  strip: 'blue' | 'orange' | 'danger';
  /** What sits in the top-right corner: the actions of the card. */
  corner?: ReactNode;
  /** What replaces the body, when the card is asking something. */
  children?: ReactNode;
}) {
  return (
    <article className="notebook-card" data-strip={strip}>
      {children ?? (
        <>
          <CardGraphDrawing notebookId={seed} />
          <div className="notebook-card-text">
            <h2>{name}</h2>
            {description ? <p>{description}</p> : null}
            {byline ? <p className="notebook-card-byline">{byline}</p> : null}
          </div>
          <footer>
            <span className="notebook-card-meta">
              <span className={shortMeta ? 'is-long' : undefined}>{meta}</span>
              {shortMeta ? <span className="is-short">{shortMeta}</span> : null}
            </span>
            <Link to={to} className="notebook-open">
              <span className="is-long">{openLabel}</span>
              <span className="is-short">{openShort}</span> →
            </Link>
          </footer>
        </>
      )}
      {corner}
    </article>
  );
}

/** One notebook among the notebooks (#198), on the shelf card. */
export function NotebookCard({
  notebook,
  strip,
  corner,
  children,
  byline,
  to,
}: {
  notebook: NotebookSummary;
  /** The strip on top: the brand, or the red of a card that is asking. */
  strip: 'blue' | 'orange' | 'danger';
  /** What sits in the top-right corner: the actions of the card. */
  corner?: ReactNode;
  /** What replaces the body, when the card is asking something. */
  children?: ReactNode;
  /** A line under the description: whose a notebook shared with me is (#256). */
  byline?: string;
  /** Where the card opens, when it is not the notebook: a model shared as a model reader (#355). */
  to?: string;
}) {
  const { t, i18n } = useTranslation();
  const locale = intlLocale(i18n.language);
  const day = formatDay(notebook.updatedAt, locale);
  const notes = t('notebooks.noteCount', { count: notebook.noteCount });

  return (
    <ShelfCard
      seed={notebook.id}
      name={notebook.name}
      description={notebook.description}
      byline={byline}
      meta={`${notes} · ${t('notebooks.updatedAt', { date: day })}`}
      shortMeta={`${notes} · ${day}`}
      to={to ?? notebookAddress(notebook.id)}
      openLabel={t('notebooks.open')}
      openShort={t('notebooks.openShort')}
      strip={strip}
      corner={corner}
    >
      {children}
    </ShelfCard>
  );
}
