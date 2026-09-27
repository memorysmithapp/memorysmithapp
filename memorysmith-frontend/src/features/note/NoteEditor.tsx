import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { NOTE_MESSAGE_MAX_LENGTH } from '@memorysmith/contracts';
import { noteNameOf } from '../../shared/api/markdown';
import { notesReaching } from '../../shared/api/source';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { queryKeys } from '../../shared/api/query-keys';
import { Modal } from '../../shared/components/Modal';
import { AttachRefusal, attachFile, insertAt, referenceOf } from './attach';
import { ATTACH_PORTS } from './attach-ports';

export interface EditOutcome {
  readonly content: string;
  readonly message: string;
  /** The old name, kept as an alias, when the person asked for it. */
  readonly keepAlias: boolean;
}

/**
 * Writing a note from the interface (#169, RN-KNW-052).
 *
 * The text area holds WHAT WAS TYPED, not what is drawn: the frontmatter
 * included, the wikilinks unresolved, the embeds unexpanded. The reading
 * surface resolves and expands, and writing back what it shows would hand the
 * notebook a document nobody wrote.
 *
 * There is no toolbar and no split preview. The notation of this product is a
 * published specification, and a toolbar teaches a second one beside it;
 * confirming and reading is the preview, and it costs one click.
 *
 * *Anexar arquivo* is not a toolbar: it teaches no notation, it keeps a file
 * and writes the one reference the specification already has, `![[name]]`,
 * where the cursor is (#242, RN-KNW-054). The file is kept at once, whole, and
 * stays in the notebook whether or not this edit is written. It is chosen from
 * the disk, dragged onto the text, or pasted into it — a screenshot has no file
 * to choose (#253, RN-KNW-055).
 */
