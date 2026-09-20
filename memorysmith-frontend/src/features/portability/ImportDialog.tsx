import { useRef, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NotebookDocument, TransferDto } from '@memorysmith/contracts';
import { applyImport, listNotebooks, prepareImport } from '../../shared/api/source';
import { ArchiveError, readNotebookArchive } from './notebook-archive';
import { TransferChooser, type ChooserTab, type Preset } from './TransferChooser';
import { TransferDialog } from './TransferDialog';
import {
  countsOf,
  danglingLinks,
  effectiveOf,
  pickedNothing,
  seedOf,
  selectionOf,
  treeOf,
  twinNames,
  wholeScope,
  type DocumentTree,
  type Picked,
  type Scope,
} from './import-selection';
import { useRefreshTransfers } from './transfers';
import { queryKeys } from '../../shared/api/query-keys';

/**
 * What an import writes, asked in the dialog both sides share (#160).
 *
 * It was a page of its own while an export was a dialog, so the same job was
 * asked for in two shapes. It is the same dialog now, and what it gained by
 * losing the page is where it ends: **the decision is here and the following is
 * Transfers**, which already shows what is running, what it wrote and how to
 * open it. Nothing is watched twice.
 *
 * The document is read in the BROWSER before a byte is uploaded (#143), so the
 * name, the refusals and the tree are all answered before anything leaves the
 * machine. The name comes from the document and not from the file, because a
 * subscription holds each notebook name once (RN-KNW-032).
 */
