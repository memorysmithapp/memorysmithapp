/**
 * `pnpm tools`: the tools that operate and evaluate the product from outside.
 *
 *   pnpm tools --help
 *   pnpm tools <command> --help
 *   pnpm tools <command> [arguments]
 *
 * Delivering an environment is not one of them: it belongs to the
 * infrastructure (`pnpm -C memorysmithapp-infra deliver`). A command runs as a
 * process of its own, with its arguments untouched, and its exit code is this
 * one's.
 */

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { commandNamed, helpOf, invocationOf, overview } from './cli/registry.js';

const [name, ...args] = process.argv.slice(2);

if (!name || name === '--help' || name === '-h' || name === 'help') {
  process.stdout.write(`${overview()}\n`);
  process.exit(name ? 0 : 1);
}

const command = commandNamed(name);
if (!command) {
  console.error(`There is no command called "${name}".\n\n${overview()}`);
  process.exit(1);
}
if (args[0] === '--help' || args[0] === '-h') {
  process.stdout.write(`${helpOf(command)}\n`);
  process.exit(0);
}

const require = createRequire(import.meta.url);
const invocation = invocationOf(command, args, (specifier) => require.resolve(specifier));
const run = spawnSync(invocation.file, [...invocation.args], { stdio: 'inherit' });
if (run.error) {
  console.error(run.error.message);
  process.exit(1);
}
process.exit(run.status ?? 1);
