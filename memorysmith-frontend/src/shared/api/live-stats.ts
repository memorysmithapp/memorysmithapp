// What the dashboard can honestly say about real notebooks.
//
// The seed dashboard charts `maturity`, `reviewed`, `type` and `tags`, which
// are the authoring convention of the seed. The product does NOT impose that
// convention: the backend never interprets the content of a note, and which
// attributes a note carries is a decision of each notebook's Guidance. So the
// live dashboard cannot ask "how many notes are evergreen"; it asks the notebook
// which attributes it has and charts whatever comes back.
//
// The Discovery projection already answers exactly that, and it also already
// decided which attributes are worth counting: an attribute that turns out to
// be free text leaves the statistics on its own, through the cardinality
// ceiling, and comes back flagged as discarded.

import { getFacetsById, getHealthById, listNotebooks } from './backend';

export interface LiveFacet {
  readonly facet: string;
  readonly kind: string;
  /** Values across every notebook, largest first. */
  readonly values: Array<{ value: string; count: number }>;
  readonly total: number;
}

export interface LiveStats {
  readonly notebooks: number;
  readonly notes: number;
  readonly pendingLinks: number;
  readonly orphans: number;
  readonly facets: LiveFacet[];
  /** Attributes the projection dropped as free text, named rather than hidden. */
  readonly discarded: string[];
  /** Notebooks that did not answer, so the totals below them are short. */
  readonly unavailable: number;
  readonly perNotebook: Array<{ notebookId: string; name: string; notes: number }>;
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
 * Two reads per notebook, a few notebooks at a time. A notebook that fails to answer is
 * left out of the aggregate rather than taking the whole dashboard down, and
 * the count of those is carried out so the screen can say the totals are
 * short. Numbers that quietly under-report are worse than numbers missing.
 */
export async function loadLiveStats(): Promise<LiveStats> {
  const notebooks = await listNotebooks();

  const settled = await mapWithLimit(notebooks, NOTEBOOKS_AT_A_TIME, async (notebook) => {
    const [facets, health] = await Promise.all([
      getFacetsById(notebook.id).catch(() => null),
      getHealthById(notebook.id).catch(() => null),
    ]);
    return { notebook, facets, health };
  });
  const unavailable = settled.filter(
    (entry) => entry.facets === null || entry.health === null,
  ).length;

  const merged = new Map<string, { kind: string; values: Map<string, number> }>();
  const discarded = new Set<string>();
  let pendingLinks = 0;
  let orphans = 0;

  for (const { facets, health } of settled) {
    pendingLinks += health?.pendingLinks.length ?? 0;
    orphans += health?.orphans.length ?? 0;

    for (const facet of facets?.facets ?? []) {
      if (facet.discarded) {
        discarded.add(facet.facet);
        continue;
      }
      const entry = merged.get(facet.facet) ?? { kind: facet.kind, values: new Map() };
      for (const { value, count } of facet.values) {
        entry.values.set(value, (entry.values.get(value) ?? 0) + count);
      }
      merged.set(facet.facet, entry);
    }
  }

  const facets: LiveFacet[] = [...merged.entries()]
    .map(([facet, entry]) => {
      const values = [...entry.values.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);
      return {
        facet,
        kind: entry.kind,
        values,
        total: values.reduce((sum, each) => sum + each.count, 0),
      };
    })
    .sort((a, b) => b.total - a.total);

  return {
    notebooks: notebooks.length,
    notes: notebooks.reduce((sum, notebook) => sum + notebook.noteCount, 0),
    pendingLinks,
    orphans,
    facets,
    discarded: [...discarded].sort(),
    unavailable,
    perNotebook: notebooks.map((notebook) => ({
      notebookId: notebook.id,
      name: notebook.name,
      notes: notebook.noteCount,
    })),
  };
}