export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  /** The field the name is typed in, which a refusal sends the person back to. */
  const nameField = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [document, setDocument] = useState<NotebookDocument | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [preset, setPreset] = useState<Preset>('everything');
  const [scope, setScope] = useState<Scope>(wholeScope);
  const [picked, setPicked] = useState<Picked>(pickedNothing);
  const [filter, setFilter] = useState('');
  const [tab, setTab] = useState<ChooserTab>('context');
  const [starting, setStarting] = useState(false);

  const notebooks = useQuery({
    queryKey: queryKeys.notebooks(),
    queryFn: listNotebooks,
    enabled: open,
  });
  const refresh = useRefreshTransfers();

  const tree: DocumentTree | null = useMemo(() => (document ? treeOf(document) : null), [document]);
  /**
   * What travels, out of the scope and what was ticked under it (#161). It is
   * derived and never stored, so unticking a folder takes its notes out of the
   * transfer in the same instant it takes them out of the tab that offered them.
   */
  const chosen = useMemo(
    () => (tree ? effectiveOf(tree, scope, picked) : null),
    [tree, scope, picked],
  );

  async function choose(chosenFile: File): Promise<void> {
    setRefusal(null);
    setFile(chosenFile);
    try {
      const read = await readNotebookArchive(chosenFile);
      setDocument(read);
      setName(read.notebook.name);
      setPreset('everything');
      setScope(wholeScope);
      setPicked(pickedNothing);
    } catch (error) {
      setDocument(null);
      setRefusal(error instanceof ArchiveError ? error.refusal : 'BAD_FORMAT');
    }
  }

  const taken = (notebooks.data ?? []).some(
    (notebook) => notebook.name.trim().toLowerCase() === name.trim().toLowerCase(),
  );
  const counts = tree && chosen ? countsOf(tree, chosen) : null;
  const twins = document && chosen ? twinNames(document, chosen) : [];
  const dangling = document && chosen ? danglingLinks(document, chosen) : 0;
  const ready =
    document !== null && name.trim().length > 0 && !taken && twins.length === 0 && !starting;

  async function begin(): Promise<void> {
    if (!file || !document) return;
    setStarting(true);
    setRefusal(null);
    try {
      const prepared = await prepareImport();
      const uploaded = await fetch(prepared.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': 'application/zip' },
      });
      if (!uploaded.ok) throw new Error('upload');

      const transfer: TransferDto = await applyImport(
        prepared.uploadKey,
        name.trim(),
        preset === 'choose' && chosen ? selectionOf(chosen) : null,
        // What the person calls this file: the upload is addressed by an
        // identifier, which says nothing to anybody reading Transfers later.
        file.name,
      );
      void transfer;
      refresh();
      // The job is running; where it is watched is Transfers (#160).
      reset();
      onClose();
    } catch {
      setRefusal('UPLOAD');
    } finally {
      setStarting(false);
    }
  }

  /**
   * The whole notebook, or part of it. It is answered inside the chooser now,
   * so choosing the whole notebook no longer takes the chooser off the screen
   * — and the tab that says what refuses stays reachable either way (#161).
   */
  function choosePreset(next: Preset): void {
    setPreset(next);
    if (next === 'everything') {
      setScope(wholeScope);
      setPicked(pickedNothing);
    }
  }

  /** From the refusal to the tab that explains it, in one click (#161). */
  function showRefusals(): void {
    setTab('conflicts');
  }

  /** And from there back to the field that names the notebook. */
  function fixName(): void {
    nameField.current?.focus();
    nameField.current?.select();
  }

  /**
   * And from there into the tree, where one of the copies is let go.
   *
   * A tab of a species opens only when that species is being chosen ITEM BY
   * ITEM, so sending somebody to the notes means putting the chooser in the
   * state where a note can be unticked — otherwise it lands them back on the
   * scope, which is what it did.
   */
  function findNote(twin: string): void {
    if (!tree) return;
    setPreset('choose');
    setScope((current) => ({
      ...current,
      folders: true,
      notes: true,
      reach: { ...current.reach, notes: 'choose' },
    }));
    setPicked((current) =>
      current.notes.size === 0 ? { ...current, notes: seedOf(tree, 'notes') } : current,
    );
    setFilter(twin);
    setTab('notes');
  }

  function reset(): void {
    setFile(null);
    setDocument(null);
    setRefusal(null);
    setName('');
    setPreset('everything');
    setScope(wholeScope);
    setPicked(pickedNothing);
    setFilter('');
    setTab('context');
  }

  return (
    <TransferDialog
      open={open}
      title={t('portability.importHeading')}
      onClose={() => {
        reset();
        onClose();
      }}
      actions={
        <>
          {counts && (
            <p className="transfer-summary">
              {t('portability.willCreate', {
                folders: t('portability.countFolders', { count: counts.folders }),
                templates: t('portability.countTemplates', { count: counts.templates }),
                notes: t('portability.noteCount', { count: counts.notes }),
              })}
              {/* The files the archive carries. They are not part of the
                  selection — a file belongs to the notebook, not to a folder —
                  so they are said rather than chosen (RN-PRT-025). */}
              {(document?.files?.length ?? 0) > 0 &&
                ` · ${t('portability.countFiles', { count: document?.files?.length ?? 0 })}`}
              {dangling > 0 && ` · ${t('portability.danglingLinks', { count: dangling })}`}
              {(taken || twins.length > 0) && (
                <>
                  <br />
                  {/* The one line saying the import is refused, and it does not
                      grow with the number of refusals: what each one is, and
                      the way out of it, is in the tab this opens. It is also
                      what the name field points at, because the sentence that
                      used to sit under the field is in that tab now. */}
                  <span className="is-conflict" id="transfer-refusal">
                    {[
                      taken ? t('portability.nameTakenBlock') : null,
                      twins.length > 0
                        ? t('portability.twinsBlock', { count: twins.length })
                        : null,
                      t('portability.nothingImported'),
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  </span>{' '}
                  <button type="button" className="chooser-twins-open" onClick={showRefusals}>
                    {t('portability.showTwins')}
                  </button>
                </>
              )}
            </p>
          )}
          <button
            type="button"
            className="button is-quiet"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            {t('portability.cancel')}
          </button>
          <button
            type="button"
            className="button is-primary"
            disabled={!ready}
            onClick={() => void begin()}
          >
            {t('portability.import')}
          </button>
        </>
      }
    >
      <div
        className={document ? 'import-drop is-chosen' : 'import-drop'}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const dropped = event.dataTransfer.files[0];
          if (dropped) void choose(dropped);
        }}
      >
        <input
          ref={input}
          type="file"
          accept=".notebook,application/zip"
          hidden
          onChange={(event) => {
            const picked = event.target.files?.[0];
            event.target.value = '';
            if (picked) void choose(picked);
          }}
        />
        <button type="button" className="button is-quiet" onClick={() => input.current?.click()}>
          {t('portability.chooseFile')}
        </button>
        <span className="import-drop-hint">{file ? file.name : t('portability.dropHint')}</span>
      </div>

      {refusal && <p className="status">{t(`portability.refusal.${refusal}`)}</p>}

      {document && tree && (
        <>
          <div className="transfer-field">
            <label htmlFor="import-notebook-name">{t('portability.notebookName')}</label>
            {/* What is wrong with the name is said in the foot and in full in
                the tab of the refusals, and no longer in a line under the
                field, which moved the whole screen as it was typed (#161). */}
            <input
              ref={nameField}
              id="import-notebook-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={taken}
              aria-describedby={taken ? 'transfer-refusal' : undefined}
            />
          </div>

          {chosen && (
            <TransferChooser
              tree={tree}
              scope={scope}
              onScope={setScope}
              picked={picked}
              onPicked={setPicked}
              chosen={chosen}
              filter={filter}
              onFilter={setFilter}
              direction="import"
              tab={tab}
              onTab={setTab}
              preset={preset}
              onPreset={choosePreset}
              twins={twins}
              nameTaken={taken ? name.trim() : null}
              onFixName={fixName}
              onFindNote={findNote}
            />
          )}
        </>
      )}
    </TransferDialog>
  );
}
