import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NotebookDocument, TransferDto } from '@memorysmith/contracts';
import { applyImport, listNotebooks, prepareImport } from '../../shared/api/source';
import { TransferChooser } from './TransferChooser';
import { notebookAddress } from '../../shared/api/note-address';
import { useDocumentTitle } from '../../shared/components/document-title';
import { ArchiveError, readNotebookArchive } from './notebook-archive';
import {
  countsOf,
  danglingLinks,
  everything,
  nothing,
  selectionOf,
  treeOf,
  twinNames,
  type Chosen,
  type DocumentTree,
} from './import-selection';
import { useRefreshTransfers, useTransfers } from './transfers';

/**
 * Two, and there used to be three. `Structure only` went with the cycle that
 * made the history an item: the Guidance and the Template of each folder are
 * rows of the tree, ticked on their own, so the preset was a selection anybody
 * can make by hand — and a third button that only sometimes meant what it said
 * costs more than it saves (RN-PRT-017).
 */
type Preset = 'everything' | 'choose';

/**
 * Importing a notebook: a page of three steps and an end (#143, RN-PRT-017,
 * RN-PRT-018).
 *
 * It was one button that took a file and either navigated away or turned into
 * an error message, which is not enough for what an import is. Nobody saw what
 * was about to be created; the name was the name of the FILE, so exporting a
 * notebook and importing it back — the most natural test of a backup — hit a
 * name already taken; it was all or nothing, though a notebook is often wanted
 * for its design alone; and a large notebook could not be imported at all,
 * because the whole thing ran inside one request.
 *
 * A page rather than a dialog, because the tree of a real notebook is long and
 * has to work at phone width.
 */
export function ImportNotebookPage() {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [document, setDocument] = useState<NotebookDocument | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [preset, setPreset] = useState<Preset>('everything');
  const [chosen, setChosen] = useState<Chosen>(nothing);
  const [filter, setFilter] = useState('');
  const [started, setStarted] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useDocumentTitle(t('portability.importHeading'));
  const notebooks = useQuery({ queryKey: ['notebooks'], queryFn: listNotebooks });
  const { data: transfers } = useTransfers();
  const refresh = useRefreshTransfers();

  const tree: DocumentTree | null = useMemo(() => (document ? treeOf(document) : null), [document]);
  const running = transfers?.transfers.find((each) => each.transferId === started);

  async function choose(chosenFile: File): Promise<void> {
    setRefusal(null);
    setFile(chosenFile);
    try {
      const read = await readNotebookArchive(chosenFile);
      const built = treeOf(read);
      setDocument(read);
      // The name comes from the DOCUMENT and not from the file, and it may be
      // changed: a subscription holds each notebook name once (RN-KNW-032).
      setName(read.notebook.name);
      setPreset('everything');
      setChosen(everything(built));
    } catch (error) {
      setDocument(null);
      setRefusal(error instanceof ArchiveError ? error.refusal : 'BAD_FORMAT');
    }
  }

  function usePreset(next: Preset): void {
    setPreset(next);
    if (!tree) return;
    if (next === 'everything') setChosen(everything(tree));
  }

  /** Changing anything in the tree switches the preset to it by itself. */
  function change(next: Chosen): void {
    setPreset('choose');
    setChosen(next);
  }

  const taken = (notebooks.data ?? []).some(
    (notebook) => notebook.name.trim().toLowerCase() === name.trim().toLowerCase(),
  );
  const counts = tree ? countsOf(tree, chosen) : null;
  const twins = document ? twinNames(document, chosen) : [];
  const dangling = document ? danglingLinks(document, chosen) : 0;
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
        selectionOf(chosen),
        // What the person calls this file: the upload is addressed by an
        // identifier, which says nothing to anybody reading Transfers later.
        file.name,
      );
      setStarted(transfer.transferId);
      refresh();
    } catch {
      setRefusal('UPLOAD');
    } finally {
      setStarting(false);
    }
  }

  // ---- the end ------------------------------------------------------------
  if (running && running.status !== 'running') {
    return (
      <section className="page import-page">
        <h1>{t('portability.importHeading')}</h1>
        {running.status === 'ready' ? (
          <>
            <p className="status">
              {t('portability.importDone', { name: running.notebookName, count: running.done })}
            </p>
            {running.notebookId && (
              <Link className="button is-primary" to={notebookAddress(running.notebookId)}>
                {t('portability.openNotebook')}
              </Link>
            )}
          </>
        ) : (
          <>
            <p className="status">{t(`portability.refusal.${running.failure ?? 'INTERNAL'}`)}</p>
            <p className="status">{t('portability.importKeptNothing')}</p>
            <button type="button" className="button is-quiet" onClick={() => setStarted(null)}>
              {t('portability.tryAgain')}
            </button>
          </>
        )}
      </section>
    );
  }

  // ---- step 3: importing ---------------------------------------------------
  if (running) {
    return (
      <section className="page import-page">
        <h1>{t('portability.importing', { name: running.notebookName })}</h1>
        <p className="status" aria-live="polite">
          {t('transfers.running.import', { done: running.done, total: running.total })}
        </p>
        <progress
          className="import-progress"
          value={running.total > 0 ? running.done / running.total : undefined}
          max={1}
        />
        <p className="status">{t('portability.importLeavePage')}</p>
        <Link className="button is-quiet" to="/transfers">
          {t('transfers.heading')}
        </Link>
      </section>
    );
  }

  // ---- steps 1 and 2 -------------------------------------------------------
  return (
    <section className="page import-page">
      <h1>{t('portability.importHeading')}</h1>

      <div
        className="import-drop"
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
          <label className="import-name">
            <span>{t('portability.notebookName')}</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={taken}
            />
          </label>
          {taken && <p className="status">{t('portability.nameTaken', { name })}</p>}

          <div
            className="import-presets"
            role="radiogroup"
            aria-label={t('portability.whatToImport')}
          >
            {(['everything', 'choose'] as const).map((each) => (
              <label key={each} className="import-preset">
                <input
                  type="radio"
                  name="import-preset"
                  checked={preset === each}
                  onChange={() => usePreset(each)}
                />
                {t(`portability.preset.${each}`)}
              </label>
            ))}
          </div>

          {preset === 'choose' && (
            <TransferChooser
              tree={tree}
              chosen={chosen}
              onChange={change}
              filter={filter}
              onFilter={setFilter}
            />
          )}

          <footer className="import-summary" aria-live="polite">
            <p>
              {t('portability.willCreate', {
                folders: counts?.folders ?? 0,
                templates: counts?.templates ?? 0,
                notes: counts?.notes ?? 0,
              })}
              {counts?.guidance ? ` · ${t('portability.notebookGuidance')}` : ''}
            </p>
            {dangling > 0 && <p>{t('portability.danglingLinks', { count: dangling })}</p>}
            {twins.map((twin) => (
              <p key={`${twin.folderId}-${twin.name}`} className="import-conflict">
                {t('portability.twinNames', { name: twin.name })}
              </p>
            ))}
            <button
              type="button"
              className="button is-primary"
              disabled={!ready}
              onClick={() => void begin()}
            >
              {t('portability.import')}
            </button>
          </footer>
        </>
      )}
    </section>
  );
}
