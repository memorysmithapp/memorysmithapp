/**
 * What a deploy says about itself (architecture-guide.md, section 23.3).
 *
 * The environment, the version and the commit arrive as CDK context
 * (`-c environment=… -c version=… -c commit=…`), from whatever runs the deploy.
 * None of them is ever a constant of the build: every function receives all
 * three as variables, the interface reads them from `/config.json`, and every
 * stack of the product carries the version and the commit as tags. A deploy
 * that says nothing is production, serving the version of this package.
 */

import { Tags, type Stack } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import pkg from '../package.json' with { type: 'json' };

export interface Deployment {
  readonly environment: string;
  readonly version: string;
  readonly commit: string;
}

export function deploymentOf(scope: Construct): Deployment {
  const context = (key: string): string | undefined => {
    const value: unknown = scope.node.tryGetContext(key);
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
  };
  return {
    environment: context('environment') ?? 'production',
    version: context('version') ?? pkg.version,
    commit: context('commit') ?? 'unknown',
  };
}

/**
 * Tags the stacks a deploy delivers with the version and the commit they serve.
 * Only those: the pipeline delivers every version, so a version written on it
 * would be false by construction, and it was, saying `0.5.7` and `unknown` on a
 * pipeline that had just delivered `0.6.0-rc.87`.
 */
export function tagDelivery(stacks: readonly Stack[], deployment: Deployment): void {
  for (const stack of stacks) {
    Tags.of(stack).add('app:version', deployment.version);
    Tags.of(stack).add('deploy:sha', deployment.commit);
  }
}

/** The variables every function of a deploy receives. */
export function deploymentVariables(deployment: Deployment): Record<string, string> {
  return {
    APP_ENVIRONMENT: deployment.environment,
    APP_VERSION: deployment.version,
    APP_COMMIT: deployment.commit,
  };
}
