/**
 * The commands of `pnpm tools`: each one is found by its name, says what it
 * takes, and runs as its own process with its arguments untouched.
 */

import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAINTENANCE_JOBS } from '../commands/lib/maintenance.js';
import { commandNamed, GROUPS, helpOf, invocationOf, overview } from '../cli/registry.js';

const resolve = (specifier: string): string => `/resolved/${specifier}`;

describe('pnpm tools', () => {
  it('names onboarding, product data, the functional suite and the agent evaluation', () => {
    const names = GROUPS.flatMap((group) => group.commands.map((command) => command.name));
    expect(names).toEqual(['onboard', 'data', 'functional', 'agent-eval']);
    for (const name of names) expect(overview()).toContain(name);
  });

  it('runs every command from a file that exists', () => {
    for (const command of GROUPS.flatMap((group) => group.commands)) {
      const runner = command.runner;
      expect(existsSync(runner.kind === 'tsx' ? runner.entry : runner.config)).toBe(true);
    }
  });

  it('lists every maintenance job in the help of data', () => {
    const help = helpOf(commandNamed('data')!);
    for (const job of Object.keys(MAINTENANCE_JOBS)) expect(help).toContain(job);
  });

  it('hands a command its arguments as they came', () => {
    const data = invocationOf(
      commandNamed('data')!,
      ['recount-storage', '--environment', 'staging', '--apply'],
      resolve,
    );
    expect(data.file).toBe(process.execPath);
    expect(data.args[0]).toBe('/resolved/tsx/cli');
    expect(data.args.slice(2)).toEqual(['recount-storage', '--environment', 'staging', '--apply']);
  });

  it('runs the functional suite with the Playwright runner and its config', () => {
    const functional = invocationOf(commandNamed('functional')!, ['--project', 'api'], resolve);
    expect(functional.args.slice(0, 3)).toEqual(['/resolved/@playwright/test/cli', 'test', '-c']);
    expect(functional.args[3]).toMatch(/tools\/functional\/playwright\.config\.ts$/);
    expect(functional.args.slice(4)).toEqual(['--project', 'api']);
  });

  it('has no command that delivers', () => {
    expect(commandNamed('deliver')).toBeUndefined();
    expect(commandNamed('deploy')).toBeUndefined();
  });
});
