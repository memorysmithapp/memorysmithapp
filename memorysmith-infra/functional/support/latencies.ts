/**
 * How long each operation took, recorded and never gated
 * (architecture-guide.md, section 18).
 *
 * A functional run is not a load test: it runs a few calls of each operation,
 * on a cold environment, from one region. Its numbers say where to look, and a
 * threshold on them would fail a delivery over a cold start. So they go into the
 * report, one line per operation, and nothing fails on them.
 */

export interface LatencyRecord {
  readonly operation: string;
  readonly milliseconds: number;
}

export interface LatencySummary {
  readonly operation: string;
  readonly count: number;
  readonly p50: number;
  readonly p95: number;
  readonly max: number;
}

/** The nearest-rank percentile, which is always a value that was measured. */
export function percentile(samples: readonly number[], p: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil((p / 100) * sorted.length)));
  return sorted[rank - 1] ?? 0;
}

export function summarize(records: readonly LatencyRecord[]): LatencySummary[] {
  const byOperation = new Map<string, number[]>();
  for (const record of records) {
    const samples = byOperation.get(record.operation) ?? [];
    samples.push(record.milliseconds);
    byOperation.set(record.operation, samples);
  }
  return [...byOperation.entries()]
    .map(([operation, samples]) => ({
      operation,
      count: samples.length,
      p50: percentile(samples, 50),
      p95: percentile(samples, 95),
      max: Math.max(...samples),
    }))
    .sort((a, b) => a.operation.localeCompare(b.operation));
}
