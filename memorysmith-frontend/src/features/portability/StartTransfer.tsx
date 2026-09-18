import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { listNotebooks, startExport } from '../../shared/api/source';
import { ExportChoice } from './ExportChoice';
import { saveArchive, useRefreshTransfers, useTransfers } from './transfers';

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
 * The convenience the notebook button had is kept: while this page is still
 * open, an export that finishes saves itself. Elsewhere Transfers keeps it for
 * as long as the person wants it.
 */
export function StartTransfer({ onStarted }: { onStarted?: () => void }) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);
  const [withHistory, setWithHistory] = useState(false);
  const [notebookId, setNotebookId] = useState('');
  const [started, setStarted] = useState<string | null>(null);
  const saved = useRef<string | null>(null);
  const refresh = useRefreshTransfers();
  const { data } = useTransfers();

  const notebooks = useQuery({ queryKey: ['notebooks'], queryFn: listNotebooks, enabled: asking });
  const mine = data?.transfers.find((transfer) => transfer.transferId === started);

  // The one this click started, and only while this page is still open: the
  // download of a transfer somebody started elsewhere is theirs to ask for.
  useEffect(() => {
    if (!mine || mine.status !== 'ready' || saved.current === mine.transferId) return;
    saved.current = mine.transferId;
    void saveArchive(mine.transferId);
  }, [mine]);

  const choices = (notebooks.data ?? []).map((notebook) => ({
    id: notebook.id,
    name: notebook.name,
  }));

  // The first of the list unless another was chosen, so the dialog always has
  // an answer and the common case is one click.
  const chosen = notebookId || (choices[0]?.id ?? '');

  async function begin(): Promise<void> {
    if (!chosen) return;
    const transfer = await startExport(chosen, withHistory);
    setStarted(transfer.transferId);
    refresh();
    onStarted?.();
  }

  return (
    <>
      <div className="transfers-start">
        <button type="button" className="chip" onClick={() => setAsking(true)}>
          {t('transfers.newExport')}
        </button>
        <Link to="/imports/new" className="chip" onClick={() => onStarted?.()}>
          {t('transfers.newImport')}
        </Link>
      </div>
      <ExportChoice
        open={asking}
        notebooks={choices}
        notebookId={chosen}
        onChooseNotebook={setNotebookId}
        withHistory={withHistory}
        onToggleHistory={setWithHistory}
        onConfirm={() => void begin()}
        onClose={() => setAsking(false)}
      />
    </>
  );
}
