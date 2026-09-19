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
  /** What it rebuilds, as a person reads it. */
  readonly rebuilds: string;
}

export const MAINTENANCE_JOBS = {
  'recount-storage': {
    entry: 'memorysmith-backend/apps/core-monolith/src/recount.ts',
    rebuilds: 'the storage counter of every subscription',
  },
  'reproject-links': {
    entry: 'memorysmith-backend/apps/core-monolith/src/reproject.ts',
    rebuilds: 'the link graph of every notebook',
  },
  'migrate-slots': {
    entry: 'memorysmith-backend/apps/core-monolith/src/migrate-slots.ts',
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
}): Record<string, string> {
  return {
    KNOWLEDGE_TABLE: `mv-knowledge-${input.environment}`,
    DISCOVERY_TABLE: `mv-discovery-${input.environment}`,
    CONTENT_BUCKET: input.contentBucket,
  };
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
