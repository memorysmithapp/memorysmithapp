import { describe, expect, it } from 'vitest';
import {
  FolderId,
  Instant,
  NoteId,
  NotebookId,
  Position,
  Role,
  NotebookRoleLimit,
  Slug,
  SubscriptionId,
} from '@memorysmith/kernel';
import { Folder } from '../src/domain/notebook/Folder.js';
import { Notebook } from '../src/domain/notebook/Notebook.js';
import { ShortText } from '../src/domain/values.js';
import { NotePlacement } from '../src/domain/services/NotePlacement.js';
import { RESERVED_FRONTMATTER_KEYS } from '@memorysmith/contracts';
import { composeNotebookContext } from '../src/domain/services/NotebookContextComposer.js';
import {
  AuthorizationPolicy,
  type RequestContext,
} from '../src/domain/access/AuthorizationPolicy.js';
import {
  authorship,
  expectErr,
  folderDescription,
  folderName,
  newNotebook,
  notebookName,
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
      `3. **Trabalhos/** \`${trabalhos.id.value}\`: Relatorios emitidos. (0 notes here, 0 in subfolders)`,
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

  it('tells a folder that keeps its notes in subfolders from an empty one', () => {
    // RN-AGT-035: "Business Knowledge/ (0 notes)" while six subfolders held 26.
    const parentId = FolderId.generate();
    const childId = FolderId.generate();
    const at = (id: FolderId, parent: FolderId | null, name: string) =>
      Folder.rehydrate({
        id,
        parentFolderId: parent,
        name: folderName(name),
        slug: unwrap(Slug.from(name)),
        description: folderDescription(`Onde ficam as ${name}.`),
        position: Position.first(),
        createdBy: authorship(),
        updatedAt: Instant.now(),
      });
    const notebook = Notebook.rehydrate({
      id: NotebookId.generate(),
      subscriptionId: SubscriptionId.generate(),
      name: notebookName('Leitura'),
      slug: unwrap(Slug.from('Leitura')),
      description: unwrap(ShortText.create('')),
      folders: [at(parentId, null, 'Negocio'), at(childId, parentId, 'Regras')],
      limits: new Map(),
      noteCounts: new Map([[childId.value, 26]]),
      notebookNoteCount: 26,
      templatedFolderIds: new Set(),
      hasGuidance: false,
      version: 1,
      createdBy: authorship(),
      updatedAt: Instant.now(),
      deletedAt: null,
    });

    const context = composeNotebookContext({
      notebook,
      guidance: null,
      reservedVocabulary: VOCABULARY,
    });

    expect(context).toContain('(0 notes here, 26 in subfolders)');
    expect(context).toContain('Onde ficam as Regras. (26 notes)');
  });

  it('says how much the notebook holds, the folders against their ceiling', () => {
    // RN-AGT-032: the notes are the sum of the counts printed beside each
    // folder, so the two agree; the folders are said against 200 (RN-KNW-010).
    const { notebook } = rehydratedNotebookWithNotes(811);
    const context = composeNotebookContext({
      notebook,
      guidance: null,
      reservedVocabulary: VOCABULARY,
    });
    expect(context).toContain('811 notes · 1 of 200 folders');
    expect(context).toContain('(811 notes)');
  });

  it('flags a folder that has a template', () => {
    // The Template is an aggregate of its own; what the tree carries is the
    // fact that this folder has one (RN-KNW-044).
    const { notebook, folderId } = rehydratedNotebookWithNotes(2, true);
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

  it('teaches no value for who wrote a note, and says its history answers it', () => {
    // Teaching `author` as the person who authorized the connection put the
    // e-mail of the connected account into notes other people produced.
    const context = composeNotebookContext({
      notebook: newNotebook(),
      guidance: null,
      reservedVocabulary: VOCABULARY,
    });

    expect(context).not.toContain('the person who authorized the connection');
    expect(context).not.toContain('`co-author`');
    expect(context).toContain('`note_history`');
    expect(context).toContain('never writes an attribute into the body of a note');
  });

  it('says what a name is without prohibiting anything about headings', () => {
    const context = composeNotebookContext({
      notebook: newNotebook(),
      guidance: null,
      reservedVocabulary: VOCABULARY,
    });

    expect(context).toContain('the title its page shows');
    expect(context).not.toMatch(/never names|names nothing|nothing else names|not a heading/);
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
