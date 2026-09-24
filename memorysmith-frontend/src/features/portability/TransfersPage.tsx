import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Trans, useTranslation } from 'react-i18next';
import { intlLocale } from '../../i18n/intl-locale';
import type { TransferDto } from '@memorysmith/contracts';
import { cancelTransfer, deleteTransfer, listNotebooks } from '../../shared/api/source';
import { notebookAddress } from '../../shared/api/note-address';
import { useDocumentTitle } from '../../shared/components/document-title';
import { Tabs } from '../../shared/components/Tabs';
import { formatBytes } from '../../shared/components/StorageBar';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { queryState } from '../../shared/api/query-state';
import { saveArchive, useRefreshTransfers, useTransfers } from './transfers';
import { TransferActions, TransferDialogs, type Starting } from './StartTransfer';
import { KindMark, TransferFile, TransferState, TransferTitle, failureOf } from './TransferParts';
import { queryKeys } from '../../shared/api/query-keys';

type Filter = 'all' | 'export' | 'import';

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
 *
 * Drawn to the approved design (#205): the space the kept exports take under
 * the title, because it counts against the plan; tabs that say how many each
 * holds; and the rows in one card, each with its kind, its file, its state and
 * the one or two things that can be done to it.
 */
export function TransfersPage() {
  const { t, i18n } = useTranslation();
  const locale = intlLocale(i18n.language);
  const [filter, setFilter] = useState<Filter>('all');
  const [starting, setStarting] = useState<Starting>(null);
  /** The kept export an import was started from, by its row (#207). */
  const [importFrom, setImportFrom] = useState<string | undefined>(undefined);
  const transfers = useTransfers();
  // What still exists, so a row can say that the notebook of an export is gone.
  const notebooks = useQuery({ queryKey: queryKeys.notebooks(), queryFn: listNotebooks });

  useDocumentTitle(t('transfers.heading'));

  const state = queryState(transfers);
  const all = transfers.data?.transfers ?? [];
  const rows = all.filter((transfer) => filter === 'all' || transfer.kind === filter);
  const alive = new Set((notebooks.data ?? []).map((notebook) => notebook.id));
  const size = (bytes: number) => formatBytes(bytes, locale);

  return (
    <section className="page transfers-page">
      <div className="transfers-page-heading">
        <div>
          <h1>{t('transfers.heading')}</h1>
          <p className="transfers-kept">
            <Trans
              i18nKey="transfers.keptSentence"
              values={{ size: size(transfers.data?.keptBytes ?? 0) }}
              components={{ b: <strong /> }}
            />
          </p>
        </div>
        <TransferActions onStart={setStarting} />
      </div>
      <TransferDialogs
        starting={starting}
        exportId={importFrom}
        onClose={() => {
          setStarting(null);
          setImportFrom(undefined);
        }}
      />

      {/* One of three, one at a time, each saying how many it holds (#205). */}
      <Tabs
        id="transfers"
        label={t('transfers.filter')}
        className="transfers-filters"
        tabs={(['all', 'export', 'import'] as const).map((each) => ({
          key: each,
          label: t(`transfers.filters.${each}`),
          total: each === 'all' ? all.length : all.filter((row) => row.kind === each).length,
        }))}
        active={filter}
        onSelect={setFilter}
      />

      {/* A refetch that failed over a list already on the screen is not a
          page that failed: the list stays, and it is asked again. */}
      {state === 'error' && !transfers.data && (
        <p className="status">{t(messageKeyOf(transfers.error))}</p>
      )}
      {state === 'pending' && <p className="status">{t('common.loading')}</p>}
      {state === 'ready' && rows.length === 0 && <p className="status">{t('transfers.empty')}</p>}

      {rows.length > 0 && (
        <ul
          className="transfers-rows"
          role="tabpanel"
          id="transfers-panel"
          aria-labelledby={`transfers-tab-${filter}`}
        >
          {rows.map((transfer) => (
            <TransferRow
              key={transfer.transferId}
              transfer={transfer}
              notebookGone={
                transfer.kind === 'export' &&
                transfer.notebookId !== null &&
                notebooks.data !== undefined &&
                !alive.has(transfer.notebookId)
              }
              size={size}
              onImport={() => {
                setImportFrom(transfer.transferId);
                setStarting('import');
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function TransferRow({
  transfer,
  notebookGone,
  size,
  onImport,
}: {
  transfer: TransferDto;
  notebookGone: boolean;
  size: (bytes: number) => string;
  /** Imports this kept export as a new notebook, without the round trip through the disk (#207). */
  onImport: () => void;
}) {
  const { t, i18n } = useTranslation();
  const refresh = useRefreshTransfers();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const failure = failureOf(transfer, t, (key) => i18n.exists(key));

  async function remove(): Promise<void> {
    setBusy(true);
    try {
      await deleteTransfer(transfer.transferId);
      refresh();
    } finally {
      setBusy(false);
      setAsking(false);
    }
  }

  async function cancel(): Promise<void> {
    setBusy(true);
    try {
      await cancelTransfer(transfer.transferId);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  const readyExport = transfer.status === 'ready' && transfer.kind === 'export';
  /**
   * Every transfer that ended can leave the list (#221): an export with its
   * bytes, and an import with its record alone, since it keeps no bytes and the
   * notebook it created stays. A running one is cancelled first (RN-PRT-026).
   */
  const ended = transfer.status !== 'running';
  const ask = transfer.kind === 'import' ? 'transfers.deleteImportAsk' : 'transfers.deleteAsk';

  return (
    <li className="transfers-row">
      <KindMark kind={transfer.kind} />
      <div className="transfers-row-what">
        <TransferTitle transfer={transfer} />
        <TransferFile transfer={transfer} />
      </div>
      <div className="transfers-row-state">
        <TransferState transfer={transfer} />
      </div>
      <div className="transfers-row-actions">
        {/* An import that runs can be stopped, and stopping takes it back down
            whole (RN-PRT-018). An export cannot: it writes nothing but its file. */}
        {transfer.status === 'running' && transfer.kind === 'import' && (
          <button
            type="button"
            className="button is-quiet is-small"
            disabled={busy}
            onClick={() => void cancel()}
          >
            {t('transfers.cancelImport')}
          </button>
        )}
        {/* An import ends in a notebook, so its row is where it is opened. */}
        {transfer.status === 'ready' &&
          transfer.kind === 'import' &&
          transfer.notebookId !== null && (
            <Link className="button is-quiet is-small" to={notebookAddress(transfer.notebookId)}>
              {t('portability.openNotebook')}
            </Link>
          )}
        {readyExport && (
          <button
            type="button"
            className="button is-quiet is-small"
            onClick={() => void saveArchive(transfer.transferId)}
          >
            {t('transfers.download')}
          </button>
        )}
        {readyExport && (
          <button type="button" className="button is-quiet is-small" onClick={onImport}>
            {t('transfers.importKept')}
          </button>
        )}
        {ended && !asking && (
          <button
            type="button"
            className="button is-danger is-small"
            onClick={() => setAsking(true)}
          >
            {t('transfers.delete')}
          </button>
        )}
      </div>

      {notebookGone && <p className="transfers-row-note">{t('transfers.notebookGone')}</p>}
      {failure && <p className="transfers-row-note is-failure">{failure}</p>}

      {/* Deleting asks in place, saying what goes and what does not: the space
          it frees, and that the notebook, if it still exists, is untouched. */}
      {asking && (
        <div className="transfers-confirm" role="group" aria-label={t(ask)}>
          <p>
            <strong>{t(ask)}</strong>{' '}
            {readyExport
              ? t('transfers.deleteFrees', { size: size(transfer.bytes) })
              : t(
                  transfer.kind === 'import'
                    ? 'transfers.deleteImportKeeps'
                    : 'transfers.deleteRecordOnly',
                )}
          </p>
          <div className="transfers-confirm-actions">
            <button
              type="button"
              className="button is-quiet is-small"
              disabled={busy}
              onClick={() => setAsking(false)}
            >
              {t('transfers.keep')}
            </button>
            <button
              type="button"
              className="button is-danger is-filled is-small"
              disabled={busy}
              onClick={() => void remove()}
            >
              {t('transfers.deleteForGood')}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
