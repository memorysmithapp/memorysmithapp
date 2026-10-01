import { useMemo, useState } from 'react';
import { useLiveInterval } from '../../shared/api/live';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '../../i18n/intl-locale';
import { listNotebooks } from '../../shared/api/source';
import { CardCarousel } from '../../shared/components/CardCarousel';
import { NotebookCatalogueSkeleton } from '../../shared/components/skeletons';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { queryState } from '../../shared/api/query-state';
import { queryKeys } from '../../shared/api/query-keys';
import { useMatchMedia } from '../../shared/lib/media';
import { homeExpanded, rememberHomeExpanded } from '../../shared/store/home-layout';
import { TransferDialogs } from '../portability/StartTransfer';
import { NotebookActions } from './NotebookActions';
import { SubscriptionSpace } from './SubscriptionSpace';
import { byName } from './catalogue';
import { useIncomingShares, useOwnShares } from '../sharing/shares';
import { AcceptedShareCard, PendingShareCard } from '../sharing/SharedNotebookCards';
import type { IncomingShareDto } from '@memorysmith/contracts';
import type { NotebookSummary } from '../../shared/types/api';

/** One card of the row: a notebook of mine, or one shared with me (#256). */
type Entry =
  | { kind: 'own'; name: string; notebook: NotebookSummary }
  | { kind: 'shared'; name: string; share: IncomingShareDto };

/**
 * Home (#198): the notebooks to open, and under them the space of the
 * subscription. The four numbers about links that were here — pending links
 * and orphans across every notebook — left the door: they cost a read of
 * every notebook to draw, and they answer a question asked inside a notebook,
 * where its pending links still are.
 *
 * On the desktop the notebooks can fill the whole page instead (#257), and
 * the space steps aside while they do. A phone keeps its row: what this
 * browser remembers is ignored there, and the button is not drawn.
 */
const PHONE = '(max-width: 40rem)';

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const locale = intlLocale(i18n.language);
  const query = useQuery({
    queryKey: queryKeys.notebooks(),
    queryFn: listNotebooks,
    refetchInterval: useLiveInterval(),
  });
  const state = queryState(query);
  // The export a card started, with its notebook already chosen (#199).
  const [exporting, setExporting] = useState<string | null>(null);
  const [remembered, setRemembered] = useState(homeExpanded);
  const phone = useMatchMedia(PHONE);
  const expanded = remembered && !phone;
  function expand(next: boolean) {
    setRemembered(next);
    rememberHomeExpanded(next);
  }
  const notebooks = useMemo(
    () => (query.data ? byName(query.data, locale) : undefined),
    [query.data, locale],
  );
  /**
   * The notebooks shared with me appear here and nowhere else of the product's
   * lists — not in the space, which counts what is mine, nor among what an
   * export chooses from (RN-ACC-030) — among mine, by the same order.
   */
  const incoming = useIncomingShares();
  const isOwner = (notebooks ?? []).some((notebook) => notebook.effectiveRole === 'OWNER');
  const ownShares = useOwnShares(isOwner);
  const sharedByMe = useMemo(
    () =>
      new Set(
        (ownShares.data ?? [])
          .filter((share) => share.state === 'pending' || share.state === 'accepted')
          .map((share) => share.notebookId),
      ),
    [ownShares.data],
  );
  const entries = useMemo((): Entry[] | undefined => {
    if (!notebooks) return undefined;
    return byName<Entry>(
      [
        ...notebooks.map((notebook) => ({ kind: 'own' as const, name: notebook.name, notebook })),
        ...(incoming.data ?? []).map((share) => ({
          kind: 'shared' as const,
          name: share.name,
          share,
        })),
      ],
      locale,
    );
  }, [notebooks, incoming.data, locale]);

  return (
    <section className={expanded ? 'page home is-expanded' : 'page home'}>
      <CardCarousel
        heading={<h1 className="home-heading">{t('dashboard.selectNotebook')}</h1>}
        prevLabel={t('dashboard.prevNotebooks')}
        nextLabel={t('dashboard.nextNotebooks')}
        expanded={expanded}
        onExpandedChange={phone ? undefined : expand}
        expandLabel={t('dashboard.expandNotebooks')}
        collapseLabel={t('dashboard.collapseNotebooks')}
      >
        {entries?.map((entry, index) => {
          const strip = index % 2 === 0 ? 'blue' : 'orange';
          if (entry.kind === 'own') {
            return (
              <NotebookActions
                key={entry.notebook.id}
                notebook={entry.notebook}
                strip={strip}
                onExport={setExporting}
                sharedByMe={sharedByMe.has(entry.notebook.id)}
              />
            );
          }
          return entry.share.state === 'pending' ? (
            <PendingShareCard key={entry.share.notebookId} share={entry.share} />
          ) : (
            <AcceptedShareCard
              key={entry.share.notebookId}
              share={entry.share}
              strip={strip}
              onExport={setExporting}
            />
          );
        })}
      </CardCarousel>
      {state === 'error' && <p className="status">{t(messageKeyOf(query.error))}</p>}
      {state === 'pending' && <NotebookCatalogueSkeleton />}
      {entries?.length === 0 && <p className="hint home-empty">{t('dashboard.noNotebooks')}</p>}

      {expanded ? null : <SubscriptionSpace />}
      <TransferDialogs
        starting={exporting === null ? null : 'export'}
        notebookId={exporting ?? undefined}
        notebookName={incoming.data?.find((share) => share.notebookId === exporting)?.name}
        onClose={() => setExporting(null)}
      />
    </section>
  );
}
