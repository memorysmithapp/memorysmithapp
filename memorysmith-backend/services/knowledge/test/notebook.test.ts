import { describe, expect, it } from 'vitest';
import { type FolderId, Instant, NotebookRoleLimit } from '@memorysmith/kernel';
import type { Folder } from '../src/domain/notebook/Folder.js';
import { RemovalPolicy, NOTEBOOK_LIMITS } from '../src/domain/values.js';
import {
  authorship,
  contentRef,
  expectErr,
  folderDescription,
  folderName,
  newNotebook,
  otherUser,
  rehydratedNotebookWithNotes,
  unwrap,
  user,
  notebookName,
} from './fixtures.js';

describe('Notebook: creation', () => {
  it('derives the slug from the name and records NotebookCreated', () => {
    const notebook = newNotebook('Normas e Legislacao');
    expect(notebook.slug.value).toBe('normas-e-legislacao');
    const events = notebook.pullEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('NotebookCreated');
    expect(events[0]?.authorship.user.value).toBe(user.value);
    expect(events[0]?.subscriptionId).toBe(notebook.subscriptionId);
  });

  it('starts with no guidance and an empty tree', () => {
    const notebook = newNotebook();
    expect(notebook.hasGuidance).toBe(false);
    expect(notebook.folders.size).toBe(0);
    expect(notebook.noteCount).toBe(0);
  });

  it('renames and re-derives the slug', () => {
    const notebook = newNotebook();
    notebook.pullEvents();
    expect(unwrap(notebook.rename(notebookName('Jurisprudencia Tributaria'), authorship())));
    expect(notebook.slug.value).toBe('jurisprudencia-tributaria');
    expect(notebook.pullEvents()[0]?.type).toBe('NotebookRenamed');
  });
});

describe('Notebook: guidance and template are pointers, never Markdown', () => {
  it('stores a ContentRef and records the event carrying it', () => {
    const notebook = newNotebook();
    notebook.pullEvents();
    const ref = contentRef();
    unwrap(notebook.setGuidance(ref, authorship()));

    expect(notebook.guidanceRef?.equals(ref)).toBe(true);
    const [event] = notebook.pullEvents();
    expect(event?.type).toBe('GuidanceUpdated');
    // The complete ref travels inside the event (architecture-guide.md 6.5).
    expect(event?.contentRef?.sha256).toBe(ref.sha256);
    expect(event?.contentRef?.versionId).toBe(ref.versionId);
    expect(event?.contentRef?.bytes).toBe(ref.bytes);
  });

  it('does not record a revision when the content is byte-for-byte identical', () => {
    // RN-KNW-028: same bytes means no revision, no event, no re-indexing.
    const notebook = newNotebook();
    const first = contentRef('b'.repeat(64));
    unwrap(notebook.setGuidance(first, authorship()));
    notebook.pullEvents();

    const sameContent = contentRef('b'.repeat(64));
    unwrap(notebook.setGuidance(sameContent, authorship()));
    expect(notebook.pullEvents()).toHaveLength(0);
  });

  it('attaches a template to a folder', () => {
    const notebook = newNotebook();
    const folder = unwrap(
      notebook.addFolder(
        null,
        folderName('Normas'),
        folderDescription('Normas.'),
        null,
        authorship(),
      ),
    );
    notebook.pullEvents();
    unwrap(notebook.attachTemplate(folder.id, contentRef('c'.repeat(64)), authorship()));
    expect(notebook.folders.get(folder.id)?.hasTemplate).toBe(true);
    expect(notebook.pullEvents()[0]?.type).toBe('TemplateUpdated');
  });
});

