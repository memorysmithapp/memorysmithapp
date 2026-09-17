import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listNotebooks } from '../../shared/api/source';
import { notebookAddress } from '../../shared/api/note-address';
import { LiveDashboard } from './LiveDashboard';
import { CardCarousel } from '../../shared/components/CardCarousel';
import { NotebookCatalogueSkeleton } from '../../shared/components/skeletons';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { queryState } from '../../shared/api/query-state';

/**
 * The locale drives the format, never a literal in the code: the same instant
 * reads 3 Sep 2026 for one reader and 3 de set. de 2026 for another.
 */
function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso));
}

/**
 * The notebook catalogue, and under it what the notebooks themselves declare. There
 * used to be a second overview here, charting a fixed set of frontmatter
 * attributes that only the bundled seed guaranteed; the product never imposed
 * that convention, and the seed is gone (live-stats.ts).
 */
export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'pt_BR' ? 'pt-BR' : 'en-US';
  const query = useQuery({ queryKey: ['notebooks'], queryFn: listNotebooks });
  const notebooks = query.data;
  const state = queryState(query);

  return (
    <section className="page dashboard">
      <div className="dashboard-heading-row">
        <h2 className="dashboard-section-heading">{t('dashboard.selectNotebook')}</h2>
        {/* An import makes a NEW notebook, so it belongs where the notebooks
            are listed and not inside one of them (RN-PRT-012). It is a page of
            its own, because what it has to show — what the document carries,
            what will be created and how far it got — does not fit in a button
            (#143). */}
        <Link to="/imports/new" className="notebook-nav-link notebook-nav-action">
          {t('portability.import')}
        </Link>
      </div>
      {state === 'error' && <p className="status">{t(messageKeyOf(query.error))}</p>}
      {state === 'pending' && <NotebookCatalogueSkeleton />}
      <CardCarousel
        prevLabel={t('dashboard.prevNotebooks')}
        nextLabel={t('dashboard.nextNotebooks')}
      >
        {notebooks?.map((notebook) => (
          <Link key={notebook.id} to={notebookAddress(notebook.id)} className="notebook-card">
            <h2>{notebook.name}</h2>
            <p>{notebook.description}</p>
            <footer>
              <span>
                {t('notebooks.noteCount', { count: notebook.noteCount })}
                {' · '}
                {t('notebooks.updatedAt', { date: formatDate(notebook.updatedAt, locale) })}
              </span>
              <span className="notebook-open">{t('notebooks.open')} →</span>
            </footer>
          </Link>
        ))}
      </CardCarousel>

      <LiveDashboard />
    </section>
  );
}
