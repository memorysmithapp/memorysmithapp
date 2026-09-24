import { describe, expect, it } from 'vitest';
import { READING_PATH, TOOL_CATALOG, catalogIsWellFormed } from '../src/mcp/catalog.js';
import { McpToolAdapter, UNNAMED_NOTE_NOTICE } from '../src/mcp/tools.js';
import { GatewayError, type AgentCaller } from '../src/mcp/gateway.js';
import { handleMcpRequest } from '../src/mcp.js';
import {
  DESIGN_NOTEBOOK_SKILL,
  FORMATTING_LEFT_TO_WRITE_NOTES,
  FORMATTING_USES,
  SKILLS,
  skillIndex,
  skillNamed,
} from '../src/mcp/skills.js';
import {
  DECLARED_SILENCE,
  MARKDOWN_SPEC_SOURCES,
  RECOGNISED_NOTATION,
  type Deployment,
} from '@memorysmith/contracts';
import type { VerifiedAgentToken } from '../src/auth.js';
import pkg from '../package.json' with { type: 'json' };

const caller: AgentCaller = {
  userId: 'user-1',
  subscriptionId: '01JBQ2X0000000000000000000',
};

function gateways(overrides: Record<string, unknown> = {}) {
  const access = {
    connector: async () => ({ clientId: 'https://claude.ai/mcp', clientName: 'Claude' }),
    ...((overrides['access'] as object) ?? {}),
  };
  const knowledge = {
    listNotebooks: async () => [
      { notebookId: 'v1', name: 'Normas', description: 'Texto normativo', noteCount: 48 },
    ],
    notebookContext: async () => '# Notebook: Normas\n\n## Structure\n1. **Normas**: (48 notes)\n',
    template: async () => ({
      content: '# Modelo\n\n## Vigencia',
      folderName: 'Normas',
      revision: 'v5',
    }),
    listNotes: async () => [
      { noteId: 'n1', name: 'Lei 14.133', slug: 'lei-14133', folderId: 'f1', position: 'a0' },
    ],
    nextNumber: async () => 42,
    readNote: async () => ({
      noteId: 'n1',
      name: 'Lei 14.133',
      content: '# Lei 14.133',
      revision: 'v3',
      updatedAt: '2026-03-20T10:00:00.000Z',
    }),
    createNote: async () => ({
      noteId: 'n2',
      name: 'Nova',
      content: '# Nova',
      revision: 'v1',
      updatedAt: '2026-03-21T10:00:00.000Z',
    }),
    updateNote: async () => ({
      noteId: 'n1',
      name: 'Lei 14.133',
      content: '# Atualizada',
      revision: 'v4',
      updatedAt: '2026-03-22T10:00:00.000Z',
    }),
    searchNotes: async () => [
      { noteId: 'n1', name: 'Lei 14.133', section: null, excerpt: 'Lei 14.133', score: 1 },
    ],
    createNotebook: async () => ({
      notebookId: 'v2',
      name: 'Achados',
      description: 'Achados de auditoria',
      noteCount: 0,
    }),
    deleteNotebook: async () => undefined,
    keptExportsOf: async () => 0,
    setGuidance: async () => 'v2',
    guidance: async () => ({ content: '# Proposito', revision: 'v1' }),
    createFolder: async () => ({
      folderId: 'f2',
      parentFolderId: null,
      name: 'Achados',
      slug: 'achados',
      description: 'Achados de auditoria.',
    }),
    deleteFolder: async () => ({ removedFolderIds: ['f2'] }),
    setTemplate: async () => 'v6',
    deleteNote: async () => undefined,
    reorderFolder: async () => [
      {
        folderId: 'f2',
        parentFolderId: null,
        name: 'Achados',
        slug: 'achados',
        description: 'Achados de auditoria.',
        position: 'Zz',
      },
      {
        folderId: 'f1',
        parentFolderId: null,
        name: 'Normas',
        slug: 'normas',
        description: 'Texto normativo.',
        position: 'a0',
      },
    ],
    reorderNote: async () => [
      { noteId: 'n2', name: 'Nova', folderId: 'f1', position: 'Zz' },
      { noteId: 'n1', name: 'Lei 14.133', folderId: 'f1', position: 'a0' },
    ],
    ...((overrides['knowledge'] as object) ?? {}),
  };
  const discovery = {
    relatedNotes: async () => ({
      noteId: 'n1',
      name: 'Achado 12',
      folderId: 'f1',
      depth: 0,
      children: [{ noteId: 'n2', name: 'Lei 14.133', folderId: 'f2', depth: 1, children: [] }],
    }),
    backlinks: async () => [
      { noteId: 'n3', name: 'Achado 12', slug: 'achado-12', folderId: 'f2', position: 'a0' },
    ],
    ...((overrides['discovery'] as object) ?? {}),
  };
  const audit = {
    noteHistory: async () => [
      {
        occurredAt: '2026-03-20T10:00:00.000Z',
        type: 'NoteUpdated',
        userId: 'user-1',
        agentName: 'Claude',
        agentClientId: 'https://claude.ai/mcp',
        revision: 'v3',
      },
    ],
    revisionAt: async () => ({
      noteId: 'n1',
      name: null,
      content: '# Como estava em marco',
      revision: 'v2',
      updatedAt: '2026-03-10T10:00:00.000Z',
    }),
    ...((overrides['audit'] as object) ?? {}),
  };
  return new McpToolAdapter({ access, knowledge, discovery, audit } as never);
}

