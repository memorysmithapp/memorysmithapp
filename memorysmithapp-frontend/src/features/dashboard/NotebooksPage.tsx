import { useMemo, useState } from 'react';
import { useLiveInterval } from '../../shared/api/live';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '../../i18n/intl-locale';
import { listModels, listNotebooks } from '../../shared/api/source';
import { ActionWord } from '../../shared/components/ActionWord';
import { useDocumentTitle } from '../../shared/components/document-title';
import { PlusIcon } from '../../shared/components/icons';
import { ShelfSkeleton } from '../../shared/components/skeletons';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { queryState } from '../../shared/api/query-state';
import { queryKeys } from '../../shared/api/query-keys';
import { TransferDialogs } from '../portability/StartTransfer';
import { NotebookActions } from './NotebookActions';
import { ShelfHeading } from './ShelfHeading';
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
 * shared with the person, as cards in a grid, by name, and a new one; a
 * notebook declared as a model is on the page of the models instead (#422). A
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
  /**
   * A notebook declared as a model is a model, and lives on the page of the
   * models only (#422, RN-PRT-060): its card there opens it. An invitation still waiting
   * for an answer stays here, where it is answered.
   */
  const models = useQuery({ queryKey: queryKeys.models(), queryFn: listModels });
  const modelIds = useMemo(
    () => new Set((models.data ?? []).map((model) => model.notebookId.toLowerCase())),
    [models.data],
  );
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
  /**
   * The grid waits for both lists and draws them at once (#420): the shared
   * ones take their place among mine by name, so arriving later they pushed
   * the cards already on the screen. A list of shares that failed does not
   * hold mine back.
   */
  const entries = useMemo((): Entry[] | undefined => {
    if (!notebooks || incoming.isPending || models.isPending) return undefined;
    return byName<Entry>(
      [
        ...notebooks
          .filter((notebook) => !modelIds.has(notebook.id.toLowerCase()))
          .map((notebook) => ({ kind: 'own' as const, name: notebook.name, notebook })),
        ...(incoming.data ?? [])
          .filter(
            (share) => share.state === 'pending' || !modelIds.has(share.notebookId.toLowerCase()),
          )
          .map((share) => ({
            kind: 'shared' as const,
            name: share.name,
            share,
          })),
      ],
      locale,
    );
  }, [notebooks, incoming.isPending, incoming.data, models.isPending, modelIds, locale]);

  return (
    <section className="page shelf-page">
      <ShelfHeading
        page="notebooks"
        title={t('nav.notebooks')}
        count={entries?.length}
        help={t('notebooks.help')}
        action={
          // A notebook, blank or from a model (#359); a new model starts on
          // the page of the models (#418).
          <button
            type="button"
            // The quiet button every page head uses, as Transfers does (#422).
            className="button is-quiet"
            onClick={() => setCreating(true)}
          >
            <ActionWord icon={<PlusIcon />} word={t('newNotebook.open')} />
          </button>
        }
      />
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
      {state === 'pending' || (state === 'ready' && (incoming.isPending || models.isPending)) ? (
        <ShelfSkeleton />
      ) : null}
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
