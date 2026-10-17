/**
 * Every word of the editor in both locales (#300): the package names each one
 * it shows, and a word a locale leaves out reaches a person in English.
 */

import { describe, expect, it } from 'vitest';
import { ENGLISH } from '@memorysmithapp/markdown-renderer';
import en from '../../i18n/locales/en_US.json' with { type: 'json' };
import pt from '../../i18n/locales/pt_BR.json' with { type: 'json' };

const KEYS = Object.keys(ENGLISH.editor).map((key) =>
  key === 'attachQueued' ? 'attachQueued_other' : key,
);

describe('the words of the editor', () => {
  it.each([
    ['en_US', en.noteEditor as Record<string, string>],
    ['pt_BR', pt.noteEditor as Record<string, string>],
  ])('are all in %s', (_, words) => {
    expect(KEYS.filter((key) => !words[key])).toEqual([]);
  });

  it('are in Portuguese in pt_BR, and not the English left in place', () => {
    const words = pt.noteEditor as Record<string, string>;
    // A word that is the same in both languages is fine; most are not.
    const same = KEYS.filter(
      (key) => words[key] === (en.noteEditor as Record<string, string>)[key],
    );
    expect(same.length).toBeLessThan(KEYS.length / 10);
  });
});
