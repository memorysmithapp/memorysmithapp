import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getNotebookStructure } from '../../shared/api/source';
import { TransferChooser } from './TransferChooser';
import { TransferDialog } from './TransferDialog';
import {
  countsOf,
  effectiveOf,
  pickedNothing,
  treeOfNotebook,
  wholeScope,
  type Chosen,
  type Picked,
  type Scope,
} from './import-selection';

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
  const [scope, setScope] = useState<Scope>(wholeScope);
  const [picked, setPicked] = useState<Picked>(pickedNothing);
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
   * What travels, out of the scope and what was ticked under it (#161).
   *
   * It is DERIVED, and the scope it is derived from opens at everything: a
   * selection held as state could not be unticked — letting the Guidance go
   * emptied it, which made the expression answer `everything` again, which
   * ticked it back — and a scope has no such fixed point, because `all` and
   * `choose` are stored rather than inferred from what is in the set.
   */
  const chosen: Chosen | null = useMemo(
    () => (tree ? effectiveOf(tree, scope, picked) : null),
    [tree, scope, picked],
  );

  const counts = tree && chosen ? countsOf(tree, chosen) : null;

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
                folders: t('portability.countFolders', { count: counts.folders }),
                templates: t('portability.countTemplates', { count: counts.templates }),
                notes: t('portability.noteCount', { count: counts.notes }),
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
                if (each === 'everything') {
                  setScope(wholeScope);
                  setPicked(pickedNothing);
                }
              }}
            />
            <span>
              <strong>{t(`portability.preset.${each}`)}</strong>
              {each === 'everything' && preset === 'everything' && (
                <small>{t('portability.wholeNotebookHint')}</small>
              )}
            </span>
          </label>
        ))}
      </div>

      {preset === 'choose' &&
        (tree && chosen ? (
          <TransferChooser
            tree={tree}
            scope={scope}
            onScope={setScope}
            picked={picked}
            onPicked={setPicked}
            chosen={chosen}
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
