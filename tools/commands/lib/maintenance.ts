/**
 * The jobs an operator runs against the tables of an environment
 * (ADR-010, ADR-017).
 *
 * Every projection of the product owes an answer to how it remakes itself when
 * it is wrong (PE5), and two of the answers are entrypoints of the core, which
 * read the tables with the product's own code. This is what a command needs to
 * know to run one against an environment. Nothing here runs anything.
 */

export interface MaintenanceJob {
  /** The entrypoint of the core, from the root of the repository, for a job run as a process. */
  readonly entry?: string;
  /**
   * The state machine a job runs as in AWS, for a job that is not a process
   * (#311), by the base of its physical name.
   */
  readonly stateMachine?: string;
  /** What it rebuilds, as a person reads it, or what it deletes, for a job that deletes. */
  readonly rebuilds?: string;
  readonly deletes?: string;
  /** The only environments it may run in, when it is not every one. */
  readonly only?: readonly string[];
}

export const MAINTENANCE_JOBS = {
  // First, because it is what makes a scan of staging worth running (#276).
  'cleanup-staging': {
    entry: 'memorysmithapp-backend/apps/core-monolith/src/cleanup-staging.ts',
    deletes: 'the notebooks the functional suite abandoned',
    only: ['staging'],
  },
  'recount-storage': {
    entry: 'memorysmithapp-backend/apps/core-monolith/src/recount.ts',
    rebuilds:
      'the storage counters of every subscription: what fills it, by kind and by notebook, and its kept exports',
  },
  // A run in AWS, one notebook per iteration, which holds no workstation (#311).
  'reproject-links': {
    stateMachine: 'mv-reproject-links',
    rebuilds: 'the link graph of every notebook',
  },
  // What a deleted file left behind before its deletion reached the purge (#372).
  'purge-deleted-files': {
    entry: 'memorysmithapp-backend/apps/core-monolith/src/purge-deleted-files.ts',
    deletes: 'the bytes of the files deleted on their own',
  },
  'migrate-slots': {
    entry: 'memorysmithapp-backend/apps/core-monolith/src/migrate-slots.ts',
    rebuilds: 'the Guidance and the Templates written before they had a life of their own',
  },
} as const satisfies Record<string, MaintenanceJob>;

export type MaintenanceJobName = keyof typeof MAINTENANCE_JOBS;

export function isMaintenanceJob(name: string): name is MaintenanceJobName {
  return name in MAINTENANCE_JOBS;
}

/**
 * The resources a job reads, as the variables it reads them from. The tables
 * are named after their environment, so they are written here; the bucket is
 * named by CloudFormation, so the command reads it from the data stack.
 */
export function jobVariables(input: {
  readonly environment: string;
  readonly contentBucket: string;
  readonly userPoolId: string;
}): Record<string, string> {
  return {
    // A job that deletes checks the environment itself as well (#276).
    ENVIRONMENT: input.environment,
    KNOWLEDGE_TABLE: `mv-knowledge-${input.environment}`,
    DISCOVERY_TABLE: `mv-discovery-${input.environment}`,
    // The recount of the storage reads the revisions off the trail and the
    // kept exports off their own table (RN-SUB-024).
    AUDIT_TABLE: `mv-audit-${input.environment}`,
    PORTABILITY_TABLE: `mv-portability-${input.environment}`,
    // The cleanup reads the owner of a subscription off Access and asks the
    // pool whether that account still exists.
    ACCESS_TABLE: `mv-access-${input.environment}`,
    // Destroying content is the purge's alone, so a job hands it the work (INV-08).
    PURGE_QUEUE: `mv-purge-${input.environment}`,
    CONTENT_BUCKET: input.contentBucket,
    USER_POOL_ID: input.userPoolId,
  };
}

/** Why a job may not run in an environment at all, or null. */
export function environmentRefusal(job: MaintenanceJob, environment: string): string | null {
  if (!job.only || job.only.includes(environment)) return null;
  return `This job runs on ${job.only.join(' and ')} only, and never on ${environment}. Nothing ran.`;
}