describe('The tool catalog is the public contract', () => {
  it('publishes the whole authoring surface, reads and writes', () => {
    // The catalog IS the public contract of the product: a tool leaving it, or
    // an argument changing shape, is a version bump and never a quiet edit.
    expect(TOOL_CATALOG.map((tool) => tool.name)).toEqual([
      'whoami',
      'get_skill',
      'list_notebooks',
      'create_notebook',
      'delete_notebook',
      'get_notebook_context',
      'get_guidance',
      'set_guidance',
      'delete_guidance',
      'create_folder',
      'reorder_folder',
      'delete_folder',
      'get_template',
      'set_template',
      'delete_template',
      'next_number',
      'list_notes',
      'read_note',
      'create_note',
      // What a notebook keeps beside its notes (#166).
      'keep_file',
      'list_files',
      'delete_file',
      'update_note',
      'reorder_note',
      'delete_note',
      'search_notes',
      'related_notes',
      'backlinks',
      // The sweep before the work is handed over (#217).
      'check_notebook',
      'note_history',
    ]);
  });

  it('gives every tool a title and a read-only or destructive hint', () => {
    // RN-AGT-009: without the hints a client asks the user on every call.
    expect(catalogIsWellFormed()).toBe(true);
    for (const tool of TOOL_CATALOG) {
      expect(tool.title.length).toBeGreaterThan(0);
      expect(tool.description.length).toBeGreaterThan(40);
    }
  });

  it('narrates a reading path made only of tools that exist', () => {
    /**
     * The help of `whoami` walks READING_PATH. A step naming a tool nobody
     * implements would send an agent down a path that fails on the first call,
     * which is worse than shipping no help at all.
     */
    const named = new Set(TOOL_CATALOG.map((tool) => tool.name));
    for (const step of READING_PATH) expect(named.has(step)).toBe(true);
  });

  it('never mixes reading and writing in one tool', () => {
    // RN-AGT-010: there is no generic tool parameterized by operation.
    const writers = TOOL_CATALOG.filter((tool) => tool.annotations.readOnlyHint === false);
    expect(writers.map((tool) => tool.name)).toEqual([
      'create_notebook',
      'delete_notebook',
      'set_guidance',
      'delete_guidance',
      'create_folder',
      'reorder_folder',
      'delete_folder',
      'set_template',
      'delete_template',
      'next_number',
      'create_note',
      'keep_file',
      'delete_file',
      'update_note',
      'reorder_note',
      'delete_note',
    ]);
    for (const tool of TOOL_CATALOG) {
      const readable = tool.annotations.readOnlyHint === true;
      const writable = tool.annotations.readOnlyHint === false;
      expect(readable !== writable).toBe(true);
    }
  });

  it('declares create_note as NOT idempotent, and update_note as destructive', () => {
    // RN-AGT-024: a name its folder holds is refused, but a note with no name
    // reserves nothing, so a repeated call can still write a second note.
    // Declaring it idempotent would tell a client that every retry is free.
    const create = TOOL_CATALOG.find((tool) => tool.name === 'create_note');
    const update = TOOL_CATALOG.find((tool) => tool.name === 'update_note');
    expect(create?.annotations.idempotentHint).toBe(false);
    expect(create?.annotations.destructiveHint).toBe(false);
    expect(create?.description).toContain('one note of each name');
    expect(update?.annotations.destructiveHint).toBe(true);
  });

  it('tells the agent that a note is named by name: in the content it writes', () => {
    // RN-KNW-035: there is no name argument anywhere, and an agent that
    // writes no `name:` gets a note no link can reach (RN-KNW-036).
    const create = TOOL_CATALOG.find((tool) => tool.name === 'create_note');
    const update = TOOL_CATALOG.find((tool) => tool.name === 'update_note');
    expect(create?.inputSchema.required).toEqual(['notebook', 'folder', 'content']);
    expect(create?.description).toContain('`name:`');
    expect(create?.description).toContain('the title the page shows');
    expect(create?.description).toContain('`write-notes`');
    expect(update?.description).toContain('renamed');
    // No description teaches `title:` for naming a note.
    for (const tool of TOOL_CATALOG) expect(tool.description).not.toContain('`title:`');
  });

  it('tells the agent to read the template before writing', () => {
    // RN-AGT-002: the server does not validate against the template, so the
    // description is what carries the instruction.
    const create = TOOL_CATALOG.find((tool) => tool.name === 'create_note');
    expect(create?.description).toContain('get_template');
  });
});

describe('whoami answers who is acting and how to write here', () => {
  it('names the person, the connector and the subscription', async () => {
    const result = await gateways().call(
      'whoami',
      {},
      {
        ...caller,
        email: 'heitor@example.com',
      },
    );
    expect(result.isError).toBe(false);

    const answer = result.content[0]?.text ?? '';
    expect(answer).toContain('heitor@example.com');
    expect(answer).toContain('- **Connector**: Claude (`https://claude.ai/mcp`)');
    expect(answer).toContain(caller.subscriptionId);
  });

  it('says the connector is unidentified, and never names a user in its place', async () => {
    // The token of the proxy carries the user, and naming the connector by it
    // is exactly what whoami used to do.
    const unbound = gateways({ access: { connector: async () => null } });
    const answer = (await unbound.call('whoami', {}, caller)).content[0]?.text ?? '';
    expect(answer).toContain('- **Connector**: not identified');
    expect(answer).toContain('every write through');
    expect(answer).not.toMatch(/Connector\*\*: user-1/);
  });

  it('falls back to the identifier when the token carries no e-mail', async () => {
    const result = await gateways().call('whoami', {}, caller);
    expect(result.content[0]?.text ?? '').toContain('user-1');
  });

  it('lists the notebooks actually within reach, not a description of them', async () => {
    const result = await gateways().call('whoami', {}, caller);
    const answer = result.content[0]?.text ?? '';
    expect(answer).toContain('Normas');
    expect(answer).toContain('48 note(s)');
  });

  it('says plainly when there is no notebook yet', async () => {
    const empty = gateways({ knowledge: { listNotebooks: async () => [] } });
    const result = await empty.call('whoami', {}, caller);
    expect(result.content[0]?.text ?? '').toContain('No notebook yet');
  });

  it('walks the reading path and names every tool of the catalog', async () => {
    const result = await gateways().call('whoami', {}, caller);
    const answer = result.content[0]?.text ?? '';

    // The path, in order, and each step where it belongs.
    for (const [index, step] of READING_PATH.entries()) {
      expect(answer).toContain(`${index + 1}. **\`${step}\`**`);
    }
    // And nothing in the catalog is left out of the surface it advertises.
    for (const tool of TOOL_CATALOG) expect(answer).toContain(`\`${tool.name}\``);
  });

  it('says the server does not validate content against guidance or template', async () => {
    // PP4: the backend never interprets a note. An agent that assumes it does
    // would trust a check that never runs.
    const result = await gateways().call('whoami', {}, caller);
    expect(result.content[0]?.text ?? '').toContain('does NOT validate');
  });
});

