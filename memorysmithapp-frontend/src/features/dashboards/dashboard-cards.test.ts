/**
 * The cards of a dashboard: a table heads its columns as the agent named
 * them (#527), and a chart never holds its card wider than the card is (#528).
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { columnHeading } from './components';

const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

describe('the heading of a column of a table (#527)', () => {
  it('is the name the agent gave it', () => {
    expect(columnHeading('situacao', { names: { situacao: 'Situação' } })).toBe('Situação');
  });

  it("is the column's own name when the agent gave none", () => {
    expect(columnHeading('prazo', { names: { situacao: 'Situação' } })).toBe('prazo');
    expect(columnHeading('prazo', {})).toBe('prazo');
    expect(columnHeading('prazo', { names: ['Prazo'] })).toBe('prazo');
    expect(columnHeading('prazo', { names: { prazo: '' } })).toBe('prazo');
  });
});

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
