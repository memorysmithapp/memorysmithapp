/**
 * The overview of the dashboard: four numbers about everything the account
 * holds.
 *
 * It used to chart whatever attributes the notebooks declared, which was an
 * honest feature and the wrong one for this screen: the charts answered a
 * question nobody was asking at the door, and they cost a second read of every
 * notebook to draw. What is left is what somebody wants on arriving — how much
 * there is, and how much of it is broken.
 *
 * The two counts that matter are on the right for a reason. A pending link and
 * an orphan note are the two ways a notebook quietly stops being a graph, and
 * this is the one screen that looks across every notebook at once.
 */

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { loadLiveStats } from '../../shared/api/live-stats';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { queryState } from '../../shared/api/query-state';
import { DashboardSkeleton } from '../../shared/components/skeletons';
import { queryKeys } from '../../shared/api/query-keys';

const nf = new Intl.NumberFormat();

export function LiveDashboard() {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: queryKeys.liveStats(), queryFn: loadLiveStats });
  const state = queryState(query);

  // Three states, told apart. `isLoading || !data` said "Loading…" forever
  // over a request that had already failed, because with `retry: false` an
  // errored query is neither loading nor holding data.
  if (state === 'error') {
    return <p className="status">{t(messageKeyOf(query.error))}</p>;
  }
  // `!data` is the same condition `pending` already carries, written again so
  // the compiler can see it. Everything below reads an answer that exists.
  const data = query.data;
  if (state === 'pending' || !data) return <DashboardSkeleton />;

  return (
    <>
      <h2 className="dashboard-section-heading">{t('dashboard.heading')}</h2>

      <div className="stat-row">
        <div className="stat-tile">
          <span className="stat-value">{nf.format(data.notebooks)}</span>
          <span className="stat-label">{t('dashboard.kpiNotebooks')}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{nf.format(data.notes)}</span>
          <span className="stat-label">{t('dashboard.kpiNotes')}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{nf.format(data.pendingLinks)}</span>
          <span className="stat-label">{t('dashboard.kpiPending')}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{nf.format(data.orphans)}</span>
          <span className="stat-label">{t('dashboard.kpiOrphans')}</span>
        </div>
      </div>

      {/*
        The one caveat that survived the charts, and it survived because it is
        about the NUMBERS and not about what was drawn beside them: a notebook
        that did not answer leaves all four short. Numbers that quietly
        under-report are worse than numbers missing.
      */}
      {data.unavailable > 0 && (
        <p className="dashboard-footnote">
          {t('dashboard.unavailableNotebooks', { count: data.unavailable })}
        </p>
      )}
    </>
  );
}
