/**
 * Transclusion, on the reading surface (RN-DSC-029 on the Discovery side).
 *
 * These are the rules that cannot be checked by looking at a screen: the cut
 * of a section, the one-level ceiling, and the pair of notes that embed each
 * other and used to be the way to hang the page.
 */

import { describe, expect, it } from 'vitest';
import { demoteEmbeds, sectionOf, splitEmbeds, EMBED_LIMIT } from './transclusion';

describe('splitting a body into text and embeds', () => {
  it('separates the embed from the prose around it', () => {
    const segments = splitEmbeds('Before.\n\n![[Target]]\n\nAfter.');

    expect(segments.map((segment) => segment.kind)).toEqual(['text', 'embed', 'text']);
    expect(segments[1]).toEqual({ kind: 'embed', target: 'Target', anchor: null });
  });

  it('carries the section along when the embed names one', () => {
    const [embed] = splitEmbeds('![[Norma 4.2#Exceções]]');

    expect(embed).toEqual({ kind: 'embed', target: 'Norma 4.2', anchor: 'Exceções' });
  });

  it('leaves a plain wikilink alone: only the bang form is an embed', () => {
    const segments = splitEmbeds('See [[Target]] for the rule.');

    expect(segments).toHaveLength(1);
    expect(segments[0]?.kind).toBe('text');
  });

  it('stops expanding at the ceiling and keeps the rest as references', () => {
    const body = Array.from({ length: EMBED_LIMIT + 3 }, (_, i) => `![[Note ${i}]]`).join('\n\n');
    const segments = splitEmbeds(body);
    const embeds = segments.filter((segment) => segment.kind === 'embed');
    const tail = segments[segments.length - 1];

    expect(embeds).toHaveLength(EMBED_LIMIT);
    // Demoted, never dropped: losing the reference would be worse than not
    // expanding it.
    expect(tail?.kind).toBe('text');
    expect(tail?.kind === 'text' && tail.text).toContain('[[Note 12]]');
    expect(tail?.kind === 'text' && tail.text).not.toContain('![[Note 12]]');
  });
});

describe('one level, and only one', () => {
  it('turns an embed into a link', () => {
    expect(demoteEmbeds('![[Target#Section]]')).toBe('[[Target#Section]]');
  });

  it('breaks the cycle of two notes that embed each other', () => {
    // A embeds B, and the body of B embeds A. The second level is demoted, so
    // rendering terminates by construction instead of by a depth counter.
    const bodyOfB = 'B says: ![[A]]';
    const inside = demoteEmbeds(bodyOfB);

    expect(inside).toBe('B says: [[A]]');
    expect(splitEmbeds(inside).every((segment) => segment.kind === 'text')).toBe(true);
  });
});

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
