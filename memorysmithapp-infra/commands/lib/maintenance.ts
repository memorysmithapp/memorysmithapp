/**
 * The jobs an operator runs against the tables of an environment
 * (architecture-guide.md, sections 10.3 and 11).
 *
 * Every projection of the product owes an answer to how it remakes itself when
 * it is wrong (PE5), and two of the answers are entrypoints of the core, which
 * read the tables with the product's own code. This is what a command needs to
 * know to run one against an environment. Nothing here runs anything.
 */

export interface MaintenanceJob {
  /** The entrypoint of the core, from the root of the repository. */
  readonly entry: string;
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
  'reproject-links': {
    entry: 'memorysmithapp-backend/apps/core-monolith/src/reproject.ts',
    rebuilds: 'the link graph of every notebook',
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
