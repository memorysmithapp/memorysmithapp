import { useMemo, useState } from 'react';
import { useLiveInterval } from '../../shared/api/live';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '../../i18n/intl-locale';
import { listNotebooks } from '../../shared/api/source';
import { ActionWord } from '../../shared/components/ActionWord';
import { useDocumentTitle } from '../../shared/components/document-title';
import { PlusIcon } from '../../shared/components/icons';
import { NotebookCatalogueSkeleton } from '../../shared/components/skeletons';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { queryState } from '../../shared/api/query-state';
import { queryKeys } from '../../shared/api/query-keys';
import { TransferDialogs } from '../portability/StartTransfer';
import { NotebookActions } from './NotebookActions';
import { NewNotebookDialog } from '../models/NewNotebookDialog';
import { byName } from './catalogue';
import { useIncomingShares, useOwnShares } from '../sharing/shares';
import { AcceptedShareCard, PendingShareCard } from '../sharing/SharedNotebookCards';
import type { IncomingShareDto } from '@memorysmithapp/contracts';
import type { NotebookSummary } from '../../shared/types/api';

/** One card of the row: a notebook of mine, or one shared with me (#256). */
type Entry =
  | { kind: 'own'; name: string; notebook: NotebookSummary }
  | { kind: 'shared'; name: string; share: IncomingShareDto };

/**
 * The notebooks (#418): every notebook of the subscription and every one
 * shared with the person, as cards in a grid, by name, and a new one. A
 * notebook shared with a person appears here and nowhere else of the product's
 * lists (RN-ACC-043). The space of the subscription is Home's.
 */
export function NotebooksPage() {
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
  const [creating, setCreating] = useState(false);
  useDocumentTitle(t('nav.notebooks'));
  const notebooks = useMemo(
    () => (query.data ? byName(query.data, locale) : undefined),
    [query.data, locale],
  );
  /**
   * The notebooks shared with me appear here and nowhere else of the product's
   * lists — not in the space, which counts what is mine, nor among what an
   * export chooses from (RN-ACC-043) — among mine, by the same order.
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
    <section className="page shelf-page">
      <div className="shelf-heading">
        <h1>{t('nav.notebooks')}</h1>
        {/* A notebook, blank or from a model (#359); a new model starts on
            the page of the models (#418). */}
        <button type="button" className="button is-primary" onClick={() => setCreating(true)}>
          <ActionWord icon={<PlusIcon />} word={t('newNotebook.open')} />
        </button>
      </div>
      <div className="shelf-grid">
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
      </div>
      {state === 'error' && <p className="status">{t(messageKeyOf(query.error))}</p>}
      {state === 'pending' && <NotebookCatalogueSkeleton />}
      {entries?.length === 0 && <p className="hint home-empty">{t('dashboard.noNotebooks')}</p>}

      <NewNotebookDialog open={creating} onClose={() => setCreating(false)} />
      <TransferDialogs
        starting={exporting === null ? null : 'export'}
        notebookId={exporting ?? undefined}
        notebookName={incoming.data?.find((share) => share.notebookId === exporting)?.name}
        onClose={() => setExporting(null)}
      />
    </section>
  );
}
