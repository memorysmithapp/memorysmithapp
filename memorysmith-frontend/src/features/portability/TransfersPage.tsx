import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Trans, useTranslation } from 'react-i18next';
import { intlLocale } from '../../i18n/intl-locale';
import type { TransferDto } from '@memorysmith/contracts';
import {
  canWrite,
  cancelTransfer,
  deleteTransfer,
  linkUpload,
  listNotebooks,
} from '../../shared/api/source';
import type { NotebookSummary } from '../../shared/types/api';
import { notebookAddress } from '../../shared/api/note-address';
import { useDocumentTitle } from '../../shared/components/document-title';
import { Tabs } from '../../shared/components/Tabs';
import { formatBytes } from '../../shared/components/StorageBar';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { queryState } from '../../shared/api/query-state';
import {
  isOpenUpload,
  isWaitingRequest,
  notebookUnavailable,
  saveArchive,
  useRefreshTransfers,
  useTransfers,
} from './transfers';
import { TransferActions, TransferDialogs, type Starting } from './StartTransfer';
import {
  KindMark,
  TransferFile,
  TransferState,
  TransferTitle,
  UploadPurpose,
  failureOf,
} from './TransferParts';
import { queryKeys } from '../../shared/api/query-keys';
import { RequestFulfil } from './RequestFulfil';

