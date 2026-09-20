import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NOTE_MESSAGE_MAX_LENGTH } from '@memorysmith/contracts';
import { noteNameOf } from '../../shared/api/markdown';
import { notesReaching } from '../../shared/api/source';
import { Modal } from '../../shared/components/Modal';

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
      </div>

      <Modal
        open={asking}
        title={t('editor.askHeading')}
        onClose={() => setAsking(false)}
        actions={
          <>
            <button
              type="button"
              className="button is-primary"
              disabled={busy}
              onClick={() => onConfirm({ content: text, message, keepAlias })}
            >
              {busy ? t('editor.writing') : t('editor.write')}
            </button>
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => setAsking(false)}
            >
              {t('editor.back')}
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
              {t('editor.willBeRenamed', {
                from: currentName,
                to: nextName,
                losing,
                gaining,
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
