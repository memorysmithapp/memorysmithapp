/**
 * What a selection of a `.notebook` document means (#143, RN-PRT-017).
 *
 * The page draws what these answer and sends what `selectionOf` builds, so this
 * is where the rules of the selection are proved: a scope decides which species
 * travel, a checkbox takes the whole branch of one species, a folder that was
 * not chosen but holds something that was is written as a path, and the summary
 * states the consequences.
 */

import { describe, expect, it } from 'vitest';
import type { NotebookDocument } from '@memorysmith/contracts';
import {
  countsOf,
  danglingLinks,
  effectiveOf,
  everything,
  nameOf,
  offeredFolders,
  pickBranch,
  pickOne,
  pickedNothing,
  scopeCountsOf,
  seedOf,
  selectionOf,
  stateOfBranch,
  treeOf,
  twinNames,
  twinNoteIds,
  wholeScope,
  type Chosen,
  type Picked,
  type Scope,
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
  files: [
    {
      name: 'engelbart.jpg',
      description: 'A face.',
      mimeType: 'image/jpeg',
      tags: [],
      path: '/',
      bytes: 'AAAA',
    },
    {
      name: 'esquema.png',
      description: 'A drawing.',
      mimeType: 'image/png',
      tags: [],
      path: '/desenhos',
      bytes: 'AAAAAAAA',
    },
  ],
} as NotebookDocument;

const tree = treeOf(DOCUMENT);
const root = tree.folders[0]!;
const child = root.children[0]!;

/** A scope over the whole one, which is where the chooser opens. */
const scopeOf = (
  over: Partial<Omit<Scope, 'reach'>> & { reach?: Partial<Scope['reach']> },
): Scope => ({
  ...wholeScope,
  ...over,
  reach: { ...wholeScope.reach, ...(over.reach ?? {}) },
});

/** What somebody ticked, from the identifiers alone. */
const pick = (over: Partial<Record<keyof Picked, string[]>>): Picked => ({
  folders: new Set(over.folders ?? []),
  templates: new Set(over.templates ?? []),
  notes: new Set(over.notes ?? []),
  files: new Set(over.files ?? []),
});

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

/**
 * The scope: which species travel, and how much of each (#161).
 *
 * The chooser opens on everything, and what a person does from there is take
 * things out — which is why a scope is stored and a selection is derived. A
 * selection held as state could not be unticked: letting the Guidance go
 * emptied the set, which made `everything` answer again, which ticked it back.
 */
describe('the scope', () => {
  it('opens on the whole document', () => {
    const chosen = everything(tree);
    expect(chosen.guidance).toBe(true);
    expect(chosen.folders.size).toBe(3);
    expect(chosen.templates.size).toBe(1);
    expect(chosen.notes.size).toBe(3);
  });

  it('leaves the design of a notebook one box away', () => {
    // `Structure only` was a preset and is not any more: the notes are a
    // species of the scope, so taking them out is one click (RN-PRT-017).
    const design = effectiveOf(tree, scopeOf({ notes: false }), pickedNothing);
    expect(design.guidance).toBe(true);
    expect(design.folders.size).toBe(3);
    expect(design.templates.size).toBe(1);
    expect(design.notes.size).toBe(0);
  });

  it('carries nothing of a species that is switched off', () => {
    const noTemplates = effectiveOf(tree, scopeOf({ templates: false }), pickedNothing);
    expect(noTemplates.templates.size).toBe(0);
    expect(noTemplates.folders.size).toBe(3);
  });

  it('empties the Templates and the notes when the folders go', () => {
    // A Template and a note belong to a folder, so neither can travel without
    // one. It was always true and the screen never said it (#161).
    const none = effectiveOf(tree, scopeOf({ folders: false }), pickedNothing);
    expect(none.folders.size).toBe(0);
    expect(none.templates.size).toBe(0);
    expect(none.notes.size).toBe(0);
    // And the Guidance is not a folder, so it is untouched.
    expect(none.guidance).toBe(true);
  });

  it('keeps a note out when the folder holding it was not chosen', () => {
    const chosen = effectiveOf(
      tree,
      scopeOf({ reach: { folders: 'choose' } }),
      pick({ folders: [CHILD] }),
    );
    expect(chosen.folders).toEqual(new Set([CHILD]));
    // N1 lives in ROOT, which travels only as a path.
    expect(chosen.notes).toEqual(new Set([N2, N3]));
    expect(chosen.templates.size).toBe(0);
  });

  it('intersects what was ticked with the folders that travel', () => {
    const chosen = effectiveOf(
      tree,
      scopeOf({ reach: { folders: 'choose', notes: 'choose' } }),
      pick({ folders: [CHILD], notes: [N1, N2] }),
    );
    // N1 was ticked and its folder was not chosen, so it does not travel.
    expect(chosen.notes).toEqual(new Set([N2]));
  });

  it('remembers what was ticked under a folder that was unticked', () => {
    // Ticking the folder back brings the notes back, rather than silently
    // losing what somebody had already chosen note by note.
    const picked = pick({ folders: [CHILD], notes: [N2] });
    const away = scopeOf({ folders: false, reach: { folders: 'choose', notes: 'choose' } });
    expect(effectiveOf(tree, away, picked).notes.size).toBe(0);
    const back = scopeOf({ reach: { folders: 'choose', notes: 'choose' } });
    expect(effectiveOf(tree, back, picked).notes).toEqual(new Set([N2]));
  });
});

