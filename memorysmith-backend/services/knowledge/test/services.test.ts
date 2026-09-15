import { describe, expect, it } from 'vitest';
import type { FolderId } from '@memorysmith/kernel';
import { NoteId, Position, Role, NotebookRoleLimit } from '@memorysmith/kernel';
import type { Folder } from '../src/domain/notebook/Folder.js';
import { NotePlacement } from '../src/domain/services/NotePlacement.js';
import { RESERVED_FRONTMATTER_KEYS } from '@memorysmith/contracts';
import { composeNotebookContext } from '../src/domain/services/NotebookContextComposer.js';
import {
  AuthorizationPolicy,
  type RequestContext,
} from '../src/domain/access/AuthorizationPolicy.js';
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
} from './fixtures.js';

/**
 * What the composition root injects in production: the vocabulary of the
 * specification, never a list typed in a test (RN-AGT-025).
 */
const VOCABULARY = RESERVED_FRONTMATTER_KEYS;

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

  it('refuses an anchor that is not a note of the folder, naming the ones that are', () => {
    const refused = expectErr(NotePlacement.place(siblings, NoteId.generate()));
    expect(refused.code).toBe('VALIDATION');
    expect(JSON.stringify(refused.details)).toContain(first.noteId.value);
  });

  it('ignores the moving note when computing its own new position', () => {
    // Anchoring against its own key would produce a key that is not strictly
    // between the neighbours.
    const placed = unwrap(NotePlacement.place(siblings, null, first.noteId));
    expect(placed.value < second.position.value).toBe(true);
  });
});

describe('NotebookContextComposer', () => {
  it('renders guidance in full, then the numbered annotated tree', () => {
    const { notebook, folderId } = rehydratedNotebookWithNotes(48);
    unwrap(
      notebook.addFolder(
        null,
        folderName('Achados'),
        folderDescription('Achados de auditoria. Todo achado cita a norma que o fundamenta.'),
        folderId,
        authorship(),
      ),
    );
    const trabalhos = unwrap(
      notebook.addFolder(
        null,
        folderName('Trabalhos'),
        folderDescription('Relatorios emitidos.'),
        notebook.folders.childrenOf(null)[1]?.id ?? null,
        authorship(),
      ),
    );
    const year2026 = unwrap(
      notebook.addFolder(
        trabalhos.id,
        folderName('2026'),
        folderDescription('Emitidos neste exercicio.'),
        null,
        authorship(),
      ),
    );

    const context = composeNotebookContext({
      notebook,
      guidance: '## Purpose\nOne norm per note.',
      reservedVocabulary: VOCABULARY,
    });

    expect(context).toContain('# Notebook: Normas e Legislacao');
    expect(context).toContain('## Purpose\nOne norm per note.');
    expect(context).toContain('## Structure');
    // Order is the defined order, numbered, and the counts come along. The
    // identifier of each folder comes along too (RN-AGT-020).
    expect(context).toContain(
      `1. **Normas** \`${folderId.value}\`: Texto normativo por artigo. (48 notes)`,
    );
    expect(context).toContain('2. **Achados** `');
    // A folder with children is rendered with a trailing slash, and its
    // children are numbered underneath it.
    expect(context).toContain(
      `3. **Trabalhos/** \`${trabalhos.id.value}\`: Relatorios emitidos. (0 notes)`,
    );
    expect(context).toContain(
      `   3.1. **2026** \`${year2026.id.value}\`: Emitidos neste exercicio. (0 notes)`,
    );
  });

  it('addresses every folder of a deep tree, so no level is reachable only by having created it', () => {
    // The defect this guards: the identifier used to be returned exactly once,
    // by create_folder, so a later session could read the tree and name none of
    // it. Every rendered folder carries its own identifier, at every depth
    // (RN-AGT-020).
    const { notebook, folderId } = rehydratedNotebookWithNotes(0);
    let parent: FolderId | null = folderId;
    const nested: FolderId[] = [folderId];
    // RN-KNW-003 caps the tree at 6 levels; the root fixture is the first.
    for (const level of ['L2', 'L3', 'L4', 'L5', 'L6']) {
      const child: Folder = unwrap(
        notebook.addFolder(
          parent,
          folderName(level),
          folderDescription(`Level ${level}.`),
          null,
          authorship(),
        ),
      );
      nested.push(child.id);
      parent = child.id;
    }

    const context = composeNotebookContext({
      notebook,
      guidance: null,
      reservedVocabulary: VOCABULARY,
    });

    for (const id of nested) expect(context).toContain(`\`${id.value}\``);
    // The deepest one is indented and numbered, and still addressable.
    expect(context).toContain(
      `               1.1.1.1.1.1. **L6** \`${nested[5]?.value}\`: Level L6. (0 notes)`,
    );
  });

  it('flags a folder that has a template', () => {
    const { notebook, folderId } = rehydratedNotebookWithNotes(2);
    unwrap(notebook.attachTemplate(folderId, contentRef('f'.repeat(64)), authorship()));
    const context = composeNotebookContext({
      notebook,
      guidance: null,
      reservedVocabulary: VOCABULARY,
    });
    expect(context).toContain('(2 notes, has TEMPLATE.md)');
    // The folder that has a template is exactly the folder get_template needs
    // an identifier for (RN-AGT-020).
    expect(context).toContain(`\`${folderId.value}\`:`);
  });

  it('declares the reserved vocabulary, and exactly the one the specification carries', () => {
    // RN-AGT-025. An agent landing here has no other way to tell an attribute
    // name that means something everywhere from one that belongs to this notebook
    // alone, and a list typed beside the specification would be the fourth
    // copy this cycle removed.
    const context = composeNotebookContext({
      notebook: newNotebook(),
      guidance: null,
      reservedVocabulary: VOCABULARY,
    });

    expect(context).toContain('## Reserved attributes');
    for (const key of VOCABULARY) expect(context).toContain(`\`${key}\``);
    // And no name the specification does not reserve: `maturity` is the
    // product's own facet and it belongs to whatever Guidance declares it.
    expect(context).not.toContain('`maturity`');
    expect(context).not.toContain('`autor`');
  });

  it('says what author and co-author mean here, and that the product never writes them', () => {
    const context = composeNotebookContext({
      notebook: newNotebook(),
      guidance: null,
      reservedVocabulary: VOCABULARY,
    });

    expect(context).toContain('the person who authorized the connection');
    expect(context).toContain('the connector that executed the write');
    expect(context).toContain('never writes an attribute into the body of a note');
  });

  it('declares nothing when the vocabulary is empty, rather than an empty heading', () => {
    const context = composeNotebookContext({
      notebook: newNotebook(),
      guidance: null,
      reservedVocabulary: [],
    });
    expect(context).not.toContain('## Reserved attributes');
  });

  it('says so when there is no guidance yet, instead of pretending', () => {
    const notebook = newNotebook();
    const context = composeNotebookContext({
      notebook,
      guidance: null,
      reservedVocabulary: VOCABULARY,
    });
    expect(context).toContain('has no guidance yet');
    expect(context).toContain('no folders yet');
  });
});

