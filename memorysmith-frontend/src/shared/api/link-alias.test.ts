/**
 * What a target REACHES, which is the question the reading surface draws a
 * link by (#164, RN-DSC-046).
 *
 * The surface used to ask how many notes were NAMED that, counting the tree it
 * had already drawn. An alias is not in that tree — Knowledge reads nothing of
 * a note beyond its `name:` (rule 5) — so a target an alias answered counted
 * zero: the link was painted as a link to nothing and an embed of it expanded
 * nothing, while clicking it reached the note. The spellings now arrive from
 * Discovery, which is the context that reads them, and resolution here follows
 * the order the specification fixes: every note whose name matches, and only
 * when none does, every note carrying it as an alias (§5.2, steps 7 and 8).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FolderNode, NotebookStructure } from '../types/api';

vi.mock('./backend', () => ({
  getNotebookStructure: vi.fn(),
  getNotebookNames: vi.fn(),
}));

const backend = await import('./backend');
const source = await import('./source');

const NOTEBOOK = '01JBOOK';

function folder(id: string, notes: Array<{ id: string; name: string | null }>): FolderNode {
  return {
    id,
    parentId: null,
    name: id,
    slug: id,
    description: '',
    position: 0,
    hasTemplate: false,
    noteCount: notes.length,
    notes: notes.map((note) => ({ ...note, folderId: id })),
    children: [],
  };
}

const structure: NotebookStructure = {
  notebook: {
    id: NOTEBOOK,
    slug: 'caderno',
    name: 'Caderno',
    description: '',
    noteCount: 3,
    updatedAt: '2026-09-20T00:00:00.000Z',
  },
  guidance: null,
  guidanceRevision: null,
  effectiveRole: 'owner',
  folders: [
    folder('f1', [{ id: 'n1', name: 'Visão Geral' }]),
    folder('f2', [
      { id: 'n2', name: 'Visão Geral' },
      { id: 'n3', name: 'Lei 14.133' },
    ]),
  ],
};

/** What Discovery answers: the name each note states and what it is also called. */
const names = [
  { noteId: 'n1', name: 'Visão Geral', aliases: ['Visão Geral Notas 1'], folderId: 'f1' },
  {
    noteId: 'n2',
    name: 'Visão Geral',
    aliases: ['Visão Geral Notas 2', 'A outra'],
    folderId: 'f2',
  },
  { noteId: 'n3', name: 'Lei 14.133', aliases: ['LGL', 'A outra'], folderId: 'f2' },
];

beforeEach(async () => {
  vi.mocked(backend.getNotebookStructure).mockResolvedValue(structure);
  vi.mocked(backend.getNotebookNames).mockResolvedValue(names);
  await source.getNotebookStructure(NOTEBOOK);
  await source.getNotebookNames(NOTEBOOK);
});

describe('a target reaches a note by its name, or by a spelling it declares', () => {
  it('reaches the one note carrying the alias, and addresses it', () => {
    expect(source.notesReaching(NOTEBOOK, 'Visão Geral Notas 1')).toEqual(['n1']);
    expect(source.resolveNoteId(NOTEBOOK, 'Visão Geral Notas 1')).toBe('n1');
    // An address is written in lower case, whatever case the identifier
    // arrived in (RN-DSC-045).
    expect(source.wikilinkUrl(NOTEBOOK, 'Visão Geral Notas 1')).toBe(
      `/notebooks/${NOTEBOOK.toLowerCase()}/notes/n1`,
    );
  });

  it('reaches every note of a name, and the name wins over any alias', () => {
    expect(source.notesReaching(NOTEBOOK, 'Visão Geral')).toEqual(['n1', 'n2']);
    // The target is the choice, never one of the two notes.
    expect(source.wikilinkUrl(NOTEBOOK, 'Visão Geral')).toContain('/links/');
    expect(source.resolveNoteId(NOTEBOOK, 'Visão Geral')).toBeNull();
  });

  it('reaches both notes when two of them carry one spelling, which is a choice', () => {
    expect(source.notesReaching(NOTEBOOK, 'A outra')).toEqual(['n2', 'n3']);
    expect(source.wikilinkUrl(NOTEBOOK, 'A outra')).toContain('/links/');
  });

  it('reaches nothing when no name and no spelling answers, which is pending', () => {
    expect(source.notesReaching(NOTEBOOK, 'Nada ainda')).toEqual([]);
    expect(source.resolveNoteId(NOTEBOOK, 'Nada ainda')).toBeNull();
  });

  it('compares a spelling the way it compares a name: NFC, and nothing else folded', () => {
    expect(source.notesReaching(NOTEBOOK, 'Visão Geral Notas 1'.normalize('NFD'))).toEqual(['n1']);
    expect(source.notesReaching(NOTEBOOK, 'visão geral notas 1')).toEqual([]);
  });
});
