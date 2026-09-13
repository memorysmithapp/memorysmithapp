/**
 * The configuration of the environment the page was served from, read at
 * runtime from `/config.json` (architecture-guide.md, 23.3).
 *
 * It used to be compiled in from `.env.local`, which made the bundle of one
 * environment unusable in another, and forced the interface to be built between
 * two backend deploys, once the API it talks to existed. Now one build serves
 * any environment: the release of each one publishes this file beside the
 * bundle, and the page reads it before rendering anything.
 */

import type { DeploymentEnvironment } from '@memorysmith/contracts';

export interface RuntimeConfig {
  /** Where the product API answers, with no trailing slash. */
  readonly apiOrigin: string;
  /** Where the sign-in page answers, with no trailing slash. */
  readonly cognitoDomain: string;
  /** The app client of the interface. */
  readonly cognitoClientId: string;
  readonly environment: DeploymentEnvironment;
  readonly version: string;
}

const ENVIRONMENTS: readonly DeploymentEnvironment[] = ['production', 'staging', 'development'];

let loaded: RuntimeConfig | null = null;

function text(raw: Record<string, unknown>, key: keyof RuntimeConfig): string {
  const value = raw[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`config.json has no "${key}", and the interface cannot start without it.`);
  }
  return value.trim();
}

/** A configuration, validated field by field, or an error naming what is missing. */
export function parseRuntimeConfig(raw: unknown): RuntimeConfig {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('config.json is not an object.');
  }
  const fields = raw as Record<string, unknown>;
  const environment = text(fields, 'environment');
  if (!ENVIRONMENTS.includes(environment as DeploymentEnvironment)) {
    throw new Error(`config.json names "${environment}", which is not an environment.`);
  }
  return {
    apiOrigin: text(fields, 'apiOrigin').replace(/\/$/, ''),
    cognitoDomain: text(fields, 'cognitoDomain').replace(/\/$/, ''),
    cognitoClientId: text(fields, 'cognitoClientId'),
    environment: environment as DeploymentEnvironment,
    version: text(fields, 'version'),
  };
}

/**
 * Reads `/config.json`, once, before the application renders. It is never
 * cached by the browser: the file changes with every release of the
 * environment, and its name does not.
 */
export async function loadRuntimeConfig(fetchImpl: typeof fetch = fetch): Promise<RuntimeConfig> {
  const response = await fetchImpl('/config.json', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`The configuration of this environment answered ${response.status}.`);
  }
  loaded = parseRuntimeConfig(await response.json());
  return loaded;
}

/** The configuration, for code that only runs once the application has started. */
export function runtimeConfig(): RuntimeConfig {
  if (!loaded) throw new Error('The runtime configuration was read before it was loaded.');
  return loaded;
}

/** The configuration when it is loaded, and null before, for code that may run either way. */
export function loadedRuntimeConfig(): RuntimeConfig | null {
  return loaded;
}
