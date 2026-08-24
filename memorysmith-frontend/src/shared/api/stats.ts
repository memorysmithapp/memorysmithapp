// Aggregations over the seed statistics emitted by build-seed.mjs. Maturity is
// the cross-vault authoring standard (`maturity: seed | growing | evergreen` in
// every note's frontmatter), so the dashboard reads it directly.

import raw from '../../../seed/stats.json';

export interface VaultStats {
  vault: string;
  name: string;
  notes: number;
  folders: number;
  byType: Record<string, number>;
  byMaturity: Record<string, number>;
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
  resolvedLinks: number;
  pendingLinks: number;
}

export function totals(): Totals {
  return vaultStats.reduce(
    (acc, v) => ({
      vaults: acc.vaults + 1,
      notes: acc.notes + v.notes,
      resolvedLinks: acc.resolvedLinks + v.links.resolved,
      pendingLinks: acc.pendingLinks + v.links.pending,
    }),
    { vaults: 0, notes: 0, resolvedLinks: 0, pendingLinks: 0 },
  );
}

export function topTypes(limit: number): { type: string; count: number }[] {
  const merged = new Map<string, number>();
  for (const vault of vaultStats) {
    for (const [type, count] of Object.entries(vault.byType)) {
      merged.set(type, (merged.get(type) ?? 0) + count);
    }
  }
  const sorted = [...merged.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, limit).map(([type, count]) => ({ type, count }));
  const rest = sorted.slice(limit).reduce((sum, [, count]) => sum + count, 0);
  if (rest > 0) top.push({ type: '__other__', count: rest });
  return top;
}