describe('AuthorizationPolicy', () => {
  const notebook = newNotebook();

  function context(overrides: Partial<RequestContext> = {}): RequestContext {
    return {
      user: otherUser,
      isOwner: false,
      role: Role.EDITOR,
      ...overrides,
    };
  }

  it('lets the subscription owner reach everything', () => {
    const role = AuthorizationPolicy.effectiveRole(context({ user, isOwner: true }), notebook);
    expect(role).toBe(Role.OWNER);
  });

  it('answers 404, never 403, for a notebook the caller cannot see', () => {
    // RN-SUB-004: a forbidden resource is indistinguishable from a missing one.
    const outsider = context({ role: Role.NONE });
    const error = expectErr(AuthorizationPolicy.require(outsider, notebook, 'read'));
    expect(error.code).toBe('FORBIDDEN');
    expect(error.revealsExistence).toBe(false);
  });

  it('lets an EDITOR write', () => {
    expect(unwrap(AuthorizationPolicy.require(context(), notebook, 'write'))).toBe(Role.EDITOR);
  });

  it('demotes an EDITOR to VIEWER through the notebook ceiling', () => {
    const limited = newNotebook();
    unwrap(limited.setRoleLimit(otherUser, NotebookRoleLimit.VIEWER, authorship()));
    const ctx = context({ role: Role.EDITOR });

    expect(AuthorizationPolicy.effectiveRole(ctx, limited)).toBe(Role.VIEWER);
    const error = expectErr(AuthorizationPolicy.require(ctx, limited, 'write'));
    // The one deliberate exception to the 404: the member already sees this
    // notebook in their list, so a 404 here would protect nothing (RN-ACC-012).
    expect(error.revealsExistence).toBe(true);
    expect(error.message).toContain('limited to VIEWER');
  });

  it('never lets a ceiling promote anyone', () => {
    const limited = newNotebook();
    unwrap(limited.setRoleLimit(otherUser, NotebookRoleLimit.VIEWER, authorship()));
    const viewer = context({ role: Role.VIEWER });
    expect(AuthorizationPolicy.effectiveRole(viewer, limited)).toBe(Role.VIEWER);
  });

  it('reserves administration for the owner', () => {
    const error = expectErr(AuthorizationPolicy.require(context(), notebook, 'administer'));
    expect(error.revealsExistence).toBe(true);
    expect(
      unwrap(AuthorizationPolicy.require(context({ isOwner: true }), notebook, 'administer')),
    ).toBe(Role.OWNER);
  });

  it('refuses a VIEWER any write, by subscription role alone', () => {
    const viewer = context({ role: Role.VIEWER });
    const error = expectErr(AuthorizationPolicy.require(viewer, notebook, 'write'));
    expect(error.message).toContain('EDITOR');
  });
});