describe('The connector authors the notebook, and not only its notes', () => {
  /** Each write tool reaches its own use case; none is parameterized by operation. */
  function spy(): { calls: string[]; adapter: ReturnType<typeof gateways> } {
    const calls: string[] = [];
    const adapter = gateways({
      knowledge: {
        createNotebook: async (_caller: unknown, input: { name: string }) => {
          calls.push(`createNotebook:${input.name}`);
          return { notebookId: 'v2', name: input.name, description: '', noteCount: 0 };
        },
        deleteNotebook: async (_caller: unknown, notebookId: string) => {
          calls.push(`deleteNotebook:${notebookId}`);
        },
        // An export survives the notebook it was made of, and whoever deletes
        // one is told so where the deletion is confirmed (RN-PRT-021).
        keptExportsOf: async () => 2,
        setGuidance: async (_caller: unknown, notebookId: string, content: string) => {
          calls.push(`setGuidance:${notebookId}:${content}`);
        },
        createFolder: async (
          _caller: unknown,
          input: { name: string; parentFolderId?: string },
        ) => {
          calls.push(`createFolder:${input.name}:${input.parentFolderId ?? 'root'}`);
          return {
            folderId: 'f9',
            parentFolderId: input.parentFolderId ?? null,
            name: input.name,
            slug: 'x',
            description: 'y',
          };
        },
        deleteFolder: async (_caller: unknown, input: { folderId: string; policy: string }) => {
          calls.push(`deleteFolder:${input.folderId}:${input.policy}`);
          return { removedFolderIds: [input.folderId] };
        },
        setTemplate: async (_caller: unknown, input: { folderId: string }) => {
          calls.push(`setTemplate:${input.folderId}`);
        },
        deleteNote: async (_caller: unknown, notebookId: string, noteId: string) => {
          calls.push(`deleteNote:${notebookId}:${noteId}`);
        },
      },
    });
    return { calls, adapter };
  }

  it('creates a notebook, its guidance, a folder and its template', async () => {
    const { calls, adapter } = spy();
    await adapter.call('create_notebook', { name: 'Achados', description: 'De auditoria' }, caller);
    await adapter.call(
      'set_guidance',
      { notebook: 'v2', content: '# Proposito', baseRevision: null },
      caller,
    );
    await adapter.call(
      'create_folder',
      { notebook: 'v2', name: '2026', description: 'Deste exercicio.', parent: 'f1' },
      caller,
    );
    await adapter.call(
      'set_template',
      { notebook: 'v2', folder: 'f9', content: '# {{t}}', baseRevision: null },
      caller,
    );

    expect(calls).toEqual([
      'createNotebook:Achados',
      'setGuidance:v2:# Proposito',
      'createFolder:2026:f1',
      'setTemplate:f9',
    ]);
  });

  it('deletes a note, a folder and a notebook, each through its own tool', async () => {
    const { calls, adapter } = spy();
    await adapter.call('delete_note', { notebook: 'v1', note: 'n1' }, caller);
    await adapter.call(
      'delete_folder',
      { notebook: 'v1', folder: 'f2', policy: 'CASCADE' },
      caller,
    );
    await adapter.call('delete_notebook', { notebook: 'v1' }, caller);

    expect(calls).toEqual(['deleteNote:v1:n1', 'deleteFolder:f2:CASCADE', 'deleteNotebook:v1']);
  });

  it('refuses to remove a folder without an explicit policy', async () => {
    // RN-KNW-007: there is no implicit default, so the tool asks rather than
    // guessing between refusing and cascading over a subtree.
    const result = await gateways().call('delete_folder', { notebook: 'v1', folder: 'f2' }, caller);
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('delete_folder requires the argument "policy"');
  });

  it('says plainly that a deletion is definitive', async () => {
    // Deleting is definitive and there is no trash (RN-KNW-029, RN-KNW-033).
    // What the answer says is what an agent repeats to the person, so it says
    // what went and that nothing brings it back.
    const { adapter } = spy();
    const note = await adapter.call('delete_note', { notebook: 'v1', note: 'n1' }, caller);
    const notebook = await adapter.call('delete_notebook', { notebook: 'v1' }, caller);
    expect(note.content[0]?.text).toContain('Nothing brings it back');
    expect(notebook.content[0]?.text).toContain('Nothing brings it back');
    // And what does NOT go with it: the exports of that notebook stay, which
    // is the one way back from a deletion by mistake (RN-PRT-021).
    expect(notebook.content[0]?.text).toContain('are 2 exports of this notebook in Transfers');
  });

  it('names the note that holds a taken name, and says what to do next', async () => {
    // RN-AGT-030: a bare CONFLICT leaves an agent guessing whether to retry.
    const adapter = gateways({
      knowledge: {
        createNote: async () => {
          throw new GatewayError('CONFLICT', 'A note of this folder is already named "Lei"', {
            code: 'ALREADY_EXISTS',
            noteId: '01JBQ2X0000000000000000HLD',
            name: 'Lei',
          });
        },
      },
    });
    const result = await adapter.call(
      'create_note',
      { notebook: 'v1', folder: 'f1', content: 'A body the gateway refuses.' },
      caller,
    );
    expect(result.isError).toBe(true);
    const said = result.content[0]?.text ?? '';
    expect(said).toContain('01JBQ2X0000000000000000HLD');
    expect(said).toContain('update_note');
    expect(said).toContain('Nothing was written');
  });

  it('passes a refusal by role through, instead of pretending it wrote', async () => {
    // RN-AGT-006 generalized: a VIEWER is refused on every write tool, and the
    // refusal reaches the agent as an error with text it can act on.
    const adapter = gateways({
      knowledge: {
        createNotebook: async () => {
          throw new GatewayError('FORBIDDEN', 'Creating a notebook requires the EDITOR role');
        },
      },
    });
    const result = await adapter.call('create_notebook', { name: 'X', description: 'Y' }, caller);
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('EDITOR');
  });
});

