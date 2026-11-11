import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ModelChangeDto } from '@memorysmithapp/contracts';
import { intlLocale } from '../../i18n/intl-locale';
import { useLiveInterval } from '../../shared/api/live';
import { queryKeys } from '../../shared/api/query-keys';
import { getModelHistory } from '../../shared/api/source';
import { RowsSkeleton } from '../../shared/components/skeletons';

/**
 * A change as a history draws it: the community reads it with no author
 * (#431), and the overview of a notebook says which ones were the person's
 * own (#446).
 */
export type ModelHistoryChange = Omit<ModelChangeDto, 'agent' | 'fromModel'> & {
  agent?: string | null;
  fromModel?: string | null;
  you?: boolean;
};

/** How many changes a page of a history shows, as a folder's list does (#446). */
export const HISTORY_PAGE = 20;

/**
 * The history of a model (#431): the changes of the notebook it is, the newest
 * first, drawn as the list of a folder is (#416, #435) — when, who through
 * which connector, what changed with the name of what it changed, and the line
 * its author left. An edit session is one row, with how many saves it held and
 * since when. The community reads it without who (`withAuthor` false), the
 * column left out. Keeping a state of the model is exporting its notebook;
 * nothing here is frozen. The overview of every notebook draws its own with
 * it (#446): its creation says the model it came from, and it pages twenty
 * changes at a time with the pager of a folder's list.
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
  const [page, setPage] = useState(1);
  if (changes.length === 0) return <p className="hint">{t('model.historyEmpty')}</p>;
  const pages = Math.ceil(changes.length / HISTORY_PAGE);
  const shown = Math.min(page, pages);
  const rows = changes.slice((shown - 1) * HISTORY_PAGE, shown * HISTORY_PAGE);
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
            {rows.map((change, index) => {
              // The kind of change is said on the name, as its tooltip, and is
              // the text itself when the change names nothing (#437).
              const kind = t(`model.change.${change.type}`, change.type);
              return (
                <tr
                  key={`${change.occurredAt}-${change.subjectId}-${index}`}
                  className={change.saves > 1 ? 'is-session' : undefined}
                >
                  <td className="folder-notes-name model-history-what" title={kind}>
                    {change.fromModel
                      ? t('model.createdFromModel', { name: change.fromModel })
                      : (change.name ?? kind)}
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
                      {change.agent ??
                        (change.you === undefined
                          ? t('history.aPerson')
                          : change.you
                            ? t('noteAuthor.you')
                            : t('noteAuthor.person'))}
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
      {pages > 1 ? (
        // The pager of the list of a folder, word for word (#446).
        <nav className="tables-grid-pages" aria-label={t('tables.pages')}>
          <span>
            {t('tables.showing', {
              first: (shown - 1) * HISTORY_PAGE + 1,
              last: Math.min(shown * HISTORY_PAGE, changes.length),
              total: changes.length,
            })}
          </span>
          <span className="tables-grid-page-buttons">
            <button
              type="button"
              className="button is-quiet is-small"
              disabled={shown <= 1}
              onClick={() => setPage(shown - 1)}
            >
              {t('tables.previous')}
            </button>
            <button
              type="button"
              className="button is-quiet is-small"
              disabled={shown >= pages}
              onClick={() => setPage(shown + 1)}
            >
              {t('tables.next')}
            </button>
          </span>
        </nav>
      ) : null}
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
