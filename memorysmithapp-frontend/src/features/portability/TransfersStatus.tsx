import { useState } from 'react';
import { Link } from 'react-router-dom';
import { notebookAddress } from '../../shared/api/note-address';
import { useTranslation } from 'react-i18next';
import type { TransferDto } from '@memorysmithapp/contracts';
import { isWaitingRequest, isWorking, progressOf, saveArchive, useTransfers } from './transfers';
import { KindMark, TransferState, TransferTitle } from './TransferParts';
import { ActionWord } from '../../shared/components/ActionWord';
import { ChevronRightIcon, DownloadIcon, UploadIcon } from '../../shared/components/icons';

/**
 * The status of the transfers, on the bell of the header (#418, RN-PRT-019,
 * RN-PRT-020): what the ⇅ of the header used to say, now beside the news of
 * the shares, since the menu of the product carries the page of transfers.
 *
 * A ring while something runs, a dot while something has finished that the
 * person has not seen; opening the panel clears the dot. What waits on the
 * person is counted on the button (#253, RN-PRT-030): a file an agent asked
 * for is not news that fades once seen, but something still to do, and it
 * stays counted until it is done.
 */
const SEEN_KEY = 'memorysmith.transfersSeen';

function seenAt(): string {
  try {
    return window.localStorage.getItem(SEEN_KEY) ?? '';
  } catch {
    // A browser that refuses storage shows the dot once more, which is the
    // harmless half of being wrong here.
    return '';
  }
}

function markSeen(at: string): void {
  try {
    window.localStorage.setItem(SEEN_KEY, at);
  } catch {
    /* nothing to do: the dot comes back, and nothing else is lost */
  }
}

export interface TransfersStatus {
  transfers: TransferDto[];
  /** How far the first transfer under way is, from 0 to 1, or null when none runs. */
  ring: number | null;
  /** Whether something finished that the person has not seen. */
  unseen: boolean;
  /** The files agents asked for that the person has not given yet. */
  waiting: number;
  /** The person looked: what finished is seen. */
  seeAll: () => void;
}

export function useTransfersStatus(): TransfersStatus {
  const [seen, setSeen] = useState(seenAt);
  const { data } = useTransfers();
  const transfers = data?.transfers ?? [];
  /**
   * The ring is for a job that ends by itself. An upload of an agent may wait
   * for its parts for days, and a ring turning for days says nothing: it is on
   * the list, and on the page, instead (RN-PRT-028).
   */
  const running = transfers.filter(isWorking);
  const unseen = transfers.some(
    (transfer) => transfer.finishedAt !== null && transfer.finishedAt > seen,
  );
  return {
    transfers,
    ring: running.length > 0 ? progressOf(running[0] as TransferDto) : null,
    unseen: running.length === 0 && unseen,
    waiting: transfers.filter(isWaitingRequest).length,
    seeAll: () => {
      const newest = transfers.reduce(
        (latest, transfer) =>
          transfer.finishedAt && transfer.finishedAt > latest ? transfer.finishedAt : latest,
        seen,
      );
      markSeen(newest);
      setSeen(newest);
    },
  };
}

/** The four most recent transfers, and the way to all of them, in the panel of the bell. */
export function TransfersRecent({
  transfers,
  onClose,
}: {
  transfers: TransferDto[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="transfers-recent-section" aria-label={t('transfers.heading')}>
      <div className="transfers-panel-head">
        <h2>{t('transfers.heading')}</h2>
      </div>
      {transfers.length === 0 ? (
        <p className="transfers-panel-empty">{t('transfers.empty')}</p>
      ) : (
        <ul className="transfers-recent">
          {transfers.slice(0, 4).map((transfer) => (
            <li key={transfer.transferId}>
              <TransferLine transfer={transfer} onClose={onClose} />
            </li>
          ))}
        </ul>
      )}
      <div className="transfers-panel-foot">
        <Link to="/transfers" className="transfers-see-all" onClick={onClose}>
          {t('transfers.seeAll')} →
        </Link>
      </div>
    </section>
  );
}

/** One recent transfer: its kind, what it is, its state, and the one thing to do. */
function TransferLine({ transfer, onClose }: { transfer: TransferDto; onClose: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="transfers-line">
      <KindMark kind={transfer.kind} />
      <div className="transfers-line-what">
        <TransferTitle transfer={transfer} />
        <TransferState transfer={transfer} />
      </div>
      {transfer.status === 'ready' && transfer.kind === 'export' && (
        <button
          type="button"
          className="button is-quiet is-small"
          onClick={() => {
            onClose();
            void saveArchive(transfer.transferId);
          }}
        >
          <ActionWord icon={<DownloadIcon />} word={t('transfers.download')} />
        </button>
      )}
      {transfer.status === 'ready' &&
        transfer.kind === 'import' &&
        transfer.notebookId !== null && (
          <Link
            className="button is-quiet is-small"
            to={notebookAddress(transfer.notebookId)}
            onClick={onClose}
          >
            <ActionWord icon={<ChevronRightIcon />} word={t('transfers.open')} />
          </Link>
        )}
      {/* A file waiting for the person is given on the page, where there is
          room to choose, drag or paste it (#253). */}
      {isWaitingRequest(transfer) && (
        <Link className="button is-primary is-small" to="/transfers" onClick={onClose}>
          <ActionWord icon={<UploadIcon />} word={t('transfers.fulfil')} />
        </Link>
      )}
    </div>
  );
}
