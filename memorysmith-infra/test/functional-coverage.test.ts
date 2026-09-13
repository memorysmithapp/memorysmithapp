/**
 * The functional suite covers every route of the core (architecture-guide.md,
 * section 19), checked where it costs nothing: in the Quality stage, before
 * anything is deployed, against the manifest the core keeps equal to its app.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readText, REPOSITORY_ROOT } from '../commands/lib/repository.js';
import { coverageGap, declaredCases, describeGap } from '../functional/support/coverage.js';

function specSources(): string[] {
  const root = join(REPOSITORY_ROOT, 'memorysmith-infra', 'functional');
  return readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.spec.ts'))
    .map((file) => readFileSync(join(root, file), 'utf8'));
}

describe('the coverage of the functional suite', () => {
  it('has a case for every route of the core, and none for a route that is gone', () => {
    const routes = JSON.parse(
      readText('memorysmith-backend/apps/core-monolith/routes.json'),
    ) as string[];

    expect(
      describeGap('route', coverageGap(routes, declaredCases(specSources()).route)),
    ).toBeNull();
  });
});
