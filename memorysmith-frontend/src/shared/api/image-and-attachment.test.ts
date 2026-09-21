/**
 * The two halves of the image family the specification finished: the
 * dimensions an image carries in its alt text (§3.14, RN-DSC-048) and the
 * attachment a notebook keeps beside its notes (§5.8, RN-DSC-049).
 *
 * The crossing between them is the pipe, and it is read by WHAT THE TARGET IS:
 * a note takes the alias, an attachment takes the dimensions, and a target
 * that resolves to neither takes the alias — because reading it as a dimension
 * would discard text an author wrote. Whichever it is, the pipe never changes
 * the target.
 */

import { describe, expect, it } from 'vitest';
import { readImageAlt } from './image-dimensions';
import { resolveWikilinks } from './markdown';
import { splitEmbeds } from './transclusion';

describe('the pipe in an alt text separates the description from the dimensions', () => {
  it('reads width and height, and keeps the description', () => {
    expect(readImageAlt('Engelbart|100x145')).toEqual({
      description: 'Engelbart',
      width: 100,
      height: 145,
    });
  });

  it('reads a width on its own, which keeps the aspect ratio', () => {
    expect(readImageAlt('Engelbart|100')).toEqual({
      description: 'Engelbart',
      width: 100,
      height: null,
    });
  });

  it('leaves a value that is not a dimension inside the description', () => {
    // Deleting what an author wrote into an accessibility label is the worse
    // of the two failures, so `large` stays and nothing is applied.
    expect(readImageAlt('Engelbart|large')).toEqual({
      description: 'Engelbart|large',
      width: null,
      height: null,
    });
    expect(readImageAlt('A curve|100x')).toEqual({
      description: 'A curve|100x',
      width: null,
      height: null,
    });
  });

  it('never drops the description, which is what a reader hears', () => {
    expect(readImageAlt('Engelbart').description).toBe('Engelbart');
    expect(readImageAlt('|100').description).toBe('');
  });
});

describe('an attachment is a file the notebook keeps, and not a name that looks like one', () => {
  /**
   * The extension decides NOTHING (#166). What a target is is decided by what
   * the notebook holds, which is what the page loaded — so every case below
   * says what is kept, and the two that matter most are the ones where the
   * name would have said the opposite.
   */
  const keeps = (name: string): boolean => ['esquema de blocos', 'engelbart.jpg'].includes(name);

  it('is what the notebook keeps, with an extension or without one', () => {
    // A name with no extension at all, which the old guess called a note.
    expect(resolveWikilinks('Ver ![[esquema de blocos]].', () => null, keeps)).toContain(
      'attachment:',
    );
    // And a name that looks like a file and is not one: nothing is kept
    // under it, so it is a pending link like any other.
    const out = resolveWikilinks('Ver ![[colheita-2026.csv]].', () => null, keeps);
    expect(out).toContain('pending:');
    expect(out).not.toContain('attachment:');
  });

  it('is reported as the file it is, and never as a pending note', () => {
    const out = resolveWikilinks('Ver ![[engelbart.jpg]] no arquivo.', () => null, keeps);

    expect(out).toContain('attachment:');
    expect(out).not.toContain('pending:');
    expect(out).toContain('engelbart.jpg');
  });

  /**
   * This case used to assert that the dimension does not reach the page as
   * text, and nothing else — which dropping it satisfied perfectly (#173). The
   * dimension is notation the specification declares, so what it has to do is
   * **arrive**: it travels with the address, after the encoded name, where
   * nothing else can be, and the reading surface takes it off there.
   */
  it('carries its dimensions in the same pipe, to the address and not to the page', () => {
    const both = resolveWikilinks('![[engelbart.jpg|100x145]]', () => null, keeps);
    // The `!` is still in front: this pass reads the wikilink, and stripping
    // the bang is `demoteEmbeds`, one step earlier in the real pipeline.
    expect(both).toBe('![engelbart.jpg](attachment:engelbart.jpg|100x145)');

    // A width on its own keeps the aspect ratio, and travels the same way.
    expect(resolveWikilinks('![[engelbart.jpg|120]]', () => null, keeps)).toBe(
      '![engelbart.jpg](attachment:engelbart.jpg|120)',
    );

    // A value that is not a dimension is not one: nothing is applied, and it
    // is not shown either, because the name of the file is what a file shows.
    expect(resolveWikilinks('![[engelbart.jpg|grande]]', () => null, keeps)).toBe(
      '![engelbart.jpg](attachment:engelbart.jpg)',
    );
  });

  it('is never transcluded, because there is no note to expand', () => {
    const segments = splitEmbeds('![[engelbart.jpg]] and ![[Lei 14.133]]', keeps);
    expect(segments.filter((each) => each.kind === 'embed')).toHaveLength(1);
    expect(
      segments.some((each) => each.kind === 'text' && each.text.includes('engelbart.jpg')),
    ).toBe(true);
  });
});

describe('the pipe is read by what the target is', () => {
  const resolve = (name: string): string | null => (name === 'Lei 14.133' ? '/v/a/lei' : null);

  it('shows the alias when the target is a note', () => {
    expect(resolveWikilinks('[[Lei 14.133|a nova lei]]', resolve)).toContain(
      '[a nova lei](/v/a/lei)',
    );
  });

  it('shows the alias when the target resolves to nothing', () => {
    // Reading it as a dimension would discard the text an author wrote.
    const out = resolveWikilinks('[[Uma nota futura|o apelido]]', resolve);
    expect(out).toContain('[o apelido](pending:');
  });

  it('never lets the pipe change the target', () => {
    const asked: string[] = [];
    resolveWikilinks('[[Lei 14.133|qualquer coisa]]', (name) => {
      asked.push(name);
      return null;
    });
    expect(asked).toEqual(['Lei 14.133']);
  });
});