describe('what each row of the scope states', () => {
  it('counts what is carried over what is held', () => {
    const counts = scopeCountsOf(tree, everything(tree));
    expect(counts.folders).toEqual({ carried: 3, held: 3 });
    expect(counts.templates).toEqual({ carried: 1, held: 1 });
    expect(counts.notes).toEqual({ carried: 3, held: 3 });
  });

  it('falls with the folders, so the dependency shows in the first tab', () => {
    const chosen = effectiveOf(
      tree,
      scopeOf({ reach: { folders: 'choose' } }),
      pick({ folders: [CHILD] }),
    );
    const counts = scopeCountsOf(tree, chosen);
    expect(counts.folders).toEqual({ carried: 1, held: 3 });
    expect(counts.templates).toEqual({ carried: 0, held: 1 });
    expect(counts.notes).toEqual({ carried: 2, held: 3 });
  });
});

/**
 * What each tab offers, and what a checkbox in it moves (#161).
 *
 * One species per tab, and a checkbox that never reaches across: ticking a
 * folder does not tick its Template and ticking notes never ticks a folder.
 * A checkbox that answered both questions is what made the previous chooser
 * unreadable, and on the first run against staging a notebook chosen for its
 * design alone arrived with no folder at all.
 */
describe('what a tab offers', () => {
  it('offers every folder in the Folders tab', () => {
    const offered = offeredFolders(tree.folders, null, 'folders');
    expect(offered.map((folder) => folder.id)).toEqual([ROOT, OTHER]);
    expect(offered[0]?.offered).toBe(true);
    expect(offered[0]?.children.map((child_) => child_.id)).toEqual([CHILD]);
  });

  it('draws a folder that was not chosen as a path, and offers nothing on it', () => {
    // Its children would otherwise hang off nothing, and it carries its name
    // and its description and nothing else of its own (RN-PRT-017).
    const offered = offeredFolders(tree.folders, new Set([CHILD]), 'notes');
    expect(offered).toHaveLength(1);
    expect(offered[0]?.id).toBe(ROOT);
    expect(offered[0]?.offered).toBe(false);
    expect(offered[0]?.notes).toEqual([]);
    expect(offered[0]?.children[0]?.offered).toBe(true);
  });

  it('drops a branch that offers nothing of the species', () => {
    // The Templates tab of a notebook with one Template is one row and not
    // sixty-eight, and the folder with no notes is not in the Notes tab.
    const templates = offeredFolders(tree.folders, new Set([ROOT, CHILD, OTHER]), 'templates');
    expect(templates.map((folder) => folder.id)).toEqual([ROOT]);
    expect(templates[0]?.children).toEqual([]);

    const notes = offeredFolders(tree.folders, new Set([ROOT, CHILD, OTHER]), 'notes');
    expect(notes.map((folder) => folder.id)).toEqual([ROOT]);
  });
});

describe('choosing in a tab', () => {
  const offered = offeredFolders(tree.folders, null, 'folders');
  const offeredRoot = offered[0]!;

  it('takes the whole branch on a checkbox, and gives it back', () => {
    const on = pickBranch(pickedNothing, offeredRoot, 'folders', true);
    expect(on.folders).toEqual(new Set([ROOT, CHILD]));
    expect(stateOfBranch(on, offeredRoot, 'folders')).toBe('on');
    expect(
      stateOfBranch(pickBranch(on, offeredRoot, 'folders', false), offeredRoot, 'folders'),
    ).toBe('off');
  });

  it('never reaches across species', () => {
    const on = pickBranch(pickedNothing, offeredRoot, 'folders', true);
    expect(on.templates.size).toBe(0);
    expect(on.notes.size).toBe(0);
  });

  it('says a folder is mixed when part of its branch is chosen', () => {
    const one = pickOne(pickedNothing, 'folders', CHILD, true);
    expect(stateOfBranch(one, offeredRoot, 'folders')).toBe('mixed');
  });

  it('keeps a folder chosen when a folder under it is let go', () => {
    // Which is how a folder without the folders under it is said: tick the
    // branch, untick each child, and the parent stays on and reads as mixed.
    const branch = pickBranch(pickedNothing, offeredRoot, 'folders', true);
    const child_ = offeredRoot.children[0]!;
    const alone = pickBranch(branch, child_, 'folders', false);
    expect(alone.folders).toEqual(new Set([ROOT]));
    expect(stateOfBranch(alone, offeredRoot, 'folders')).toBe('mixed');
  });

  it('counts only what a branch offers, so a path contributes its children', () => {
    const notes = offeredFolders(tree.folders, new Set([CHILD]), 'notes');
    const path = notes[0]!;
    const on = pickBranch(pickedNothing, path, 'notes', true);
    // ROOT is a path here, so its own note is not among what was ticked.
    expect(on.notes).toEqual(new Set([N2, N3]));
  });
});

