import { useEffect, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { diagnose, type Notice } from '@memorysmithapp/markdown-renderer/diagnose';
import { notesReaching, resolveNoteUrl } from '../../shared/api/source';
import { isAttachmentName } from '../../shared/api/attachment';

/** How long the text rests before it is read again: a notice is not a keystroke's business. */
const SETTLE_MS = 400;

/**
 * The offset in the text of a line and a column counted from 1, which is how
 * a notice says where it is: what the text area selects to show it.
 */
export function offsetOf(text: string, line: number, column: number): number {
  let at = 0;
  for (let current = 1; current < line; current += 1) {
    const next = text.indexOf('\n', at);
    if (next === -1) return text.length;
    at = next + 1;
  }
  return Math.min(at + column - 1, text.length);
}

/**
 * The notices of the note being written (#291, RN-KNW-059), read as the page
 * will draw it: by the renderer's `diagnose`, against the names and the files
 * of this notebook. A notice never blocks a write — there is no invalid note —
 * so this only says, while the text is typed, where the page will differ from
 * it.
 */
export function useNotices(text: string, notebookId: string): Notice[] {
  const [notices, setNotices] = useState<Notice[]>([]);
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      void diagnose(text, {
        resolve: (name) => resolveNoteUrl(notebookId, name),
        reaches: (name) => notesReaching(notebookId, name).length,
        keeps: (name) => isAttachmentName(notebookId, name),
      })
        .then((found) => {
          if (current) setNotices(found);
        })
        // A reading that failed says nothing rather than something wrong.
        .catch(() => undefined);
    }, SETTLE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [text, notebookId]);
  return notices;
}

/**
 * The notices under the text: first what the page will draw differently from
 * the text, then, folded, what the note could still declare. Each one takes
 * the cursor to where it is.
 */
export function NoteNotices({
  text,
  notices,
  area,
}: {
  text: string;
  notices: readonly Notice[];
  area: RefObject<HTMLTextAreaElement | null>;
}) {
  const { t } = useTranslation();
  const differs = notices.filter((each) => each.severity === 'notice');
  const hints = notices.filter((each) => each.severity === 'hint');
  if (notices.length === 0) return null;

  const go = (notice: Notice) => {
    const field = area.current;
    if (!field) return;
    const start = offsetOf(text, notice.line, notice.column);
    const end = Math.max(start, offsetOf(text, notice.endLine, notice.endColumn));
    field.focus();
    field.setSelectionRange(start, end);
  };

  const list = (items: readonly Notice[]) => (
    <ul className="note-notices-list">
      {items.map((notice, index) => (
        <li key={`${notice.code}-${notice.line}-${notice.column}-${index}`}>
          <button
            type="button"
            className="note-notice"
            data-severity={notice.severity}
            title={t('notices.goTo', { line: notice.line, column: notice.column })}
            onClick={() => go(notice)}
          >
            <span className="note-notice-at">{t('notices.at', { line: notice.line })}</span>
            <span className="note-notice-text">{t(`notices.codes.${notice.code}`)}</span>
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <section className="note-notices" aria-live="polite">
      {differs.length > 0 ? (
        <>
          <h2 className="note-notices-heading">{t('notices.heading')}</h2>
          {list(differs)}
        </>
      ) : null}
      {hints.length > 0 ? (
        <details className="note-notices-hints">
          <summary>
            {t('notices.hintsHeading')} <span className="note-notices-count">{hints.length}</span>
          </summary>
          {list(hints)}
        </details>
      ) : null}
    </section>
  );
}
