/**
 * Starts the staging pipeline on the head of this branch
 * (architecture-guide.md, section 20).
 *
 *   pnpm staging:start             with credentials of the account
 *
 * Staging runs only when somebody asks, because a run costs money and the
 * decision to spend it belongs to whoever asks. The pipeline builds the commit,
 * not the checkout, so the commit has to be pushed first, and the branch is
 * handed over as a variable because the version staging serves is computed
 * from its name.
 */

import { CodePipelineClient, StartPipelineExecutionCommand } from '@aws-sdk/client-codepipeline';
import { parseArgs } from 'node:util';
import { git } from './lib/repository.js';

const { values } = parseArgs({
  options: {
    pipeline: { type: 'string', default: 'memorysmith-staging' },
    branch: { type: 'string' },
  },
});

const head = git('rev-parse', 'HEAD');
const branch = values.branch ?? git('rev-parse', '--abbrev-ref', 'HEAD');

if (git('branch', '--remotes', '--contains', head).length === 0) {
  console.error(`${head.slice(0, 7)} is not pushed. Push it, then start staging on it.`);
  process.exit(1);
}

const started = await new CodePipelineClient({}).send(
  new StartPipelineExecutionCommand({
    name: values.pipeline,
    sourceRevisions: [{ actionName: 'Source', revisionType: 'COMMIT_ID', revisionValue: head }],
    variables: [{ name: 'SOURCE_BRANCH', value: branch }],
  }),
);

process.stdout.write(
  `Staging started on ${head.slice(0, 7)} of ${branch}: execution ${started.pipelineExecutionId}.\n`,
);