describe('Notebook: I1, the slug is unique among siblings', () => {
  it('rejects a sibling with a colliding slug', () => {
    const notebook = newNotebook();
    unwrap(
      notebook.addFolder(null, folderName('Normas'), folderDescription('A.'), null, authorship()),
    );
    const collision = notebook.addFolder(
      null,
      folderName('normas'),
      folderDescription('B.'),
      null,
      authorship(),
    );
    expect(expectErr(collision).code).toBe('CONFLICT');
  });

  it('allows the same slug under different parents', () => {
    const notebook = newNotebook();
    const first = unwrap(
      notebook.addFolder(null, folderName('Normas'), folderDescription('A.'), null, authorship()),
    );
    const nested = notebook.addFolder(
      first.id,
      folderName('Normas'),
      folderDescription('B.'),
      null,
      authorship(),
    );
    expect(nested.ok).toBe(true);
  });

  it('rejects a rename that collides with a sibling', () => {
    const notebook = newNotebook();
    unwrap(
      notebook.addFolder(null, folderName('Normas'), folderDescription('A.'), null, authorship()),
    );
    const achados = unwrap(
      notebook.addFolder(null, folderName('Achados'), folderDescription('B.'), null, authorship()),
    );
    expect(
      expectErr(notebook.renameFolder(achados.id, folderName('Normas'), authorship())).code,
    ).toBe('CONFLICT');
  });
});

describe('Notebook: I2, maximum depth of six levels', () => {
  it('accepts exactly six levels and refuses the seventh', () => {
    const notebook = newNotebook();
    let parent: FolderId | null = null;
    for (let level = 1; level <= NOTEBOOK_LIMITS.maxDepth; level++) {
      const folder = notebook.addFolder(
        parent,
        folderName(`Level ${level}`),
        folderDescription(`Level ${level}.`),
        null,
        authorship(),
      );
      expect(folder.ok).toBe(true);
      parent = unwrap(folder).id;
    }
    const seventh = notebook.addFolder(
      parent,
      folderName('Level 7'),
      folderDescription('Too deep.'),
      null,
      authorship(),
    );
    expect(expectErr(seventh).code).toBe('VALIDATION');
  });

  it('refuses a move that would push the subtree past the limit', () => {
    const notebook = newNotebook();
    // A chain of four, plus a separate chain of three.
    let parent: FolderId | null = null;
    const chain: FolderId[] = [];
    for (let level = 1; level <= 4; level++) {
      const folder: Folder = unwrap(
        notebook.addFolder(
          parent,
          folderName(`Deep ${level}`),
          folderDescription('.'),
          null,
          authorship(),
        ),
      );
      chain.push(folder.id);
      parent = folder.id;
    }
    const rootA = unwrap(
      notebook.addFolder(null, folderName('Branch'), folderDescription('.'), null, authorship()),
    );
    const branchChild = unwrap(
      notebook.addFolder(rootA.id, folderName('Child'), folderDescription('.'), null, authorship()),
    );
    unwrap(
      notebook.addFolder(
        branchChild.id,
        folderName('Grandchild'),
        folderDescription('.'),
        null,
        authorship(),
      ),
    );

    // Branch is 3 levels tall; hanging it under the 4th level would reach 7.
    const move = notebook.moveFolder(rootA.id, chain[3] as FolderId, null, authorship());
    expect(expectErr(move).code).toBe('VALIDATION');
  });
});

describe('Notebook: I3, a move never creates a cycle', () => {
  it('refuses to move a folder into its own subtree', () => {
    const notebook = newNotebook();
    const root = unwrap(
      notebook.addFolder(null, folderName('Root'), folderDescription('.'), null, authorship()),
    );
    const child = unwrap(
      notebook.addFolder(root.id, folderName('Child'), folderDescription('.'), null, authorship()),
    );
    expect(expectErr(notebook.moveFolder(root.id, child.id, null, authorship())).code).toBe(
      'VALIDATION',
    );
    expect(expectErr(notebook.moveFolder(root.id, root.id, null, authorship())).code).toBe(
      'VALIDATION',
    );
  });
});

