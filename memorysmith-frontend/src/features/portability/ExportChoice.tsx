import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getNotebookStructure } from '../../shared/api/source';
import { TransferChooser } from './TransferChooser';
import { TransferDialog } from './TransferDialog';
import { countsOf, everything, nothing, treeOfNotebook, type Chosen } from './import-selection';

/**
 * What an export carries, asked in the dialog both sides share (#160).
 *
 * An export is started from Transfers, from wherever the person is (#151), so
 * it asks WHICH notebook — among the ones they can see, because a listing must
 * never reveal one they cannot (rule 9).
 *
 * And it asks what goes in the archive, which is not a detail of the file:
 * **deleting a notebook takes its history with it** (RN-AUD-011), so an archive
 * that carries the history is the only place that history survives. The whole
 * notebook is one click and carries everything; choosing opens the chooser
 * (RN-PRT-024).
 */
export function ExportChoice({
  open,
  notebooks,
  notebookId,
  onChooseNotebook,
  onConfirm,
  onClose,
}: {
  open: boolean;
  /** The notebooks this person can see, which is what may be exported. */
  notebooks: ReadonlyArray<{ id: string; name: string }>;
  notebookId: string;
  onChooseNotebook: (notebookId: string) => void;
  /** What the archive carries. `null` is the whole notebook (RN-PRT-024). */
  onConfirm: (chosen: Chosen | null) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [preset, setPreset] = useState<'everything' | 'choose'>('everything');
  const [chosen, setChosen] = useState<Chosen>(nothing);
  const [filter, setFilter] = useState('');

  /**
   * The structure of the notebook, which is what an export chooses from: it has
   * no document yet, so the tree comes from the API (#156). Asked when somebody
   * opens the chooser, and not when the dialog opens.
   */
  const structure = useQuery({
    queryKey: ['notebook-structure', notebookId],
    queryFn: () => getNotebookStructure(notebookId),
    enabled: open && preset === 'choose' && notebookId !== '',
  });
  const tree = structure.data ? treeOfNotebook(structure.data) : null;

  /**
   * Choosing starts from everything, which is what somebody who opened the
   * chooser wants to take things OUT of — and it is set ONCE, when the tree
   * arrives, because the tree is fetched only after the choice is made.
   *
   * It used to be derived at render, and a derived selection cannot be
   * unticked: letting the Guidance go emptied the selection, which made the
   * expression answer `everything` again, which ticked it back.
   */
  const [started, setStarted] = useState('');
  useEffect(() => {
    if (!tree || preset !== 'choose' || started === notebookId) return;
    setStarted(notebookId);
    setChosen(everything(tree));
  }, [tree, preset, notebookId, started]);

  const counts = tree ? countsOf(tree, chosen) : null;

  return (
    <TransferDialog
      open={open}
      title={t('portability.exportHeading')}
      onClose={onClose}
      actions={
        <>
          {preset === 'choose' && counts && (
            <p className="transfer-summary">
              {t('portability.willCarry', {
                folders: counts.folders,
                templates: counts.templates,
                notes: counts.notes,
              })}
            </p>
          )}
          <button type="button" className="button is-quiet" onClick={onClose}>
            {t('portability.cancel')}
          </button>
          <button
            type="button"
            className="button is-primary"
            disabled={notebooks.length === 0}
            onClick={() => onConfirm(preset === 'choose' ? chosen : null)}
          >
            {t('portability.startExport')}
          </button>
        </>
      }
    >
      {notebooks.length === 0 ? (
        <p className="status">{t('transfers.noNotebooks')}</p>
      ) : (
        <div className="transfer-field">
          {/* The label is beside the control and not around it: a label that
              wraps a select takes the text of the chosen option into the name
              of the field, which is what a screen reader announces. */}
          <label htmlFor="export-choice-notebook">{t('portability.exportNotebook')}</label>
          <select
            id="export-choice-notebook"
            value={notebookId}
            onChange={(event) => onChooseNotebook(event.target.value)}
          >
            {notebooks.map((notebook) => (
              <option key={notebook.id} value={notebook.id}>
                {notebook.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="transfer-presets" role="radiogroup" aria-label={t('portability.exportWhat')}>
        {(['everything', 'choose'] as const).map((each) => (
          <label key={each} className="transfer-preset">
            <input
              type="radio"
              name="export-preset"
              checked={preset === each}
              onChange={() => {
                setPreset(each);
                if (each === 'everything') setStarted('');
              }}
            />
            <span>
              <strong>{t(`portability.preset.${each}`)}</strong>
              {each === 'everything' && <small>{t('portability.wholeNotebookHint')}</small>}
            </span>
          </label>
        ))}
      </div>

      {preset === 'choose' &&
        (tree ? (
          <TransferChooser
            tree={tree}
            chosen={chosen}
            onChange={setChosen}
            filter={filter}
            onFilter={setFilter}
            direction="export"
          />
        ) : (
          <p className="status">{t('common.loading')}</p>
        ))}
    </TransferDialog>
  );
}
