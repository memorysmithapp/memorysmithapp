import { describe, expect, it } from 'vitest';
import { NoteId, Position, Role, Slug, VaultRoleLimit } from '@memorysmith/kernel';
import { NotePlacement } from '../src/domain/services/NotePlacement.js';
import { NoteRelocation } from '../src/domain/services/NoteRelocation.js';
import { composeVaultContext } from '../src/domain/services/VaultContextComposer.js';
import {
  AuthorizationPolicy,
  type RequestContext,
} from '../src/domain/access/AuthorizationPolicy.js';
import { SlugConflictPolicy } from '../src/domain/values.js';
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
} from './fixtures.js';

describe('NotePlacement', () => {
  const first = { noteId: NoteId.generate(), position: Position.first() };
  const second = { noteId: NoteId.generate(), position: Position.between(first.position, null) };
  const siblings = [first, second];

  it('appends at the end of the folder', () => {
    const appended = NotePlacement.append(siblings);
    expect(appended.value > second.position.value).toBe(true);
  });

  it('places at the front when no anchor is given', () => {
    const placed = unwrap(NotePlacement.place(siblings, null));
    expect(placed.value < first.position.value).toBe(true);
  });

  it('places right after the anchor', () => {
    const placed = unwrap(NotePlacement.place(siblings, first.noteId));
    expect(placed.value > first.position.value).toBe(true);
    expect(placed.value < second.position.value).toBe(true);
  });

  it('appends when the anchor is unknown instead of guessing a slot', () => {
    const placed = unwrap(NotePlacement.place(siblings, NoteId.generate()));
    expect(placed.value > second.position.value).toBe(true);
  });

  it('ignores the moving note when computing its own new position', () => {
    // Anchoring against its own key would produce a key that is not strictly
    // between the neighbours.
    const placed = unwrap(NotePlacement.place(siblings, null, first.noteId));
    expect(placed.value < second.position.value).toBe(true);
  });
});

describe('NoteRelocation: the slug conflict policy', () => {
  const slug = unwrap(Slug.from('lei-14133'));

  it('keeps the slug when the destination vault has it free', () => {
    const resolved = unwrap(
      NoteRelocation.resolveSlug(slug, () => false, SlugConflictPolicy.REJECT),
    );
    expect(resolved.value).toBe('lei-14133');
  });

  it('answers CONFLICT under REJECT', () => {
    const error = expectErr(
      NoteRelocation.resolveSlug(slug, () => true, SlugConflictPolicy.REJECT),
    );
    expect(error.code).toBe('CONFLICT');
    expect(error.details).toEqual({ slug: 'lei-14133' });
  });

  it('suffixes only when RENAME was asked for explicitly', () => {
    const taken = new Set(['lei-14133', 'lei-14133-2']);
    const resolved = unwrap(
      NoteRelocation.resolveSlug(slug, (s) => taken.has(s.value), SlugConflictPolicy.RENAME),
    );
    expect(resolved.value).toBe('lei-14133-3');
  });

  it('gives up rather than looping forever', () => {
    const error = expectErr(
      NoteRelocation.resolveSlug(slug, () => true, SlugConflictPolicy.RENAME),
    );
    expect(error.code).toBe('CONFLICT');
  });

  it('requires an explicit policy: there is no implicit default', () => {
    expect(expectErr(SlugConflictPolicy.create('')).code).toBe('PRECONDITION_FAILED');
  });
});