/** Why a job may not run under these credentials, or null. */
export function accountRefusal(input: {
  readonly environment: string;
  readonly callerAccount: string;
  readonly environmentAccount: string | undefined;
}): string | null {
  if (!input.environmentAccount) {
    return `cdk.json names no account for ${input.environment}. Nothing ran.`;
  }
  if (input.callerAccount !== input.environmentAccount) {
    return (
      `These credentials belong to account ${input.callerAccount}, and ${input.environment} ` +
      `lives in ${input.environmentAccount}. Nothing ran.`
    );
  }
  return null;
}

/** The progress of a run, as the map of its notebooks counts it. */
export interface RunProgress {
  readonly total: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly running: number;
}

export function progressLine(progress: RunProgress): string {
  const done = progress.succeeded + progress.failed;
  return `  ${done}/${progress.total} notebook(s) done, ${progress.running} running`;
}

/** What a run of the reprojection answers, as `summarise` of the core writes it. */
export interface ReprojectionSummary {
  readonly mode: 'report' | 'apply';
  readonly notebooks: number;
  readonly rebuilt: number;
  readonly gone: number;
  readonly notes: number;
  readonly files: number;
  readonly edgesBefore: number;
  readonly edgesAfter: number;
  readonly gained: number;
  readonly gainedByAlias: number;
  readonly lost: number;
  readonly pending: number;
  readonly changed: ReadonlyArray<{
    subscriptionId: string;
    notebookId: string;
    gained: number;
    lost: number;
  }>;
  readonly lostEdges: ReadonlyArray<{
    subscriptionId: string;
    notebookId: string;
    from: string;
    to: string;
  }>;
  readonly failed: ReadonlyArray<{ subscriptionId: string; notebookId: string; error: string }>;
  readonly good: boolean;
}

/**
 * The report a person reads at the end of a run. It names notebooks and notes
 * by identifier only, because the summary is the output of an execution and
 * the console keeps it.
 */
export function summaryLines(summary: ReprojectionSummary): string[] {
  const lines = [
    `${summary.notebooks} notebook(s), ${summary.notes} note(s) and ${summary.files} kept file(s)` +
      (summary.gone > 0 ? `; ${summary.gone} stopped being live during the run` : ''),
    `  edges before          ${summary.edgesBefore}`,
    `  edges after           ${summary.edgesAfter}`,
    `  edges gained          ${summary.gained} (${summary.gainedByAlias} answered by an alias)`,
    `  edges lost            ${summary.lost}`,
    `  links left pending    ${summary.pending}`,
  ];
  if (summary.changed.length > 0) {
    lines.push('', 'Notebooks whose graph changes:');
    for (const notebook of summary.changed) {
      lines.push(
        `  ${notebook.subscriptionId} / ${notebook.notebookId}  +${notebook.gained} -${notebook.lost}`,
      );
    }
  }
  if (summary.lostEdges.length > 0) {
    // Not a warning that can be waved through: an entry here is a link that
    // stopped resolving, because a note stopped stating the name the link was
    // written against.
    lines.push('', 'EDGES LOST, links that stopped resolving:');
    for (const edge of summary.lostEdges) {
      lines.push(`  ${edge.subscriptionId} / ${edge.notebookId}  ${edge.from} -> ${edge.to}`);
    }
  }
  if (summary.failed.length > 0) {
    lines.push('', 'NOTEBOOKS THAT FAILED after their retries, the others finished:');
    for (const notebook of summary.failed) {
      lines.push(`  ${notebook.subscriptionId} / ${notebook.notebookId}  ${notebook.error}`);
    }
  }
  lines.push(
    '',
    summary.mode === 'apply'
      ? `Rebuilt the link graph of ${summary.rebuilt} notebook(s).`
      : 'A report: nothing was written. Pass --apply to rebuild these graphs.',
  );
  return lines;
}

/**
 * The exit code of a run: 2 when an edge was lost, which is the one number
 * whoever ran it has to look at, 1 when a notebook failed or the run did not
 * finish, and 0 otherwise.
 */
export function runExitCode(summary: ReprojectionSummary | null): number {
  if (!summary) return 1;
  if (summary.lost > 0) return 2;
  return summary.failed.length > 0 ? 1 : 0;
}
