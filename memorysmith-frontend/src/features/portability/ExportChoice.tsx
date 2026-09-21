import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getNotebookFiles, getNotebookStructure } from '../../shared/api/source';
import { TransferChooser, type ChooserTab, type Preset } from './TransferChooser';
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
import { queryKeys } from '../../shared/api/query-keys';

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
  const [preset, setPreset] = useState<Preset>('everything');
  const [scope, setScope] = useState<Scope>(wholeScope);
  const [picked, setPicked] = useState<Picked>(pickedNothing);
  const [filter, setFilter] = useState('');
  const [tab, setTab] = useState<ChooserTab>('context');

  /**
   * The structure of the notebook, which is what an export chooses from: it has
   * no document yet, so the tree comes from the API (#156).
   *
   * Asked when the dialog opens, because the chooser is on the screen whichever
   * the answer to *the whole notebook or part of it* is: that question is the
   * head of its first tab now, and the five rows under it are what the whole
   * notebook MEANS for this notebook, in numbers (#161).
   */
  const structure = useQuery({
    queryKey: queryKeys.notebookStructure(notebookId),
    queryFn: () => getNotebookStructure(notebookId),
    enabled: open && notebookId !== '',
  });

  /**
   * And the files it keeps, which are a species of the selection like any
   * other (#176). They are not part of the structure: a file belongs to the
   * notebook rather than to a folder, so it arrives in a call of its own.
   *
   * It is the SAME query the notebook page runs, under the same key and
   * answering the same shape. It answered a count there and a list here for
   * one afternoon, and what react-query holds under a key is whatever was
   * written to it first: this dialog read the count and asked it for files.
   */
  const files = useQuery({
    queryKey: queryKeys.notebookFiles(notebookId),
    queryFn: () => getNotebookFiles(notebookId),
    enabled: open && notebookId !== '',
  });

  const tree =
    structure.data && files.data ? treeOfNotebook({ ...structure.data, files: files.data }) : null;

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
          {counts && (
            <p className="transfer-summary">
              {t('portability.willCarry', {
                folders: t('portability.countFolders', { count: counts.folders }),
                templates: t('portability.countTemplates', { count: counts.templates }),
                notes: t('portability.noteCount', { count: counts.notes }),
              })}
              {/* And the files, which are most of what an archive weighs: the
                  summary that never named them is the whole of #176. */}
              {counts.files > 0 && ` · ${t('portability.countFiles', { count: counts.files })}`}
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

      {notebooks.length > 0 &&
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
            tab={tab}
            onTab={setTab}
            preset={preset}
            onPreset={(next) => {
              setPreset(next);
              if (next === 'everything') {
                setScope(wholeScope);
                setPicked(pickedNothing);
              }
            }}
          />
        ) : (
          <p className="status">{t('common.loading')}</p>
        ))}
    </TransferDialog>
  );
}
