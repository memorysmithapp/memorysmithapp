/**
 * The manifest of the routes of the core (architecture-guide.md, section 19).
 *
 * The functional suite holds a case for every route, and it reads which routes
 * there are from `routes.json`, because it never imports the product. This keeps
 * that file equal to the routes the app really mounts: a route added, removed or
 * renamed fails here until the manifest says so.
 *
 *   WRITE_ROUTE_MANIFEST=1 pnpm -C memorysmith-backend/apps/core-monolith exec vitest run routes
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from './wiring.js';

const MANIFEST = fileURLToPath(new URL('../routes.json', import.meta.url));

describe('the route manifest', () => {
  it('lists every route the app mounts, and nothing else', () => {
    const mounted = [
      ...new Set(
        buildTestApp()
          // A middleware is registered for every method, and it is not a route.
          .app.routes.filter((route) => route.method !== 'ALL')
          .map((route) => `${route.method} ${route.path}`),
      ),
    ].sort();

    if (process.env['WRITE_ROUTE_MANIFEST']) {
      writeFileSync(MANIFEST, `${JSON.stringify(mounted, null, 2)}\n`);
    }
    expect(
      JSON.parse(readFileSync(MANIFEST, 'utf8')),
      'routes.json disagrees with the app: run this test with WRITE_ROUTE_MANIFEST=1',
    ).toEqual(mounted);
  });
});
