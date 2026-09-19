import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { listNotebooks, startExport } from '../../shared/api/source';
import { ExportChoice } from './ExportChoice';
import { ImportDialog } from './ImportDialog';
import { useRefreshTransfers } from './transfers';
import { selectionOf, type Chosen } from './import-selection';

/** Which of the two transfers is being decided, or none. */
export type Starting = 'export' | 'import' | null;

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
 * **Nothing downloads by itself.** An export used to save itself the moment it
 * was ready, which was the only way to reach the file when it was a button
 * inside a notebook. There are two buttons for it now — in the panel and on
 * the page — so a third way, firing without being asked and wherever the
 * person had moved to, is one too many (#160).
 *
 * The two halves are separate exports because **the buttons and the dialogs do
 * not live in the same place**: inside the panel of the menu the buttons
 * disappear when it closes, and a dialog that disappeared with them could
 * never be opened by closing it (#160). The page, which never collapses, uses
 * the two together.
 */
export function StartTransfer() {
  const [starting, setStarting] = useState<Starting>(null);

  return (
    <>
      <TransferActions onStart={setStarting} />
      <TransferDialogs starting={starting} onClose={() => setStarting(null)} />
    </>
  );
}

/**
 * The two ways in, drawn as peers: one of them being filled and the other
 * outlined said one mattered more, which is not true (#160).
 */
export function TransferActions({ onStart }: { onStart: (starting: Starting) => void }) {
  const { t } = useTranslation();

  return (
    <div className="transfers-start">
      <button type="button" className="button is-quiet" onClick={() => onStart('export')}>
        {t('transfers.newExport')}
      </button>
      <button type="button" className="button is-quiet" onClick={() => onStart('import')}>
        {t('transfers.newImport')}
      </button>
    </div>
  );
}

/** The decision itself, in the one dialog both sides share (#160). */
export function TransferDialogs({
  starting,
  onClose,
}: {
  starting: Starting;
  onClose: () => void;
}) {
  const [notebookId, setNotebookId] = useState('');
  const refresh = useRefreshTransfers();
  const notebooks = useQuery({
    queryKey: ['notebooks'],
    queryFn: listNotebooks,
    enabled: starting === 'export',
  });

  const choices = (notebooks.data ?? []).map((notebook) => ({
    id: notebook.id,
    name: notebook.name,
  }));

  // The first of the list unless another was chosen, so the dialog always has
  // an answer and the common case is one click.
  const chosen = notebookId || (choices[0]?.id ?? '');

  async function begin(carrying: Chosen | null): Promise<void> {
    if (!chosen) return;
    await startExport(chosen, carrying === null ? null : selectionOf(carrying));
    refresh();
    // The job is running; where it is watched is Transfers (#160).
    onClose();
  }

  return (
    <>
      <ExportChoice
        open={starting === 'export'}
        notebooks={choices}
        notebookId={chosen}
        onChooseNotebook={setNotebookId}
        onConfirm={(carrying) => void begin(carrying)}
        onClose={onClose}
      />
      <ImportDialog open={starting === 'import'} onClose={onClose} />
    </>
  );
}
