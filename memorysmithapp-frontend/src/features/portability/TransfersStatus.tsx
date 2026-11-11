import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import type { TransferDto } from '@memorysmithapp/contracts';
import { isWorking, progressOf, saveArchive, useTransfers } from './transfers';
import { KindMark, TransferState, TransferTitle, failureOf } from './TransferParts';
import { ChevronRightIcon, DownloadIcon } from '../../shared/components/icons';
import { ActionWord } from '../../shared/components/ActionWord';
import { notebookAddress } from '../../shared/api/note-address';

/**
 * Transfers, on the bell of the header (#418, #450): the edge of the button
 * fills as far as the transfers under way got, and the panel shows each with
 * its bar while it runs; when one ends, that it finished or failed is news,
 * kept until the person reads it, here and after a reload. Everything else
 * about transfers is on their page, in the menu.
 */
// The transfers whose end the person read (#450); the key of #418 held the
// running ones read, which means something else, so it is left behind.
const NOTICED_KEY = 'memorysmith.transfersEndedRead';
/** Enough to remember every transfer a person can have running at once. */
const REMEMBERED = 50;

function noticed(): string[] {
  try {
    const kept: unknown = JSON.parse(window.localStorage.getItem(NOTICED_KEY) ?? '[]');
    return Array.isArray(kept) ? kept.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    // A browser that refuses storage shows the notice once more, which is the
    // harmless half of being wrong here.
    return [];
  }
}

function remember(ids: string[]): void {
  try {
    window.localStorage.setItem(NOTICED_KEY, JSON.stringify(ids.slice(-REMEMBERED)));
  } catch {
    /* nothing to do: the notice comes back once */
  }
}

export interface TransfersStatus {
  /**
   * How far the transfers under way are, from 0 to 1 — the one furthest from
   * done (#450) — or null when none runs.
   */
  ring: number | null;
  /** The exports and imports under way, shown in the panel while they run. */
  running: TransferDto[];
  /** The ones that ended and the person has not read about yet (#450). */
  ended: TransferDto[];
  /** The person read the notices of the ended ones: they leave the bell. */
  read: () => void;
}

/** How long an export or an import that ended stays news, unread (#450). */
const ENDED_NEWS_MS = 24 * 60 * 60 * 1000;

/** An export or an import that ended, as news: done or failed, lately. */
export function endedLately(transfer: TransferDto, now: number): boolean {
  return (
    (transfer.kind === 'export' || transfer.kind === 'import') &&
    (transfer.status === 'ready' || transfer.status === 'failed') &&
    transfer.finishedAt !== null &&
    now - new Date(transfer.finishedAt).getTime() < ENDED_NEWS_MS
  );
}

export function useTransfersStatus(): TransfersStatus {
  const [read, setRead] = useState(noticed);
  const { data } = useTransfers();
  /**
   * The ring and the notice are for a job that ends by itself. An upload of
   * an agent may wait for its parts for days, and a ring turning for days
   * says nothing: it is on the page of transfers instead (RN-PRT-028).
   */
  const transfers = data?.transfers ?? [];
  const running = transfers.filter(isWorking);
  const now = Date.now();
  const ended = transfers.filter(
    (transfer) => endedLately(transfer, now) && !read.includes(transfer.transferId),
  );
  const progress = running.map((transfer) => progressOf(transfer) ?? 0);
  return {
    ring: running.length > 0 ? Math.min(...progress) : null,
    running,
    ended,
    read: () => {
      if (ended.length === 0) return;
      const next = [...read, ...ended.map((transfer) => transfer.transferId)];
      remember(next);
      setRead(next);
    },
  };
}

/**
 * One transfer as a notice of the bell (#450): while it runs, what it is and
 * its bar; once it ended, that it finished or failed and why, with the way to
 * what it made — the archive to download, the notebook to open.
 */
export function TransferNotice({
  transfer,
  onClose,
}: {
  transfer: TransferDto;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const running = transfer.status === 'running';
  const failure = failureOf(transfer, t, (key) => i18n.exists(key));
  const kind = transfer.kind === 'export' ? 'export' : 'import';
  return (
    <div
      className="notification transfer-notice"
      data-state={running ? 'running' : transfer.status}
    >
      <div className="transfers-line">
        <KindMark kind={transfer.kind} />
        <div className="transfers-line-what">
          {running ? (
            <>
              <TransferTitle transfer={transfer} />
              <TransferState transfer={transfer} />
            </>
          ) : (
            <>
              <p className="notification-what">
                <Trans
                  i18nKey={`transfers.endedNotice.${kind}.${transfer.status === 'ready' ? 'ready' : 'failed'}`}
                  values={{ notebook: transfer.notebookName }}
                  components={{ b: <strong /> }}
                />
              </p>
              {failure ? <p className="notification-failure">{failure}</p> : null}
            </>
          )}
        </div>
      </div>
      <div className="notification-actions">
        {transfer.status === 'ready' && transfer.kind === 'export' ? (
          <button
            type="button"
            className="button is-quiet is-small"
            onClick={() => void saveArchive(transfer.transferId)}
          >
            <ActionWord icon={<DownloadIcon />} word={t('transfers.download')} />
          </button>
        ) : null}
        {transfer.status === 'ready' && transfer.kind === 'import' && transfer.notebookId ? (
          <Link
            className="button is-quiet is-small"
            to={notebookAddress(transfer.notebookId)}
            onClick={onClose}
          >
            {t('portability.openNotebook')}
          </Link>
        ) : null}
        <Link className="button is-quiet is-small" to="/transfers" onClick={onClose}>
          {t('transfers.seeAll')}
          <ChevronRightIcon width={12} height={12} />
        </Link>
      </div>
    </div>
  );
}