describe('The tool adapter translates in both directions', () => {
  it('returns the notebook context as Markdown, not as JSON', async () => {
    const result = await gateways().call('get_notebook_context', { notebook: 'v1' }, caller);
    expect(result.isError).toBe(false);
    expect(result.content[0]?.text).toContain('# Notebook: Normas');
    expect(result.content[0]?.text).toContain('## Structure');
  });

  it('answers a missing argument with the schema of the tool', async () => {
    // RN-AGT-003: the error carries what the next attempt needs.
    const result = await gateways().call('create_note', { notebook: 'v1' }, caller);
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('create_note requires the argument "folder"');
    expect(result.content[0]?.text).toContain('content');
  });

  it('passes a revision conflict through with the current content', async () => {
    const adapter = gateways({
      knowledge: {
        updateNote: async () => {
          throw new GatewayError('CONFLICT', 'The note changed since your revision', {
            currentRevision: 'v9',
            currentContent: '# Conteudo atual',
          });
        },
      },
    });
    const result = await adapter.call(
      'update_note',
      { notebook: 'v1', note: 'n1', content: '# Nova', baseRevision: 'v3' },
      caller,
    );
    expect(result.content[0]?.text).toContain('Conteudo atual');
  });

  it('reads a past revision through the audit trail when asOf is given', async () => {
    const result = await gateways().call(
      'read_note',
      { notebook: 'v1', note: 'n1', asOf: '2026-03-15T00:00:00.000Z' },
      caller,
    );
    expect(result.content[0]?.text).toContain('Como estava em marco');
  });

  it('renders the dependency tree as an indented outline', async () => {
    const result = await gateways().call('related_notes', { notebook: 'v1', note: 'n1' }, caller);
    // The folder tells apart two notes of one name (#128).
    expect(result.content[0]?.text).toBe(
      '- Achado 12 (n1, folder f1)\n  - Lei 14.133 (n2, folder f2)',
    );
  });

  it('answers what a notebook left pending, and what looks broken in it (#217)', async () => {
    const answer = {
      pending: [
        {
          target: 'M42',
          from: [{ noteId: 'n2', name: 'Session 1', folderId: 'f1' }],
          likelyMeant: { name: 'M42 Orion Nebula', kind: 'note', noteId: 'n1' },
        },
      ],
      orphans: [],
    };
    const adapter = gateways({ discovery: { checkNotebook: async () => answer } });
    const result = await adapter.call('check_notebook', { notebook: 'v1' }, caller);
    expect(result.isError).toBe(false);
    expect(JSON.parse(result.content[0]?.text ?? '')).toEqual(answer);
  });

  it('says something useful when the connector reaches no notebook', async () => {
    const adapter = gateways({ knowledge: { listNotebooks: async () => [] } });
    const result = await adapter.call('list_notebooks', {}, caller);
    expect(result.isError).toBe(false);
    expect(result.content[0]?.text).toContain('reaches no notebook yet');
  });
});

describe('The MCP transport', () => {
  const token: VerifiedAgentToken = {
    sub: 'user-1',
    clientId: 'https://claude.ai/mcp',
    subscriptionId: '01JBQ2X0000000000000000000',
    payload: {},
  };

  it('lists the catalog on tools/list', async () => {
    const response = await handleMcpRequest(
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      token,
      gateways(),
    );
    expect(response).not.toBeNull();
    const tools = (response as { result: { tools: unknown[] } }).result.tools;
    expect(tools).toHaveLength(TOOL_CATALOG.length);
  });

  it('refuses a tool call from a token with no subscription', async () => {
    const unbound: VerifiedAgentToken = { sub: 'user-1', clientId: 'x', payload: {} };
    const response = await handleMcpRequest(
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'list_notebooks' } },
      unbound,
      gateways(),
    );
    const result = (response as { result: { isError: boolean; content: Array<{ text: string }> } })
      .result;
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('not bound to a subscription');
  });

  it('announces the version of the service manifest on the handshake, never a literal', async () => {
    const response = await handleMcpRequest(
      { jsonrpc: '2.0', id: 1, method: 'initialize' },
      token,
      gateways(),
    );
    const { serverInfo } = (
      response as { result: { serverInfo: { name: string; version: string } } }
    ).result;
    expect(serverInfo.name).toBe('memorysmith-mcp');
    // Compared against the manifest, not against a number written here: a
    // literal in the test would have to be edited on every release, which is
    // the very failure this fixes.
    expect(serverInfo.version).toBe(pkg.version);
  });

  it('answers notifications with no body', async () => {
    const response = await handleMcpRequest(
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      token,
      gateways(),
    );
    expect(response).toBeNull();
  });
});

