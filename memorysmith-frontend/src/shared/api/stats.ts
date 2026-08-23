// Aggregations over the seed statistics emitted by build-seed.mjs. The maturity
// buckets fold the per-vault status vocabularies (which belong to each vault's
// Guidance, not to the product) into a single ordered scale for the dashboard.

import raw from '../../../seed/stats.json';

export interface VaultStats {
  vault: string;
  name: string;
  notes: number;
  folders: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  links: { resolved: number; pending: number };
}

export const vaultStats: VaultStats[] = (raw as unknown as { vaults: VaultStats[] }).vaults;

export type MaturityBucket = 'open' | 'evolving' | 'consolidated';
export const MATURITY_ORDER: MaturityBucket[] = ['consolidated', 'evolving', 'open'];

const BUCKET_BY_STATUS: Record<string, MaturityBucket> = {
  seed: 'open',
  draft: 'open',
  open: 'open',
  growing: 'evolving',
  inferred: 'evolving',
  evergreen: 'consolidated',
  confirmed: 'consolidated',
};

export function maturityOf(stats: VaultStats): Record<MaturityBucket, number> {
  const buckets: Record<MaturityBucket, number> = { open: 0, evolving: 0, consolidated: 0 };
  for (const [status, count] of Object.entries(stats.byStatus)) {
    buckets[BUCKET_BY_STATUS[status] ?? 'open'] += count;
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
