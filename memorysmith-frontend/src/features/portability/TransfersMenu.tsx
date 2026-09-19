import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TransferDto } from '@memorysmith/contracts';
import { lineOf, progressOf, saveArchive, useTransfers } from './transfers';
import { TransferActions, TransferDialogs, type Starting } from './StartTransfer';

/**
 * Transfers, beside the user menu (RN-PRT-019, RN-PRT-020).
 *
 * It follows the pattern browsers use for downloads and **not** a notification
 * bell: what it holds is files, each of which can be opened, saved again or
 * thrown away, and none of which is news to be dismissed.
 *
 * A ring while something runs, a dot while something has finished that the
 * person has not seen. Opening the panel clears the dot.
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

export function TransfersMenu() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState<Starting>(null);
  const [seen, setSeen] = useState(seenAt);
  const root = useRef<HTMLDivElement>(null);
  const { data } = useTransfers();

  const transfers = data?.transfers ?? [];
  const running = transfers.filter((transfer) => transfer.status === 'running');
  const finished = transfers.filter(
    (transfer) => transfer.finishedAt !== null && transfer.finishedAt > seen,
  );

  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [open]);

  function toggle(): void {
    setOpen((current) => {
      if (!current) {
        // Opening the panel is what clears the dot: the person has seen them.
        const newest = transfers.reduce(
          (latest, transfer) =>
            transfer.finishedAt && transfer.finishedAt > latest ? transfer.finishedAt : latest,
          seen,
        );
        markSeen(newest);
        setSeen(newest);
      }
      return !current;
    });
  }

  /**
   * It used to disappear when nothing had ever been transferred, which was
   * right while a transfer was started somewhere else. It is where one is
   * started now (#151), so it is always here.
   */
  const ring = running.length > 0 ? progressOf(running[0] as TransferDto) : null;

  return (
    <div className="transfers-menu" ref={root}>
      <button
        type="button"
        className="transfers-trigger"
        onClick={toggle}
        aria-expanded={open}
        aria-label={t('transfers.heading')}
      >
        <span aria-hidden="true">⇅</span>
        {running.length > 0 && (
          <span
            className="transfers-ring"
            style={{ ['--progress' as string]: `${Math.round((ring ?? 0) * 100)}%` }}
          />
        )}
        {running.length === 0 && finished.length > 0 && <span className="transfers-dot" />}
      </button>
      {open && (
        <div className="transfers-panel">
          <h2>{t('transfers.heading')}</h2>
          <TransferActions
            onStart={(kind) => {
              // One surface at a time: the panel used to stay open behind the
              // dialog it had opened (#160). The dialog itself is mounted
              // outside the panel, so closing it here does not take it away.
              setOpen(false);
              setStarting(kind);
            }}
          />
          {transfers.length === 0 && <p className="status">{t('transfers.empty')}</p>}
          <ul className="transfers-recent">
            {transfers.slice(0, 4).map((transfer) => (
              <li key={transfer.transferId}>
                <TransferLine transfer={transfer} onClose={() => setOpen(false)} />
              </li>
            ))}
          </ul>
          {transfers.length > 0 && (
            <Link to="/transfers" className="transfers-see-all" onClick={() => setOpen(false)}>
              {t('transfers.seeAll')} →
            </Link>
          )}
        </div>
      )}
      <TransferDialogs starting={starting} onClose={() => setStarting(null)} />
    </div>
  );
}

function TransferLine({ transfer, onClose }: { transfer: TransferDto; onClose: () => void }) {
  const { t } = useTranslation();
  const progress = progressOf(transfer);

  return (
    <div className="transfers-line">
      <span className="transfers-line-name">{lineOf(transfer, t)}</span>
      <span className="transfers-line-state">
        {transfer.status === 'running'
          ? t(`transfers.running.${transfer.kind}`, {
              done: transfer.done,
              total: transfer.total,
            })
          : t(`transfers.ended.${transfer.status}`)}
      </span>
      {progress !== null && (
        <progress className="transfers-line-bar" value={progress} max={1}>
          {Math.round(progress * 100)}%
        </progress>
      )}
      {transfer.status === 'ready' && transfer.kind === 'export' && (
        <button
          type="button"
          className="button is-quiet is-small"
          onClick={() => {
            onClose();
            void saveArchive(transfer.transferId);
          }}
        >
          {t('transfers.download')}
        </button>
      )}
    </div>
  );
}
