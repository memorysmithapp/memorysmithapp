/**
 * Prints the version a deploy of this commit serves (architecture-guide.md, 23.3).
 *
 *   pnpm -C memorysmith-infra served-version --environment staging [--branch release/v0.6.0]
 *
 * The branch is the one named, then SOURCE_BRANCH, then the checkout's own. A
 * pipeline started on a commit has no branch checked out, so it names it.
 */

import { parseArgs } from 'node:util';
import { servedVersion, type ServingEnvironment } from './lib/release.js';
import { commitsAheadOfMain, git, readText } from './lib/repository.js';

const { values } = parseArgs({
  options: { environment: { type: 'string' }, branch: { type: 'string' } },
});

const environment = (values.environment ?? 'staging') as ServingEnvironment;
if (environment !== 'production' && environment !== 'staging') {
  console.error(`There is no environment called "${environment}".`);
  process.exit(1);
}

const packageVersion = (
  JSON.parse(readText('memorysmith-infra/package.json')) as { version: string }
).version;

process.stdout.write(
  servedVersion({
    environment,
    packageVersion,
    branch:
      values.branch ?? process.env['SOURCE_BRANCH'] ?? git('rev-parse', '--abbrev-ref', 'HEAD'),
    commitsAhead: environment === 'production' ? 0 : commitsAheadOfMain(),
    sha: git('rev-parse', 'HEAD'),
  }) + '\n',
);