export function NoteEditor({
  initial,
  currentName,
  notebookId,
  busy,
  onCancel,
  onConfirm,
  onDirty,
}: {
  initial: string;
  currentName: string | null;
  notebookId: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (outcome: EditOutcome) => void;
  /** Whether there is typing to lose, which the page guards the router with. */
  onDirty: (dirty: boolean) => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(initial);
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState('');
  const [keepAlias, setKeepAlias] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const client = useQueryClient();
  /** Where an attachment is: sending its parts, done, or what went wrong. */
  const [attaching, setAttaching] = useState<
    | { phase: 'hashing' }
    | { phase: 'sending'; sent: number; total: number }
    | { phase: 'done'; name: string }
    | { phase: 'failed'; message: string }
    | null
  >(null);
  const sending = attaching?.phase === 'hashing' || attaching?.phase === 'sending';

  async function attach(file: File): Promise<void> {
    const at = area.current?.selectionStart ?? text.length;
    setAttaching({ phase: 'hashing' });
    try {
      const kept = await attachFile(
        ATTACH_PORTS,
        {
          notebookId,
          file,
          purpose: currentName
            ? t('editor.attachPurpose', { note: currentName })
            : t('editor.attachPurposeUnnamed'),
        },
        (sent, total) => setAttaching({ phase: 'sending', sent, total }),
      );
      const next = insertAt(text, at, referenceOf(kept.name));
      setText(next.text);
      setAttaching({ phase: 'done', name: kept.name });
      // The note reaches the file by name: the list it resolves names from is
      // read again, so the embed draws on the first read after the write.
      void client.invalidateQueries({ queryKey: queryKeys.notebookFiles(notebookId) });
      void client.invalidateQueries({ queryKey: queryKeys.subscriptionUsage() });
      requestAnimationFrame(() => {
        area.current?.focus();
        area.current?.setSelectionRange(next.cursor, next.cursor);
      });
    } catch (error) {
      setAttaching({
        phase: 'failed',
        message:
          error instanceof AttachRefusal
            ? t(`editor.attachRefusal.${error.reason}`)
            : t(messageKeyOf(error)),
      });
    }
  }

  const dirty = text !== initial;

  useEffect(() => {
    area.current?.focus();
  }, []);

  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);

  /**
   * Losing twenty minutes of typing to a misclicked link is the kind of loss
   * that never gets reported as a defect and never gets forgiven either. The
   * browser asks its own question here; leaving by a link inside the product
   * is guarded by the page, which owns the router.
   */
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const nextName = noteNameOf(text);
  const renamed = nextName !== currentName;
  /**
   * The two numbers a rename costs, both answered by the link index the page
   * already loaded: how many notes point at the old name and will go pending,
   * and how many pending links to the new one will resolve. Nothing rewrites
   * the other notes — the backend never touches the body of a note — so this
   * is the whole of what a rename does to a notebook.
   */
  const losing = renamed && currentName ? notesReaching(notebookId, currentName).length : 0;
  const gaining = renamed && nextName ? notesReaching(notebookId, nextName).length : 0;

  return (
    <div className="note-editor">
      <textarea
        ref={area}
        className="note-editor-area"
        value={text}
        spellCheck={false}
        onChange={(event) => setText(event.target.value)}
        aria-label={t('editor.area')}
        // A file pasted or dropped on the text is attached where it lands;
        // text pasted or dropped is left to the text area, as it always was.
        onPaste={(event) => {
          const pasted = event.clipboardData.files[0];
          if (!pasted || busy || sending) return;
          event.preventDefault();
          void attach(pasted);
        }}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes('Files')) event.preventDefault();
        }}
        onDrop={(event) => {
          const dropped = event.dataTransfer.files[0];
          if (!dropped || busy || sending) return;
          event.preventDefault();
          void attach(dropped);
        }}
      />

      <div className="note-editor-actions">
        <button
          type="button"
          className="button is-primary"
          disabled={!dirty || busy}
          onClick={() => setAsking(true)}
        >
          {t('editor.confirm')}
        </button>
        <button type="button" className="button" disabled={busy} onClick={onCancel}>
          {t('editor.cancel')}
        </button>
        <button
          type="button"
          className="button is-quiet note-editor-attach"
          disabled={busy || sending}
          onClick={() => picker.current?.click()}
        >
          {t('editor.attach')}
        </button>
        <input
          ref={picker}
          type="file"
          hidden
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            event.target.value = '';
            if (chosen) void attach(chosen);
          }}
        />
      </div>
      {attaching ? (
        <p
          className={`note-editor-attaching${attaching.phase === 'failed' ? ' is-failure' : ''}`}
          role="status"
        >
          {attaching.phase === 'hashing'
            ? t('editor.attachHashing')
            : attaching.phase === 'sending'
              ? t('editor.attachSending', { sent: attaching.sent, total: attaching.total })
              : attaching.phase === 'done'
                ? t('editor.attachDone', { name: attaching.name })
                : attaching.message}
        </p>
      ) : null}

      <Modal
        open={asking}
        title={t('editor.askHeading')}
        onClose={() => setAsking(false)}
        actions={
          <>
            <button
              type="button"
              className="button is-quiet"
              disabled={busy}
              onClick={() => setAsking(false)}
            >
              {t('editor.back')}
            </button>
            <button
              type="button"
              className="button is-primary"
              disabled={busy}
              onClick={() => onConfirm({ content: text, message, keepAlias })}
            >
              {busy ? t('editor.writing') : t('editor.write')}
            </button>
          </>
        }
      >
        {/*
          What this write will DO, said before it is confirmed and never as a
          refusal: somebody may want a note with no name, and the specification
          says so. What they may not have is losing it without being told, in
          the one screen where the name is a line of text like any other
          (RN-KNW-036).
        */}
        {renamed ? (
          nextName === null ? (
            <p className="editor-notice is-pending">
              {t('editor.willBeUnnamed', { count: losing })}
            </p>
          ) : currentName === null ? (
            <p className="editor-notice">
              {t('editor.willBeNamed', { name: nextName, count: gaining })}
            </p>
          ) : (
            <p className="editor-notice">
              {/* Two counts in one sentence, and a plural takes one: each
                  clause is pluralised on its own and then placed (#188). */}
              {t('editor.willBeRenamed', {
                from: currentName,
                to: nextName,
                losing: t('editor.renameLosing', { count: losing }),
                gaining: t('editor.renameGaining', { count: gaining }),
              })}
            </p>
          )
        ) : null}

        {/*
          And the way out the model already has: an alias resolves exactly what
          no name resolved (§5.2, step 8), so the links to the old name keep
          arriving — and the day somebody writes a note actually named that,
          the name takes them back (RN-DSC-053).
        */}
        {renamed && currentName ? (
          <label className="editor-alias">
            <input
              type="checkbox"
              checked={keepAlias}
              onChange={(event) => setKeepAlias(event.target.checked)}
            />
            <span>{t('editor.keepAlias', { name: currentName })}</span>
          </label>
        ) : null}

        <label className="field">
          <span className="field-label">{t('editor.messageLabel')}</span>
          <input
            type="text"
            value={message}
            maxLength={NOTE_MESSAGE_MAX_LENGTH}
            placeholder={t('editor.messagePlaceholder')}
            onChange={(event) => setMessage(event.target.value)}
          />
          <span className="field-hint">{t('editor.messageOptional')}</span>
        </label>
      </Modal>
    </div>
  );
}
