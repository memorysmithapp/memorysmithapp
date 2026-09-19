import { useRef, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NotebookDocument, TransferDto } from '@memorysmith/contracts';
import { applyImport, listNotebooks, prepareImport } from '../../shared/api/source';
import { ArchiveError, readNotebookArchive } from './notebook-archive';
import { TransferChooser } from './TransferChooser';
import { TransferDialog } from './TransferDialog';
import {
  countsOf,
  danglingLinks,
  effectiveOf,
  pickedNothing,
  selectionOf,
  treeOf,
  twinNames,
  wholeScope,
  type DocumentTree,
  type Picked,
  type Scope,
} from './import-selection';
import { useRefreshTransfers } from './transfers';

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
  const [file, setFile] = useState<File | null>(null);
  const [document, setDocument] = useState<NotebookDocument | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [preset, setPreset] = useState<'everything' | 'choose'>('everything');
  const [scope, setScope] = useState<Scope>(wholeScope);
  const [picked, setPicked] = useState<Picked>(pickedNothing);
  const [filter, setFilter] = useState('');
  const [starting, setStarting] = useState(false);

  const notebooks = useQuery({ queryKey: ['notebooks'], queryFn: listNotebooks, enabled: open });
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

  function reset(): void {
    setFile(null);
    setDocument(null);
    setRefusal(null);
    setName('');
    setPreset('everything');
    setScope(wholeScope);
    setPicked(pickedNothing);
    setFilter('');
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
              {dangling > 0 && ` · ${t('portability.danglingLinks', { count: dangling })}`}
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
          <div className="transfer-field">
            <label htmlFor="import-notebook-name">{t('portability.notebookName')}</label>
            <input
              id="import-notebook-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={taken}
            />
          </div>
          {taken && <p className="status">{t('portability.nameTaken', { name })}</p>}

          <div
            className="transfer-presets"
            role="radiogroup"
            aria-label={t('portability.whatToCarry.import')}
          >
            {(['everything', 'choose'] as const).map((each) => (
              <label key={each} className="transfer-preset">
                <input
                  type="radio"
                  name="import-preset"
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

          {preset === 'choose' && chosen && (
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
            />
          )}

          {twins.map((twin) => (
            <p key={`${twin.folderId}-${twin.name}`} className="status is-conflict">
              {t('portability.twinNames', { name: twin.name })}
            </p>
          ))}
        </>
      )}
    </TransferDialog>
  );
}
