import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TransferDto } from '@memorysmithapp/contracts';
import { isWorking, progressOf, useTransfers } from './transfers';
import { KindMark, TransferState, TransferTitle } from './TransferParts';
import { ChevronRightIcon } from '../../shared/components/icons';

/**
 * Transfers, on the bell of the header (#418): a ring on the button while a
 * transfer runs, filled as far as the first one got, and a notice in the panel
 * that one is under way. The notice is news: once the person has read it, it
 * leaves the bell, and the ring goes on until the transfer ends. Everything
 * else about transfers is on their page, in the menu.
 */
const NOTICED_KEY = 'memorysmith.transfersNoticed';
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
  /** How far the first transfer under way is, from 0 to 1, or null when none runs. */
  ring: number | null;
  /** The transfers under way the person has not read about yet. */
  notices: TransferDto[];
  /** The person read the notices: they leave the bell. */
  read: () => void;
}

export function useTransfersStatus(): TransfersStatus {
  const [read, setRead] = useState(noticed);
  const { data } = useTransfers();
  /**
   * The ring and the notice are for a job that ends by itself. An upload of
   * an agent may wait for its parts for days, and a ring turning for days
   * says nothing: it is on the page of transfers instead (RN-PRT-028).
   */
  const running = (data?.transfers ?? []).filter(isWorking);
  const notices = running.filter((transfer) => !read.includes(transfer.transferId));
  return {
    ring: running.length > 0 ? progressOf(running[0] as TransferDto) : null,
    notices,
    read: () => {
      if (notices.length === 0) return;
      const next = [...read, ...notices.map((transfer) => transfer.transferId)];
      remember(next);
      setRead(next);
    },
  };
}

/** One transfer under way, as a notice of the bell, and the way to its page. */
export function TransferNotice({
  transfer,
  onClose,
}: {
  transfer: TransferDto;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="notification transfer-notice">
      <div className="transfers-line">
        <KindMark kind={transfer.kind} />
        <div className="transfers-line-what">
          <TransferTitle transfer={transfer} />
          <TransferState transfer={transfer} />
        </div>
      </div>
      <div className="notification-actions">
        <Link className="button is-quiet is-small" to="/transfers" onClick={onClose}>
          {t('transfers.seeAll')}
          <ChevronRightIcon width={12} height={12} />
        </Link>
      </div>
    </div>
  );
}
