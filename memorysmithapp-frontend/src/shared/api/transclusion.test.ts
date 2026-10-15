/**
 * The section a preview of a part cuts (#260). How an embed expands is the
 * renderer's, and is held by its own suite and by the conformance cases of
 * the reading surface (#291).
 */

import { describe, expect, it } from 'vitest';
import { sectionOf } from './transclusion';

describe('cutting a section', () => {
  const document = [
    '# Norma 4.2',
    '',
    'Intro.',
    '',
    '## Exceções',
    '',
    'A primeira exceção.',
    '',
    '### Detalhe',
    '',
    'Ainda dentro das exceções.',
    '',
    '## Vigência',
    '',
    'Outra seção.',
  ].join('\n');

  it('cuts from the heading to the next one of equal or higher level', () => {
    const cut = sectionOf(document, 'Exceções') ?? '';

    expect(cut).toContain('## Exceções');
    expect(cut).toContain('A primeira exceção.');
    // A deeper heading belongs to the section; a sibling ends it.
    expect(cut).toContain('### Detalhe');
    expect(cut).not.toContain('## Vigência');
  });

  it('matches the anchor by slug, so accents and case do not decide', () => {
    expect(sectionOf(document, 'excecoes')).not.toBeNull();
    expect(sectionOf(document, 'EXCEÇÕES')).not.toBeNull();
  });

  it('runs to the end of the document when nothing closes the section', () => {
    const cut = sectionOf(document, 'Vigência') ?? '';

    expect(cut).toContain('Outra seção.');
  });

  it('answers null when the section is not there, instead of guessing', () => {
    expect(sectionOf(document, 'Revogação')).toBeNull();
  });
});
