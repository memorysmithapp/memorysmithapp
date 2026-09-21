// What the dashboard can honestly say about real notebooks.
//
// Four numbers: how many notebooks, how many notes, and the two ways a
// notebook quietly stops being a graph — a link that reaches nothing and a
// note nothing reaches.
//
// It used to also merge the frontmatter attributes of every notebook into
// charts, which cost a SECOND read of every notebook. The dashboard is the one
// screen whose cost grows with the number of notebooks, so dropping the charts
// halved it.

import { getHealthById, listNotebooks } from './backend';

export interface LiveStats {
  readonly notebooks: number;
  readonly notes: number;
  readonly pendingLinks: number;
  readonly orphans: number;
  /** Notebooks that did not answer, so the numbers above them are short. */
  readonly unavailable: number;
}

/**
 * How many notebooks are asked at once. Firing every notebook in parallel is the
 * obvious way to write this and the wrong one: the dashboard is the only
 * screen whose cost grows with the number of notebooks, and a burst of requests
 * is the one thing a serverless API answers with 503 rather than slowly. A
 * few at a time is barely slower and never storms anything.
 */
const NOTEBOOKS_AT_A_TIME = 3;

async function mapWithLimit<T, U>(
  items: T[],
  limit: number,
  each: (item: T) => Promise<U>,
): Promise<U[]> {
  const results: U[] = [];
  for (let start = 0; start < items.length; start += limit) {
    results.push(...(await Promise.all(items.slice(start, start + limit).map(each))));
  }
  return results;
}

/**
 * One read per notebook, a few notebooks at a time. A notebook that fails to
 * answer is left out of the aggregate rather than taking the whole dashboard
 * down, and the count of those is carried out so the screen can say the totals
 * are short. Numbers that quietly under-report are worse than numbers missing.
 */
export async function loadLiveStats(): Promise<LiveStats> {
  const notebooks = await listNotebooks();

  const health = await mapWithLimit(notebooks, NOTEBOOKS_AT_A_TIME, (notebook) =>
    getHealthById(notebook.id).catch(() => null),
  );

  return {
    notebooks: notebooks.length,
    notes: notebooks.reduce((sum, notebook) => sum + notebook.noteCount, 0),
    pendingLinks: health.reduce((sum, each) => sum + (each?.pendingLinks.length ?? 0), 0),
    orphans: health.reduce((sum, each) => sum + (each?.orphans.length ?? 0), 0),
    unavailable: health.filter((each) => each === null).length,
  };
}