describe('Notebook: I4, ordering', () => {
  it('appends a new folder when no anchor is given', () => {
    const notebook = newNotebook();
    const first = unwrap(
      notebook.addFolder(null, folderName('A'), folderDescription('.'), null, authorship()),
    );
    const second = unwrap(
      notebook.addFolder(null, folderName('B'), folderDescription('.'), null, authorship()),
    );
    // Creating a folder with nothing selected puts it at the end of the level.
    expect(notebook.folders.childrenOf(null).map((folder) => folder.id.value)).toEqual([
      first.id.value,
      second.id.value,
    ]);
  });

  it('places a folder right after the anchor', () => {
    const notebook = newNotebook();
    const a = unwrap(
      notebook.addFolder(null, folderName('A'), folderDescription('.'), null, authorship()),
    );
    const b = unwrap(
      notebook.addFolder(null, folderName('B'), folderDescription('.'), a.id, authorship()),
    );
    const c = unwrap(
      notebook.addFolder(null, folderName('C'), folderDescription('.'), a.id, authorship()),
    );
    expect(notebook.folders.childrenOf(null).map((folder) => folder.name.value)).toEqual([
      'A',
      'C',
      'B',
    ]);
    expect(b.position.value < c.position.value).toBe(false);
  });

  it('reorders with a single write and no sibling rewritten', () => {
    const notebook = newNotebook();
    const a = unwrap(
      notebook.addFolder(null, folderName('A'), folderDescription('.'), null, authorship()),
    );
    const b = unwrap(
      notebook.addFolder(null, folderName('B'), folderDescription('.'), a.id, authorship()),
    );
    const c = unwrap(
      notebook.addFolder(null, folderName('C'), folderDescription('.'), b.id, authorship()),
    );
    const positionsBefore = [a.position.value, b.position.value];
    notebook.pullEvents();

    unwrap(notebook.reorderFolder(c.id, null, authorship()));

    expect(notebook.folders.childrenOf(null).map((folder) => folder.name.value)).toEqual([
      'C',
      'A',
      'B',
    ]);
    // The siblings kept their keys: reordering touched one item only.
    expect([a.position.value, b.position.value]).toEqual(positionsBefore);
    const [event] = notebook.pullEvents();
    expect(event?.type).toBe('FolderReordered');
  });

  it('refuses an anchor that is not a folder of the same level, naming the ones that are', () => {
    const notebook = newNotebook();
    const a = unwrap(
      notebook.addFolder(null, folderName('A'), folderDescription('.'), null, authorship()),
    );
    const child = unwrap(
      notebook.addFolder(a.id, folderName('Inside A'), folderDescription('.'), null, authorship()),
    );

    const created = expectErr(
      notebook.addFolder(null, folderName('B'), folderDescription('.'), child.id, authorship()),
    );
    expect(created.code).toBe('VALIDATION');
    expect(JSON.stringify(created.details)).toContain(a.id.value);
    expect(expectErr(notebook.reorderFolder(a.id, child.id, authorship())).code).toBe('VALIDATION');
  });

  it('refuses to place a folder after itself', () => {
    const notebook = newNotebook();
    const a = unwrap(
      notebook.addFolder(null, folderName('A'), folderDescription('.'), null, authorship()),
    );
    expect(expectErr(notebook.reorderFolder(a.id, a.id, authorship())).code).toBe('VALIDATION');
  });
});

