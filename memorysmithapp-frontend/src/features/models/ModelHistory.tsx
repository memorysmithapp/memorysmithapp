import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ModelChangeDto } from '@memorysmithapp/contracts';
import { intlLocale } from '../../i18n/intl-locale';
import { useLiveInterval } from '../../shared/api/live';
import { queryKeys } from '../../shared/api/query-keys';
import { getModelHistory } from '../../shared/api/source';
import { RowsSkeleton } from '../../shared/components/skeletons';

/** A change as the community reads it, with no author (#431). */
export type ModelHistoryChange = Omit<ModelChangeDto, 'agent'> & { agent?: string | null };

/**
 * The history of a model (#431): the changes of the notebook it is, the newest
 * first, read like the history of a note — when, who through which connector,
 * what changed and the line its author left. An edit session is one change,
 * with how many saves it held and since when. The community reads it without
 * who (`withAuthor` false). Keeping a state of the model is exporting its
 * notebook; nothing here is frozen.
 */
export function ModelHistoryList({
  changes,
  truncated,
  withAuthor,
}: {
  changes: readonly ModelHistoryChange[];
  truncated: boolean;
  withAuthor: boolean;
}) {
  const { t, i18n } = useTranslation();
  if (changes.length === 0) return <p className="hint">{t('model.historyEmpty')}</p>;
  // `intlLocale`: `Intl` takes a BCP 47 tag, never the `pt_BR` of the interface.
  const when = new Intl.DateTimeFormat(intlLocale(i18n.language), {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <>
      <ol className="history-list model-history">
        {changes.map((change, index) => (
          <li
            key={`${change.occurredAt}-${change.subjectId}-${index}`}
            className={change.saves > 1 ? 'history-session' : undefined}
          >
            <div className="history-head">
              <time dateTime={change.occurredAt}>{when.format(new Date(change.occurredAt))}</time>
              {withAuthor ? (
                // The connector when an agent wrote it, and the person otherwise.
                <span className="history-author">{change.agent ?? t('history.aPerson')}</span>
              ) : null}
              <span className="chip history-kind">
                {t(`model.change.${change.type}`, change.type)}
              </span>
            </div>
            {change.name ? <p className="history-subject">{change.name}</p> : null}
            {change.saves > 1 ? (
              <p className="history-span">
                {t('history.sessionSaves', {
                  count: change.saves,
                  from: when.format(new Date(change.since)),
                })}
              </p>
            ) : null}
            {change.message ? (
              <p className="history-message">{change.message}</p>
            ) : (
              <p className="history-message is-empty">{t('history.noMessage')}</p>
            )}
          </li>
        ))}
      </ol>
      {truncated ? <p className="hint">{t('model.historyTruncated')}</p> : null}
    </>
  );
}

/** The history of a model the person reads, its own or shared as a model reader (#355, #431). */
export function ModelHistoryPanel({ notebookId }: { notebookId: string }) {
  const { t } = useTranslation();
  const history = useQuery({
    queryKey: queryKeys.modelHistory(notebookId),
    queryFn: () => getModelHistory(notebookId),
    refetchInterval: useLiveInterval(),
  });
  return (
    <section className="model-history-panel" aria-label={t('model.tabs.history')}>
      <p className="hint">{t('model.historyHint')}</p>
      {history.isPending ? (
        <RowsSkeleton rows={4} />
      ) : history.isError ? (
        <p className="status">{t('history.failed')}</p>
      ) : (
        <ModelHistoryList
          changes={history.data.changes}
          truncated={history.data.truncated}
          withAuthor
        />
      )}
    </section>
  );
}
