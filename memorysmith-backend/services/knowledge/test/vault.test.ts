import { describe, expect, it } from 'vitest';
import { type FolderId, Instant, VaultRoleLimit } from '@memorysmith/kernel';
import type { Folder } from '../src/domain/vault/Folder.js';
import { RemovalPolicy, VAULT_LIMITS } from '../src/domain/values.js';
import {
  authorship,
  contentRef,
  expectErr,
  folderDescription,
  folderName,
  newVault,
  otherUser,
  rehydratedVaultWithNotes,
  unwrap,
  user,
  vaultName,
} from './fixtures.js';

describe('Vault: creation', () => {
  it('derives the slug from the name and records VaultCreated', () => {
    const vault = newVault('Normas e Legislacao');
    expect(vault.slug.value).toBe('normas-e-legislacao');
    const events = vault.pullEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('VaultCreated');
    expect(events[0]?.authorship.user.value).toBe(user.value);
    expect(events[0]?.subscriptionId).toBe(vault.subscriptionId);
  });

  it('starts with no guidance and an empty tree', () => {
    const vault = newVault();
    expect(vault.hasGuidance).toBe(false);
    expect(vault.folders.size).toBe(0);
    expect(vault.noteCount).toBe(0);
  });

  it('renames and re-derives the slug', () => {
    const vault = newVault();
    vault.pullEvents();
    expect(unwrap(vault.rename(vaultName('Jurisprudencia Tributaria'), authorship())));
    expect(vault.slug.value).toBe('jurisprudencia-tributaria');
    expect(vault.pullEvents()[0]?.type).toBe('VaultRenamed');
  });
});

describe('Vault: guidance and template are pointers, never Markdown', () => {
  it('stores a ContentRef and records the event carrying it', () => {
    const vault = newVault();
    vault.pullEvents();
    const ref = contentRef();
    unwrap(vault.setGuidance(ref, authorship()));

    expect(vault.guidanceRef?.equals(ref)).toBe(true);
    const [event] = vault.pullEvents();
    expect(event?.type).toBe('GuidanceUpdated');
    // The complete ref travels inside the event (architecture-guide.md 6.5).
    expect(event?.contentRef?.sha256).toBe(ref.sha256);
    expect(event?.contentRef?.versionId).toBe(ref.versionId);
    expect(event?.contentRef?.bytes).toBe(ref.bytes);
  });

  it('does not record a revision when the content is byte-for-byte identical', () => {
    // RN-KNW-028: same bytes means no revision, no event, no re-indexing.
    const vault = newVault();
    const first = contentRef('b'.repeat(64));
    unwrap(vault.setGuidance(first, authorship()));
    vault.pullEvents();

    const sameContent = contentRef('b'.repeat(64));
    unwrap(vault.setGuidance(sameContent, authorship()));
    expect(vault.pullEvents()).toHaveLength(0);
  });

  it('attaches a template to a folder', () => {
    const vault = newVault();
    const folder = unwrap(
      vault.addFolder(null, folderName('Normas'), folderDescription('Normas.'), null, authorship()),
    );
    vault.pullEvents();
    unwrap(vault.attachTemplate(folder.id, contentRef('c'.repeat(64)), authorship()));
    expect(vault.folders.get(folder.id)?.hasTemplate).toBe(true);
    expect(vault.pullEvents()[0]?.type).toBe('TemplateUpdated');
  });
});

describe('Vault: I1, the slug is unique among siblings', () => {
  it('rejects a sibling with a colliding slug', () => {
    const vault = newVault();
    unwrap(
      vault.addFolder(null, folderName('Normas'), folderDescription('A.'), null, authorship()),
    );
    const collision = vault.addFolder(
      null,
      folderName('normas'),
      folderDescription('B.'),
      null,
      authorship(),
    );
    expect(expectErr(collision).code).toBe('CONFLICT');
  });

  it('allows the same slug under different parents', () => {
    const vault = newVault();
    const first = unwrap(
      vault.addFolder(null, folderName('Normas'), folderDescription('A.'), null, authorship()),
    );
    const nested = vault.addFolder(
      first.id,
      folderName('Normas'),
      folderDescription('B.'),
      null,
      authorship(),
    );
    expect(nested.ok).toBe(true);
  });

  it('rejects a rename that collides with a sibling', () => {
    const vault = newVault();
    unwrap(
      vault.addFolder(null, folderName('Normas'), folderDescription('A.'), null, authorship()),
    );
    const achados = unwrap(
      vault.addFolder(null, folderName('Achados'), folderDescription('B.'), null, authorship()),
    );
    expect(expectErr(vault.renameFolder(achados.id, folderName('Normas'), authorship())).code).toBe(
      'CONFLICT',
    );
  });
});

