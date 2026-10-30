import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { DashboardCrossFilter } from '@memorysmithapp/contracts';
import { listDashboards } from '../../shared/api/source';
import { queryKeys } from '../../shared/api/query-keys';
import { useNotebookId } from '../structure/route-ids';
import { intlLocale } from '../../i18n/intl-locale';
import { whenDrawn } from '../note/drawn';
import { PREVIEW_STORAGE_KEY } from '../note/PreviewNotePage';
import { usePreferences } from '../../shared/store/preferences';
import { DashboardView } from './DashboardsPage';

/** The view of the dashboard the renderer asked for: its periods and a mark clicked (#369). */
export function readDashboardView(
  storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage,
): {
  filters: Record<string, string | null> | null;
  cross: DashboardCrossFilter | null;
} {
  try {
    const kept = JSON.parse(storage?.getItem(PREVIEW_STORAGE_KEY) ?? 'null') as {
      filters?: Record<string, string | null> | null;
      cross?: DashboardCrossFilter | null;
    } | null;
    return { filters: kept?.filters ?? null, cross: kept?.cross ?? null };
  } catch {
    return { filters: null, cross: null };
  }
}

/** The dashboard the renderer of the server asked this page to draw, by name or identifier. */
export function readDashboardRequest(
  storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage,
): string | null {
  try {
    const kept = JSON.parse(storage?.getItem(PREVIEW_STORAGE_KEY) ?? 'null') as {
      dashboard?: unknown;
    } | null;
    return typeof kept?.dashboard === 'string' && kept.dashboard.length > 0 ? kept.dashboard : null;
  } catch {
    return null;
  }
}

/**
 * A Dashboard drawn whole for its image (#368, RN-PRT-032): opened by the
 * renderer of the server, outside the frame of the application, at the width
 * of a computer, still — no animation, no button — and marked ready once every
 * component is drawn.
 */
export function PrintDashboardPage() {
  const { i18n } = useTranslation();
  const notebookId = useNotebookId();
  const client = useQueryClient();
  const [ready, setReady] = useState(false);
  const [asked] = useState(() => readDashboardRequest());
  const [view] = useState(() => readDashboardView());
  const setPaper = usePreferences((s) => s.setPaper);
  // An image is the light theme, whatever the person chose, as a note's is.
  useEffect(() => {
    setPaper(true);
    return () => setPaper(false);
  }, [setPaper]);
  const dashboards = useQuery({
    queryKey: queryKeys.notebookDashboards(notebookId),
    queryFn: () => listDashboards(notebookId),
  });
  const dashboard =
    dashboards.data?.find(
      (each) =>
        each.dashboardId === asked?.toUpperCase() ||
        each.name.toLowerCase() === asked?.normalize('NFC').toLowerCase(),
    ) ?? null;
  const drawn = useCallback(
    (root: HTMLElement | null) => {
      void whenDrawn(root, client).then(() => setReady(true));
    },
    [client],
  );
  return (
    <main className="dashboard-print content-pane" data-ready={ready ? 'true' : undefined}>
      {dashboard ? (
        <DashboardView
          notebookId={notebookId}
          dashboard={dashboard}
          locale={intlLocale(i18n.language)}
          maintains={false}
          still
          onDrawn={drawn}
          view={view}
        />
      ) : null}
    </main>
  );
}
