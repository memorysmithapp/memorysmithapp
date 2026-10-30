/**
 * The commands of `pnpm tools`, grouped by what they do to the product, and
 * what each one runs. Nothing here runs anything: `cli.ts` does.
 *
 * Every command keeps a runner of its own — a process of tsx for a command, the
 * Playwright runner for the functional suite — so its arguments, its exit code
 * and its refusals are exactly the ones it has when run alone.
 */

import { join } from 'node:path';
import { MAINTENANCE_JOBS } from '../commands/lib/maintenance.js';
import { REPOSITORY_ROOT } from '../commands/lib/repository.js';

const TOOLS = join(REPOSITORY_ROOT, 'tools');

export type Runner =
  | { readonly kind: 'tsx'; readonly entry: string }
  | { readonly kind: 'playwright'; readonly config: string };

export interface Command {
  readonly name: string;
  readonly summary: string;
  readonly usage: readonly string[];
  readonly runner: Runner;
  /** Subcommands named in the help, for a command that takes one. */
  readonly subcommands?: Readonly<Record<string, string>>;
}

export interface Group {
  readonly name: string;
  readonly summary: string;
  readonly commands: readonly Command[];
}

export const GROUPS: readonly Group[] = [
  {
    name: 'Accounts',
    summary: 'Bring a person into an environment',
    commands: [
      {
        name: 'onboard',
        summary:
          'Create an account and its subscription, or the first platform administrator of an empty pool',
        usage: [
          'pnpm tools onboard --environment staging [--email ana@example.com] [--name Ana]',
          '  [--quota 1GB] [--status active] [--set-password] [--locale en_US]',
        ],
        runner: { kind: 'tsx', entry: join(TOOLS, 'commands/onboard.ts') },
      },
    ],
  },
  {
    name: 'Product data',
    summary: 'Rebuild or clean what the product keeps, reporting first (ADR-010, ADR-017)',
    commands: [
      {
        name: 'data',
        summary: 'Run a maintenance job of the core; it writes only with --apply',
        usage: [
          'pnpm tools data <job> [--environment staging] [--apply]',
          'pnpm tools data reproject-links --environment staging --follow <execution>',
        ],
        runner: { kind: 'tsx', entry: join(TOOLS, 'commands/maintenance.ts') },
        subcommands: Object.fromEntries(
          Object.entries(MAINTENANCE_JOBS).map(([name, job]) => [
            name,
            'deletes' in job ? `deletes ${job.deletes}` : `rebuilds ${job.rebuilds}`,
          ]),
        ),
      },
    ],
  },
  {
    name: 'Evaluation',
    summary: 'Exercise a deployed environment from outside, through its surfaces',
    commands: [
      {
        name: 'functional',
        summary: 'The functional suite: a browser and API clients driving the product',
        usage: [
          'FUNCTIONAL_ENVIRONMENT=staging FUNCTIONAL_VERSION=<served> pnpm tools functional',
          '  [any argument of playwright test, such as --project api or a file filter]',
        ],
        runner: { kind: 'playwright', config: join(TOOLS, 'functional/playwright.config.ts') },
      },
      {
        name: 'agent-eval',
        summary: 'The agent evaluation: agents working with a person, scored case by case',
        usage: [
          'pnpm tools agent-eval --environment staging [--models sonnet,haiku] [--runs 3]',
          '  [--cases AE-00,AE-01] [--user-model sonnet] [--open-room]',
        ],
        runner: { kind: 'tsx', entry: join(TOOLS, 'agent-eval/run.ts') },
      },
    ],
  },
];

export function commandNamed(name: string): Command | undefined {
  return GROUPS.flatMap((group) => group.commands).find((command) => command.name === name);
}

/** The help of every command, by group. */
export function overview(): string {
  const lines = ['Usage: pnpm tools <command> [arguments]', ''];
  for (const group of GROUPS) {
    lines.push(`${group.name} — ${group.summary}`);
    for (const command of group.commands) {
      lines.push(`  ${command.name.padEnd(12)} ${command.summary}`);
    }
    lines.push('');
  }
  lines.push('pnpm tools <command> --help says what a command takes.');
  return lines.join('\n');
}

/** The help of one command. */
export function helpOf(command: Command): string {
  const lines = [command.summary, '', ...command.usage.map((line) => `  ${line}`)];
  if (command.subcommands) {
    lines.push('', 'Jobs:');
    for (const [name, summary] of Object.entries(command.subcommands)) {
      lines.push(`  ${name.padEnd(16)} ${summary}`);
    }
  }
  return lines.join('\n');
}

/** The process a command runs as: an executable and its arguments, with no shell. */
export function invocationOf(
  command: Command,
  args: readonly string[],
  resolve: (specifier: string) => string,
): { readonly file: string; readonly args: readonly string[] } {
  if (command.runner.kind === 'playwright') {
    return {
      file: process.execPath,
      args: [resolve('@playwright/test/cli'), 'test', '-c', command.runner.config, ...args],
    };
  }
  return {
    file: process.execPath,
    args: [resolve('tsx/cli'), command.runner.entry, ...args],
  };
}
