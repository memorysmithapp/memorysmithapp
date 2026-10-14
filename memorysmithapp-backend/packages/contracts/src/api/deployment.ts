/**
 * What a running environment says about itself (architecture-guide.md, 23.3).
 *
 * The environment and the version are configuration, never a constant of the
 * build: the artefact built from a commit is the same whichever environment it
 * goes to, and each function receives both as variables when it is deployed.
 * This is the one shape every surface reads them into.
 */

import { z } from 'zod';

export const deploymentEnvironmentSchema = z.enum(['production', 'staging', 'development']);

export const deploymentSchema = z.object({
  environment: deploymentEnvironmentSchema,
  /** `X.Y.Z` in production, `X.Y.Z-rc.N+sha7` in staging. */
  version: z.string().min(1),
  /** The commit the artefact was built from, when the deploy said. */
  commit: z.string().min(1).nullable(),
});

/** `GET /health` of the API: that it answers, and what it is. */
export const healthSchema = deploymentSchema.extend({
  status: z.literal('ok'),
});

/** Carried by every response of the API, and exposed through CORS. */
export const DEPLOYMENT_HEADERS = {
  environment: 'x-memorysmith-environment',
  version: 'x-memorysmith-version',
} as const;

export type DeploymentEnvironment = z.infer<typeof deploymentEnvironmentSchema>;
export type Deployment = z.infer<typeof deploymentSchema>;
export type HealthDto = z.infer<typeof healthSchema>;

export function isProduction(deployment: { readonly environment: string }): boolean {
  return deployment.environment === 'production';
}

/**
 * The deployment a function was given, from the variables the infrastructure
 * sets: `APP_ENVIRONMENT`, `APP_VERSION` and `APP_COMMIT`.
 *
 * An environment it does not recognise, or none, reads as `development`, and
 * never as `production`: a function that cannot say where it runs must not
 * claim to be the one place where nothing is declared.
 */
export function deploymentFromVariables(
  variables: Readonly<Record<string, string | undefined>>,
  fallbackVersion = 'unknown',
): Deployment {
  const environment = deploymentEnvironmentSchema.safeParse(variables['APP_ENVIRONMENT']);
  const commit = variables['APP_COMMIT'];
  return {
    environment: environment.success ? environment.data : 'development',
    version: variables['APP_VERSION'] || fallbackVersion,
    commit: commit && commit !== 'unknown' ? commit : null,
  };
}