describe('Vault: I2, maximum depth of six levels', () => {
  it('accepts exactly six levels and refuses the seventh', () => {
    const vault = newVault();
    let parent: FolderId | null = null;
    for (let level = 1; level <= VAULT_LIMITS.maxDepth; level++) {
      const folder = vault.addFolder(
        parent,
        folderName(`Level ${level}`),
        folderDescription(`Level ${level}.`),
        null,
        authorship(),
      );
      expect(folder.ok).toBe(true);
      parent = unwrap(folder).id;
    }
    const seventh = vault.addFolder(
      parent,
      folderName('Level 7'),
      folderDescription('Too deep.'),
      null,
      authorship(),
    );
    expect(expectErr(seventh).code).toBe('VALIDATION');
  });

  it('refuses a move that would push the subtree past the limit', () => {
    const vault = newVault();
    // A chain of four, plus a separate chain of three.
    let parent: FolderId | null = null;
    const chain: FolderId[] = [];
    for (let level = 1; level <= 4; level++) {
      const folder: Folder = unwrap(
        vault.addFolder(
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
      vault.addFolder(null, folderName('Branch'), folderDescription('.'), null, authorship()),
    );
    const branchChild = unwrap(
      vault.addFolder(rootA.id, folderName('Child'), folderDescription('.'), null, authorship()),
    );
    unwrap(
      vault.addFolder(
        branchChild.id,
        folderName('Grandchild'),
        folderDescription('.'),
        null,
        authorship(),
      ),
    );

    // Branch is 3 levels tall; hanging it under the 4th level would reach 7.
    const move = vault.moveFolder(rootA.id, chain[3] as FolderId, null, authorship());
    expect(expectErr(move).code).toBe('VALIDATION');
  });
});

describe('Vault: I3, a move never creates a cycle', () => {
  it('refuses to move a folder into its own subtree', () => {
    const vault = newVault();
    const root = unwrap(
      vault.addFolder(null, folderName('Root'), folderDescription('.'), null, authorship()),
    );
    const child = unwrap(
      vault.addFolder(root.id, folderName('Child'), folderDescription('.'), null, authorship()),
    );
    expect(expectErr(vault.moveFolder(root.id, child.id, null, authorship())).code).toBe(
      'VALIDATION',
    );
    expect(expectErr(vault.moveFolder(root.id, root.id, null, authorship())).code).toBe(
      'VALIDATION',
    );
  });
});

describe('Vault: I4, ordering', () => {
  it('appends a new folder when no anchor is given', () => {
    const vault = newVault();
    const first = unwrap(
      vault.addFolder(null, folderName('A'), folderDescription('.'), null, authorship()),
    );
    const second = unwrap(
      vault.addFolder(null, folderName('B'), folderDescription('.'), null, authorship()),
    );
    // Creating a folder with nothing selected puts it at the end of the level.
    expect(vault.folders.childrenOf(null).map((folder) => folder.id.value)).toEqual([
      first.id.value,
      second.id.value,
    ]);
  });

  it('places a folder right after the anchor', () => {
    const vault = newVault();
    const a = unwrap(
      vault.addFolder(null, folderName('A'), folderDescription('.'), null, authorship()),
    );
    const b = unwrap(
      vault.addFolder(null, folderName('B'), folderDescription('.'), a.id, authorship()),
    );
    const c = unwrap(
      vault.addFolder(null, folderName('C'), folderDescription('.'), a.id, authorship()),
    );
    expect(vault.folders.childrenOf(null).map((folder) => folder.name.value)).toEqual([
      'A',
      'C',
      'B',
    ]);
    expect(b.position.value < c.position.value).toBe(false);
  });

  it('reorders with a single write and no sibling rewritten', () => {
    const vault = newVault();
    const a = unwrap(
      vault.addFolder(null, folderName('A'), folderDescription('.'), null, authorship()),
    );
    const b = unwrap(
      vault.addFolder(null, folderName('B'), folderDescription('.'), a.id, authorship()),
    );
    const c = unwrap(
      vault.addFolder(null, folderName('C'), folderDescription('.'), b.id, authorship()),
    );
    const positionsBefore = [a.position.value, b.position.value];
    vault.pullEvents();

    unwrap(vault.reorderFolder(c.id, null, authorship()));

    expect(vault.folders.childrenOf(null).map((folder) => folder.name.value)).toEqual([
      'C',
      'A',
      'B',
    ]);
    // The siblings kept their keys: reordering touched one item only.
    expect([a.position.value, b.position.value]).toEqual(positionsBefore);
    const [event] = vault.pullEvents();
    expect(event?.type).toBe('FolderReordered');
  });

  it('refuses to place a folder after itself', () => {
    const vault = newVault();
    const a = unwrap(
      vault.addFolder(null, folderName('A'), folderDescription('.'), null, authorship()),
    );
    expect(expectErr(vault.reorderFolder(a.id, a.id, authorship())).code).toBe('VALIDATION');
  });
});

describe('Vault: I5, removing a folder requires an explicit policy', () => {
  it('removes an empty folder without ceremony', () => {
    const vault = newVault();
    const folder = unwrap(
      vault.addFolder(null, folderName('Empty'), folderDescription('.'), null, authorship()),
    );
    vault.pullEvents();
    const removed = unwrap(
      vault.removeFolder(folder.id, RemovalPolicy.REJECT_IF_NOT_EMPTY, authorship()),
    );
    expect(removed).toHaveLength(1);
    expect(vault.folders.size).toBe(0);
    expect(vault.pullEvents()[0]?.type).toBe('FolderRemoved');
  });

  it('refuses to remove a folder holding subfolders without CASCADE', () => {
    const vault = newVault();
    const parent = unwrap(
      vault.addFolder(null, folderName('Parent'), folderDescription('.'), null, authorship()),
    );
    unwrap(
      vault.addFolder(parent.id, folderName('Child'), folderDescription('.'), null, authorship()),
    );

    const refused = vault.removeFolder(parent.id, RemovalPolicy.REJECT_IF_NOT_EMPTY, authorship());
    expect(expectErr(refused).code).toBe('CONFLICT');
    expect(vault.folders.size).toBe(2);
  });

  it('removes the whole subtree under CASCADE', () => {
    const vault = newVault();
    const parent = unwrap(
      vault.addFolder(null, folderName('Parent'), folderDescription('.'), null, authorship()),
    );
    const child = unwrap(
      vault.addFolder(parent.id, folderName('Child'), folderDescription('.'), null, authorship()),
    );
    unwrap(
      vault.addFolder(
        child.id,
        folderName('Grandchild'),
        folderDescription('.'),
        null,
        authorship(),
      ),
    );

    const removed = unwrap(vault.removeFolder(parent.id, RemovalPolicy.CASCADE, authorship()));
    expect(removed).toHaveLength(3);
    expect(vault.folders.size).toBe(0);
  });

  it('refuses a folder that holds notes, according to the counters', () => {
    // "Holds notes" is answered by the eventually consistent counters that
    // arrived with the aggregate: the rule is eventual consistency, not a
    // transactional invariant (architecture-guide.md, section 6.2).
    const { vault, folderId } = rehydratedVaultWithNotes(3);
    const refused = vault.removeFolder(folderId, RemovalPolicy.REJECT_IF_NOT_EMPTY, authorship());
    const error = expectErr(refused);
    expect(error.code).toBe('CONFLICT');
    expect(error.details).toEqual({ folders: 0, notes: 3 });
  });

  it('removes a folder that holds notes under CASCADE', () => {
    const { vault, folderId } = rehydratedVaultWithNotes(3);
    expect(unwrap(vault.removeFolder(folderId, RemovalPolicy.CASCADE, authorship()))).toHaveLength(
      1,
    );
  });
});

describe('Vault: role ceilings', () => {
  it('has no ceiling by default, which never demotes anyone', () => {
    const vault = newVault();
    expect(vault.hasLimitFor(otherUser)).toBe(false);
    expect(vault.limitFor(otherUser).name).toBe('OWNER');
  });

  it('records a ceiling and reports it as VIEWER', () => {
    const vault = newVault();
    vault.pullEvents();
    unwrap(vault.setRoleLimit(otherUser, VaultRoleLimit.VIEWER, authorship()));
    expect(vault.limitFor(otherUser).name).toBe('VIEWER');
    expect(vault.pullEvents()[0]?.type).toBe('VaultRoleLimitSet');

    unwrap(vault.clearRoleLimit(otherUser, authorship()));
    expect(vault.hasLimitFor(otherUser)).toBe(false);
    expect(vault.pullEvents()[0]?.type).toBe('VaultRoleLimitCleared');
  });

  it('answers NOT_FOUND when clearing a ceiling that was never set', () => {
    const vault = newVault();
    expect(expectErr(vault.clearRoleLimit(otherUser, authorship())).code).toBe('NOT_FOUND');
  });
});

describe('Vault: product limits', () => {
  it('refuses the folder above the ceiling of 200', () => {
    const vault = newVault();
    for (let index = 0; index < VAULT_LIMITS.maxFolders; index++) {
      const folder = vault.addFolder(
        null,
        folderName(`Folder ${index}`),
        folderDescription('.'),
        null,
        authorship(),
      );
      expect(folder.ok).toBe(true);
    }
    const overflow = vault.addFolder(
      null,
      folderName('One too many'),
      folderDescription('.'),
      null,
      authorship(),
    );
    expect(expectErr(overflow).code).toBe('LIMIT_EXCEEDED');
  });
});

describe('Vault: every mutation carries authorship', () => {
  it('stamps the human and the instant on the event', () => {
    const at = unwrap(Instant.fromISO('2026-03-12T10:15:00.000Z'));
    const vault = newVault();
    vault.pullEvents();
    unwrap(
      vault.addFolder(null, folderName('Normas'), folderDescription('.'), null, authorship(at)),
    );
    const [event] = vault.pullEvents();
    expect(event?.authorship.user.value).toBe(user.value);
    expect(event?.authorship.agent).toBeNull();
    expect(event?.occurredAt.toISOString()).toBe('2026-03-12T10:15:00.000Z');
  });
});