describe('Notebook: I5, removing a folder requires an explicit policy', () => {
  it('removes an empty folder without ceremony', () => {
    const notebook = newNotebook();
    const folder = unwrap(
      notebook.addFolder(null, folderName('Empty'), folderDescription('.'), null, authorship()),
    );
    notebook.pullEvents();
    const removed = unwrap(
      notebook.removeFolder(folder.id, RemovalPolicy.REJECT_IF_NOT_EMPTY, authorship()),
    );
    expect(removed).toHaveLength(1);
    expect(notebook.folders.size).toBe(0);
    expect(notebook.pullEvents()[0]?.type).toBe('FolderRemoved');
  });

  it('refuses to remove a folder holding subfolders without CASCADE', () => {
    const notebook = newNotebook();
    const parent = unwrap(
      notebook.addFolder(null, folderName('Parent'), folderDescription('.'), null, authorship()),
    );
    unwrap(
      notebook.addFolder(
        parent.id,
        folderName('Child'),
        folderDescription('.'),
        null,
        authorship(),
      ),
    );

    const refused = notebook.removeFolder(
      parent.id,
      RemovalPolicy.REJECT_IF_NOT_EMPTY,
      authorship(),
    );
    expect(expectErr(refused).code).toBe('CONFLICT');
    expect(notebook.folders.size).toBe(2);
  });

  it('removes the whole subtree under CASCADE', () => {
    const notebook = newNotebook();
    const parent = unwrap(
      notebook.addFolder(null, folderName('Parent'), folderDescription('.'), null, authorship()),
    );
    const child = unwrap(
      notebook.addFolder(
        parent.id,
        folderName('Child'),
        folderDescription('.'),
        null,
        authorship(),
      ),
    );
    unwrap(
      notebook.addFolder(
        child.id,
        folderName('Grandchild'),
        folderDescription('.'),
        null,
        authorship(),
      ),
    );

    const removed = unwrap(notebook.removeFolder(parent.id, RemovalPolicy.CASCADE, authorship()));
    expect(removed).toHaveLength(3);
    expect(notebook.folders.size).toBe(0);
  });

  it('refuses a folder that holds notes, according to the counters', () => {
    // "Holds notes" is answered by the eventually consistent counters that
    // arrived with the aggregate: the rule is eventual consistency, not a
    // transactional invariant (architecture-guide.md, section 6.2).
    const { notebook, folderId } = rehydratedNotebookWithNotes(3);
    const refused = notebook.removeFolder(
      folderId,
      RemovalPolicy.REJECT_IF_NOT_EMPTY,
      authorship(),
    );
    const error = expectErr(refused);
    expect(error.code).toBe('CONFLICT');
    expect(error.details).toEqual({ folders: 0, notes: 3 });
  });

  it('removes a folder that holds notes under CASCADE', () => {
    const { notebook, folderId } = rehydratedNotebookWithNotes(3);
    expect(
      unwrap(notebook.removeFolder(folderId, RemovalPolicy.CASCADE, authorship())),
    ).toHaveLength(1);
  });
});

describe('Notebook: role ceilings', () => {
  it('has no ceiling by default, which never demotes anyone', () => {
    const notebook = newNotebook();
    expect(notebook.hasLimitFor(otherUser)).toBe(false);
    expect(notebook.limitFor(otherUser).name).toBe('OWNER');
  });

  it('records a ceiling and reports it as VIEWER', () => {
    const notebook = newNotebook();
    notebook.pullEvents();
    unwrap(notebook.setRoleLimit(otherUser, NotebookRoleLimit.VIEWER, authorship()));
    expect(notebook.limitFor(otherUser).name).toBe('VIEWER');
    expect(notebook.pullEvents()[0]?.type).toBe('NotebookRoleLimitSet');

    unwrap(notebook.clearRoleLimit(otherUser, authorship()));
    expect(notebook.hasLimitFor(otherUser)).toBe(false);
    expect(notebook.pullEvents()[0]?.type).toBe('NotebookRoleLimitCleared');
  });

  it('answers NOT_FOUND when clearing a ceiling that was never set', () => {
    const notebook = newNotebook();
    expect(expectErr(notebook.clearRoleLimit(otherUser, authorship())).code).toBe('NOT_FOUND');
  });
});

describe('Notebook: product limits', () => {
  it('refuses the folder above the ceiling of 200', () => {
    const notebook = newNotebook();
    for (let index = 0; index < NOTEBOOK_LIMITS.maxFolders; index++) {
      const folder = notebook.addFolder(
        null,
        folderName(`Folder ${index}`),
        folderDescription('.'),
        null,
        authorship(),
      );
      expect(folder.ok).toBe(true);
    }
    const overflow = notebook.addFolder(
      null,
      folderName('One too many'),
      folderDescription('.'),
      null,
      authorship(),
    );
    expect(expectErr(overflow).code).toBe('LIMIT_EXCEEDED');
  });
});

describe('Notebook: every mutation carries authorship', () => {
  it('stamps the human and the instant on the event', () => {
    const at = unwrap(Instant.fromISO('2026-03-12T10:15:00.000Z'));
    const notebook = newNotebook();
    notebook.pullEvents();
    unwrap(
      notebook.addFolder(null, folderName('Normas'), folderDescription('.'), null, authorship(at)),
    );
    const [event] = notebook.pullEvents();
    expect(event?.authorship.user.value).toBe(user.value);
    expect(event?.authorship.agent).toBeNull();
    expect(event?.occurredAt.toISOString()).toBe('2026-03-12T10:15:00.000Z');
  });
});
