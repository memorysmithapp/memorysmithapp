/**
 * The cards of a dashboard: a chart never holds its card wider than the
 * card is (#528).
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

describe('the width of a card (#528)', () => {
  it('lays its content in one column that never grows past the card', () => {
    // An auto column grows to the width a chart was first drawn at: on a phone
    // layout widened to a computer's, or in the server's picture, the chart
    // kept the width of one column and spilled out of a card a third as wide.
    const card = /\n\.dashboard-card \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(card).toMatch(/display: grid;/);
    expect(card).toMatch(/grid-template-columns: minmax\(0, 1fr\);/);
  });
});
