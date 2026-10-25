/**
 * The environments a tool may reach, as the infrastructure declares them.
 *
 * `memorysmithapp-infra/cdk.json` is the metadata of every environment: its
 * account, its region and its zone. A tool reads it as data, the way it reads
 * the outputs of a stack, and never imports the infrastructure that wrote it.
 */

import { readText } from './repository.js';

export interface DeclaredEnvironment {
  readonly account?: string;
  readonly region?: string;
  readonly hostedZoneName?: string;
}

/** The environment `cdk.json` declares under this name, or undefined. */
export function declaredEnvironment(name: string): DeclaredEnvironment | undefined {
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
  return `Memorysmith${environment.charAt(0).toUpperCase()}${environment.slice(1)}${name}`;
}
