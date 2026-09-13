import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { exportNotebook } from '../../shared/api/source';
import { DownloadIcon } from '../../shared/components/icons';

type Phase = 'idle' | 'preparing' | 'failed';

/**
 * Downloads the whole notebook as a folder of Markdown inside a ZIP, which is the
 * promise of zero lock-in made reachable in one click (software-vision.md 12).
 *
 * The archive is built on the server and answered as a short-lived link, not
 * as a response body: a notebook of two thousand notes does not fit in one. The
 * link carries a content disposition of attachment, so navigating to it saves
 * the file and leaves the application where it was.
 */
export function ExportNotebookButton({ notebookId }: { notebookId: string }) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('idle');

  async function download(): Promise<void> {
    setPhase('preparing');
    try {
      const job = await exportNotebook(notebookId);
      if (!job.downloadUrl) {
        setPhase('failed');
        return;
      }
      window.location.assign(job.downloadUrl);
      setPhase('idle');
    } catch {
      setPhase('failed');
    }
  }

  return (
    <button
      type="button"
      className="notebook-nav-link notebook-nav-action"
      onClick={() => void download()}
      disabled={phase === 'preparing'}
    >
      <DownloadIcon />
      {phase === 'preparing' && t('portability.preparing')}
      {phase === 'failed' && t('portability.failed')}
      {phase === 'idle' && t('portability.download')}
    </button>
  );
}
