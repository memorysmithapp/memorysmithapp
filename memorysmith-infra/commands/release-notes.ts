/**
 * Prints the notes of a version, as CHANGELOG.md writes them, for the GitHub
 * Release the production pipeline creates (architecture-guide.md, 20).
 *
 *   pnpm -C memorysmith-infra release-notes [X.Y.Z]
 */

import { baseVersionOf, changelogSection } from './lib/release.js';
import { readText } from './lib/repository.js';

const version = process.argv[2] ?? baseVersionOf(readText('CLAUDE.md'));
const notes = version ? changelogSection(readText('CHANGELOG.md'), version) : null;

if (!notes) {
  console.error(`CHANGELOG.md has no notes for ${version ?? 'the base version'}.`);
  process.exit(1);
}
process.stdout.write(notes + '\n');