type Filter = 'all' | 'request' | 'export' | 'import' | 'agent';

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
 *
 * A third kind came with #240: what an agent is sending in parts (RN-PRT-028).
 * It has no deadline, so it is here that a person sees what it reserves and
 * throws it away; and when its notebook is no longer one they see, it is here
 * that it is pointed at another (RN-PRT-029).
 *
 * A fourth came with #253: a file an agent asked the person for, because it
 * could not send it (RN-PRT-030). It is the one kind that waits on the person,
 * so it has the tab right after all of them, *Aguardando você*, and it is here
 * that the person gives the file — chosen, dragged or pasted.
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
  const visible = notebooks.data ? new Set(notebooks.data.map((notebook) => notebook.id)) : null;
  const writable = (notebooks.data ?? []).filter((notebook) => canWrite(notebook.effectiveRole));
  const transit = transfers.data?.transitBytes ?? 0;
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
            {transit > 0 ? (
              <>
                {' '}
                <Trans
                  i18nKey="transfers.transitSentence"
                  values={{ size: size(transit) }}
                  components={{ b: <strong /> }}
                />
              </>
            ) : null}
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

      {/* One of four, one at a time, each saying how many it holds (#205). */}
      <Tabs
        id="transfers"
        label={t('transfers.filter')}
        className="transfers-filters"
        tabs={(['all', 'request', 'export', 'import', 'agent'] as const).map((each) => ({
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
              unavailable={notebookUnavailable(transfer, visible)}
              writable={writable}
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
  unavailable,
  writable,
  size,
  onImport,
}: {
  transfer: TransferDto;
  /** The notebook of the transfer is not one the person sees now (RN-PRT-029). */
  unavailable: boolean;
  /** The notebooks an upload may be pointed at: the ones the person writes in. */
  writable: readonly NotebookSummary[];
  size: (bytes: number) => string;
  /** Imports this kept export as a new notebook, without the round trip through the disk (#207). */
  onImport: () => void;
}) {
  const { t, i18n } = useTranslation();
  const refresh = useRefreshTransfers();
  const [asking, setAsking] = useState(false);
  const [linking, setLinking] = useState(false);
  const [target, setTarget] = useState('');
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

  async function link(): Promise<void> {
    if (!target) return;
    setBusy(true);
    try {
      await linkUpload(transfer.transferId, target);
      refresh();
      setLinking(false);
    } finally {
      setBusy(false);
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
  const request = isWaitingRequest(transfer);
  /**
   * Every transfer that ended can leave the list (#221): an export with its
   * bytes, and an import with its record alone, since it keeps no bytes and the
   * notebook it created stays. A running one is cancelled first (RN-PRT-026).
   */
  const ended = transfer.status !== 'running';
  const upload = transfer.kind === 'agent';
  /**
   * An upload is deleted whatever its state: deleting it is the only thing
   * that ends one, since it has no deadline (RN-PRT-028). So is a request,
   * which the person dismisses (RN-PRT-030).
   */
  const deletable = ended || upload || request;
  const ask =
    transfer.kind === 'import'
      ? 'transfers.deleteImportAsk'
      : upload
        ? 'transfers.deleteUploadAsk'
        : request
          ? 'transfers.deleteRequestAsk'
          : 'transfers.deleteAsk';
  const consequence = readyExport
    ? t('transfers.deleteFrees', { size: size(transfer.bytes) })
    : request
      ? t('transfers.deleteRequestKeeps', { name: transfer.fileName ?? '' })
      : upload
        ? isOpenUpload(transfer)
          ? t('transfers.deleteUploadFrees', { size: size(transfer.bytes) })
          : t('transfers.deleteFailedUpload')
        : t(
            transfer.kind === 'import'
              ? 'transfers.deleteImportKeeps'
              : 'transfers.deleteRecordOnly',
          );
  /** Where the row says its notebook is unavailable, in the words of its kind. */
  const unavailableNote = !unavailable
    ? null
    : transfer.kind === 'export'
      ? t('transfers.notebookGone')
      : transfer.kind === 'import'
        ? t('transfers.importUnavailable')
        : isOpenUpload(transfer)
          ? t('transfers.uploadUnavailable')
          : request
            ? t('transfers.requestUnavailable')
            : null;
  const [giving, setGiving] = useState(false);

  return (
    <li className="transfers-row">
      <KindMark kind={transfer.kind} />
      <div className="transfers-row-what">
        <TransferTitle transfer={transfer} />
        <TransferFile transfer={transfer} />
        <UploadPurpose transfer={transfer} />
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
        {/* An import ends in a notebook, so its row is where it is opened —
            while that notebook is one the person sees (RN-PRT-029). */}
        {transfer.status === 'ready' &&
          transfer.kind === 'import' &&
          transfer.notebookId !== null &&
          !unavailable && (
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
        {/* An upload whose notebook is unavailable finishes in another one,
            and nothing but the record moves (RN-PRT-029). */}
        {/* A request is fulfilled here, in the notebook it names, while that
            notebook is one the person sees (RN-PRT-030). */}
        {request && !unavailable && !giving && !asking && (
          <button
            type="button"
            className="button is-primary is-small"
            onClick={() => setGiving(true)}
          >
            {t('transfers.fulfil')}
          </button>
        )}
        {(isOpenUpload(transfer) || request) && unavailable && !linking && !asking && (
          <button
            type="button"
            className="button is-quiet is-small"
            onClick={() => {
              setTarget(writable[0]?.id ?? '');
              setLinking(true);
            }}
          >
            {t('transfers.link')}
          </button>
        )}
        {deletable && !asking && !linking && (
          <button
            type="button"
            className="button is-danger is-small"
            onClick={() => setAsking(true)}
          >
            {t(request ? 'transfers.dismiss' : 'transfers.delete')}
          </button>
        )}
      </div>

      {giving && request && !unavailable && (
        <RequestFulfil
          transfer={transfer}
          onKept={() => {
            setGiving(false);
            refresh();
          }}
        />
      )}

      {unavailableNote && <p className="transfers-row-note">{unavailableNote}</p>}
      {failure && <p className="transfers-row-note is-failure">{failure}</p>}

      {/* Deleting asks in place, saying what goes and what does not: the space
          it frees, and that the notebook, if it still exists, is untouched. */}
      {asking && (
        <div className="transfers-confirm" role="group" aria-label={t(ask)}>
          <p>
            <strong>{t(ask)}</strong> {consequence}
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

      {linking && (
        <div className="transfers-link" role="group" aria-label={t('transfers.link')}>
          {writable.length === 0 ? (
            <p>{t('transfers.linkNone')}</p>
          ) : (
            <div className="transfer-field">
              <label htmlFor={`link-${transfer.transferId}`}>{t('transfers.linkLabel')}</label>
              <select
                id={`link-${transfer.transferId}`}
                value={target}
                onChange={(event) => setTarget(event.target.value)}
              >
                {writable.map((notebook) => (
                  <option key={notebook.id} value={notebook.id}>
                    {notebook.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="transfers-confirm-actions">
            <button
              type="button"
              className="button is-quiet is-small"
              disabled={busy}
              onClick={() => setLinking(false)}
            >
              {t('transfers.keep')}
            </button>
            {writable.length > 0 && (
              <button
                type="button"
                className="button is-primary is-small"
                disabled={busy || !target}
                onClick={() => void link()}
              >
                {t('transfers.linkConfirm')}
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
