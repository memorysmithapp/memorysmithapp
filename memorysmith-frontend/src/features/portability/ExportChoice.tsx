import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getNotebookStructure } from '../../shared/api/source';
import { TransferChooser } from './TransferChooser';
import { everything, nothing, treeOfNotebook, type Chosen } from './import-selection';

/**
 * What goes in the archive, asked before an export starts (RN-PRT-022).
 *
 * An export used to be one click inside a notebook and nothing to decide. It
 * is started from Transfers now, from wherever the person is (#151), so it
 * asks WHICH notebook — among the ones they can see, because a listing must
 * never reveal one they cannot (rule 9).
 *
 * And it asks what goes in the archive, which is not a detail of the file:
 * **deleting a notebook takes its history with it** (RN-AUD-011), so an
 * archive that carries the history is the only place that history survives.
 * What it costs is said where it is chosen — a larger file, counted against
 * the storage of the plan — rather than discovered afterwards.
 *
 * It is a modal dialog for the reason the choice of a link is one (#144):
 * `showModal()` puts it in the top layer, which no ancestor can clip, and
 * brings the focus handling with it.
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
  const dialog = useRef<HTMLDialogElement>(null);
  const [preset, setPreset] = useState<'everything' | 'choose'>('everything');
  const [chosen, setChosen] = useState<Chosen>(nothing);
  const [filter, setFilter] = useState('');

  /**
   * The structure of the notebook, which is what an export chooses from: it
   * has no document yet, so the tree comes from the API (#156). Asked only
   * when somebody opens the chooser, and not when the dialog opens.
   */
  const structure = useQuery({
    queryKey: ['notebook-structure', notebookId],
    queryFn: () => getNotebookStructure(notebookId),
    enabled: open && preset === 'choose' && notebookId !== '',
  });
  const tree = structure.data ? treeOfNotebook(structure.data) : null;

  useEffect(() => {
    const node = dialog.current;
    if (!node || !open) return;
    if (!node.open) node.showModal();
    document.body.classList.add('has-modal');
    return () => document.body.classList.remove('has-modal');
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialog}
      className="export-choice"
      aria-labelledby="export-choice-heading"
      onClose={onClose}
      onClick={(event) => {
        // The backdrop is the dialog element itself outside its box.
        if (event.target === dialog.current) {
          dialog.current?.close();
        }
      }}
    >
      <div className="export-choice-box">
        <h2 id="export-choice-heading">{t('portability.exportHeading')}</h2>

        {notebooks.length === 0 ? (
          <p className="export-choice-what">{t('transfers.noNotebooks')}</p>
        ) : (
          <div className="export-choice-notebook">
            {/* The label is beside the control and not around it: a label that
                wraps a select takes the text of the chosen option into the
                name of the field, and the name of the field is what a person
                using a screen reader hears. */}
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

        <p className="export-choice-what">{t('portability.exportWhat')}</p>

        <div
          className="export-choice-presets"
          role="radiogroup"
          aria-label={t('portability.exportWhat')}
        >
          {(['everything', 'choose'] as const).map((each) => (
            <label key={each} className="export-choice-preset">
              <input
                type="radio"
                name="export-preset"
                checked={preset === each}
                onChange={() => {
                  setPreset(each);
                  // Choosing starts from everything, which is what somebody
                  // who opened it wants to take things OUT of.
                  if (each === 'choose' && tree) setChosen(everything(tree));
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
              chosen={chosen.folders.size === 0 && !chosen.guidance ? everything(tree) : chosen}
              onChange={setChosen}
              filter={filter}
              onFilter={setFilter}
            />
          ) : (
            <p className="export-choice-what">{t('common.loading')}</p>
          ))}

        <div className="export-choice-actions">
          <button type="button" className="button is-quiet" onClick={() => dialog.current?.close()}>
            {t('portability.cancel')}
          </button>
          <button
            type="button"
            className="button is-primary"
            disabled={notebooks.length === 0}
            onClick={() => {
              onConfirm(preset === 'choose' ? chosen : null);
              dialog.current?.close();
            }}
          >
            {t('portability.startExport')}
          </button>
        </div>
      </div>
    </dialog>
  );
}
