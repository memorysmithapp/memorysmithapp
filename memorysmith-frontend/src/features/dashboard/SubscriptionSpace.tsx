import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '../../i18n/intl-locale';
import { readUsage } from '../../shared/api/source';
import { queryKeys } from '../../shared/api/query-keys';
import { useLiveSession } from '../../shared/auth/session';
import { formatBytes } from '../../shared/components/StorageBar';
import { SpaceSkeleton } from '../../shared/components/skeletons';
import { kindsBySpace, notebookLines, shareOf, type KindKey, type NotebookLine } from './space';

const KIND_LABEL: Record<KindKey, string> = {
  files: 'dashboard.kindFiles',
  notes: 'dashboard.kindNotes',
  exports: 'dashboard.kindExports',
  others: 'dashboard.kindOthers',
};

/**
 * The space of the subscription (#198), where the four counts about links
 * used to be: how much is used and of what, which notebook holds it, and how
 * many notebooks, folders and revisions there are. It reads counters (#197),
 * never the notes themselves, and it never holds the cards up: the cards are
 * drawn from the list of notebooks, and this panel keeps its height while its
 * own answer is on the way.
 *
 * When that answer does not come, what the session already knows is still
 * true — the total and the quota — so the panel draws those with one bar and
 * says the split could not be read, rather than going blank.
 */
export function SubscriptionSpace() {
  const { t, i18n } = useTranslation();
  const locale = intlLocale(i18n.language);
  const session = useLiveSession((s) => s.session);
  const query = useQuery({ queryKey: queryKeys.subscriptionUsage(), queryFn: readUsage });
  const usage = query.data;

  const bytes = (value: number) => formatBytes(value, locale);
  const number = new Intl.NumberFormat(locale);

  const plan =
    session?.subscriptionType && session.subscriptionQuotaBytes
      ? t('dashboard.planChip', {
          plan: t(`dashboard.plan.${session.subscriptionType}`),
          quota: bytes(session.subscriptionQuotaBytes),
        })
      : null;

  const used = usage?.usedBytes ?? session?.usedBytes ?? null;
  const quota = usage?.quotaBytes ?? session?.subscriptionQuotaBytes ?? null;

  return (
    <section className="home-space" aria-labelledby="home-space-heading">
      <div className="home-space-head">
        <h2 id="home-space-heading">{t('dashboard.space')}</h2>
        <span className="carousel-rule" aria-hidden="true" />
        {plan ? <span className="chip home-plan">{plan}</span> : null}
      </div>

      {query.isPending ? (
        <SpaceSkeleton />
      ) : used === null || quota === null ? null : (
        <>
          <div className="home-space-card">
            <div className="home-space-total">
              <p className="home-space-used">
                <strong>{bytes(used)}</strong>
                <span>
                  {t('dashboard.of', { quota: bytes(quota) })}
                  {' · '}
                  {used >= quota
                    ? t('dashboard.full')
                    : t('dashboard.free', { free: bytes(quota - used) })}
                </span>
              </p>

              {usage ? (
                <>
                  {/* The bar is the table drawn: the table below is the answer. */}
                  <div className="space-bar" aria-hidden="true">
                    {kindsBySpace(usage)
                      .filter((kind) => kind.bytes > 0)
                      .map((kind) => (
                        <span
                          key={kind.key}
                          className="space-bar-part"
                          data-kind={kind.key}
                          style={{ width: `${shareOf(kind.bytes, Math.max(quota, used))}%` }}
                        />
                      ))}
                  </div>
                  <table className="space-table">
                    <thead>
                      <tr>
                        <th aria-hidden="true" />
                        <th scope="col">{t('dashboard.kind')}</th>
                        <th scope="col">{t('dashboard.quantity')}</th>
                        <th scope="col">{t('dashboard.bytes')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kindsBySpace(usage).map((kind) => (
                        <tr key={kind.key}>
                          <td>
                            <span className="space-dot" data-kind={kind.key} />
                          </td>
                          <td
                            title={
                              kind.key === 'others' ? t('dashboard.kindOthersHint') : undefined
                            }
                          >
                            {t(KIND_LABEL[kind.key])}
                          </td>
                          <td>{number.format(kind.count)}</td>
                          <td>{bytes(kind.bytes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <>
                  <div className="space-bar" aria-hidden="true">
                    <span
                      className="space-bar-part"
                      data-kind="all"
                      style={{ width: `${shareOf(Math.min(used, quota), quota)}%` }}
                    />
                  </div>
                  <p className="hint">{t('dashboard.usageUnavailable')}</p>
                </>
              )}
            </div>

            {usage ? (
              <div className="home-space-notebooks">
                <h3>{t('dashboard.byNotebook')}</h3>
                {usage.notebooks.length === 0 ? (
                  <p className="hint">{t('dashboard.noVisibleNotebooks')}</p>
                ) : (
                  <NotebookLines lines={notebookLines(usage)} format={bytes} />
                )}
              </div>
            ) : null}
          </div>

          {usage ? (
            <dl className="home-counts">
              <div>
                <dt>{t('dashboard.countNotebooks')}</dt>
                <dd>{number.format(usage.counts.notebooks)}</dd>
              </div>
              <div>
                <dt>{t('dashboard.countFolders')}</dt>
                <dd>{number.format(usage.counts.folders)}</dd>
              </div>
              <div>
                <dt>{t('dashboard.countRevisions')}</dt>
                <dd>{number.format(usage.counts.revisions)}</dd>
              </div>
            </dl>
          ) : null}
        </>
      )}
    </section>
  );
}

function NotebookLines({
  lines,
  format,
}: {
  lines: NotebookLine[];
  format: (bytes: number) => string;
}) {
  const { t } = useTranslation();
  const largest = Math.max(...lines.map((line) => line.bytes), 1);

  return (
    <ul className="space-notebooks">
      {lines.map((line) => {
        // What the notebook holds, with the zeros left out.
        const parts = [
          line.notes ? t('dashboard.notebookNotes', { count: line.notes }) : null,
          line.folders ? t('dashboard.notebookFolders', { count: line.folders }) : null,
          line.files ? t('dashboard.notebookFiles', { count: line.files }) : null,
          line.exports ? t('dashboard.notebookExports', { count: line.exports }) : null,
        ].filter((part): part is string => part !== null);
        return (
          <li key={line.notebookId ?? 'more'}>
            <div className="space-notebook-head">
              <span className="space-notebook-name">
                {line.name ?? t('dashboard.moreNotebooks', { count: line.grouped })}
              </span>
              <span className="space-notebook-bytes">{format(line.bytes)}</span>
            </div>
            <span className="space-notebook-track" aria-hidden="true">
              <span style={{ width: `${(line.bytes / largest) * 100}%` }} />
            </span>
            <span className="space-notebook-detail">
              {parts.length > 0 ? parts.join(' · ') : t('dashboard.notebookEmpty')}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
