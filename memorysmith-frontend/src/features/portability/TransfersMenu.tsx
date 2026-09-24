import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { notebookAddress } from '../../shared/api/note-address';
import { Trans, useTranslation } from 'react-i18next';
import type { TransferDto } from '@memorysmith/contracts';
import { progressOf, saveArchive, useTransfers } from './transfers';
import { Menu } from '../../shared/components/Menu';
import { formatBytes } from '../../shared/components/StorageBar';
import { intlLocale } from '../../i18n/intl-locale';
import { KindMark, TransferState, TransferTitle } from './TransferParts';
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
 *
 * Drawn to the approved design (#205): the icon button of the Controles with
 * the ring and the dot in its top corner, and a menu of 380 px — a sheet on a
 * phone — with the space used, the two actions as equals, the four most
 * recent and the way to all of them.
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
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState<Starting>(null);
  const [seen, setSeen] = useState(seenAt);
  const trigger = useRef<HTMLButtonElement>(null);
  const { data } = useTransfers();
  const close = useCallback(() => setOpen(false), []);

  const transfers = data?.transfers ?? [];
  const running = transfers.filter((transfer) => transfer.status === 'running');
  const finished = transfers.filter(
    (transfer) => transfer.finishedAt !== null && transfer.finishedAt > seen,
  );

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
    <div className="transfers-menu">
      <button
        ref={trigger}
        type="button"
        className="icon-button transfers-trigger"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="menu"
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
      <Menu
        open={open}
        onClose={close}
        trigger={trigger}
        label={t('transfers.heading')}
        className="transfers-panel"
        closeLabel={t('common.close')}
      >
        <div className="transfers-panel-head">
          <h2>{t('transfers.heading')}</h2>
          <span className="transfers-panel-kept">
            <Trans
              i18nKey="transfers.keptShort"
              values={{ size: formatBytes(data?.keptBytes ?? 0, intlLocale(i18n.language)) }}
              components={{ b: <strong /> }}
            />
          </span>
        </div>
        <TransferActions
          onStart={(kind) => {
            // One surface at a time: the panel used to stay open behind the
            // dialog it had opened (#160). The dialog itself is mounted
            // outside the panel, so closing it here does not take it away.
            setOpen(false);
            setStarting(kind);
          }}
        />
        {transfers.length === 0 ? (
          <p className="transfers-panel-empty">{t('transfers.empty')}</p>
        ) : (
          <ul className="transfers-recent">
            {transfers.slice(0, 4).map((transfer) => (
              <li key={transfer.transferId}>
                <TransferLine transfer={transfer} onClose={close} />
              </li>
            ))}
          </ul>
        )}
        {transfers.length > 0 && (
          <div className="transfers-panel-foot">
            <Link to="/transfers" className="transfers-see-all" onClick={close}>
              {t('transfers.seeAll')} →
            </Link>
          </div>
        )}
      </Menu>
      <TransferDialogs starting={starting} onClose={() => setStarting(null)} />
    </div>
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
          {t('transfers.download')}
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
            {t('transfers.open')}
          </Link>
        )}
    </div>
  );
}
