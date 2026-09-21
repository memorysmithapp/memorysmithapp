/**
 * The name of a note (§5.3), and the frontmatter reader it stands on (§6.1,
 * §6.2).
 *
 * The `name/` cases of the conformance suite run against the same function in
 * Discovery. These are here as well because each one is a decision two
 * implementations would otherwise take differently, and the kernel is where
 * the decision lives.
 */

import { describe, expect, it } from 'vitest';
import { noteName } from '../src/note-name.js';
import { bodyWithoutFrontmatter, frontmatterBlock, frontmatterOf } from '../src/frontmatter.js';

describe('noteName: the name is what the frontmatter states', () => {
  it('is the stated value', () => {
    expect(noteName('---\nname: Lei 14.133\n---\n\nThe general rule.\n')).toBe('Lei 14.133');
  });

  it('is not capped at forty characters, because a name is never a category', () => {
    const long = 'Plano de continuidade de negócios e recuperação de desastres';
    expect(long.length).toBeGreaterThan(40);
    expect(noteName(`---\nname: ${long}\n---\n\n# PCN\n\nO plano.\n`)).toBe(long);
  });

  it('reads a name written in pt-BR as a name', () => {
    expect(noteName('---\nname: Recuperação de desastre\n---\n\n# RD\n\nO plano.\n')).toBe(
      'Recuperação de desastre',
    );
  });

  it('reads the value literally, with no inline parsing', () => {
    expect(noteName('---\nname: "**Lei** 14.133"\n---\n')).toBe('**Lei** 14.133');
  });

  it('trims the value and strips one layer of quotes', () => {
    expect(noteName('---\nname: "  Lei 14.133  "\n---\n')).toBe('Lei 14.133');
    expect(noteName("---\nname: 'Lei 14.133'\n---\n")).toBe('Lei 14.133');
  });
});

describe('noteName: a heading is only content', () => {
  it('gives a note with a level-1 heading and no name: no name', () => {
    expect(noteName('# Lei 14.133\n\nThe general rule.\n')).toBeNull();
  });

  it('gives a Setext heading no say either', () => {
    expect(noteName('Lei 14.133\n==========\n\nThe general rule.\n')).toBeNull();
  });

  it('keeps the name when a heading beside it says something else', () => {
    expect(noteName('---\nname: Lei 14.133\n---\n\n# The general rule\n\nThe body.\n')).toBe(
      'Lei 14.133',
    );
  });

  it('is not displaced by, nor read from, any other key', () => {
    expect(noteName('---\ntags: [contracts]\n---\n\n# Lei 14.133\n')).toBeNull();
    expect(noteName('---\ntitle: Lei 14.133\n---\n\nThe general rule.\n')).toBeNull();
  });

  it('reads nothing when the block does not open the document', () => {
    expect(noteName('Intro.\n\n---\nname: Lei 14.133\n---\n')).toBeNull();
  });
});

describe('noteName: a name of the wrong shape is no name, and never an error', () => {
  it('is no name when empty, and nothing falls through to the heading', () => {
    expect(noteName('---\nname:\n---\n\n# Lei 14.133\n')).toBeNull();
  });

  it('is no name when it is a list, inline or dashed', () => {
    expect(noteName('---\nname: [one, two]\n---\n\n# Lei 14.133\n')).toBeNull();
    expect(noteName('---\nname:\n  - Lei 14.133\n  - Lei 14133\n---\n\n# Lei 14.133\n')).toBeNull();
  });

  it.each(['#', '[', ']', '|'])('is no name when it carries %s', (delimiter) => {
    expect(noteName(`---\nname: Lei ${delimiter} 14.133\n---\n\n# Lei 14.133\n`)).toBeNull();
  });
});

describe('noteName: what is true of a name once it is read', () => {
  it('normalises to NFC, so one note is not two', () => {
    const decomposed = 'Ação'.normalize('NFD');
    expect(noteName(`---\nname: ${decomposed}\n---\n`)).toBe('Ação'.normalize('NFC'));
  });

  it('folds nothing else: case is exact', () => {
    expect(noteName('---\nname: Lei\n---\n')).toBe('Lei');
    expect(noteName('---\nname: lei\n---\n')).toBe('lei');
  });

  it('accepts a slash, because folders play no part in identity', () => {
    expect(noteName('---\nname: Reunião 03/09/2026\n---\n')).toBe('Reunião 03/09/2026');
    expect(noteName('---\nname: and/or\n---\n')).toBe('and/or');
  });
});

describe('the frontmatter block', () => {
  it('is read only when the document opens with it', () => {
    expect(frontmatterBlock('---\nname: Lei\n---\n\nBody.\n')).toBe('name: Lei');
    expect(frontmatterBlock('\n---\nname: Lei\n---\n')).toBeNull();
    expect(frontmatterBlock('Body.\n\n---\n\nMore body.\n')).toBeNull();
  });

  it('takes no part in the body', () => {
    expect(bodyWithoutFrontmatter('---\nname: Lei\n---\n\n# Lei\n')).toBe('\n# Lei\n');
    expect(bodyWithoutFrontmatter('# Lei\n')).toBe('# Lei\n');
  });

  it('reads scalars, inline lists and dash lists, and carries the written form out', () => {
    const frontmatter = frontmatterOf(
      '---\nname: Lei 14.133\ntags: [contracts, budget]\naliases:\n  - Lei de licitações\nempty:\n---\n',
    );
    expect(frontmatter['name']).toEqual({ written: 'scalar', values: ['Lei 14.133'] });
    expect(frontmatter['tags']).toEqual({ written: 'list', values: ['contracts', 'budget'] });
    expect(frontmatter['aliases']).toEqual({ written: 'list', values: ['Lei de licitações'] });
    expect(frontmatter['empty']).toEqual({ written: 'scalar', values: [] });
  });

  it('tells a list of one item from a scalar, because they are not the same attribute', () => {
    expect(frontmatterOf('---\ntags: [contracts]\n---')['tags']?.written).toBe('list');
    expect(frontmatterOf('---\ntags: contracts\n---')['tags']?.written).toBe('scalar');
  });

  it('is empty when there is no block', () => {
    expect(frontmatterOf('# Lei 14.133\n')).toEqual({});
  });
});
