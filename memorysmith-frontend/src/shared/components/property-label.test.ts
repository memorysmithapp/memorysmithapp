/**
 * The reserved vocabulary is written in en-US and may be READ in another
 * language (RN-DSC-030), and the properties of a note are drawn in a declared
 * order (RN-DSC-051).
 *
 * The translation stops at the label. The bytes of the note, what the export
 * writes, and what the search answers all keep the en-US key, which is what
 * makes a notebook kept in Portuguese answer `created:2026-09` and still read as
 * Portuguese on screen.
 *
 * The list is not written here either: it comes from the specification, so a
 * change that reserves one more name reserves it in this test too — and
 * the label guard below is what turns that into a failing build rather than a
 * key nobody translated.
 */

import { describe, expect, it } from 'vitest';
import { DRAWN_RESERVED_KEYS } from '@memorysmith/contracts';
import { orderedProperties, propertyLabel, propertyType, readableValue } from './PropertyValue';
import en from '../../i18n/locales/en_US.json' with { type: 'json' };
import pt from '../../i18n/locales/pt_BR.json' with { type: 'json' };

/** A translator that makes the lookup visible. */
const t = (key: string): string => `<${key}>`;

describe('a reserved key is labelled as it is written (#218)', () => {
  it('reads tags and aliases in lowercase in both locales, as every other key', () => {
    // Every agent and every Template writes the frontmatter in lowercase, and
    // the panel showed two keys capitalised, in pt_BR in another word.
    for (const key of ['tags', 'aliases']) {
      expect((en.reserved as Record<string, string>)[key]).toBe(key);
      expect((pt.reserved as Record<string, string>)[key]).toBe(key);
    }
  });
});

describe('a reserved key may be shown translated', () => {
  it.each([...DRAWN_RESERVED_KEYS])('translates %s', (key) => {
    expect(propertyLabel(key, t)).toBe(`<reserved.${key}>`);
  });

  it('has a label in both locales for every reserved key it draws', () => {
    // The guard that makes a fourth reserved name a failing build instead of
    // a key drawn in en-US inside a screen in Portuguese.
    for (const key of DRAWN_RESERVED_KEYS) {
      expect((en.reserved as Record<string, string>)[key], `en_US label for ${key}`).toBeTruthy();
      expect((pt.reserved as Record<string, string>)[key], `pt_BR label for ${key}`).toBeTruthy();
    }
  });
});

describe('every other attribute keeps the name whoever wrote the note gave it', () => {
  it('leaves an attribute the notebook invented alone', () => {
    expect(propertyLabel('maturity', t)).toBe('maturity');
    expect(propertyLabel('norma', t)).toBe('norma');
  });

  it('does not translate an attribute that merely reads like a reserved one', () => {
    // `etiquetas` is somebody's own key, in their own language, and renaming
    // it on screen would be the interface deciding what their notebook means.
    expect(propertyLabel('etiquetas', t)).toBe('etiquetas');
    expect(propertyLabel('Tags', t)).toBe('Tags');
  });
});

describe('the properties are drawn in a declared order (RN-DSC-051)', () => {
  const drawn = (entries: Array<[string, string]>): string[] =>
    orderedProperties(entries).map(([key]) => key);

  it('puts the reserved keys first, in the order of the specification', () => {
    const written: Array<[string, string]> = [
      ['maturity', 'seed'],
      ['tags', 'contracts'],
      ['norma', 'federal'],
      ['aliases', 'RTO'],
    ];
    expect(drawn(written)).toEqual(['aliases', 'tags', 'maturity', 'norma']);
  });

  it('keeps the vocabulary of the notebook in the order the note wrote it', () => {
    const written: Array<[string, string]> = [
      ['zeta', '1'],
      ['alfa', '2'],
      ['tags', 'contracts'],
    ];
    expect(drawn(written)).toEqual(['tags', 'zeta', 'alfa']);
  });

  it('draws who wrote a note and when as ordinary properties, under the keys as written', () => {
    // They are not reserved: the history answers them, and a notebook that writes
    // them chose the key, so the screen keeps it untranslated and in its place.
    expect(
      drawn([
        ['updated', '2026-09-09'],
        ['author', 'Ana'],
        ['tags', 'contracts'],
        ['created', '2026-09-01'],
      ]),
    ).toEqual(['tags', 'updated', 'author', 'created']);
    expect(propertyLabel('author', t)).toBe('author');
    expect(propertyLabel('created', t)).toBe('created');
  });

  it('never draws the name as a property, because a note is not a category of itself', () => {
    expect(
      drawn([
        ['name', 'Lei 14.133'],
        ['maturity', 'seed'],
      ]),
    ).toEqual(['maturity']);
  });

  it('draws a title as the ordinary property it is, because it names nothing', () => {
    expect(
      drawn([
        ['name', 'Lei 14.133'],
        ['title', 'Lei geral de licitações'],
      ]),
    ).toEqual(['title']);
  });
});

/**
 * A boolean and a date are drawn in the locale of the reader, and the typed
 * value stays what it was (#193).
 */
describe('a boolean or a date is drawn as the reader reads it', () => {
  const words = (key: string): string =>
    ({ 'note.propertyTrue': 'Sim', 'note.propertyFalse': 'Não' })[key] ?? key;

  it.each([
    ['true', 'Sim'],
    ['yes', 'Sim'],
    ['False', 'Não'],
    ['no', 'Não'],
  ])('%s is %s', (typed, drawn) => {
    expect(readableValue(typed, propertyType(typed, false), 'pt-BR', words)).toBe(drawn);
  });

  it('writes a date the way the locale does, on the day that was typed whatever the zone', () => {
    expect(readableValue('2026-09-21', 'date', 'pt-BR', words)).toBe('21 de set. de 2026');
    expect(readableValue('2026-09-21', 'date', 'en-US', words)).toBe('Sep 21, 2026');
  });

  it('carries the time when the note wrote one', () => {
    expect(readableValue('2026-09-21T14:30', 'date', 'en-US', words)).toMatch(/Sep 21, 2026.*2:30/);
  });

  it('leaves a date that does not exist as it was typed, and text as text', () => {
    expect(readableValue('2026-02-31', 'date', 'pt-BR', words)).toBeNull();
    expect(readableValue('draft', 'text', 'pt-BR', words)).toBeNull();
  });
});
