/**
 * Says whether the head of this branch ran on staging, and never blocks
 * anything (development-process.md, section 8).
 *
 *   pnpm staging:status            with credentials of the account
 *
 * It exits 0 in every one of its three answers: a merge without a staging run
 * is a decision that belongs to the author, and this only makes sure it is made
 * knowingly.
 */

import {
  CodePipelineClient,
  ListPipelineExecutionsCommand,
  type PipelineExecutionSummary,
} from '@aws-sdk/client-codepipeline';
import { parseArgs } from 'node:util';
import { describeStagingStatus, stagingStatusOf } from './lib/staging.js';
import { git } from './lib/repository.js';

const { values } = parseArgs({
  options: { pipeline: { type: 'string', default: 'memorysmith-staging' } },
});

const client = new CodePipelineClient({});
const summaries: PipelineExecutionSummary[] = [];
let nextToken: string | undefined;
do {
  const page = await client.send(
    new ListPipelineExecutionsCommand({
      pipelineName: values.pipeline,
      maxResults: 100,
      nextToken,
    }),
  );
  summaries.push(...(page.pipelineExecutionSummaries ?? []));
  nextToken = summaries.length < 200 ? page.nextToken : undefined;
} while (nextToken);

const isAncestor = (ancestor: string, of: string): boolean => {
  try {
    git('merge-base', '--is-ancestor', ancestor, of);
    return true;
  } catch {
    return false;
  }
};

const status = stagingStatusOf({
  head: git('rev-parse', 'HEAD'),
  executions: summaries.map((summary) => ({
    id: summary.pipelineExecutionId ?? '',
    status: summary.status ?? '',
    commit: summary.sourceRevisions?.[0]?.revisionId ?? null,
    startedAt: summary.startTime ?? new Date(0),
  })),
  onBranch: (commit) => isAncestor(commit, 'HEAD') && !isAncestor(commit, 'origin/main'),
});

process.stdout.write(describeStagingStatus(status) + '\n');