describe('VaultContextComposer', () => {
  it('renders guidance in full, then the numbered annotated tree', () => {
    const { vault, folderId } = rehydratedVaultWithNotes(48);
    unwrap(
      vault.addFolder(
        null,
        folderName('Achados'),
        folderDescription('Achados de auditoria. Todo achado cita a norma que o fundamenta.'),
        folderId,
        authorship(),
      ),
    );
    const trabalhos = unwrap(
      vault.addFolder(
        null,
        folderName('Trabalhos'),
        folderDescription('Relatorios emitidos.'),
        vault.folders.childrenOf(null)[1]?.id ?? null,
        authorship(),
      ),
    );
    unwrap(
      vault.addFolder(
        trabalhos.id,
        folderName('2026'),
        folderDescription('Emitidos neste exercicio.'),
        null,
        authorship(),
      ),
    );

    const context = composeVaultContext({ vault, guidance: '## Purpose\nOne norm per note.' });

    expect(context).toContain('# Vault: Normas e Legislacao');
    expect(context).toContain('## Purpose\nOne norm per note.');
    expect(context).toContain('## Structure');
    // Order is the defined order, numbered, and the counts come along.
    expect(context).toContain('1. **Normas**: Texto normativo por artigo. (48 notes)');
    expect(context).toContain('2. **Achados**:');
    // A folder with children is rendered with a trailing slash, and its
    // children are numbered underneath it.
    expect(context).toContain('3. **Trabalhos/**: Relatorios emitidos. (0 notes)');
    expect(context).toContain('   3.1. **2026**: Emitidos neste exercicio. (0 notes)');
  });

  it('flags a folder that has a template', () => {
    const { vault, folderId } = rehydratedVaultWithNotes(2);
    unwrap(vault.attachTemplate(folderId, contentRef('f'.repeat(64)), authorship()));
    expect(composeVaultContext({ vault, guidance: null })).toContain('(2 notes, has TEMPLATE.md)');
  });

  it('says so when there is no guidance yet, instead of pretending', () => {
    const vault = newVault();
    const context = composeVaultContext({ vault, guidance: null });
    expect(context).toContain('has no guidance yet');
    expect(context).toContain('no folders yet');
  });
});

describe('AuthorizationPolicy', () => {
  const vault = newVault();

  function context(overrides: Partial<RequestContext> = {}): RequestContext {
    return {
      user: otherUser,
      isOwner: false,
      roles: new Map([[vault.workspaceId.value, Role.EDITOR]]),
      ...overrides,
    };
  }

  it('lets the subscription owner reach everything', () => {
    const role = AuthorizationPolicy.effectiveRole(context({ user, isOwner: true }), vault);
    expect(role).toBe(Role.OWNER);
  });

  it('answers 404, never 403, for a vault the caller cannot see', () => {
    // RN-SUB-004: a forbidden resource is indistinguishable from a missing one.
    const outsider = context({ roles: new Map() });
    const error = expectErr(AuthorizationPolicy.require(outsider, vault, 'read'));
    expect(error.code).toBe('FORBIDDEN');
    expect(error.revealsExistence).toBe(false);
  });

  it('lets an EDITOR write', () => {
    expect(unwrap(AuthorizationPolicy.require(context(), vault, 'write'))).toBe(Role.EDITOR);
  });

  it('demotes an EDITOR to VIEWER through the vault ceiling', () => {
    const limited = newVault();
    unwrap(limited.setRoleLimit(otherUser, VaultRoleLimit.VIEWER, authorship()));
    const ctx = context({ roles: new Map([[limited.workspaceId.value, Role.EDITOR]]) });

    expect(AuthorizationPolicy.effectiveRole(ctx, limited)).toBe(Role.VIEWER);
    const error = expectErr(AuthorizationPolicy.require(ctx, limited, 'write'));
    // The one deliberate exception to the 404: the member already sees this
    // vault in their list, so a 404 here would protect nothing (RN-ACC-012).
    expect(error.revealsExistence).toBe(true);
    expect(error.message).toContain('limited to VIEWER');
  });

  it('never lets a ceiling promote anyone', () => {
    const limited = newVault();
    unwrap(limited.setRoleLimit(otherUser, VaultRoleLimit.VIEWER, authorship()));
    const viewer = context({ roles: new Map([[limited.workspaceId.value, Role.VIEWER]]) });
    expect(AuthorizationPolicy.effectiveRole(viewer, limited)).toBe(Role.VIEWER);
  });

  it('reserves administration for the owner', () => {
    const error = expectErr(AuthorizationPolicy.require(context(), vault, 'administer'));
    expect(error.revealsExistence).toBe(true);
    expect(
      unwrap(AuthorizationPolicy.require(context({ isOwner: true }), vault, 'administer')),
    ).toBe(Role.OWNER);
  });

  it('refuses a VIEWER any write, by workspace role alone', () => {
    const viewer = context({ roles: new Map([[vault.workspaceId.value, Role.VIEWER]]) });
    const error = expectErr(AuthorizationPolicy.require(viewer, vault, 'write'));
    expect(error.message).toContain('EDITOR');
  });
});
