import { useQuery } from '@tanstack/react-query';
import { useLiveInterval } from '../../shared/api/live';
import { useTranslation } from 'react-i18next';
import { groupHistory } from '@memorysmithapp/contracts';
import { noteHistory, type HistoryEntryDto } from '../../shared/api/backend';
import { intlLocale } from '../../i18n';
import { queryKeys } from '../../shared/api/query-keys';
import type { RefObject } from 'react';
import { Modal } from '../../shared/components/Modal';
import { Sheet } from '../../shared/components/Sheet';
import { useSheetLayout } from '../../shared/components/Menu';

/** How often, and for how long, the trail is read while it has not caught up with the note. */
const CATCH_UP_MS = 2_000;
const CATCH_UP_WINDOW_MS = 60_000;

/**
 * What happened to this note, and what its authors said about it (#169,
 * RN-AUD-012).
 *
 * It exists because the line an author leaves needs a reader: a message
 * written into a drawer nobody opens is a form, not a feature. Until now the
 * trail was reachable through the connector and through the API, and no screen
 * of the product showed the revisions of a note.
 *
 * It is the smallest honest reader: each entry with its instant, who wrote it
 * and the line they left. Putting an old body back is another delivery, with
 * its own rule about what that write is.
 *
 * An edit session of the interface is one entry (#300, RN-AUD-013): the editor
 * saves as the person types, a pause at a time, and each save is a revision;
 * the entry says who, how many saves and from when to when, and opens into
 * them.
 */
export function NoteHistory({
  notebookId,
  noteId,
  updatedAt,
}: {
  notebookId: string;
  noteId: string;
  /** When the note last changed, which the trail reaches a moment later. */
  updatedAt?: string | undefined;
}) {
  const { t, i18n } = useTranslation();
  const live = useLiveInterval();
  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.noteHistory(notebookId, noteId),
    queryFn: () => noteHistory(notebookId, noteId),
    /**
     * The trail is written by the audit consumer after the note, so a read
     * right after a write can come back without it — and it is the read a
     * write of this page makes, since the write invalidates the history. While
     * the note is newer than the newest entry, and only for the minute after
     * it changed, the trail is read again every two seconds instead of waiting
     * for the next half minute (#206).
     */
    refetchInterval: (query) => {
      if (live === false || !updatedAt) return live;
      const changed = Date.parse(updatedAt);
      const entries = query.state.data ?? [];
      const newest = Math.max(0, ...entries.map((entry) => Date.parse(entry.occurredAt)));
      const behind = newest < changed && Date.now() - changed < CATCH_UP_WINDOW_MS;
      return behind ? CATCH_UP_MS : live;
    },
  });

  if (isPending) return <p className="status">{t('history.loading')}</p>;
  if (isError || !data) return <p className="status">{t('history.failed')}</p>;

  // Newest first: what somebody opening a history wants is the last thing that
  // happened, and the trail is answered in the order it was written.
  const groups = groupHistory(
    data.map((entry) => ({ ...entry, session: entry.session ?? null })),
  ).reverse();
  // `intlLocale` and not `i18n.language`: the interface names its locales
  // `en_US` and `pt_BR`, and `Intl` takes a BCP 47 tag and throws on anything
  // else. This is the fourth surface to need it and the helper is why it is
  // one call rather than a fourth conversion written out by hand.
  const when = new Intl.DateTimeFormat(intlLocale(i18n.language), {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const author = (entry: HistoryEntryDto) =>
    // Who wrote: the connector when an agent did, and the person otherwise.
    // An agent writes AS somebody, so the name of the connector is what tells
    // the two apart on the screen.
    entry.authorship.agent?.clientName ?? t('history.aPerson');

  return (
    <ol className="history-list">
      {groups.map((group, index) => {
        if (group.kind === 'entry') {
          const entry = group.entry;
          return (
            <li key={`${entry.occurredAt}-${index}`}>
              <div className="history-head">
                <time dateTime={entry.occurredAt}>{when.format(new Date(entry.occurredAt))}</time>
                <span className="history-author">{author(entry)}</span>
                <span className="chip history-kind">
                  {t(`history.kind.${entry.type}`, entry.type)}
                </span>
              </div>
              {entry.message ? (
                <p className="history-message">{entry.message}</p>
              ) : (
                <p className="history-message is-empty">{t('history.noMessage')}</p>
              )}
            </li>
          );
        }
        const first = group.entries[0]!;
        const last = group.entries.at(-1)!;
        const saves = [...group.entries].reverse();
        return (
          <li key={group.session} className="history-session">
            <div className="history-head">
              <time dateTime={last.occurredAt}>{when.format(new Date(last.occurredAt))}</time>
              <span className="history-author">{author(last)}</span>
              <span className="chip history-kind">{t('history.kind.EditSession')}</span>
            </div>
            <details className="history-saves">
              <summary>
                {t('history.sessionSaves', {
                  count: group.entries.length,
                  from: when.format(new Date(first.occurredAt)),
                })}
              </summary>
              <ol>
                {saves.map((entry) => (
                  <li key={entry.contentRef?.versionId ?? entry.occurredAt}>
                    <time dateTime={entry.occurredAt}>
                      {when.format(new Date(entry.occurredAt))}
                    </time>
                    {entry.message ? <span> · {entry.message}</span> : null}
                  </li>
                ))}
              </ol>
            </details>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Where the history is read (#226): the modal of the Controles on a computer,
 * named after the note, and a sheet on a phone. It is opened from the bar of
 * the note and mounted only while open, which is what keeps opening a note
 * from asking for its trail.
 */
export function NoteHistoryDialog({
  open,
  onClose,
  noteName,
  notebookId,
  noteId,
  updatedAt,
  returnFocus,
}: {
  open: boolean;
  onClose: () => void;
  noteName: string;
  notebookId: string;
  noteId: string;
  updatedAt?: string | undefined;
  returnFocus: RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation();
  const sheet = useSheetLayout();
  if (!open) return null;
  const list = <NoteHistory notebookId={notebookId} noteId={noteId} updatedAt={updatedAt} />;
  return sheet ? (
    <Sheet
      open
      onClose={onClose}
      label={t('history.heading')}
      title={t('history.heading')}
      closeLabel={t('common.close')}
      className="history-sheet"
      returnFocus={returnFocus}
    >
      {list}
    </Sheet>
  ) : (
    <Modal
      open
      title={t('history.heading')}
      subtitle={noteName}
      onClose={onClose}
      className="history-dialog"
    >
      {list}
    </Modal>
  );
}
