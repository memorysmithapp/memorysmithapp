/**
 * Where this connector runs, as an agent is told it (RN-AGT-026).
 *
 * An agent connected to staging writes exactly as it would in production, and
 * nothing in the notebooks tells the two apart. So outside production the
 * connector says it before the agent writes anything: in the handshake, and at
 * the top of `whoami`. In production it says nothing, and the version it
 * announces is the released one.
 */

import { isProduction, type Deployment } from '@memorysmith/contracts';
import pkg from '../../package.json' with { type: 'json' };

/**
 * The version of the service manifest, derived and never written beside it: a
 * literal here would still say 0.2.0 three releases later. It is what a
 * deployment that declares no version announces.
 */
export const SERVICE_VERSION: string = pkg.version;

/** What a caller that passes no deployment gets, which is production. */
export const PRODUCTION_DEFAULT: Deployment = {
  environment: 'production',
  version: SERVICE_VERSION,
  commit: null,
};

/** The sentence an agent is told outside production, or null in production. */
export function environmentNotice(deployment: Deployment): string | null {
  if (isProduction(deployment)) return null;
  return (
    `This is the ${deployment.environment} environment of MemorySmith, running ` +
    `${deployment.version}. What is written here is disposable: the environment is ` +
    'rebuilt and its notebooks go with it, so do not bring into it anything that has to be kept.'
  );
}
