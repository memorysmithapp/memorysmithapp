import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '../../i18n/intl-locale';
import { listNotebooks } from '../../shared/api/source';
import { CardCarousel } from '../../shared/components/CardCarousel';
import { NotebookCatalogueSkeleton } from '../../shared/components/skeletons';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { queryState } from '../../shared/api/query-state';
import { queryKeys } from '../../shared/api/query-keys';
import { NotebookCard } from './NotebookCard';
import { SubscriptionSpace } from './SubscriptionSpace';
import { byName } from './catalogue';

/**
 * Home (#198): the notebooks to open, and under them the space of the
 * subscription. The four numbers about links that were here — pending links
 * and orphans across every notebook — left the door: they cost a read of
 * every notebook to draw, and they answer a question asked inside a notebook,
 * where its pending links still are.
 */
export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const locale = intlLocale(i18n.language);
  const query = useQuery({ queryKey: queryKeys.notebooks(), queryFn: listNotebooks });
  const state = queryState(query);
  const notebooks = useMemo(
    () => (query.data ? byName(query.data, locale) : undefined),
    [query.data, locale],
  );

  return (
    <section className="page home">
      <CardCarousel
        heading={<h1 className="home-heading">{t('dashboard.selectNotebook')}</h1>}
        prevLabel={t('dashboard.prevNotebooks')}
        nextLabel={t('dashboard.nextNotebooks')}
      >
        {notebooks?.map((notebook, index) => (
          <NotebookCard
            key={notebook.id}
            notebook={notebook}
            strip={index % 2 === 0 ? 'blue' : 'orange'}
          />
        ))}
      </CardCarousel>
      {state === 'error' && <p className="status">{t(messageKeyOf(query.error))}</p>}
      {state === 'pending' && <NotebookCatalogueSkeleton />}
      {notebooks?.length === 0 && <p className="hint home-empty">{t('dashboard.noNotebooks')}</p>}

      <SubscriptionSpace />
    </section>
  );
}
