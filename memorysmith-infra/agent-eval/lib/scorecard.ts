/**
 * The scorecard of a round (architecture-guide.md, section 19): per case and
 * per model, how many runs passed each mechanical check, and the place where
 * the judge writes what needs judgement. It is posted on the issue of the cycle
 * as a dated record.
 */

import type { CheckOutcome } from './checks.js';

export interface RunResult {
  readonly caseId: string;
  readonly variant: string;
  readonly model: string;
  readonly run: number;
  readonly outcomes: readonly CheckOutcome[];
  readonly leaks: readonly string[];
  readonly costUsd: number;
  readonly turns: number;
  readonly error: string | null;
}

export function scorecard(input: {
  readonly round: string;
  readonly environment: string;
  readonly version: string;
  readonly models: readonly string[];
  readonly results: readonly RunResult[];
}): string {
  const lines = [
    `## Agent evaluation, round ${input.round}`,
    '',
    `Against ${input.environment}, serving \`${input.version}\`. Each cell is passed / applicable, over the runs of that model; a run discarded for a leak counts in no cell.`,
    '',
  ];

  const groups = new Map<string, RunResult[]>();
  for (const result of input.results) {
    const key = `${result.caseId} · ${result.variant}`;
    groups.set(key, [...(groups.get(key) ?? []), result]);
  }

  for (const [key, results] of groups) {
    lines.push(
      `### ${key}`,
      '',
      `| Check | ${input.models.join(' | ')} |`,
      `|---|${input.models.map(() => '---').join('|')}|`,
    );
    const checks = [
      ...new Set(results.flatMap((result) => result.outcomes.map((each) => each.check))),
    ];
    const scored = (model: string) =>
      results.filter(
        (result) => result.model === model && result.error === null && result.leaks.length === 0,
      );
    for (const check of checks) {
      const cells = input.models.map((model) => {
        const applicable = scored(model)
          .map((result) => result.outcomes.find((each) => each.check === check))
          .filter((each): each is CheckOutcome => each !== undefined && each.passed !== null);
        return applicable.length === 0
          ? '—'
          : `${applicable.filter((each) => each.passed).length}/${applicable.length}`;
      });
      lines.push(`| ${check} | ${cells.join(' | ')} |`);
    }
    const count = (model: string, predicate: (result: RunResult) => boolean) =>
      results.filter((result) => result.model === model && predicate(result)).length;
    lines.push(
      `| runs that failed to run | ${input.models.map((model) => count(model, (result) => result.error !== null)).join(' | ')} |`,
      `| runs discarded for a leak | ${input.models.map((model) => count(model, (result) => result.leaks.length > 0)).join(' | ')} |`,
      `| cost of the executor, USD | ${input.models
        .map((model) =>
          results
            .filter((result) => result.model === model)
            .reduce((total, result) => total + result.costUsd, 0)
            .toFixed(2),
        )
        .join(' | ')} |`,
      '',
      '**Judgement:** _written by the judge after reading the runs, against the rubric of the case._',
      '',
    );
  }
  return lines.join('\n');
}
