/**
 * Where each parameter reference stands (§7.14), which decides how a value is
 * written there when a notebook is created from a model: a whole value of the
 * frontmatter is replaced with its quotes, a wikilink target names a note.
 */

import { describe, expect, it } from 'vitest';
import { parameterReferences, textReferences } from '../src/parameter-references.js';

describe('the place of a parameter reference', () => {
  const note = [
    '---',
    'name: "Assembly of {{condominium}}"',
    'manager: "{{manager}}"',
    'due: {{date}}',
    'blocks: ["{{block}}", B]',
    '---',
    '# Assembly of {{condominium}}',
    '',
    'Chaired by [[{{manager}}]] and [[Lei 14.133|{{city}}]].',
  ].join('\n');
  const found = parameterReferences(note);
  const at = (reference: { start: number; end: number }) =>
    note.slice(reference.start, reference.end);

  it('says a whole value of the frontmatter, and where the value is written', () => {
    const manager = found.find((each) => each.name === 'manager' && each.value);
    expect(manager?.place).toBe('frontmatter-value');
    expect(note.slice(manager!.value!.start, manager!.value!.end)).toBe('"{{manager}}"');
    const due = found.find((each) => each.name === 'date');
    expect(due?.place).toBe('frontmatter-value');
    expect(note.slice(due!.value!.start, due!.value!.end)).toBe('{{date}}');
    const block = found.find((each) => each.name === 'block');
    expect(note.slice(block!.value!.start, block!.value!.end)).toBe('"{{block}}"');
  });

  it('says text inside a value of the frontmatter', () => {
    const title = found.find((each) => each.place === 'frontmatter-text');
    expect(title?.name).toBe('condominium');
    expect(at(title!)).toBe('{{condominium}}');
  });

  it('tells the target of a wikilink from its alias, and both from text', () => {
    const body = found.filter(
      (each) => each.place !== 'frontmatter-value' && each.place !== 'frontmatter-text',
    );
    expect(body.map((each) => [each.name, each.place])).toEqual([
      ['condominium', 'text'],
      ['manager', 'wikilink-target'],
      ['city', 'text'],
    ]);
    for (const each of body) expect(at(each)).toBe(`{{${each.name}}}`);
  });

  it('reads plain text with nothing but the escapes', () => {
    expect(
      textReferences('Notebook of {{client}} and \\{{literal}}').map((each) => each.name),
    ).toEqual(['client']);
  });
});
