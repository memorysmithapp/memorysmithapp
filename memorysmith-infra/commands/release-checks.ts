/**
 * The first stage of the production pipeline (architecture-guide.md, 20).
 *
 * A merge to main that touches what is deployed becomes a release, so before
 * anything is built the version has to agree everywhere it is written and must
 * not be released already. Every reason is printed, and the stage fails on any.
 *
 *   pnpm -C memorysmith-infra release-checks
 */

import { baseVersionOf, releaseProblems } from './lib/release.js';
import { manifests, readText, tagExists } from './lib/repository.js';

const claudeMd = readText('CLAUDE.md');
const version = baseVersionOf(claudeMd);

const problems = releaseProblems({
  claudeMd,
  manifests: manifests(),
  changelog: readText('CHANGELOG.md'),
  tagExists: version ? tagExists(`v${version}`) : false,
});

if (problems.length > 0) {
  console.error(`This merge cannot be released as v${version ?? '?'}:`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
process.stdout.write(`v${version} is ready to be released.\n`);
