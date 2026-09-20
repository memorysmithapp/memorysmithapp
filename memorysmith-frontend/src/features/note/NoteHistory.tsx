import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { noteHistory } from '../../shared/api/backend';
import { intlLocale } from '../../i18n';

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
 */
export function NoteHistory({ notebookId, noteId }: { notebookId: string; noteId: string }) {
  const { t, i18n } = useTranslation();
  const { data, isPending, isError } = useQuery({
    queryKey: ['note-history', notebookId, noteId],
    queryFn: () => noteHistory(notebookId, noteId),
  });

  if (isPending) return <p className="status">{t('history.loading')}</p>;
  if (isError || !data) return <p className="status">{t('history.failed')}</p>;

  // Newest first: what somebody opening a history wants is the last thing that
  // happened, and the trail is answered in the order it was written.
  const entries = [...data].reverse();
  // `intlLocale` and not `i18n.language`: the interface names its locales
  // `en_US` and `pt_BR`, and `Intl` takes a BCP 47 tag and throws on anything
  // else. This is the fourth surface to need it and the helper is why it is
  // one call rather than a fourth conversion written out by hand.
  const when = new Intl.DateTimeFormat(intlLocale(i18n.language), {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <ol className="history-list">
      {entries.map((entry, index) => (
        <li key={`${entry.occurredAt}-${index}`}>
          <div className="history-head">
            <time dateTime={entry.occurredAt}>{when.format(new Date(entry.occurredAt))}</time>
            {/*
              Who wrote: the connector when an agent did, and the person
              otherwise. An agent writes AS somebody, so the name of the
              connector is what tells the two apart on the screen.
            */}
            <span className="history-author">
              {entry.authorship.agent?.clientName ?? t('history.aPerson')}
            </span>
            <span className="chip history-kind">{t(`history.kind.${entry.type}`, entry.type)}</span>
          </div>
          {entry.message ? (
            <p className="history-message">{entry.message}</p>
          ) : (
            <p className="history-message is-empty">{t('history.noMessage')}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
