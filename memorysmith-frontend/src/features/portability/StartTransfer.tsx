import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { listNotebooks, startExport } from '../../shared/api/source';
import { ExportChoice } from './ExportChoice';
import { rememberStartedExport, useRefreshTransfers } from './transfers';
import { selectionOf, type Chosen } from './import-selection';

/**
 * Starting a transfer, from wherever you are (RN-PRT-019).
 *
 * Each half used to live on the single screen it was born on: the export was a
 * button inside a notebook, so exporting meant navigating to it first, and the
 * import was a link on the dashboard, so importing meant going back there.
 * Transfers is on every screen and is where a transfer is followed, downloaded
 * again and deleted — so it is where one is started (#151).
 *
 * **The export asks which notebook**, among the ones the person can see: a
 * listing must never reveal a notebook somebody cannot see (RN-PRT-020, rule 9
 * of the design), and `listNotebooks` answers exactly those.
 *
 * The convenience the notebook button had is kept, and it had to move with it:
 * an export that finishes while this browser is still open saves itself, and
 * what waits for it is the menu — starting one from the panel closes the
 * panel, which unmounts this.
 */
export function StartTransfer({ onStarted }: { onStarted?: () => void }) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);
  const [notebookId, setNotebookId] = useState('');
  const refresh = useRefreshTransfers();
  const notebooks = useQuery({ queryKey: ['notebooks'], queryFn: listNotebooks, enabled: asking });

  const choices = (notebooks.data ?? []).map((notebook) => ({
    id: notebook.id,
    name: notebook.name,
  }));

  // The first of the list unless another was chosen, so the dialog always has
  // an answer and the common case is one click.
  const chosen = notebookId || (choices[0]?.id ?? '');

  async function begin(carrying: Chosen | null): Promise<void> {
    if (!chosen) return;
    const transfer = await startExport(chosen, carrying === null ? null : selectionOf(carrying));
    /**
     * Remembered rather than waited for here: starting one from the panel
     * closes the panel, which unmounts this. The menu is what waits, because
     * it is in the frame of every screen (#151).
     */
    rememberStartedExport(transfer.transferId);
    refresh();
    onStarted?.();
  }

  return (
    <>
      <div className="transfers-start">
        <button type="button" className="button is-primary" onClick={() => setAsking(true)}>
          {t('transfers.newExport')}
        </button>
        <Link to="/imports/new" className="button is-quiet" onClick={() => onStarted?.()}>
          {t('transfers.newImport')}
        </Link>
      </div>
      <ExportChoice
        open={asking}
        notebooks={choices}
        notebookId={chosen}
        onChooseNotebook={setNotebookId}
        onConfirm={(carrying) => void begin(carrying)}
        onClose={() => setAsking(false)}
      />
    </>
  );
}