describe('what the summary states', () => {
  /** One note of a subfolder, and nothing else: the smallest real selection. */
  const oneNote: Chosen = effectiveOf(
    tree,
    scopeOf({
      guidance: false,
      history: false,
      templates: false,
      reach: { folders: 'choose', notes: 'choose' },
    }),
    pick({ folders: [CHILD], notes: [N2] }),
  );

  it('counts a folder nothing selected but holding something selected', () => {
    // It is written as a PATH: its name and its description, and no Template.
    const counts = countsOf(tree, oneNote);
    expect(counts.folders).toBe(2);
    expect(counts.templates).toBe(0);
    expect(counts.notes).toBe(1);
    expect(counts.guidance).toBe(false);
  });

  it('counts the links a selection leaves pointing at notes left out', () => {
    const onlyN1 = effectiveOf(
      tree,
      scopeOf({ reach: { folders: 'choose', notes: 'choose' } }),
      pick({ folders: [ROOT], notes: [N1] }),
    );
    expect(danglingLinks(DOCUMENT, onlyN1)).toBe(1);
    expect(danglingLinks(DOCUMENT, everything(tree))).toBe(0);
  });

  it('does not count a link already pending in the archive as one left out', () => {
    // [[Nobody]] names no note of the archive, so no selection left it out:
    // the whole notebook still leaves nothing behind (#222).
    const pending: NotebookDocument = {
      ...DOCUMENT,
      notes: DOCUMENT.notes.map((note) =>
        note.noteId === N1
          ? { ...note, body: body('Actors', 'It points at [[ADR-002]] and [[Nobody]].') }
          : note,
      ),
    };
    const onlyN1 = effectiveOf(
      tree,
      scopeOf({ reach: { folders: 'choose', notes: 'choose' } }),
      pick({ folders: [ROOT], notes: [N1] }),
    );
    expect(danglingLinks(pending, everything(tree))).toBe(0);
    expect(danglingLinks(pending, onlyN1)).toBe(1);
  });

  it('names a pair of notes that share a name in one folder, when both are selected', () => {
    // A folder holds one note of each name (RN-KNW-042), and the conflict is
    // resolved by leaving one out rather than by editing the file.
    expect(twinNames(DOCUMENT, everything(tree))).toEqual([
      {
        folderId: CHILD,
        folderName: 'Decisions',
        name: 'ADR-002',
        count: 2,
        noteIds: [N2, N3],
      },
    ]);
    expect(twinNames(DOCUMENT, oneNote)).toEqual([]);
  });

  it('carries the whole name, spaces and all', () => {
    /**
     * The pair used to be packed into a string key and unpacked with
     * `split(' ')`, so every name was cut at its first space. A real notebook
     * reported three collisions, two of them reading `Código:` and neither
     * naming its folder — three sentences that could not tell the reader which
     * notes they were about, on a screen whose only job was to let them find
     * those notes and leave one out (#161).
     */
    const long = 'Código: Note.ts · create lê o nome do corpo';
    const twinned = {
      ...DOCUMENT,
      notes: DOCUMENT.notes.map((note) =>
        note.noteId === N2 || note.noteId === N3 ? { ...note, body: body(long) } : note,
      ),
    } as NotebookDocument;
    const twins = twinNames(twinned, everything(treeOf(twinned)));
    expect(twins).toHaveLength(1);
    expect(twins[0]?.name).toBe(long);
    expect(twins[0]?.folderName).toBe('Decisions');
    expect(twinNoteIds(twins)).toEqual(new Set([N2, N3]));
  });
});

