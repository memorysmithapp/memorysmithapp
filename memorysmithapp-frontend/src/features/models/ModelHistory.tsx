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
 * first, drawn as the list of a folder is (#416, #435) — when, who through
 * which connector, what changed with the name of what it changed, and the line
 * its author left. An edit session is one row, with how many saves it held and
 * since when. The community reads it without who (`withAuthor` false), the
 * column left out. Keeping a state of the model is exporting its notebook;
 * nothing here is frozen.
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
  // Short, as the date of a note in a folder, with its time (#437).
  const when = new Intl.DateTimeFormat(intlLocale(i18n.language), {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return (
    <div className="folder-notes model-history">
      <div className="tables-grid-scroll">
        <table className="tables-grid folder-notes-table model-history-table">
          <thead>
            <tr>
              <th scope="col">{t('model.historyColumns.what')}</th>
              <th scope="col">{t('model.historyColumns.when')}</th>
              {withAuthor ? <th scope="col">{t('model.historyColumns.who')}</th> : null}
              <th scope="col">{t('model.historyColumns.line')}</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((change, index) => {
              // The kind of change is said on the name, as its tooltip, and is
              // the text itself when the change names nothing (#437).
              const kind = t(`model.change.${change.type}`, change.type);
              return (
                <tr
                  key={`${change.occurredAt}-${change.subjectId}-${index}`}
                  className={change.saves > 1 ? 'is-session' : undefined}
                >
                  <td className="folder-notes-name model-history-what" title={kind}>
                    {change.name ?? kind}
                  </td>
                  <td data-label={t('model.historyColumns.when')} className="model-history-when">
                    <time dateTime={change.occurredAt}>
                      {when.format(new Date(change.occurredAt))}
                    </time>
                    {change.saves > 1 ? (
                      <span className="model-history-saves">
                        {t('history.sessionSaves', {
                          count: change.saves,
                          from: when.format(new Date(change.since)),
                        })}
                      </span>
                    ) : null}
                  </td>
                  {withAuthor ? (
                    // The connector when an agent wrote it, and the person otherwise.
                    <td
                      data-label={t('model.historyColumns.who')}
                      className={change.agent ? 'model-history-who is-agent' : 'model-history-who'}
                    >
                      {change.agent ?? t('history.aPerson')}
                    </td>
                  ) : null}
                  <td data-label={t('model.historyColumns.line')} className="model-history-line">
                    {change.message ?? <span className="is-empty">{t('history.noMessage')}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {truncated ? <p className="hint">{t('model.historyTruncated')}</p> : null}
    </div>
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