describe('skills: the method, indexed by whoami', () => {
  it('indexes every registered skill, derived from the registry', async () => {
    const result = await gateways().call('whoami', {}, caller);
    const help = result.content[0]?.text ?? '';

    // Derived, not transcribed: every skill in the registry shows up with the
    // task it teaches, and nothing else can (RN-AGT-018).
    for (const skill of SKILLS) {
      expect(help).toContain(skill.name);
      expect(help).toContain(skill.task);
    }
    expect(help).toContain('get_skill');
  });

  it('serves the body of a skill by name', async () => {
    const result = await gateways().call('get_skill', { name: 'design-notebook' }, caller);

    expect(result.isError).toBe(false);
    expect(result.content[0]?.text).toBe(skillNamed('design-notebook')?.body);
  });

  it('teaches the practices a notebook is built with, each as the product implements it', () => {
    const body = skillNamed('design-notebook')?.body ?? '';

    for (const section of [
      '## The guidance',
      '## Short notes, one concept each',
      '## Folders and subfolders',
      '## Properties and tags',
      '## Maps of content',
      '## Templates',
      '## Formatting that earns its place',
    ]) {
      expect(body).toContain(section);
    }
    // The two mistakes the skill was first written for, stated positively: a
    // guidance opening with the heading the Notebook Context already prints,
    // and a folder that receives notes with no template.
    expect(body).toContain('Open with the paragraph that says what the notebook is');
    expect(body).toContain('Every folder that receives notes has its own template');
    expect(body).toContain('Open the template with the frontmatter block');
    expect(body).toContain('headings from `#`');
    // What the product does, where a practice could promise more than that.
    expect(body).toContain('a subfolder too');
    expect(body).toContain('reorder_folder');
    expect(body).toContain('`tags: [contracts, procurement]`');
    expect(body).toContain('`convert-inline-tags`');
    // What six agents writing one notebook showed the skill had to teach (#132):
    // the three parts of a description, subfolders created with their first
    // note, names without the kind of the folder, maps kept as notes arrive,
    // and records that multiply numbered by the folder.
    expect(body).toContain('the question its notes');
    expect(body).toContain('Create a subfolder when its first note arrives');
    expect(body).toContain('the folder says what kind of note it is');
    expect(body).toContain('Add the line of a map with the note it points at');
    expect(body).toContain('`next_number`');
    expect(body).toContain('`[[EV-00042|reads only the name key]]`');
    // And no interview: the agent proposes, and the person confirms.
    expect(body).not.toContain('samples');
    expect(body).toContain('confirm it before creating anything');
  });

  it('says when a notebook uses each form the page draws, keyed by the specification', () => {
    const body = skillNamed('design-notebook')?.body ?? '';
    const drawn = RECOGNISED_NOTATION.filter((entry) => entry.reader === 'reading-surface').map(
      (entry) => entry.id,
    );
    const taught = Object.keys(FORMATTING_USES);

    // Every form the page draws is taught here or left to write-notes, never
    // both, and nothing is keyed by a form the specification no longer has.
    expect([...taught, ...FORMATTING_LEFT_TO_WRITE_NOTES].sort()).toEqual([...drawn].sort());
    for (const id of taught) expect(FORMATTING_LEFT_TO_WRITE_NOTES.has(id)).toBe(false);
    for (const use of Object.values(FORMATTING_USES)) expect(body).toContain(use);
    // The syntax comes from the specification, and not from this file.
    const mermaid = RECOGNISED_NOTATION.find((entry) => entry.id === 'mermaid');
    expect(body).toContain(mermaid?.syntax ?? 'mermaid');
  });

  it('builds the notation skill from the declaration, never beside it', async () => {
    const body = skillNamed('write-notes')?.body ?? '';

    // Every declared form and its effect are in the text. Discovery tests the
    // same declaration against its extractors, so a notation that stops being
    // read stops being taught (RN-AGT-017).
    for (const entry of RECOGNISED_NOTATION) {
      expect(body).toContain(entry.syntax);
      expect(body).toContain(entry.effect);
    }
  });

  it('teaches what the product deliberately does not read', () => {
    const body = skillNamed('write-notes')?.body ?? '';

    // The half an agent gets wrong is not the notation it mistyped, it is the
    // one it believed in, so the list of what does nothing is part of the
    // skill and not an appendix.
    //
    // It was read off `recognised: false` until specification v0.4.0 stopped
    // carrying the field, and the assertion below is why that mattered: the
    // list went empty and this test said so instead of passing on nothing.
    expect(DECLARED_SILENCE.length).toBeGreaterThan(0);
    for (const entry of DECLARED_SILENCE) {
      expect(body).toContain(entry.syntax);
      expect(body).toContain(entry.effect);
    }
  });

  it('teaches the closing rule, which answers every form it does not list', () => {
    const body = skillNamed('write-notes')?.body ?? '';

    // §8 of the profile: a form outside the table may still be drawn, never
    // carries meaning, and never supports a conformance claim. It is the one
    // sentence that answers "I wrote something and got nothing" for every
    // undescribed form at once, which is why the profile traded a catalogue
    // for it in v0.4.0 and why the skill states it rather than a list.
    expect(body).toContain('is not part of the notation');
    expect(body).toContain('never carries meaning');
  });

  it('teaches when a source is a link, when it earns a note, and when it is embedded', () => {
    // #133: a notebook that cited every excerpt with a note of its own spent
    // 693 of its 811 notes on evidence a link would have carried.
    const body = skillNamed('write-notes')?.body ?? '';
    expect(body).toContain('## Citing a source');
    expect(body).toContain('A source with an address of its own is cited where it is used');
    expect(body).toContain('A source earns a note of its own');
    expect(body).toContain('A passage many notes cite is embedded, not copied');
    expect(body).toContain('![[Load test of 2026-09-15#^p95]]');
  });

  it('names each source of the notation, and survives one without a version', () => {
    const body = skillNamed('write-notes')?.body ?? '';

    // Obsidian is credited without a version because it publishes
    // documentation and not a specification. Reading `version` as required is
    // how the skill served `Obsidian undefined`.
    for (const source of MARKDOWN_SPEC_SOURCES) {
      expect(body).toContain(source.name);
      expect(body).toContain(source.url);
    }
    expect(body).not.toContain('undefined');
  });
  it('answers an unknown skill with the ones that exist, not with a bare refusal', async () => {
    const result = await gateways().call('get_skill', { name: 'no-such-skill' }, caller);

    expect(result.isError).toBe(true);
    const text = result.content[0]?.text ?? '';
    expect(text).toContain('NOT_FOUND');
    expect(text).toContain('design-notebook');
  });

  it('refuses a call with no name, saying which argument is missing', async () => {
    const result = await gateways().call('get_skill', {}, caller);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('name');
  });
});

