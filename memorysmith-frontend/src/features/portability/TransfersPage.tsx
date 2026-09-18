import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TransferDto } from '@memorysmith/contracts';
import { deleteTransfer, listNotebooks } from '../../shared/api/source';
import { useDocumentTitle } from '../../shared/components/document-title';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { queryState } from '../../shared/api/query-state';
import { progressOf, saveArchive, useRefreshTransfers, useTransfers } from './transfers';
import { StartTransfer } from './StartTransfer';

type Filter = 'all' | 'export' | 'import';

/** A size a person reads, in the units a person uses. */
function sizeOf(bytes: number, locale: string): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: unit === 0 ? 0 : 1 }).format(value)} ${units[unit]}`;
}

/**
 * Transfers: every export and every import of whoever is signed in
 * (RN-PRT-019, RN-PRT-020).
 *
 * An export used to be a link of fifteen minutes that nothing listed, and the
 * bucket threw the file away the next day — so a backup was something nobody
 * could come back to. It is kept here until the person deletes it, it counts
 * towards the storage of the subscription (RN-SUB-021), and it survives the
 * deletion of its notebook, which is the one way back from a deletion by
 * mistake (RN-PRT-012).
 */
export function TransfersPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'pt_BR' ? 'pt-BR' : 'en-US';
  const [filter, setFilter] = useState<Filter>('all');
  const [deleting, setDeleting] = useState<string | null>(null);
  const transfers = useTransfers();
  const refresh = useRefreshTransfers();
  // What still exists, so a row can say that the notebook of an export is gone.
  const notebooks = useQuery({ queryKey: ['notebooks'], queryFn: listNotebooks });

  useDocumentTitle(t('transfers.heading'));

  const state = queryState(transfers);
  const rows = (transfers.data?.transfers ?? []).filter(
    (transfer) => filter === 'all' || transfer.kind === filter,
  );
  const alive = new Set((notebooks.data ?? []).map((notebook) => notebook.id));

  async function remove(transfer: TransferDto): Promise<void> {
    await deleteTransfer(transfer.transferId);
    setDeleting(null);
    refresh();
  }

  return (
    <section className="page transfers-page">
      <div className="transfers-page-heading">
        <h1>{t('transfers.heading')}</h1>
        <span className="transfers-kept">
          {t('transfers.keptBytes', {
            size: sizeOf(transfers.data?.keptBytes ?? 0, locale),
          })}
        </span>
      </div>

      <StartTransfer />

      <div className="transfers-filters" role="group" aria-label={t('transfers.filter')}>
        {(['all', 'export', 'import'] as const).map((each) => (
          <button
            key={each}
            type="button"
            className={filter === each ? 'chip is-selected' : 'chip'}
            aria-pressed={filter === each}
            onClick={() => setFilter(each)}
          >
            {t(`transfers.filters.${each}`)}
          </button>
        ))}
      </div>

      {state === 'error' && <p className="status">{t(messageKeyOf(transfers.error))}</p>}
      {state === 'pending' && <p className="status">{t('common.loading')}</p>}
      {state === 'ready' && rows.length === 0 && <p className="status">{t('transfers.empty')}</p>}

      <ul className="transfers-rows">
        {rows.map((transfer) => {
          const progress = progressOf(transfer);
          return (
            <li key={transfer.transferId} className="transfers-row">
              <div className="transfers-row-main">
                <span className="transfers-row-name">{transfer.notebookName}</span>
                <span className="transfers-row-when">
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  }).format(new Date(transfer.requestedAt))}
                </span>
                <span className="transfers-row-state">
                  {transfer.status === 'running'
                    ? t(`transfers.running.${transfer.kind}`, {
                        done: transfer.done,
                        total: transfer.total,
                      })
                    : transfer.status === 'ready'
                      ? sizeOf(transfer.bytes, locale)
                      : t(`transfers.ended.${transfer.status}`)}
                </span>
                {progress !== null && (
                  <progress className="transfers-row-bar" value={progress} max={1} />
                )}
              </div>

              {transfer.kind === 'export' &&
                transfer.notebookId !== null &&
                !alive.has(transfer.notebookId) && (
                  <p className="transfers-row-note">{t('transfers.notebookGone')}</p>
                )}

              {transfer.status === 'ready' && transfer.kind === 'export' && (
                <div className="transfers-row-actions">
                  <button
                    type="button"
                    className="chip"
                    onClick={() => void saveArchive(transfer.transferId)}
                  >
                    {t('transfers.download')}
                  </button>
                  {deleting === transfer.transferId ? (
                    <>
                      {/* It asks on the page, saying what goes and what does
                          not: the notebook, if it still exists, is untouched. */}
                      <span className="transfers-row-confirm">{t('transfers.deleteWarning')}</span>
                      <button
                        type="button"
                        className="chip is-danger"
                        onClick={() => void remove(transfer)}
                      >
                        {t('transfers.deleteForGood')}
                      </button>
                      <button type="button" className="chip" onClick={() => setDeleting(null)}>
                        {t('common.cancel')}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="chip"
                      onClick={() => setDeleting(transfer.transferId)}
                    >
                      {t('transfers.delete')}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
