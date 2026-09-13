/**
 * Whether the head of a branch ran on staging (architecture-guide.md, 20;
 * development-process.md, section 8).
 *
 * Nothing blocks a merge on it. It warns the author, who decides, and it is
 * what the "Staging validation" section of a pull request states.
 */

export interface StagingExecution {
  readonly id: string;
  readonly status: string;
  /** The commit the execution was started on, when the pipeline recorded one. */
  readonly commit: string | null;
  readonly startedAt: Date;
}

export type StagingStatus =
  | { readonly state: 'validated'; readonly executionId: string; readonly commit: string }
  | {
      readonly state: 'behind';
      readonly executionId: string;
      readonly validated: string;
      readonly head: string;
    }
  | { readonly state: 'never' };

/**
 * One of three answers: this commit was validated; an earlier commit of this
 * branch was, and the head is not; or no commit of this branch ever ran.
 * `onBranch` answers whether a commit belongs to the branch and not to main,
 * so a run on main never passes for a run of the branch.
 */
export function stagingStatusOf(input: {
  readonly head: string;
  readonly executions: readonly StagingExecution[];
  readonly onBranch: (commit: string) => boolean;
}): StagingStatus {
  const succeeded = input.executions
    .filter((execution) => execution.status === 'Succeeded' && execution.commit !== null)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

  const exact = succeeded.find((execution) => execution.commit === input.head);
  if (exact) return { state: 'validated', executionId: exact.id, commit: input.head };

  const earlier = succeeded.find((execution) => input.onBranch(execution.commit as string));
  if (earlier) {
    return {
      state: 'behind',
      executionId: earlier.id,
      validated: earlier.commit as string,
      head: input.head,
    };
  }
  return { state: 'never' };
}

const short = (commit: string): string => commit.slice(0, 7);

/** The sentence a person reads, and the pull request repeats. */
export function describeStagingStatus(status: StagingStatus): string {
  switch (status.state) {
    case 'validated':
      return `Staging validated this commit, ${short(status.commit)}, in execution ${status.executionId}.`;
    case 'behind':
      return (
        `Staging validated ${short(status.validated)} in execution ${status.executionId}, and the ` +
        `branch is at ${short(status.head)}: what came after it never ran on staging.`
      );
    case 'never':
      return 'No commit of this branch ever ran on staging.';
  }
}
