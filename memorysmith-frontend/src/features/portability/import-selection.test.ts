/**
 * What a selection of a `.notebook` document means (#143, RN-PRT-017).
 *
 * The page draws what these answer and sends what `selectionOf` builds, so this
 * is where the rules of the selection are proved: a checkbox takes the whole
 * branch, a folder shows three states, a folder holding something selected is
 * written as a path, and the summary states the consequences.
 */

import { describe, expect, it } from 'vitest';
import type { NotebookDocument } from '@memorysmith/contracts';
import {
  countsOf,
  danglingLinks,
  everything,
  nameOf,
  nothing,
  selectionOf,
  stateOf,
  treeOf,
  twinNames,
  withBranch,
  withNode,
} from './import-selection';

const ROOT = '01JBQ2X0000000000000000001';
const CHILD = '01JBQ2X0000000000000000002';
const OTHER = '01JBQ2X0000000000000000003';
const N1 = '01JBQ2X000000000000000000A';
const N2 = '01JBQ2X000000000000000000B';
const N3 = '01JBQ2X000000000000000000C';

const body = (name: string, extra = ''): string => `---\nname: ${name}\n---\n\n${extra}`;

const DOCUMENT: NotebookDocument = {
  documentVersion: '1.0',
  exportedAt: '2026-09-17T12:00:00.000Z',
  notebook: { name: 'System reading', description: 'A notebook.', guidance: '# Guidance\n' },
  folders: [
    {
      folderId: ROOT,
      parentFolderId: null,
      name: '01 Context',
      description: 'Where it starts.',
      position: 'a0',
      template: '## Finding\n',
    },
    {
      folderId: CHILD,
      parentFolderId: ROOT,
      name: 'Decisions',
      description: 'What was decided.',
      position: 'a0',
      template: null,
    },
    {
      folderId: OTHER,
      parentFolderId: null,
      name: '02 Integrations',
      description: 'What it talks to.',
      position: 'a1',
      template: null,
    },
  ],
  notes: [
    {
      noteId: N1,
      folderId: ROOT,
      position: 'a0',
      createdAt: '2026-09-17T12:00:00.000Z',
      updatedAt: '2026-09-17T12:00:00.000Z',
      body: body('Actors', 'It points at [[ADR-002]].'),
    },
    {
      noteId: N2,
      folderId: CHILD,
      position: 'a0',
      createdAt: '2026-09-17T12:00:00.000Z',
      updatedAt: '2026-09-17T12:00:00.000Z',
      body: body('ADR-002'),
    },
    {
      noteId: N3,
      folderId: CHILD,
      position: 'a1',
      createdAt: '2026-09-17T12:00:00.000Z',
      updatedAt: '2026-09-17T12:00:00.000Z',
      body: body('ADR-002'),
    },
  ],
} as NotebookDocument;

const tree = treeOf(DOCUMENT);
const root = tree.folders[0]!;
const child = root.children[0]!;

describe('the tree of a document', () => {
  it('counts the notes of a branch, subfolders included', () => {
    // A folder that keeps its notes in subfolders never reads as empty.
    expect(root.noteCount).toBe(3);
    expect(child.noteCount).toBe(2);
    expect(tree.folders[1]?.noteCount).toBe(0);
  });

  it('names a note by the name: of its frontmatter, and nothing else', () => {
    expect(nameOf(body('Actors'))).toBe('Actors');
    expect(nameOf('# A heading\n\nNo frontmatter here.')).toBeNull();
    expect(nameOf('---\ntitle: Not a name\n---\n')).toBeNull();
  });
});

describe('the presets', () => {
  it('everything is the whole document', () => {
    const chosen = everything(tree);
    expect(chosen.guidance).toBe(true);
    expect(chosen.folders.size).toBe(3);
    expect(chosen.templates.size).toBe(1);
    expect(chosen.notes.size).toBe(3);
  });

  it('leaves the design of a notebook one selection away, with no preset for it', () => {
    /**
     * `Structure only` was a preset and is not any more: the Guidance and the
     * Template of each folder are items of the tree, so taking the notes out of
     * `everything` is the same thing and is what the tree does (RN-PRT-017).
     */
    const whole = everything(tree);
    const design = { ...whole, notes: new Set<string>() };
    expect(design.guidance).toBe(true);
    expect(design.folders.size).toBe(3);
    expect(design.templates.size).toBe(1);
    expect(design.notes.size).toBe(0);
  });
});

describe('choosing in the tree', () => {
  it('takes the whole branch on a checkbox, and gives it back', () => {
    const on = withBranch(nothing, root, true);
    expect(on.folders).toEqual(new Set([ROOT, CHILD]));
    expect(on.notes).toEqual(new Set([N1, N2, N3]));
    expect(stateOf(on, root)).toBe('on');
    expect(stateOf(withBranch(on, root, false), root)).toBe('off');
  });

  it('shows a folder as mixed when only part of it is selected', () => {
    const one = withNode(nothing, { kind: 'note', id: N2 }, true);
    expect(stateOf(one, root)).toBe('mixed');
    expect(stateOf(one, child)).toBe('mixed');
  });

  it('selects only the node when that is what was asked', () => {
    // The less common intent, which is why it is not the checkbox.
    const only = withNode(nothing, { kind: 'folder', id: ROOT }, true);
    expect(only.folders).toEqual(new Set([ROOT]));
    expect(only.notes.size).toBe(0);
  });
});

describe('what the summary states', () => {
  it('counts a folder nothing selected but holding something selected', () => {
    // It is written as a PATH: its name and its description, and no Template.
    const one = withNode(nothing, { kind: 'note', id: N2 }, true);
    const counts = countsOf(tree, one);
    expect(counts.folders).toBe(2);
    expect(counts.templates).toBe(0);
    expect(counts.notes).toBe(1);
    expect(counts.guidance).toBe(false);
  });

  it('counts the links a selection leaves pointing at notes left out', () => {
    const one = withNode(nothing, { kind: 'note', id: N1 }, true);
    expect(danglingLinks(DOCUMENT, one)).toBe(1);
    expect(danglingLinks(DOCUMENT, everything(tree))).toBe(0);
  });

  it('names a pair of notes that share a name in one folder, when both are selected', () => {
    // A folder holds one note of each name (RN-KNW-042), and the conflict is
    // resolved by leaving one out rather than by editing the file.
    expect(twinNames(DOCUMENT, everything(tree))).toEqual([{ folderId: CHILD, name: 'ADR-002' }]);
    const one = withNode(nothing, { kind: 'note', id: N2 }, true);
    expect(twinNames(DOCUMENT, one)).toEqual([]);
  });
});

describe('what travels to the server', () => {
  it('is the identifiers the document carries, and nothing derived', () => {
    const selection = selectionOf(withNode(nothing, { kind: 'note', id: N2 }, true));
    expect(selection).toEqual({
      guidance: false,
      history: false,
      folders: [],
      templates: [],
      notes: [N2],
    });
  });
});
