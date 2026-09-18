import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NotebookDocument, TransferDto } from '@memorysmith/contracts';
import { applyImport, listNotebooks, prepareImport } from '../../shared/api/source';
import { notebookAddress } from '../../shared/api/note-address';
import { useDocumentTitle } from '../../shared/components/document-title';
import { ArchiveError, readNotebookArchive } from './notebook-archive';
import {
  countsOf,
  danglingLinks,
  everything,
  nothing,
  selectionOf,
  stateOf,
  treeOf,
  twinNames,
  withBranch,
  withNode,
  type Chosen,
  type DocumentTree,
  type TreeFolder,
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
            <>
              <label className="import-filter">
                <span className="visually-hidden">{t('portability.filter')}</span>
                <input
                  type="text"
                  value={filter}
                  placeholder={t('portability.filter')}
                  onChange={(event) => setFilter(event.target.value)}
                />
              </label>
              <ul className="import-tree" role="tree" aria-label={t('portability.whatToImport')}>
                {tree.guidance && (
                  <li role="none">
                    <div role="treeitem" aria-selected={chosen.guidance} className="import-row">
                      <label>
                        <input
                          type="checkbox"
                          checked={chosen.guidance}
                          onChange={(event) =>
                            change({ ...chosen, guidance: event.target.checked })
                          }
                        />
                        {t('portability.notebookGuidance')}
                      </label>
                    </div>
                  </li>
                )}
                {tree.historyEntries > 0 && (
                  <li role="none">
                    <div role="treeitem" aria-selected={chosen.history} className="import-row">
                      <label>
                        <input
                          type="checkbox"
                          checked={chosen.history}
                          onChange={(event) => change({ ...chosen, history: event.target.checked })}
                        />
                        {t('portability.history')}
                        <small>
                          {t('portability.historyEntries', { count: tree.historyEntries })}
                        </small>
                      </label>
                    </div>
                  </li>
                )}
                {tree.folders.map((folder) => (
                  <FolderRow
                    key={folder.id}
                    folder={folder}
                    chosen={chosen}
                    filter={filter.trim().toLowerCase()}
                    depth={0}
                    onChange={change}
                  />
                ))}
              </ul>
            </>
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

/**
 * One folder of the tree, with its Template and its notes.
 *
 * **A checkbox always takes the whole branch**, which is what everyone expects
 * of a tree; selecting only the node is the less common intent and lives in the
 * control beside it. Two checkboxes on one row would make every row ambiguous.
 *
 * A branch opens collapsed below the first level, so a tree of a thousand notes
 * draws a handful of rows until somebody asks for more.
 */
function FolderRow({
  folder,
  chosen,
  filter,
  depth,
  onChange,
}: {
  folder: TreeFolder;
  chosen: Chosen;
  filter: string;
  depth: number;
  onChange: (next: Chosen) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(depth === 0);
  const state = stateOf(chosen, folder);

  const matches = (text: string): boolean =>
    filter.length === 0 || text.toLowerCase().includes(filter);
  const notes = folder.notes.filter((note) => matches(note.name));
  const hidden =
    filter.length > 0 &&
    !matches(folder.name) &&
    notes.length === 0 &&
    folder.children.length === 0;
  if (hidden) return null;

  return (
    <li role="none">
      <div
        role="treeitem"
        aria-expanded={open}
        aria-checked={state === 'mixed' ? 'mixed' : state === 'on'}
        className="import-row"
        style={{ paddingInlineStart: `${depth}rem` }}
      >
        <button
          type="button"
          className="import-twisty"
          onClick={() => setOpen((current) => !current)}
          aria-label={open ? t('portability.collapse') : t('portability.expand')}
        >
          {open ? '▾' : '▸'}
        </button>
        <label>
          <input
            type="checkbox"
            checked={state === 'on'}
            ref={(node) => {
              if (node) node.indeterminate = state === 'mixed';
            }}
            onChange={(event) => onChange(withBranch(chosen, folder, event.target.checked))}
          />
          {folder.name}
        </label>
        <span className="import-row-count">
          {t('portability.noteCount', { count: folder.noteCount })}
        </span>
        {/* Only this node: a folder written as a path, or a Template without
            the notes under it (RN-PRT-017). */}
        <button
          type="button"
          className="import-only"
          onClick={() =>
            onChange(
              withNode(chosen, { kind: 'folder', id: folder.id }, !chosen.folders.has(folder.id)),
            )
          }
        >
          {t('portability.onlyThis')}
        </button>
      </div>

      {open && (
        <ul role="group">
          {folder.template && (
            <li role="none">
              <div
                role="treeitem"
                aria-selected={chosen.templates.has(folder.id)}
                className="import-row"
                style={{ paddingInlineStart: `${depth + 1}rem` }}
              >
                <label>
                  <input
                    type="checkbox"
                    checked={chosen.templates.has(folder.id)}
                    onChange={(event) =>
                      onChange(
                        withNode(chosen, { kind: 'template', id: folder.id }, event.target.checked),
                      )
                    }
                  />
                  {t('portability.folderTemplate')}
                </label>
              </div>
            </li>
          )}
          {folder.children.map((child) => (
            <FolderRow
              key={child.id}
              folder={child}
              chosen={chosen}
              filter={filter}
              depth={depth + 1}
              onChange={onChange}
            />
          ))}
          {notes.map((note) => (
            <li role="none" key={note.id}>
              <div
                role="treeitem"
                aria-selected={chosen.notes.has(note.id)}
                className="import-row"
                style={{ paddingInlineStart: `${depth + 1}rem` }}
              >
                <label>
                  <input
                    type="checkbox"
                    checked={chosen.notes.has(note.id)}
                    onChange={(event) =>
                      onChange(
                        withNode(chosen, { kind: 'note', id: note.id }, event.target.checked),
                      )
                    }
                  />
                  {note.name || t('note.unnamed')}
                </label>
              </div>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
