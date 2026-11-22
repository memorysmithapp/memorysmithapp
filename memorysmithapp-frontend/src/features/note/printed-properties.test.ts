/**
 * What a printed note shows of its properties, as its notebook's style says
 * (#530, RN-KNW-096).
 */

import { describe, expect, it } from 'vitest';
import { keysOf, printedProperties } from './printed-properties';

const NOTE = [
  ['tags', 'obra'],
  ['status', 'aberta'],
  ['data', '2026-11-22'],
  ['responsavel', 'Ana'],
] as const;

describe('the properties a printed note shows (#530)', () => {
  it('are every one of them, below the title, with no heading, by default', () => {
    expect(printedProperties(NOTE, { print: { place: 'start', keys: null, title: null } })).toEqual(
      { place: 'start', shown: NOTE, heading: null },
    );
  });

  it('are only the keys chosen, in their order, a key the note lacks left out', () => {
    const { shown, place, heading } = printedProperties(NOTE, {
      print: { place: 'end', keys: ['Responsavel', 'prazo', 'status'], title: 'Registro' },
    });
    expect(shown).toEqual([
      ['responsavel', 'Ana'],
      ['status', 'aberta'],
    ]);
    expect(place).toBe('end');
    expect(heading).toBe('Registro');
  });

  it('are none when the style prints none', () => {
    expect(printedProperties(NOTE, { print: 'none' })).toEqual({
      place: 'none',
      shown: [],
      heading: null,
    });
  });
});

describe('the keys typed on the Style page (#530)', () => {
  it('are the words between commas, and none typed prints them all', () => {
    expect(keysOf(' status, data ,,responsavel ')).toEqual(['status', 'data', 'responsavel']);
    expect(keysOf('  ,  ')).toBeNull();
    expect(keysOf('')).toBeNull();
  });
});