describe('the connector hands over the Markdown the author wrote (RN-AGT-015)', () => {
  it('never expands an embed: read_note returns the notation verbatim', async () => {
    const body = 'The rule in full:\n\n![[Lei 14.133#Article 75]]\n';
    const adapter = gateways({
      knowledge: {
        readNote: async () => ({
          noteId: 'n1',
          name: 'Direct contracting',
          content: body,
          revision: 'v3',
          updatedAt: '2026-03-20T10:00:00.000Z',
        }),
      },
    });

    const result = await adapter.call('read_note', { notebook: 'v1', note: 'n1' }, caller);
    const text = result.content[0]?.text ?? '';

    // The agent that wants the target reads the target. Expanding here would
    // hand it content it never asked for, and hide whose words those are.
    expect(text).toContain('![[Lei 14.133#Article 75]]');
  });
});

describe('writing guidance and template carries the revision (RN-AGT-016)', () => {
  it('refuses set_guidance with no baseRevision, and says what is missing', async () => {
    const result = await gateways().call(
      'set_guidance',
      { notebook: 'v1', content: '# New' },
      caller,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('baseRevision');
  });

  it('accepts an explicit null, which is what an empty slot asserts', async () => {
    const result = await gateways().call(
      'set_guidance',
      { notebook: 'v1', content: '# New', baseRevision: null },
      caller,
    );

    // Null is not the absence of the argument: it is a claim about the state,
    // and the server checks it like any other revision.
    expect(result.isError).toBe(false);
  });

  it('refuses set_template with no baseRevision', async () => {
    const result = await gateways().call(
      'set_template',
      { notebook: 'v1', folder: 'f1', content: '# T' },
      caller,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('baseRevision');
  });

  it('reads the guidance with the revision a write has to echo back', async () => {
    const result = await gateways({
      knowledge: {
        guidance: async () => ({ content: '# Proposito', revision: 'v7' }),
      },
    }).call('get_guidance', { notebook: 'v1' }, caller);

    expect(result.isError).toBe(false);
    expect(result.content[0]?.text).toContain('v7');
  });

  it('reads the template with the revision a write has to echo back', async () => {
    const result = await gateways().call('get_template', { notebook: 'v1', folder: 'f1' }, caller);

    // The same shape get_guidance answers: without the revision, replacing a
    // Template that exists had no path that succeeded.
    expect(result.isError).toBe(false);
    expect(JSON.parse(result.content[0]?.text ?? '')).toEqual({
      content: '# Modelo\n\n## Vigencia',
      revision: 'v5',
    });
  });

  it('answers the revision each write produced, so the next one needs no read', async () => {
    const guidance = await gateways().call(
      'set_guidance',
      { notebook: 'v1', content: '# New', baseRevision: null },
      caller,
    );
    const template = await gateways().call(
      'set_template',
      { notebook: 'v1', folder: 'f1', content: '# T', baseRevision: null },
      caller,
    );

    expect(JSON.parse(guidance.content[0]?.text ?? '')).toEqual({ revision: 'v2' });
    expect(JSON.parse(template.content[0]?.text ?? '')).toEqual({ revision: 'v6' });
  });

  it('says what to do when the notebook has no guidance yet', async () => {
    const result = await gateways({ knowledge: { guidance: async () => null } }).call(
      'get_guidance',
      { notebook: 'v1' },
      caller,
    );

    expect(result.content[0]?.text).toContain('baseRevision: null');
  });
});

/**
 * An agent connected to staging writes exactly as it would in production, and
 * nothing in a notebook tells the two apart, so the connector says it
 * (RN-AGT-026). In production it says nothing.
 */
describe('the connector declares where it runs, outside production', () => {
  const token: VerifiedAgentToken = {
    sub: 'user-1',
    clientId: 'proxy-client',
    subscriptionId: '01JBQ2X0000000000000000000',
    payload: {},
  };
  const staging = {
    environment: 'staging',
    version: '0.6.0-rc.12+a1b2c3d',
    commit: 'a1b2c3d',
  } as const;

  async function handshake(deployment?: typeof staging) {
    const response = await handleMcpRequest(
      { jsonrpc: '2.0', id: 1, method: 'initialize' },
      token,
      gateways(),
      '',
      deployment,
    );
    return (
      response as {
        result: { serverInfo: { version: string }; instructions?: string };
      }
    ).result;
  }

  it('announces the version it runs, and says that what is written there is disposable', async () => {
    const result = await handshake(staging);
    expect(result.serverInfo.version).toBe('0.6.0-rc.12+a1b2c3d');
    expect(result.instructions).toContain('staging');
    expect(result.instructions).toContain('0.6.0-rc.12+a1b2c3d');
    expect(result.instructions).toContain('disposable');
    // Before anything else the instructions say, the skills included.
    expect(result.instructions?.startsWith('This is the staging environment')).toBe(true);
  });

  it('opens whoami with the environment and the version', async () => {
    const adapter = new McpToolAdapter(
      {
        access: { connector: async () => null },
        knowledge: { listNotebooks: async () => [] },
        discovery: {},
        audit: {},
      } as never,
      staging,
    );
    const answer = (await adapter.call('whoami', {}, caller)).content[0]?.text ?? '';
    expect(answer.startsWith('## Where this is')).toBe(true);
    expect(answer).toContain('0.6.0-rc.12+a1b2c3d');
  });

  it('says none of it in production', async () => {
    const result = await handshake();
    // The instructions are sent in production too, for the skills, and never
    // with a word about the environment.
    expect(result.instructions).not.toContain('environment of MemorySmith');
    expect(result.instructions).not.toContain('disposable');
    const answer = (await gateways().call('whoami', {}, caller)).content[0]?.text ?? '';
    expect(answer).not.toContain('## Where this is');
  });
});

/**
 * The path an agent actually takes passes through the method of its task
 * (RN-AGT-028). A round of agents against staging measured why: the ones that
 * read the skill of their task wrote the notebook the method describes, and the
 * ones that went from list_notebooks to a write never saw a skill.
 */
describe('the path an agent takes passes through the method of its task', () => {
  const token: VerifiedAgentToken = {
    sub: 'user-1',
    clientId: 'proxy-client',
    subscriptionId: '01JBQ2X0000000000000000000',
    payload: {},
  };
  const staging: Deployment = {
    environment: 'staging',
    version: '0.6.0-rc.12+a1b2c3d',
    commit: 'a1b2c3d',
  };

  async function instructions(deployment?: Deployment): Promise<string> {
    const response = await handleMcpRequest(
      { jsonrpc: '2.0', id: 1, method: 'initialize' },
      token,
      gateways(),
      '',
      deployment,
    );
    return (response as { result: { instructions?: string } }).result.instructions ?? '';
  }

  const description = (name: string): string =>
    TOOL_CATALOG.find((tool) => tool.name === name)?.description ?? '';

  it('sends the agent to whoami and indexes every skill in the handshake, in any environment', async () => {
    for (const text of [await instructions(), await instructions(staging)]) {
      expect(text).toContain('`whoami` before any other tool');
      expect(text).toContain('get_skill');
      expect(text).toMatch(/BEFORE you start/);
      for (const skill of SKILLS) {
        expect(text).toContain(skill.name);
        expect(text).toContain(skill.task);
      }
    }
  });

  it('prints one index in the handshake and in whoami, so the two cannot disagree', async () => {
    const help = (await gateways().call('whoami', {}, caller)).content[0]?.text ?? '';
    const handshake = await instructions();
    for (const line of skillIndex()) {
      expect(help).toContain(line);
      expect(handshake).toContain(line);
    }
    // The heading agent-eval reads the index under.
    expect(help).toContain('## Skills');
  });

  it('no longer calls list_notebooks the place to start, and sends the agent to whoami', () => {
    expect(description('list_notebooks')).not.toContain('Start here');
    expect(description('list_notebooks')).toContain('Call whoami before it');
    expect(description('whoami')).toContain('before any other tool');
  });

  it('asks for the method, and for the person to confirm the structure, before a notebook is created', () => {
    const create = description('create_notebook');
    expect(create).toContain(`\`${DESIGN_NOTEBOOK_SKILL}\``);
    expect(create).toContain('confirm with the person the structure you propose');
    expect(create).not.toContain('samples');
    expect(create.indexOf('BEFORE calling it')).toBeLessThan(create.indexOf('set_guidance'));
  });

  it('cites no skill the registry does not have', async () => {
    const empty = gateways({ knowledge: { listNotebooks: async () => [] } });
    const served = [
      ...TOOL_CATALOG.map((tool) => tool.description),
      (await empty.call('whoami', {}, caller)).content[0]?.text ?? '',
      (await empty.call('list_notebooks', {}, caller)).content[0]?.text ?? '',
      await instructions(),
    ].join('\n');
    // A skill is the one thing served in backticks with a hyphen in its name.
    const cited = [...served.matchAll(/`([a-z0-9]+(?:-[a-z0-9]+)+)`/g)].map((match) => match[1]);

    expect(cited.length).toBeGreaterThan(0);
    for (const name of cited) expect(skillNamed(name ?? '')).toBeDefined();
  });

  it('tells an account with no notebook that the connector can create one', async () => {
    const empty = gateways({ knowledge: { listNotebooks: async () => [] } });
    for (const tool of ['whoami', 'list_notebooks']) {
      const answer = (await empty.call(tool, {}, caller)).content[0]?.text ?? '';
      expect(answer).toContain('create_notebook');
      expect(answer).toContain(DESIGN_NOTEBOOK_SKILL);
      expect(answer).toContain('EDITOR');
      expect(answer).not.toMatch(/ask the owner/i);
      expect(answer).not.toContain('Nothing below will return content');
      expect(answer).not.toContain('samples');
      expect(answer).toContain('the structure you propose');
    }
  });

  it('asks for the person before a guidance that exists is replaced', () => {
    expect(description('set_guidance')).toContain('confirm with the person before replacing it');
  });

  it('says a template opens with the block that carries name:', () => {
    const template = description('set_template');
    expect(template).toContain('`name:`');
    expect(template).toContain('`---`');
    expect(template).toContain('headings from `#`');
  });

  it('answers a write that leaves a note with no name with a notice beside the null', async () => {
    const unnamed = {
      noteId: 'n2',
      name: null,
      content: 'name: Nova\n\nNo block opens this note.',
      revision: 'v1',
      updatedAt: '2026-03-21T10:00:00.000Z',
    };
    const adapter = gateways({
      knowledge: { createNote: async () => unnamed, updateNote: async () => unnamed },
    });

    const answers = [
      await adapter.call(
        'create_note',
        { notebook: 'v1', folder: 'f1', content: unnamed.content },
        caller,
      ),
      await adapter.call(
        'update_note',
        { notebook: 'v1', note: 'n2', content: unnamed.content, baseRevision: 'v0' },
        caller,
      ),
    ];

    for (const answer of answers) {
      expect(answer.isError).toBe(false);
      // One JSON document, which a client reading the answer as JSON still parses.
      expect(answer.content).toHaveLength(1);
      const parsed = JSON.parse(answer.content[0]?.text ?? '') as Record<string, unknown>;
      expect(Object.keys(parsed)[0]).toBe('notice');
      expect(parsed['notice']).toBe(UNNAMED_NOTE_NOTICE);
      expect(parsed['name']).toBeNull();
      expect(parsed['revision']).toBe('v1');
    }
  });

  it('says nothing more about a note that has a name', async () => {
    const answer = await gateways().call(
      'create_note',
      { notebook: 'v1', folder: 'f1', content: '---\nname: Nova\n---' },
      caller,
    );
    expect(JSON.parse(answer.content[0]?.text ?? '')).not.toHaveProperty('notice');
  });
});

describe('the connector orders what it writes (RN-AGT-029)', () => {
  it('passes the anchor of a creation, and none when there is none', async () => {
    const seen: Array<Record<string, unknown>> = [];
    const record =
      (answer: unknown) =>
      async (_caller: unknown, input: Record<string, unknown>): Promise<unknown> => {
        seen.push(input);
        return answer;
      };
    const adapter = gateways({
      knowledge: {
        createFolder: record({
          folderId: 'f3',
          parentFolderId: null,
          name: 'Glossário',
          slug: 'glossario',
          description: 'Termos.',
          position: 'a0V',
        }),
        createNote: record({
          noteId: 'n2',
          name: 'Nova',
          content: '---\nname: Nova\n---',
          revision: 'v1',
          updatedAt: '2026-03-21T10:00:00.000Z',
        }),
      },
    });

    await adapter.call(
      'create_folder',
      { notebook: 'v1', name: 'Glossário', description: 'Termos.', after: 'f1' },
      caller,
    );
    await adapter.call(
      'create_folder',
      { notebook: 'v1', name: 'Fontes', description: 'De onde vem.' },
      caller,
    );
    await adapter.call(
      'create_note',
      { notebook: 'v1', folder: 'f1', content: '---\nname: Nova\n---', after: 'n1' },
      caller,
    );

    expect(seen[0]).toMatchObject({ afterFolderId: 'f1' });
    expect(seen[1]).not.toHaveProperty('afterFolderId');
    expect(seen[2]).toMatchObject({ afterNoteId: 'n1' });
  });

  it('asks a reorder where the item goes, and reads null as first', async () => {
    const seen: Array<Record<string, unknown>> = [];
    const record = async (_caller: unknown, input: Record<string, unknown>) => {
      seen.push(input);
      return [];
    };
    const adapter = gateways({ knowledge: { reorderFolder: record, reorderNote: record } });

    const missing = await adapter.call('reorder_folder', { notebook: 'v1', folder: 'f2' }, caller);
    await adapter.call('reorder_folder', { notebook: 'v1', folder: 'f2', after: null }, caller);
    await adapter.call('reorder_note', { notebook: 'v1', note: 'n2', after: 'n1' }, caller);

    // A missing anchor is a mistake worth an error, never a default.
    expect(missing.isError).toBe(true);
    expect(missing.content[0]?.text).toContain('"after"');
    expect(seen).toEqual([
      { notebookId: 'v1', folderId: 'f2', afterFolderId: null },
      { notebookId: 'v1', noteId: 'n2', afterNoteId: 'n1' },
    ]);
  });

  it('answers the siblings in their new order', async () => {
    const folders = await gateways().call(
      'reorder_folder',
      { notebook: 'v1', folder: 'f2', after: null },
      caller,
    );
    const notes = await gateways().call(
      'reorder_note',
      { notebook: 'v1', note: 'n2', after: null },
      caller,
    );

    const ids = (answer: { content: Array<{ text: string }> }, key: string) =>
      (JSON.parse(answer.content[0]?.text ?? '') as Array<Record<string, string>>).map(
        (each) => each[key],
      );
    expect(ids(folders, 'folderId')).toEqual(['f2', 'f1']);
    expect(ids(notes, 'noteId')).toEqual(['n2', 'n1']);
  });

  it('issues the next number of a folder as a write that is not idempotent', async () => {
    // RN-AGT-036: a second call issues another number, so a retry is not free.
    const tool = TOOL_CATALOG.find((each) => each.name === 'next_number');
    expect(tool?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    });
    const answer = await gateways().call('next_number', { notebook: 'v1', folder: 'f1' }, caller);
    expect(JSON.parse(answer.content[0]?.text ?? '')).toEqual({ folder: 'f1', number: 42 });
  });

  it('declares both reorders as writes that destroy nothing', () => {
    for (const name of ['reorder_folder', 'reorder_note']) {
      const tool = TOOL_CATALOG.find((each) => each.name === name);
      expect(tool?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false });
    }
  });
});
