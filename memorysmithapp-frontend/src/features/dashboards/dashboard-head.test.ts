/**
 * The head of a dashboard (#387): the name, the actions and the description
 * each hold an area of their own, so the length of the description never
 * moves the actions.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
const page = readFileSync(new URL('./DashboardsPage.tsx', import.meta.url), 'utf8');

describe('the head of a dashboard (#387)', () => {
  it('puts the actions at the right of the name and the description under both', () => {
    expect(css).toMatch(
      /\.dashboard-head \{\s*display: grid;\s*grid-template-columns: minmax\(0, 1fr\) auto;\s*grid-template-areas:\s*'name actions'\s*'desc desc';/,
    );
    expect(css).toMatch(/\.dashboard-actions \{\s*grid-area: actions;/);
  });

  it('puts the actions under the name on a phone', () => {
    expect(css).toMatch(/grid-template-areas:\s*'name'\s*'actions'\s*'desc';/);
  });

  it('places the name and the description in the head itself, not in a block of their own', () => {
    const head = page.slice(page.indexOf('<header className="dashboard-head">'));
    expect(head.indexOf('dashboard-name')).toBeLessThan(head.indexOf('dashboard-actions'));
    expect(head.slice(0, head.indexOf('dashboard-name'))).not.toContain('<div>');
  });
});
