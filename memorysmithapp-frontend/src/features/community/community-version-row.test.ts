/**
 * A version row of a community model (#384): its button is never squeezed out
 * by its changelog. The frame of its own the community pages had (#385, #410)
 * left with #418: they are pages of the application, under its menu.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('a version row of a community model (#384)', () => {
  const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

  it('has a column for each of its four items, so its button keeps its width', () => {
    expect(css).toMatch(
      /\.model-version\.is-public \{\s*grid-template-columns: auto auto minmax\(0, 1fr\) auto;/,
    );
  });
});
