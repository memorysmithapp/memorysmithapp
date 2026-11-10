import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getNotebookFiles,
  getNotebookStructure,
  listDashboards,
  listTables,
} from '../../shared/api/source';
import {
  carriedTables,
  EVERY_TABLE,
  inconsistentDashboards,
  transferTablesOf,
  type TablesChoice,
} from './tables-choice';
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
import { RowsSkeleton } from '../../shared/components/skeletons';
import { SearchPicker } from '../../shared/components/SearchPicker';

/**
 * What an export carries, asked in the dialog both sides share (#160).
 *
 * An export is started from Transfers, from wherever the person is (#151), so
 * it asks WHICH notebook — among the ones they can see, because a listing must
 * never reveal one they cannot (INV-09).
 *
 * And it asks what goes in the archive, which is not a detail of the file:
 * **deleting a notebook takes its history with it** (RN-AUD-011), so an archive
 * that carries the history is the only place that history survives. The whole
 * notebook is one click and carries everything; choosing opens the chooser
 * (RN-PRT-024).
 */
/** What an archive carries, in words, leaving out what is zero. */
export function carriedParts(
  counts: {
    folders: number;
    templates: number;
    notes: number;
    files: number;
    tables?: number;
    dashboards?: number;
  },
  t: (key: string, values?: Record<string, unknown>) => string,
): string[] {
  return [
    counts.folders > 0 ? t('portability.countFolders', { count: counts.folders }) : null,
    counts.templates > 0 ? t('portability.countTemplates', { count: counts.templates }) : null,
    counts.notes > 0 ? t('portability.noteCount', { count: counts.notes }) : null,
    counts.files > 0 ? t('portability.countFiles', { count: counts.files }) : null,
    counts.tables ? t('portability.countTables', { count: counts.tables }) : null,
    counts.dashboards ? t('portability.countDashboards', { count: counts.dashboards }) : null,
  ].filter((part): part is string => part !== null);
}

/** What the archive carries of the tables and dashboards, as the API is told it (#399). */
export interface TablesCarriage {
  readonly tables?: Array<{ name: string; rows: boolean }>;
  readonly dashboards?: string[];
}

export function ExportChoice({
  open,
  notebooks,
  notebookId,
  onChooseNotebook,
  onConfirm,
  onClose,
}: {
  open: boolean;
  /**
   * The notebooks this person can see, which is what may be exported: their
   * own, and the ones shared with them, with whom (#432).
   */
  notebooks: ReadonlyArray<{ id: string; name: string; sharedBy?: string | null }>;
  /** The notebook chosen, or empty while the picker asks for one. */
  notebookId: string;
  onChooseNotebook: (notebookId: string) => void;
  /**
   * What the archive carries. `null` is the whole notebook (RN-PRT-024), and
   * nothing said of the tables is every table with its rows and every
   * dashboard (#366, #399).
   */
  onConfirm: (chosen: Chosen | null, carriage: TablesCarriage) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [preset, setPreset] = useState<Preset>('everything');
  const [scope, setScope] = useState<Scope>(wholeScope);
  const [picked, setPicked] = useState<Picked>(pickedNothing);
  const [filter, setFilter] = useState('');
  const [tab, setTab] = useState<ChooserTab>('context');
  const [tablesChoice, setTablesChoice] = useState<TablesChoice>(EVERY_TABLE);

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

  /** And its tables, each of which the archive carries with its rows, its schema or not at all (#366). */
  const tables = useQuery({
    queryKey: queryKeys.notebookTables(notebookId),
    queryFn: () => listTables(notebookId),
    enabled: open && notebookId !== '',
  });
  const offeredTables = (tables.data ?? []).map((table) => ({
    name: table.name,
    rows: table.rows,
  }));
  const dashboards = useQuery({
    queryKey: queryKeys.notebookDashboards(notebookId),
    queryFn: () => listDashboards(notebookId),
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

  const whole = preset === 'everything';
  const offeredDashboards = dashboards.data ?? [];
  const tablesNow = whole ? EVERY_TABLE : tablesChoice;
  const tableCounts = carriedTables(tablesNow, offeredTables, offeredDashboards);
  /** Dashboards chosen whose table stays out: the export waits until they are resolved (#399). */
  const broken = whole
    ? []
    : inconsistentDashboards(tablesChoice, offeredTables, offeredDashboards);
  const counts = tree && chosen ? { ...countsOf(tree, chosen), ...tableCounts } : null;

  return (
    <TransferDialog
      open={open}
      title={t('portability.exportHeading')}
      onClose={onClose}
      actions={
        <>
          {counts && (
            <p className="transfer-summary">
              {t('portability.carries')}{' '}
              {/* What goes, in numbers, and nothing that is zero (#205). The
                  files are named because they are most of what an archive
                  weighs: the summary that never named them is the whole of #176. */}
              <strong>{carriedParts(counts, t).join(' · ')}</strong>
            </p>
          )}
          {broken.length > 0 ? (
            <p className="transfer-summary is-wrong" role="alert">
              {t('portability.tables.blocked', { count: broken.length })}
            </p>
          ) : null}
          <button type="button" className="button is-quiet" onClick={onClose}>
            {t('portability.cancel')}
          </button>
          <button
            type="button"
            className="button is-primary"
            disabled={notebooks.length === 0 || notebookId === '' || broken.length > 0}
            onClick={() =>
              onConfirm(
                whole ? null : chosen,
                transferTablesOf(whole, tablesChoice, offeredTables, offeredDashboards),
              )
            }
          >
            {t('portability.startExport')}
          </button>
        </>
      }
    >
      {notebooks.length === 0 ? (
        <p className="status">{t('transfers.noNotebooks')}</p>
      ) : notebookId === '' ? (
        // Which notebook, found by typing part of its name, among the person's
        // own and the ones shared with them (#432).
        <SearchPicker
          label={t('portability.exportNotebook')}
          placeholder={t('portability.searchNotebooks')}
          sources={[
            {
              key: 'mine',
              label: t('newNotebook.origins.mine'),
              kind: 'local',
              items: notebooks.filter((notebook) => !notebook.sharedBy),
            },
            {
              key: 'shared',
              label: t('newNotebook.origins.shared'),
              kind: 'local',
              items: notebooks
                .filter((notebook) => notebook.sharedBy)
                .map((notebook) => ({ ...notebook, by: notebook.sharedBy ?? null })),
            },
          ]}
          onPick={(_origin, item) => onChooseNotebook(item.id)}
        />
      ) : (
        <div className="transfer-field export-chosen">
          <span className="field-label">{t('portability.exportNotebook')}</span>
          <strong>{notebooks.find((notebook) => notebook.id === notebookId)?.name}</strong>
          <button
            type="button"
            className="button is-quiet is-small"
            onClick={() => onChooseNotebook('')}
          >
            {t('newNotebook.chooseAnother')}
          </button>
        </div>
      )}

      {notebooks.length > 0 &&
        notebookId !== '' &&
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
            tablesOffer={{
              tables: offeredTables,
              dashboards: offeredDashboards,
              choice: tablesChoice,
              onChoice: setTablesChoice,
            }}
            onPreset={(next) => {
              setPreset(next);
              if (next === 'everything') {
                setScope(wholeScope);
                setPicked(pickedNothing);
              }
            }}
          />
        ) : (
          <RowsSkeleton />
        ))}
    </TransferDialog>
  );
}
