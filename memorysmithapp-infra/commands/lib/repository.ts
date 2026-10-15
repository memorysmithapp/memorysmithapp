/**
 * What the commands read from the repository and from git. Nothing here
 * decides anything: the decisions are in `release.ts`.
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export function readText(path: string): string {
  return readFileSync(join(REPOSITORY_ROOT, path), 'utf8');
}

export function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: REPOSITORY_ROOT, encoding: 'utf8' }).trim();
}

const SKIPPED = new Set(['node_modules', '.git', 'dist', 'cdk.out', 'coverage']);

/** Every manifest of the workspace, with the version it declares. */
export function manifests(): Array<{ path: string; version: string | undefined }> {
  const found: Array<{ path: string; version: string | undefined }> = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIPPED.has(entry.name)) walk(join(directory, entry.name));
      } else if (entry.name === 'package.json') {
        const path = join(directory, entry.name);
        const parsed = JSON.parse(readFileSync(path, 'utf8')) as { version?: string };
        found.push({
          path: relative(REPOSITORY_ROOT, path).replace(/\\/g, '/'),
          version: parsed.version,
        });
      }
    }
  };
  walk(REPOSITORY_ROOT);
  return found.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * How many commits HEAD is ahead of main. A pipeline clone may hold only the
 * branch it built, so main is fetched when it is missing.
 */
export function commitsAheadOfMain(): number {
  try {
    return Number(git('rev-list', '--count', 'origin/main..HEAD'));
  } catch {
    git('fetch', '--no-tags', 'origin', 'main:refs/remotes/origin/main');
    return Number(git('rev-list', '--count', 'origin/main..HEAD'));
  }
}

export function tagExists(tag: string): boolean {
  const remote = git('ls-remote', '--tags', 'origin', `refs/tags/${tag}`);
  return remote.length > 0 || git('tag', '--list', tag).length > 0;
}
