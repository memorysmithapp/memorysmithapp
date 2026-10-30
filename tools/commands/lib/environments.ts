/**
 * The environments a tool may reach, as the infrastructure declares them.
 *
 * `memorysmithapp-infra/cdk.json` is the metadata of every environment: its
 * account, its region and its zone. A tool reads it as data, the way it reads
 * the outputs of a stack, and never imports the infrastructure that wrote it.
 * An installation of somebody else names the same things in the variables of
 * `memorysmithapp-infra/.env.<name>`, and cdk.json is not read for it (#342).
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readText, REPOSITORY_ROOT } from './repository.js';

export interface DeclaredEnvironment {
  readonly account?: string;
  readonly region?: string;
  readonly hostedZoneName?: string;
}

/** The environment `cdk.json` declares under this name, or undefined. */
export function declaredEnvironment(name: string): DeclaredEnvironment | undefined {
  const file = join(REPOSITORY_ROOT, 'memorysmithapp-infra', `.env.${name}`);
  if (existsSync(file)) process.loadEnvFile(file);
  if (process.env['INSTALLATION']?.trim()) {
    const zone = process.env['DOMAIN_NAME']?.trim();
    return {
      ...(process.env['AWS_ACCOUNT_ID'] ? { account: process.env['AWS_ACCOUNT_ID'] } : {}),
      ...(process.env['AWS_REGION'] ? { region: process.env['AWS_REGION'] } : {}),
      ...(zone ? { hostedZoneName: zone } : {}),
    };
  }
  const parsed = JSON.parse(readText('memorysmithapp-infra/cdk.json')) as {
    context: { environments: Record<string, DeclaredEnvironment | undefined> };
  };
  return parsed.context.environments[name];
}

/**
 * The id of a stack of an environment, the name its outputs are read under. It
 * is the convention of `memorysmithapp-infra/config/environments.ts`, and a
 * test of each side pins it to the same ids.
 */
export function stackIdOf(environment: string, name: string): string {
  const pascal = (text: string): string =>
    text
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  return `Memorysmith${pascal(process.env['INSTALLATION']?.trim() ?? '')}${pascal(environment)}${name}`;
}
