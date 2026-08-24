// Aggregations over the seed statistics emitted by build-seed.mjs. Maturity is
// the cross-vault authoring standard (`maturity: seed | growing | evergreen` in
// every note's frontmatter), so the dashboard reads it directly; the same goes
// for `reviewed`, tags and the `created` date.

import raw from '../../../seed/stats.json';

export interface VaultStats {
  vault: string;
  name: string;
  notes: number;
  folders: number;
  byType: Record<string, number>;
  byMaturity: Record<string, number>;
  byTag: Record<string, number>;
  byCreatedDay: Record<string, number>;
  reviewed: number;
  links: { resolved: number; pending: number };
}

export const vaultStats: VaultStats[] = (raw as unknown as { vaults: VaultStats[] }).vaults;

export type Maturity = 'seed' | 'growing' | 'evergreen';
export const MATURITY_ORDER: Maturity[] = ['evergreen', 'growing', 'seed'];

export function maturityOf(stats: VaultStats): Record<Maturity, number> {
  const buckets: Record<Maturity, number> = { seed: 0, growing: 0, evergreen: 0 };
  for (const [maturity, count] of Object.entries(stats.byMaturity)) {
    if (maturity in buckets) buckets[maturity as Maturity] += count;
  }
  return buckets;
}

export interface Totals {
  vaults: number;
  notes: number;
  reviewed: number;
  resolvedLinks: number;
  pendingLinks: number;
}

export function totals(): Totals {
  return vaultStats.reduce(
    (acc, v) => ({
      vaults: acc.vaults + 1,
      notes: acc.notes + v.notes,
      reviewed: acc.reviewed + v.reviewed,
      resolvedLinks: acc.resolvedLinks + v.links.resolved,
      pendingLinks: acc.pendingLinks + v.links.pending,
    }),
    { vaults: 0, notes: 0, reviewed: 0, resolvedLinks: 0, pendingLinks: 0 },
  );
}

function mergedCounts(select: (v: VaultStats) => Record<string, number>): [string, number][] {
  const merged = new Map<string, number>();
  for (const vault of vaultStats) {
    for (const [key, count] of Object.entries(select(vault))) {
      merged.set(key, (merged.get(key) ?? 0) + count);
    }
  }
  return [...merged.entries()].sort((a, b) => b[1] - a[1]);
}

export function topTypes(limit: number): { type: string; count: number }[] {
  const sorted = mergedCounts((v) => v.byType);
  const top = sorted.slice(0, limit).map(([type, count]) => ({ type, count }));
  const rest = sorted.slice(limit).reduce((sum, [, count]) => sum + count, 0);
  if (rest > 0) top.push({ type: '__other__', count: rest });
  return top;
}

export function topTags(limit: number): { tag: string; count: number }[] {
  return mergedCounts((v) => v.byTag)
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
}

export function distinctTagCount(): number {
  return mergedCounts((v) => v.byTag).length;
}

export interface CreatedTimeline {
  days: string[];
  series: { vault: string; name: string; counts: number[] }[];
  maxTotal: number;
}

export const OTHER_VAULTS = '__other__';

// Continuous day axis from the first to the last `created` date across vaults;
// silent days stay in the axis as zeros, so import bursts read as bursts. The
// categorical palette has three validated hues, so only the three largest
// vaults keep their own series; the rest fold into a neutral "other" series.
export function createdTimeline(): CreatedTimeline {
  const allDays = vaultStats.flatMap((v) => Object.keys(v.byCreatedDay));
  if (allDays.length === 0) return { days: [], series: [], maxTotal: 0 };
  const first = allDays.reduce((a, b) => (a < b ? a : b));
  const last = allDays.reduce((a, b) => (a > b ? a : b));

  const days: string[] = [];
  const cursor = new Date(`${first}T00:00:00Z`);
  for (;;) {
    const iso = cursor.toISOString().slice(0, 10);
    days.push(iso);
    if (iso >= last || days.length > 400) break;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const ranked = [...vaultStats].sort((a, b) => b.notes - a.notes);
  const top = new Set(ranked.slice(0, 3).map((v) => v.vault));

  const series = vaultStats
    .filter((v) => top.has(v.vault))
    .map((v) => ({
      vault: v.vault,
      name: v.name,
      counts: days.map((day) => v.byCreatedDay[day] ?? 0),
    }));
  const rest = vaultStats.filter((v) => !top.has(v.vault));
  if (rest.length > 0) {
    series.push({
      vault: OTHER_VAULTS,
      name: OTHER_VAULTS,
      counts: days.map((day) => rest.reduce((sum, v) => sum + (v.byCreatedDay[day] ?? 0), 0)),
    });
  }
  const maxTotal = Math.max(...days.map((_, i) => series.reduce((sum, s) => sum + (s.counts[i] ?? 0), 0)));
  return { days, series, maxTotal };
}
