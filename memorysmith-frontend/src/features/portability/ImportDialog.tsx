import { useEffect, useRef, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NotebookDocument, TransferDto } from '@memorysmith/contracts';
import {
  applyImport,
  downloadTransfer,
  importFromExport,
  listNotebooks,
  prepareImport,
} from '../../shared/api/source';
import { Segmented } from '../../shared/components/Segmented';
import { ArchiveError, readNotebookArchive } from './notebook-archive';
import { TransferChooser, type ChooserTab, type Preset } from './TransferChooser';
import { TransferDialog } from './TransferDialog';
import { carriedParts } from './ExportChoice';
import { formatBytes } from '../../shared/components/StorageBar';
import { intlLocale } from '../../i18n/intl-locale';
import { FileIcon } from '../../shared/components/icons';
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
import { useRefreshTransfers, useTransfers } from './transfers';
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
/** Where the archive comes from: the machine, or the exports the subscription keeps (#207). */
type Source = 'file' | 'kept';

export function ImportDialog({
  open,
  onClose,
  exportId,
}: {
  open: boolean;
  onClose: () => void;
  /** A kept export to import, when the dialog was opened from its row (#207). */
  exportId?: string | undefined;
}) {
  const { t, i18n } = useTranslation();
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
  const [source, setSource] = useState<Source>('file');
  /** The kept export the document was read from, which the import copies server-side. */
  const [keptId, setKeptId] = useState<string | null>(null);
  const [loadingKept, setLoadingKept] = useState(false);
  const transfers = useTransfers(open);
  /** The requester's own ready exports: nobody else's is offered (RN-PRT-020). */
  const kept = (transfers.data?.transfers ?? []).filter(
    (transfer) => transfer.kind === 'export' && transfer.status === 'ready',
  );

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

  /**
   * A kept export is read in the browser exactly as a file on the machine is,
   * from the link its download mints, so the name, the chooser and the
   * inconsistencies work the same (RN-PRT-017). Its bytes are NOT sent back
   * up: the import asks the server to copy them (#207).
   */
  async function chooseKept(transferId: string): Promise<void> {
    const transfer = kept.find((each) => each.transferId === transferId);
    if (!transfer) return;
    // The choice stays on the list whatever the reading answers, so a failure
    // says which export it was about.
    setKeptId(transferId);
    setLoadingKept(true);
    setRefusal(null);
    try {
      const link = await downloadTransfer(transferId);
      const answer = await fetch(link.downloadUrl);
      if (!answer.ok) throw new Error('download');
      const blob = await answer.blob();
      const named = transfer.fileName ?? `${transfer.notebookName}.notebook`;
      await choose(new File([blob], named, { type: 'application/zip' }));
    } catch {
      setFile(null);
      setDocument(null);
      setRefusal('KEPT_UNREADABLE');
    } finally {
      setLoadingKept(false);
    }
  }

  // Opened from the row of a kept export, the dialog starts on it.
  useEffect(() => {
    if (!open || !exportId || keptId === exportId || loadingKept) return;
    if (!kept.some((each) => each.transferId === exportId)) return;
    setSource('kept');
    void chooseKept(exportId);
    // Once per opening, when the list has it.
  }, [open, exportId, kept.length]);

  /** An archive read and in hand, whichever way it came (#222). */
  const inHand = document !== null && file !== null;

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
      let uploadKey: string;
      if (source === 'kept' && keptId) {
        // Copied where it is kept, so nothing leaves the device (#207).
        uploadKey = (await importFromExport(keptId)).uploadKey;
      } else {
        const prepared = await prepareImport();
        const uploaded = await fetch(prepared.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': 'application/zip' },
        });
        if (!uploaded.ok) throw new Error('upload');
        uploadKey = prepared.uploadKey;
      }

      const transfer: TransferDto = await applyImport(
        uploadKey,
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

  /** Back to the choice of an archive, on the same source, with nothing read. */
  function startOver(): void {
    setFile(null);
    setDocument(null);
    setKeptId(null);
    setRefusal(null);
  }

  function reset(): void {
    setSource('file');
    setKeptId(null);
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
          {refusal ? (
            /* An archive that could not be read is said in the same line of the
               foot as every other refusal, never in the body of the dialog: the
               body is what is being chosen, and the foot is what stops it
               (#161, #207). */
            <p className="transfer-summary">
              <span className="transfer-refused" id="transfer-refusal" role="alert">
                {t(`portability.refusal.${refusal}`)}
              </span>
            </p>
          ) : (
            counts && (
              <p className="transfer-summary">
                {taken || twins.length > 0 ? (
                  /* The one line saying the import is refused, and it does not
                   grow with the number of refusals: what each one is, and the
                   way out of it, is in the tab of the inconsistencies (#205). */
                  <span className="transfer-refused" id="transfer-refusal">
                    {t('portability.refusals', { count: twins.length + (taken ? 1 : 0) })}
                  </span>
                ) : (
                  <>
                    {t('portability.creates')}{' '}
                    {/* The files the import will keep, which is what was CHOSEN
                      and no longer what the archive happens to hold (#176). */}
                    <strong>
                      {[t('portability.oneNotebook'), ...carriedParts(counts, t)].join(' · ')}
                    </strong>
                    {dangling > 0 && ` · ${t('portability.danglingLinks', { count: dangling })}`}
                  </>
                )}
              </p>
            )
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
      {/* Where the archive comes from is asked until there is one; then the
          dialog holds the archive read and the way to choose another (#222). */}
      {!inHand && (
        <Segmented
          label={t('portability.source.label')}
          value={source}
          onChange={(next: Source) => {
            if (next === source) return;
            setSource(next);
            setKeptId(null);
            setFile(null);
            setDocument(null);
            setRefusal(null);
          }}
          options={(['file', 'kept'] as const).map((each) => ({
            value: each,
            label: t(`portability.source.${each}`),
          }))}
        />
      )}

      {!inHand && source === 'kept' && (
        <div className="transfer-field">
          <label htmlFor="import-kept">{t('portability.source.which')}</label>
          {kept.length === 0 ? (
            <p className="hint">{t('portability.source.none')}</p>
          ) : (
            <select
              id="import-kept"
              value={keptId ?? ''}
              disabled={loadingKept}
              onChange={(event) => void chooseKept(event.target.value)}
            >
              <option value="" disabled>
                {t('portability.source.pick')}
              </option>
              {kept.map((each) => (
                <option key={each.transferId} value={each.transferId}>
                  {each.notebookName} · {new Date(each.requestedAt).toLocaleDateString()}
                </option>
              ))}
            </select>
          )}
          {loadingKept && <span className="field-hint">{t('portability.source.reading')}</span>}
        </div>
      )}

      {(source === 'file' || inHand) && (
        <div
          className={document && file ? 'import-drop is-chosen' : 'import-drop'}
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
          {document && file ? (
            /* The file already read, as a card: what it is, what it holds, and
             the way to choose another (#205). */
            <>
              <span className="import-file-icon" aria-hidden="true">
                <FileIcon />
              </span>
              <span className="import-file-body">
                <strong>{file.name}</strong>
                <span>
                  {[
                    formatBytes(file.size, intlLocale(i18n.language)),
                    t('portability.readInBrowser'),
                    t('portability.countFolders', { count: document.folders.length }),
                    t('portability.noteCount', { count: document.notes.length }),
                    ...((document.files?.length ?? 0) > 0
                      ? [t('portability.countFiles', { count: document.files?.length ?? 0 })]
                      : []),
                  ].join(' · ')}
                </span>
              </span>
              {/* Choosing another goes back to where the choice is made,
                  from the device or from the kept exports alike. */}
              <button type="button" className="button is-quiet is-small" onClick={startOver}>
                {t('portability.changeFile')}
              </button>
            </>
          ) : (
            <>
              <span className="import-drop-hint">
                {file ? file.name : t('portability.dropHint')}
              </span>
              <button
                type="button"
                className="button is-quiet"
                onClick={() => input.current?.click()}
              >
                {t('portability.chooseFile')}
              </button>
            </>
          )}
        </div>
      )}

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
