/**
 * The last step of a release: the annotated tag and the GitHub Release of the
 * version that was just deployed (architecture-guide.md, §20).
 *
 * It runs **after** the delivery of production, and that order is the whole of
 * what a version tag means here: `v0.6.0` says "this exact commit is what
 * production serves", so it is written once production serves it.
 *
 *   GITHUB_REPOSITORY  owner/name
 *   COMMIT             the commit that was deployed
 *   GITHUB_TOKEN       optional: a token with `contents: write` on the
 *                      repository. Absent, the token of the `gh` CLI is used,
 *                      which is what a person running this from a workstation
 *                      already has.
 *
 * It used to authenticate as a GitHub App, because the only thing that wrote a
 * tag was the pipeline — a process with no person inside it. The pipeline was
 * switched off and the App removed, so this signs as whoever runs it, and a
 * pipeline that comes back injects `GITHUB_TOKEN` from Secrets Manager.
 */
import { execSync } from 'node:child_process';
import { publishRelease } from './lib/github-release.js';
import { baseVersionOf, changelogSection } from './lib/release.js';
import { readText } from './lib/repository.js';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`publish-release needs ${name}.`);
    process.exit(1);
  }
  return value;
}

/**
 * The token, from the environment or from the `gh` CLI.
 *
 * The environment comes first because that is what a pipeline sets, and the
 * CLI is the fallback because a person running a release from their machine is
 * already signed in there. Neither one is stored by this command.
 */
function token(): string {
  const fromEnvironment = process.env['GITHUB_TOKEN'];
  if (fromEnvironment) return fromEnvironment;
  try {
    // One fixed command and no arguments of ours: nothing here is built from
    // input, which is what makes running it through a shell harmless — and a
    // shell is what finds `gh` on Windows, where it is a `.cmd`.
    const fromCli = execSync('gh auth token', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (fromCli) return fromCli;
  } catch {
    // Reported below with the same sentence as an empty answer: what the
    // caller has to do about it is the same either way.
  }
  console.error(
    'publish-release needs GITHUB_TOKEN, or a `gh` signed in to an account that writes to the repository.',
  );
  process.exit(1);
}

const repository = required('GITHUB_REPOSITORY');
const commit = required('COMMIT');

const version = baseVersionOf(readText('CLAUDE.md'));
const notes = version ? changelogSection(readText('CHANGELOG.md'), version) : null;
if (!version || !notes) {
  console.error('CLAUDE.md and CHANGELOG.md name no version with notes to publish.');
  process.exit(1);
}

const outcome = await publishRelease({ token: token(), repository, version, commit, notes });
process.stdout.write(`v${version}: tag ${outcome.tag}, release ${outcome.release}.\n`);