describe('what travels to the server', () => {
  it('is the identifiers the document carries, and nothing derived', () => {
    /**
     * The folder is in it now. A note used to be sendable with its folder left
     * out, on the strength of the server writing that folder as a path — which
     * it still does, because an archive can be written by hand. The interface
     * no longer produces such a selection: a note travels because its folder
     * does (#161).
     */
    const selection = selectionOf(
      effectiveOf(
        tree,
        scopeOf({
          guidance: false,
          history: false,
          templates: false,
          reach: { folders: 'choose', notes: 'choose' },
        }),
        pick({ folders: [CHILD], notes: [N2] }),
      ),
    );
    expect(selection).toEqual({
      guidance: false,
      history: false,
      folders: [CHILD],
      templates: [],
      notes: [N2],
      // The files travel by NAME, and this selection carries both (#176).
      files: ['engelbart.jpg', 'esquema.png'],
    });
  });
});

/**
 * The files are the fourth species chosen item by item, and the only flat one
 * (#176). They used to travel always and silently: an archive was mostly files
 * and the screen that asked what to carry never named them.
 */
describe('the files are a species of the selection', () => {
  it('carries every one of them by default, which is what the rule defends', () => {
    const chosen = effectiveOf(tree, wholeScope, pickedNothing);
    expect([...chosen.files]).toEqual(['engelbart.jpg', 'esquema.png']);
  });

  it('carries none when the species is off', () => {
    const chosen = effectiveOf(tree, scopeOf({ files: false }), pickedNothing);
    expect([...chosen.files]).toEqual([]);
    // And nothing else moves: a file belongs to the notebook, not to a folder.
    expect(chosen.notes.size).toBe(3);
    expect(chosen.folders.size).toBe(3);
  });

  it('carries the ones ticked, by name, when it is chosen item by item', () => {
    const chosen = effectiveOf(
      tree,
      scopeOf({ reach: { files: 'choose' } }),
      pick({ files: ['esquema.png'] }),
    );
    expect([...chosen.files]).toEqual(['esquema.png']);
  });

  it('is never taken out by a folder, because no folder holds a file', () => {
    // Every folder left behind, every file still carried: the dependency the
    // other three species have does not exist here.
    const chosen = effectiveOf(
      tree,
      scopeOf({ folders: false, templates: false, notes: false }),
      pickedNothing,
    );
    expect(chosen.folders.size).toBe(0);
    expect([...chosen.files]).toEqual(['engelbart.jpg', 'esquema.png']);
  });

  it('seeds the tab with every file, because opening it means taking some out', () => {
    expect([...seedOf(tree, 'files')]).toEqual(['engelbart.jpg', 'esquema.png']);
  });

  /**
   * The summary of both dialogs is built from these counts, and the files were
   * missing from it — which is the whole of what #176 set out to fix: a screen
   * that asks what travels and never names the megabytes it is about to carry
   * is asking half a question.
   */
  it('is counted in what the transfer will carry', () => {
    expect(countsOf(tree, effectiveOf(tree, wholeScope, pickedNothing)).files).toBe(2);

    const um = effectiveOf(
      tree,
      scopeOf({ reach: { files: 'choose' } }),
      pick({ files: ['esquema.png'] }),
    );
    expect(countsOf(tree, um).files).toBe(1);

    expect(countsOf(tree, effectiveOf(tree, scopeOf({ files: false }), pickedNothing)).files).toBe(
      0,
    );
  });
});

/**
 * Where `Choose items` starts from (#161).
 *
 * The scope opens on everything and somebody who opens a tab is taking things
 * out of it. A flip into `Choose items` with nothing ticked would drop the
 * species to nothing at once, and the tab would open on a tree of empty boxes
 * saying that nothing of it travels — which is the opposite of the gesture.
 */
describe('the seed of a tab', () => {
  it('is every identifier of the species', () => {
    expect(seedOf(tree, 'folders')).toEqual(new Set([ROOT, CHILD, OTHER]));
    // Only the folders that HAVE one: `CHILD` and `OTHER` carry no Template.
    expect(seedOf(tree, 'templates')).toEqual(new Set([ROOT]));
    expect(seedOf(tree, 'notes')).toEqual(new Set([N1, N2, N3]));
  });

  it('leaves what travels exactly as it was, so the flip changes nothing', () => {
    const all = effectiveOf(tree, wholeScope, pickedNothing);
    const seeded: Picked = {
      folders: seedOf(tree, 'folders'),
      templates: seedOf(tree, 'templates'),
      notes: seedOf(tree, 'notes'),
      files: seedOf(tree, 'files'),
    };
    const choosing = effectiveOf(
      tree,
      scopeOf({ reach: { folders: 'choose', templates: 'choose', notes: 'choose' } }),
      seeded,
    );
    expect(choosing).toEqual(all);
  });
});
