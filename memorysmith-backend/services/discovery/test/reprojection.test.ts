/**
 * The rebuild of the link graph (#102), and the one property the release is
 * checked against: after the retitling migration, NO EDGE IS LOST, and every
 * edge gained is one an alias explains.
 *
 * The notebook below is the shape of the real thing: three notes that pointed at
 * each other by slug, migrated so each states its name, plus a note carrying
 * an alias that used to answer nothing.
 */

import { describe, expect, it } from 'vitest';
import { noteName } from '@memorysmith/kernel';
import { extractLinks } from '../src/domain/LinkExtractor.js';
import { extractFrontmatterAliases } from '../src/domain/Aliases.js';
import { distinctEdges, resolveAll, type ReadNote } from '../src/adapters/reprojection.js';

/** A note as the rebuild reads it: from its bytes, by the current rules. */
function read(noteId: string, markdown: string): ReadNote {
  return {
    noteId,
    folderId: 'folder',
    name: noteName(markdown) ?? '',
    aliases: extractFrontmatterAliases(markdown),
    targets: extractLinks(markdown).map((link) => link.name),
  };
}

const edgesOf = (notes: ReadNote[]): string[] =>
  resolveAll(notes)
    .edges.map((edge) => `${edge.from}->${edge.to}`)
    .sort();

describe('rebuilding the graph of a migrated notebook', () => {
  const notebook = [
    read('lei', '---\nname: Lei 14.133\n---\n\nVer [[Recovery Time Objective]].\n'),
    read(
      'rto',
      '---\nname: Recovery Time Objective\naliases: [RTO, Objetivo de Recuperação]\n---\n\nVer [[Lei 14.133]].\n',
    ),
    read('ata', '---\nname: Reunião de Time\n---\n\nFalamos de [[RTO]] e da [[Lei 14.133]].\n'),
  ];

  it('finds every edge the notebook used to have', () => {
    // What the retired rule found: the two links written with the exact name
    // of their target, which slugified to the same thing on both sides.
    const before = ['ata->lei', 'lei->rto', 'rto->lei'];
    expect(edgesOf(notebook)).toEqual(expect.arrayContaining(before));
  });

  it('gains the edge an alias explains, and says which alias', () => {
    // `[[RTO]]` resolved to nothing under the retired rule, because no note was
    // called RTO. It is an edge now, and the report can name why.
    const gained = resolveAll(notebook).edges.find((edge) => edge.by === 'alias');
    expect(gained).toEqual({ from: 'ata', to: 'rto', target: 'RTO', by: 'alias' });
  });

  it('lets a name take back what an alias was answering', () => {
    // Non-monotonic resolution, seen from the rebuild: a note written under the
    // name somebody else was aliasing takes the edge away (RN-DSC-053).
    const withOwner = [...notebook, read('rto2', '---\nname: RTO\n---\n\nA sigla.\n')];
    const alias = resolveAll(withOwner).edges.filter((edge) => edge.by === 'alias');

    expect(alias).toEqual([]);
    expect(edgesOf(withOwner)).toContain('ata->rto2');
    expect(edgesOf(withOwner)).not.toContain('ata->rto');
  });

  it('writes one edge per note carrying the name, and never to itself', () => {
    // Two notes may carry one name (RN-KNW-037), and a link into both is two
    // edges, because there is no order to appeal to (RN-DSC-042).
    const twins = [
      read('a', '---\nname: Ata\n---\n\nVer [[Nota]].\n'),
      read('b', '---\nname: Nota\n---\n\nVer [[Nota]].\n'),
      read('c', '---\nname: Nota\n---\n\nOutra.\n'),
    ];
    expect(edgesOf(twins)).toEqual(['a->b', 'a->c', 'b->c']);
  });

  it('counts a target nothing answers to as pending, and makes no edge of it', () => {
    const orphan = [read('a', '---\nname: Ata\n---\n\nVer [[Uma nota que não existe]].\n')];
    const rebuilt = resolveAll(orphan);

    expect(rebuilt.edges).toEqual([]);
    expect(rebuilt.pending).toBe(1);
  });
});

/**
 * What the report counts is EDGES, and an edge is a pair (§5.4). The plan
 * resolves every target, so a note reaching one note by its name and by a
 * spelling of it answers twice — and counting those as two edges made a
 * notebook that is perfectly projected report a difference for ever (#163).
 */
describe('what the report of a rebuild counts', () => {
  const notebook = [
    read('fonte', '---\nname: Fonte\naliases: [A fonte]\n---\n\nThe source.\n'),
    read('outra', '---\nname: Outra\n---\n\nAnother note.\n'),
    read(
      'citando',
      '---\nname: Citando\n---\n\nBy name [[Fonte]], by spelling [[A fonte]], and [[Outra]].\n',
    ),
  ];

  it('answers one entry per target, which is what names the target in the report', () => {
    expect(
      resolveAll(notebook).edges.map((edge) => `${edge.from}->${edge.to} (${edge.target})`),
    ).toEqual(['citando->fonte (Fonte)', 'citando->fonte (A fonte)', 'citando->outra (Outra)']);
  });

  it('counts one edge per pair, keeping the target that answered first', () => {
    const edges = distinctEdges(resolveAll(notebook).edges);
    expect(edges.map((edge) => `${edge.from}->${edge.to}`)).toEqual([
      'citando->fonte',
      'citando->outra',
    ]);
    expect(edges[0]?.target).toBe('Fonte');
    expect(edges[0]?.by).toBe('name');
  });
});
