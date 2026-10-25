/**
 * Where the repository is, and how a tool reads a file of it. A tool reads the
 * repository as data and never imports the projects in it.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export function readText(path: string): string {
  return readFileSync(join(REPOSITORY_ROOT, path), 'utf8');
}
