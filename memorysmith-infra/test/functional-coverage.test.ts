/**
 * The functional suite covers every route of the core and every page of the
 * interface (architecture-guide.md, section 19), checked where it costs
 * nothing: in the Quality stage, before anything is deployed. The routes come
 * from the manifest the core keeps equal to its app, and the pages from the
 * router itself. The tools are checked against the live connector, in the suite.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readText, REPOSITORY_ROOT } from '../commands/lib/repository.js';
import {
  coverageGap,
  declaredCases,
  describeGap,
  pagesOf,
} from '../functional/support/coverage.js';

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

  it('has a case for every page of the interface, and none for a page that is gone', () => {
    const pages = pagesOf(readText('memorysmith-frontend/src/app/router.tsx'));

    expect(describeGap('page', coverageGap(pages, declaredCases(specSources()).page))).toBeNull();
  });
});
