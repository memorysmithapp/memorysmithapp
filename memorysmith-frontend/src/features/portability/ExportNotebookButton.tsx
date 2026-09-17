import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { startExport } from '../../shared/api/source';
import { DownloadIcon } from '../../shared/components/icons';
import { saveArchive, useRefreshTransfers, useTransfers } from './transfers';

type Phase = 'idle' | 'starting' | 'failed';

/**
 * Starts the export of a notebook (RN-PRT-019).
 *
 * The whole export used to run inside the request behind this button, and the
 * function serving it stops at 29 seconds: a notebook large enough failed, and
 * the button said only that it had. It is a job now, followed in Transfers.
 *
 * **The common case stays one click.** A small notebook finishes in a moment,
 * and while the person is still on this page the download starts by itself.
 * Elsewhere in the application the toast offers it, and Transfers keeps it for
 * as long as they want it.
 */
export function ExportNotebookButton({ notebookId }: { notebookId: string }) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('idle');
  const [started, setStarted] = useState<string | null>(null);
  const saved = useRef<string | null>(null);
  const { data } = useTransfers();
  const refresh = useRefreshTransfers();

  const mine = data?.transfers.find((transfer) => transfer.transferId === started);

  // The one this click started, and only while this page is still open: the
  // download of a transfer somebody started elsewhere is theirs to ask for.
  useEffect(() => {
    if (!mine || mine.status !== 'ready' || saved.current === mine.transferId) return;
    saved.current = mine.transferId;
    void saveArchive(mine.transferId);
  }, [mine]);

  async function begin(): Promise<void> {
    setPhase('starting');
    try {
      const transfer = await startExport(notebookId);
      setStarted(transfer.transferId);
      refresh();
      setPhase('idle');
    } catch {
      setPhase('failed');
    }
  }

  const running = mine?.status === 'running';

  return (
    <button
      type="button"
      className="notebook-nav-link notebook-nav-action"
      onClick={() => void begin()}
      disabled={phase === 'starting' || running}
    >
      <DownloadIcon />
      {phase === 'starting' && t('portability.preparing')}
      {phase === 'failed' && t('portability.failed')}
      {phase === 'idle' && (running ? t('portability.exporting') : t('portability.download'))}
    </button>
  );
}
