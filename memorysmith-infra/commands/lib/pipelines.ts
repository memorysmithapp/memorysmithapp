/**
 * Whether an environment has a pipeline at all (architecture-guide.md, §20).
 *
 * The app instantiates the pipeline of an environment only when cdk.json names
 * the connection of the account (`bin/app.ts`), so an empty `connectionArn` is
 * the switch that puts delivery back on a workstation. Nothing of the pipeline
 * is lost when it is off: the stack is declared as it always was, and writing
 * the connection back raises it again.
 *
 * Nothing here calls AWS. The commands do, and they ask this first, so a
 * command that speaks to a pipeline says it is switched off instead of failing
 * against an account that has nothing to answer.
 */

export interface PipelineQuestion {
  readonly environment: string;
  /** What cdk.json names for the environment, empty when it names none. */
  readonly connectionArn: string | undefined;
  /** What to do instead, while it is off. */
  readonly instead: string;
}

/** Why the command cannot run, or null when the pipeline of the environment exists. */
export function pipelineRefusal(input: PipelineQuestion): string | null {
  if (input.connectionArn) return null;
  return (
    `The pipeline of ${input.environment} is switched off: cdk.json names no connection for it, ` +
    `so the app does not instantiate it and no execution exists to ask about.\n` +
    `Deliver from here instead: ${input.instead}`
  );
}

/** The connection cdk.json names for an environment, or undefined. */
export function connectionArnOf(cdkJson: string, environment: string): string | undefined {
  const parsed = JSON.parse(cdkJson) as {
    context?: {
      environments?: Record<string, { pipeline?: { connectionArn?: string } } | undefined>;
    };
  };
  const named = parsed.context?.environments?.[environment]?.pipeline?.connectionArn;
  return named && named.trim().length > 0 ? named.trim() : undefined;
}
