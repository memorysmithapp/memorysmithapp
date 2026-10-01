import { describe, expect, it } from 'vitest';
import {
  CATALOG_VERSION,
  READING_PATH,
  TOOL_CATALOG,
  catalogIsWellFormed,
  toolSignature,
} from '../src/mcp/catalog.js';
import { clientKind } from '../src/mcp/refresh.js';
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
      {
        notebookId: '01JBQ2X00000000000000000V1',
        name: 'Normas',
        description: 'Texto normativo',
        noteCount: 48,
        ownership: 'own',
      },
    ],
    notebookContext: async () => '# Notebook: Normas\n\n## Structure\n1. **Normas**: (48 notes)\n',
    template: async () => ({
      content: '# Modelo\n\n## Vigencia',
      folderName: 'Normas',
      revision: 'v5',
    }),
    listNotes: async () => [
      {
        noteId: '01JBQ2X00000000000000000N1',
        name: 'Lei 14.133',
        slug: 'lei-14133',
        folderId: '01JBQ2X00000000000000000F1',
        position: 'a0',
      },
    ],
    nextNumber: async () => 42,
    readNote: async () => ({
      noteId: '01JBQ2X00000000000000000N1',
      name: 'Lei 14.133',
      content: '# Lei 14.133',
      revision: 'v3',
      updatedAt: '2026-03-20T10:00:00.000Z',
    }),
    createNote: async () => ({
      noteId: '01JBQ2X00000000000000000N2',
      name: 'Nova',
      content: '# Nova',
      revision: '01JBQ2X00000000000000000V1',
      updatedAt: '2026-03-21T10:00:00.000Z',
    }),
    updateNote: async () => ({
      noteId: '01JBQ2X00000000000000000N1',
      name: 'Lei 14.133',
      content: '# Atualizada',
      revision: 'v4',
      updatedAt: '2026-03-22T10:00:00.000Z',
    }),
    searchNotes: async () => [
      {
        noteId: '01JBQ2X00000000000000000N1',
        name: 'Lei 14.133',
        section: null,
        excerpt: 'Lei 14.133',
        score: 1,
      },
    ],
    createNotebook: async () => ({
      notebookId: '01JBQ2X00000000000000000V2',
      name: 'Achados',
      description: 'Achados de auditoria',
      noteCount: 0,
    }),
    deleteNotebook: async () => undefined,
    keptExportsOf: async () => 0,
    setGuidance: async () => '01JBQ2X00000000000000000V2',
    guidance: async () => ({ content: '# Proposito', revision: '01JBQ2X00000000000000000V1' }),
    createFolder: async () => ({
      folderId: '01JBQ2X00000000000000000F2',
      parentFolderId: null,
      name: 'Achados',
      slug: 'achados',
      description: 'Achados de auditoria.',
    }),
    deleteFolder: async () => ({ removedFolderIds: ['01JBQ2X00000000000000000F2'] }),
    setTemplate: async () => 'v6',
    deleteNote: async () => undefined,
    reorderFolder: async () => [
      {
        folderId: '01JBQ2X00000000000000000F2',
        parentFolderId: null,
        name: 'Achados',
        slug: 'achados',
        description: 'Achados de auditoria.',
        position: 'Zz',
      },
      {
        folderId: '01JBQ2X00000000000000000F1',
        parentFolderId: null,
        name: 'Normas',
        slug: 'normas',
        description: 'Texto normativo.',
        position: 'a0',
      },
    ],
    listFileUploads: async () => [],
    reorderNote: async () => [
      {
        noteId: '01JBQ2X00000000000000000N2',
        name: 'Nova',
        folderId: '01JBQ2X00000000000000000F1',
        position: 'Zz',
      },
      {
        noteId: '01JBQ2X00000000000000000N1',
        name: 'Lei 14.133',
        folderId: '01JBQ2X00000000000000000F1',
        position: 'a0',
      },
    ],
    ...((overrides['knowledge'] as object) ?? {}),
  };
  const discovery = {
    relatedNotes: async () => ({
      noteId: '01JBQ2X00000000000000000N1',
      name: 'Achado 12',
      folderId: '01JBQ2X00000000000000000F1',
      depth: 0,
      children: [
        {
          noteId: '01JBQ2X00000000000000000N2',
          name: 'Lei 14.133',
          folderId: '01JBQ2X00000000000000000F2',
          depth: 1,
          children: [],
        },
      ],
    }),
    backlinks: async () => [
      {
        noteId: 'n3',
        name: 'Achado 12',
        slug: 'achado-12',
        folderId: '01JBQ2X00000000000000000F2',
        position: 'a0',
      },
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
      noteId: '01JBQ2X00000000000000000N1',
      name: null,
      content: '# Como estava em marco',
      revision: '01JBQ2X00000000000000000V2',
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
      // A file kept whole, sent in parts (#240).
      'begin_file_upload',
      'send_file_part',
      'file_upload_status',
      'finish_file_upload',
      'list_file_uploads',
      // A file asked of the person, and an attempt thrown away (#253).
      'request_file',
      'discard_file_upload',
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
      'begin_file_upload',
      'send_file_part',
      'finish_file_upload',
      'request_file',
      'discard_file_upload',
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

describe('a notebook shared from another subscription', () => {
  const shared = {
    notebookId: '01JBQ2X00000000000000000S1',
    name: 'Pesquisa',
    description: 'O que outra assinatura aprendeu',
    noteCount: 7,
    ownership: 'shared',
    owner: 'dona@example.com',
    access: 'read',
  };
  const withShared = () =>
    gateways({
      knowledge: {
        listNotebooks: async () => [
          {
            notebookId: '01JBQ2X00000000000000000V1',
            name: 'Normas',
            description: 'Texto normativo',
            noteCount: 48,
            ownership: 'own',
          },
          shared,
        ],
        notebookContext: async () => '# Notebook: Pesquisa\n',
      },
    });

  it('is listed by whoami apart, with its owner and its access (RN-AGT-046)', async () => {
    const answer = (await withShared().call('whoami', {}, caller)).content[0]?.text ?? '';
    expect(answer).toContain('**Normas**');
    expect(answer).toContain('Shared with this person from another subscription');
    expect(answer).toContain('shared by dona@example.com, access `read`');
  });

  it('opens its context saying it is shared and read-only, before the guidance', async () => {
    const answer =
      (await withShared().call('get_notebook_context', { notebook: shared.notebookId }, caller))
        .content[0]?.text ?? '';
    expect(answer.startsWith('> **Shared with this person by dona@example.com')).toBe(true);
    expect(answer).toContain('every write here is refused');
    expect(answer).toContain('# Notebook: Pesquisa');
  });

  it('is named in the description of every tool that writes in a notebook', async () => {
    const { TOOL_CATALOG } = await import('../src/mcp/catalog.js');
    const writing = TOOL_CATALOG.filter(
      (tool) =>
        (tool.annotations.readOnlyHint === false || tool.annotations.destructiveHint === true) &&
        'notebook' in ((tool.inputSchema as { properties?: object }).properties ?? {}),
    );
    expect(writing.length).toBeGreaterThan(5);
    for (const tool of writing) expect(tool.description).toContain('shared with this person');
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
    for (const tool of TOOL_CATALOG) expect(answer).toContain(`\`${toolSignature(tool)}\``);
  });

  it('says the server does not validate content against guidance or template', async () => {
    // PP4: the backend never interprets a note. An agent that assumes it does
    // would trust a check that never runs.
    const result = await gateways().call('whoami', {}, caller);
    expect(result.content[0]?.text ?? '').toContain('does NOT validate');
  });
});

describe('an agent working from a stale list of tools is told so (#261, RN-AGT-047)', () => {
  const claude = {
    clientId: 'https://claude.ai/oauth/mcp-oauth-client-metadata',
    clientName: 'Claude',
  };
  const chatgpt = { clientId: 'https://chatgpt.com/oauth/client.json', clientName: 'ChatGPT' };

  it('lists every tool by its signature, under the version of the catalogue', async () => {
    const answer = (await gateways().call('whoami', {}, caller)).content[0]?.text ?? '';
    expect(answer).toContain('## Your list of tools');
    expect(answer).toContain(`\`${CATALOG_VERSION}\``);
    expect(answer).toContain('`update_note(notebook, note, content, baseRevision, message?)`');
    expect(CATALOG_VERSION).toMatch(/^[0-9a-f]{8}$/);
  });

  it('sends the agent to compare, and gives the step of its own client', async () => {
    const answer = (await gateways().call('whoami', {}, caller)).content[0]?.text ?? '';
    expect(answer).toContain('Compare it with the tools your client gave you');
    expect(answer).toContain('Atualizar lista de ferramentas');
    expect(answer).not.toContain('Atualizar ferramentas*');
  });

  it('gives the step of ChatGPT to ChatGPT, and both to a connector it does not know', async () => {
    const asChatgpt = gateways({ access: { connector: async () => chatgpt } });
    const answer = (await asChatgpt.call('whoami', {}, caller)).content[0]?.text ?? '';
    expect(answer).toContain('Plugins → MemorySmith.app');
    expect(answer).not.toContain('Atualizar lista de ferramentas');

    const unknown = gateways({ access: { connector: async () => null } });
    const both = (await unknown.call('whoami', {}, caller)).content[0]?.text ?? '';
    expect(both).toContain('Atualizar lista de ferramentas');
    expect(both).toContain('Atualizar ferramentas');
  });

  it('tells the client apart by its identifier, and then by its name', () => {
    expect(clientKind(claude)).toBe('claude');
    expect(clientKind(chatgpt)).toBe('chatgpt');
    expect(clientKind({ clientId: 'https://example.org/c', clientName: 'ChatGPT Desktop' })).toBe(
      'chatgpt',
    );
    expect(clientKind({ clientId: 'https://example.org/c', clientName: 'Cursor' })).toBe('other');
    expect(clientKind(null)).toBe('other');
  });

  it('answers a tool the catalogue does not have as a list that is older than the server', async () => {
    const result = await gateways().call('read_notes_v0', {}, caller);
    expect(result.isError).toBe(true);
    const answer = result.content[0]?.text ?? '';
    expect(answer).toContain('UNKNOWN_TOOL: there is no tool named "read_notes_v0"');
    expect(answer).toContain('is older than the server');
    expect(answer).toContain('Atualizar lista de ferramentas');
  });

  it('refuses an argument the tool does not take, doing nothing, with its signature', async () => {
    let written = false;
    const adapter = gateways({
      knowledge: {
        createNote: async () => {
          written = true;
          return {};
        },
      },
    });
    const result = await adapter.call(
      'create_note',
      {
        notebook: '01JBQ2X00000000000000000V1',
        folder: '01JBQ2X00000000000000000F1',
        content: '---\nname: X\n---\n',
        path: 'decisions/x.md',
      },
      caller,
    );
    expect(written).toBe(false);
    expect(result.isError).toBe(true);
    const answer = result.content[0]?.text ?? '';
    expect(answer).toContain('create_note takes no argument "path"');
    expect(answer).toContain(
      `\`${toolSignature(TOOL_CATALOG.find((t) => t.name === 'create_note')!)}\``,
    );
    expect(answer).toContain('is older than the server');
  });

  it('gives both steps when the connector cannot be read, and still refuses', async () => {
    const adapter = gateways({
      access: {
        connector: async () => {
          throw new Error('Access is down');
        },
      },
    });
    const answer = (await adapter.call('gone_tool', {}, caller)).content[0]?.text ?? '';
    expect(answer).toContain('Atualizar lista de ferramentas');
    expect(answer).toContain('Atualizar ferramentas');
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
          return {
            notebookId: '01JBQ2X00000000000000000V2',
            name: input.name,
            description: '',
            noteCount: 0,
          };
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
            folderId: '01JBQ2X00000000000000000F9',
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
      { notebook: '01JBQ2X00000000000000000V2', content: '# Proposito', baseRevision: null },
      caller,
    );
    await adapter.call(
      'create_folder',
      {
        notebook: '01JBQ2X00000000000000000V2',
        name: '2026',
        description: 'Deste exercicio.',
        parent: '01JBQ2X00000000000000000F1',
      },
      caller,
    );
    await adapter.call(
      'set_template',
      {
        notebook: '01JBQ2X00000000000000000V2',
        folder: '01JBQ2X00000000000000000F9',
        content: '# {{t}}',
        baseRevision: null,
      },
      caller,
    );

    expect(calls).toEqual([
      'createNotebook:Achados',
      'setGuidance:01JBQ2X00000000000000000V2:# Proposito',
      'createFolder:2026:01JBQ2X00000000000000000F1',
      'setTemplate:01JBQ2X00000000000000000F9',
    ]);
  });

  it('deletes a note, a folder and a notebook, each through its own tool', async () => {
    const { calls, adapter } = spy();
    await adapter.call(
      'delete_note',
      { notebook: '01JBQ2X00000000000000000V1', note: '01JBQ2X00000000000000000N1' },
      caller,
    );
    await adapter.call(
      'delete_folder',
      {
        notebook: '01JBQ2X00000000000000000V1',
        folder: '01JBQ2X00000000000000000F2',
        policy: 'CASCADE',
      },
      caller,
    );
    await adapter.call('delete_notebook', { notebook: '01JBQ2X00000000000000000V1' }, caller);

    expect(calls).toEqual([
      'deleteNote:01JBQ2X00000000000000000V1:01JBQ2X00000000000000000N1',
      'deleteFolder:01JBQ2X00000000000000000F2:CASCADE',
      'deleteNotebook:01JBQ2X00000000000000000V1',
    ]);
  });

  it('refuses to remove a folder without an explicit policy', async () => {
    // RN-KNW-007: there is no implicit default, so the tool asks rather than
    // guessing between refusing and cascading over a subtree.
    const result = await gateways().call(
      'delete_folder',
      { notebook: '01JBQ2X00000000000000000V1', folder: '01JBQ2X00000000000000000F2' },
      caller,
    );
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('delete_folder requires the argument "policy"');
  });

  it('says plainly that a deletion is definitive', async () => {
    // Deleting is definitive and there is no trash (RN-KNW-029, RN-KNW-033).
    // What the answer says is what an agent repeats to the person, so it says
    // what went and that nothing brings it back.
    const { adapter } = spy();
    const note = await adapter.call(
      'delete_note',
      { notebook: '01JBQ2X00000000000000000V1', note: '01JBQ2X00000000000000000N1' },
      caller,
    );
    const notebook = await adapter.call(
      'delete_notebook',
      { notebook: '01JBQ2X00000000000000000V1' },
      caller,
    );
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
      {
        notebook: '01JBQ2X00000000000000000V1',
        folder: '01JBQ2X00000000000000000F1',
        content: 'A body the gateway refuses.',
      },
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
    const result = await gateways().call(
      'get_notebook_context',
      { notebook: '01JBQ2X00000000000000000V1' },
      caller,
    );
    expect(result.isError).toBe(false);
    expect(result.content[0]?.text).toContain('# Notebook: Normas');
    expect(result.content[0]?.text).toContain('## Structure');
  });

  it('answers a missing argument with the schema of the tool', async () => {
    // RN-AGT-003: the error carries what the next attempt needs.
    const result = await gateways().call(
      'create_note',
      { notebook: '01JBQ2X00000000000000000V1' },
      caller,
    );
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
      {
        notebook: '01JBQ2X00000000000000000V1',
        note: '01JBQ2X00000000000000000N1',
        content: '# Nova',
        baseRevision: 'v3',
      },
      caller,
    );
    expect(result.content[0]?.text).toContain('Conteudo atual');
  });

  it('reads a past revision through the audit trail when asOf is given', async () => {
    const result = await gateways().call(
      'read_note',
      {
        notebook: '01JBQ2X00000000000000000V1',
        note: '01JBQ2X00000000000000000N1',
        asOf: '2026-03-15T00:00:00.000Z',
      },
      caller,
    );
    expect(result.content[0]?.text).toContain('Como estava em marco');
  });

  it('renders the dependency tree as an indented outline', async () => {
    const result = await gateways().call(
      'related_notes',
      { notebook: '01JBQ2X00000000000000000V1', note: '01JBQ2X00000000000000000N1' },
      caller,
    );
    // The folder tells apart two notes of one name (#128).
    expect(result.content[0]?.text).toBe(
      '- Achado 12 (01JBQ2X00000000000000000N1, folder 01JBQ2X00000000000000000F1)\n  - Lei 14.133 (01JBQ2X00000000000000000N2, folder 01JBQ2X00000000000000000F2)',
    );
  });

  it('answers what a notebook left pending, and what looks broken in it (#217)', async () => {
    const answer = {
      pending: [
        {
          target: 'M42',
          from: [
            {
              noteId: '01JBQ2X00000000000000000N2',
              name: 'Session 1',
              folderId: '01JBQ2X00000000000000000F1',
            },
          ],
          likelyMeant: {
            name: 'M42 Orion Nebula',
            kind: 'note',
            noteId: '01JBQ2X00000000000000000N1',
          },
        },
      ],
      orphans: [],
      unshownFiles: [],
    };
    const adapter = gateways({ discovery: { checkNotebook: async () => answer } });
    const result = await adapter.call(
      'check_notebook',
      { notebook: '01JBQ2X00000000000000000V1' },
      caller,
    );
    expect(result.isError).toBe(false);
    expect(JSON.parse(result.content[0]?.text ?? '')).toEqual({
      pending: answer.pending.map((each) => ({ ...each, waitingFor: null })),
      orphans: [],
      unshownFiles: [],
      openUploads: [],
    });
  });

  it('says what is still on its way: a file asked of the person, an upload left open, a file shown nowhere (#253)', async () => {
    const note = {
      noteId: '01JBQ2X00000000000000000N2',
      name: 'Ata',
      folderId: '01JBQ2X00000000000000000F1',
    };
    const adapter = gateways({
      discovery: {
        checkNotebook: async () => ({
          pending: [
            { target: 'quadro.jpg', from: [note], likelyMeant: null },
            { target: 'foto.png', from: [note], likelyMeant: null },
            { target: 'Próxima reunião', from: [note], likelyMeant: null },
          ],
          orphans: [],
          unshownFiles: ['figura-original.jpg'],
        }),
      },
      knowledge: {
        listFileUploads: async () => [
          {
            transferId: '01JBQ2X00000000000000000R1',
            kind: 'request',
            status: 'running',
            notebookId: '01JBQ2X00000000000000000V1',
            notebookName: 'Atas',
            requestedAt: '2026-09-27T10:00:00.000Z',
            finishedAt: null,
            done: 0,
            total: 0,
            bytes: 0,
            failure: null,
            fileName: 'quadro.jpg',
            request: {
              mimeType: 'image/jpeg',
              description: '',
              purpose: 'O quadro da reunião',
              tags: [],
              path: '',
              platform: 'ChatGPT',
              expectedSize: null,
              expectedSha256: null,
            },
          },
          {
            transferId: '01JBQ2X00000000000000000P1',
            kind: 'agent',
            status: 'running',
            notebookId: '01JBQ2X00000000000000000V1',
            notebookName: 'Atas',
            requestedAt: '2026-09-27T10:00:00.000Z',
            finishedAt: null,
            done: 0,
            total: 1,
            bytes: 5000,
            failure: null,
            fileName: 'foto.png',
            upload: {
              mimeType: 'image/png',
              purpose: 'A foto',
              platform: 'Claude',
              transport: 'url',
              sha256: 'a'.repeat(64),
              partSize: 8388608,
              partCount: 1,
              received: [],
              lastPartAt: null,
            },
          },
        ],
      },
    });
    const result = await adapter.call(
      'check_notebook',
      { notebook: '01JBQ2X00000000000000000V1' },
      caller,
    );
    const answer = JSON.parse(result.content[0]?.text ?? '') as {
      pending: Array<{ target: string; waitingFor: string | null }>;
      unshownFiles: string[];
      openUploads: Array<{ kind: string; name: string; openedBy: string | null }>;
    };
    expect(answer.pending.map((each) => [each.target, each.waitingFor])).toEqual([
      ['quadro.jpg', 'person'],
      ['foto.png', 'upload'],
      ['Próxima reunião', null],
    ]);
    expect(answer.unshownFiles).toEqual(['figura-original.jpg']);
    expect(answer.openUploads.map((each) => [each.kind, each.name, each.openedBy])).toEqual([
      ['request', 'quadro.jpg', 'ChatGPT'],
      ['upload', 'foto.png', 'Claude'],
    ]);
  });

  it('asks the person for a file, from nothing or from an upload it could not finish (#253)', async () => {
    const asked: unknown[] = [];
    const adapter = gateways({
      knowledge: {
        requestFile: async (_caller: unknown, input: unknown) => {
          asked.push(input);
          return {
            transferId: '01JBQ2X00000000000000000R1',
            kind: 'request',
            notebookId: '01JBQ2X00000000000000000V1',
            fileName: 'quadro.jpg',
          };
        },
      },
    });
    const fromNothing = await adapter.call(
      'request_file',
      {
        notebook: '01JBQ2X00000000000000000V1',
        name: 'quadro.jpg',
        mimeType: 'image/jpeg',
        purpose: 'O quadro da reunião',
        size: 1935884,
      },
      caller,
    );
    expect(JSON.parse(fromNothing.content[0]?.text ?? '')).toMatchObject({
      request: '01JBQ2X00000000000000000R1',
      reference: '![[quadro.jpg]]',
    });
    await adapter.call('request_file', { upload: '01jbq2x00000000000000000p1' }, caller);
    expect(asked).toEqual([
      {
        notebookId: '01JBQ2X00000000000000000V1',
        name: 'quadro.jpg',
        mimeType: 'image/jpeg',
        purpose: 'O quadro da reunião',
        size: 1935884,
      },
      { fromUpload: '01JBQ2X00000000000000000P1' },
    ]);
  });

  it('throws an upload away when asked to (#253)', async () => {
    const discarded: string[] = [];
    const adapter = gateways({
      knowledge: {
        discardFileUpload: async (_caller: unknown, upload: string) => {
          discarded.push(upload);
        },
      },
    });
    const result = await adapter.call(
      'discard_file_upload',
      { upload: '01JBQ2X00000000000000000P1' },
      caller,
    );
    expect(result.isError).toBe(false);
    expect(discarded).toEqual(['01JBQ2X00000000000000000P1']);
  });

  it('reads an identifier in either case, and passes it on in its canonical form (#247)', async () => {
    const asked: string[] = [];
    const adapter = gateways({
      knowledge: {
        readNote: async (_caller: unknown, notebookId: string, noteId: string) => {
          asked.push(notebookId, noteId);
          return { noteId, name: 'Nota', content: '', revision: 'r1', updatedAt: '' };
        },
      },
      discovery: {
        checkNotebook: async (_caller: unknown, notebookId: string) => {
          asked.push(notebookId);
          return { pending: [], orphans: [] };
        },
        noteLinks: async () => [],
      },
    });
    const notebook = '01jbq2x00000000000000000v1';
    const note = '01jbq2x00000000000000000n1';
    await adapter.call('read_note', { notebook, note }, caller);
    await adapter.call('check_notebook', { notebook }, caller);
    expect(asked).toEqual([
      '01JBQ2X00000000000000000V1',
      '01JBQ2X00000000000000000N1',
      '01JBQ2X00000000000000000V1',
    ]);
  });

  it('refuses an argument that is not an identifier the same way in every tool (#248)', async () => {
    let reached = false;
    const adapter = gateways({
      discovery: {
        checkNotebook: async () => {
          reached = true;
          return { pending: [], orphans: [] };
        },
      },
    });
    for (const [tool, args] of [
      ['check_notebook', { notebook: 'abc' }],
      ['get_notebook_context', { notebook: 'abc' }],
      ['list_files', { notebook: 'abc' }],
      ['read_note', { notebook: '01JBQ2X00000000000000000V1', note: 'abc' }],
      ['file_upload_status', { upload: 'abc' }],
    ] as const) {
      const result = await adapter.call(tool, args, caller);
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toMatch(/^VALIDATION: .* is not an identifier: "abc"/);
    }
    expect(reached).toBe(false);
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

  async function initialize(
    params: Record<string, unknown> = {},
    deployment?: Deployment,
    siteOrigin?: string,
  ) {
    const response = await handleMcpRequest(
      { jsonrpc: '2.0', id: 1, method: 'initialize', params },
      token,
      gateways(),
      '',
      deployment,
      siteOrigin,
    );
    return (
      response as {
        result: {
          protocolVersion: string;
          serverInfo: {
            name: string;
            title: string;
            version: string;
            description: string;
            icons?: Array<{ src: string; mimeType: string; sizes: string[] }>;
            websiteUrl?: string;
          };
        };
      }
    ).result;
  }

  it('says who it is: a title, a description, PNG icons and the website of its site', async () => {
    const { serverInfo } = await initialize({}, undefined, 'https://memorysmith.app');
    expect(serverInfo.title).toBe('MemorySmith.app');
    expect(serverInfo.description).toBe(
      'Structured knowledge, natively readable and writable by humans and agents.',
    );
    expect(serverInfo.websiteUrl).toBe('https://memorysmith.app');
    // PNG is what a client that renders icons must accept, served by the site.
    expect(serverInfo.icons).toEqual([
      { src: 'https://memorysmith.app/symbol-48.png', mimeType: 'image/png', sizes: ['48x48'] },
      { src: 'https://memorysmith.app/symbol-192.png', mimeType: 'image/png', sizes: ['192x192'] },
    ]);
  });

  it('names the environment in the title outside production, and its icons come from its own site', async () => {
    const staging: Deployment = {
      environment: 'staging',
      version: '0.9.0-rc.1+a1b2c3d',
      commit: 'a1b2c3d',
    };
    const { serverInfo } = await initialize({}, staging, 'https://stg.memorysmith.app');
    expect(serverInfo.title).toBe('MemorySmith.app (staging)');
    expect(serverInfo.version).toBe('0.9.0-rc.1+a1b2c3d');
    expect(
      serverInfo.icons?.every((icon) => icon.src.startsWith('https://stg.memorysmith.app/')),
    ).toBe(true);
  });

  it('declares no icon and no website when it does not know its site', async () => {
    const { serverInfo } = await initialize();
    expect(serverInfo).not.toHaveProperty('icons');
    expect(serverInfo).not.toHaveProperty('websiteUrl');
  });

  it('answers in the revision a client asks for when it speaks it, and in the newest otherwise', async () => {
    expect((await initialize({ protocolVersion: '2025-11-25' })).protocolVersion).toBe(
      '2025-11-25',
    );
    // A client that still asks for the older revision is not told a newer one
    // it may disconnect from.
    expect((await initialize({ protocolVersion: '2025-06-18' })).protocolVersion).toBe(
      '2025-06-18',
    );
    expect((await initialize({ protocolVersion: '2024-11-05' })).protocolVersion).toBe(
      '2025-11-25',
    );
    expect((await initialize()).protocolVersion).toBe('2025-11-25');
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
    // And no interview. With material in the conversation the agent builds
    // from it and says so; without it, it proposes and the person confirms
    // (#252): Claude and ChatGPT read the old sentence in opposite ways.
    expect(body).not.toContain('samples');
    expect(body).toContain('build the notebook from it without\nasking first');
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

  it('says what nesting one form in another costs, and leaves the choice to the agent', () => {
    // #259: agents put tables in callouts and long code in cells. Both are
    // valid and both render; the skill helps decide, and forbids neither.
    const body = skillNamed('write-notes')?.body ?? '';
    expect(body).toContain('## Putting one form inside another');
    expect(body).toContain('A table inside a callout.');
    expect(body).toContain('the callout stating the rule in a sentence or two');
    expect(body).toContain('Code inside a table cell.');
    expect(body).toContain('the block goes after the table');
    expect(body).toContain('It is your call');
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
          noteId: '01JBQ2X00000000000000000N1',
          name: 'Direct contracting',
          content: body,
          revision: 'v3',
          updatedAt: '2026-03-20T10:00:00.000Z',
        }),
      },
    });

    const result = await adapter.call(
      'read_note',
      { notebook: '01JBQ2X00000000000000000V1', note: '01JBQ2X00000000000000000N1' },
      caller,
    );
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
      { notebook: '01JBQ2X00000000000000000V1', content: '# New' },
      caller,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('baseRevision');
  });

  it('accepts an explicit null, which is what an empty slot asserts', async () => {
    const result = await gateways().call(
      'set_guidance',
      { notebook: '01JBQ2X00000000000000000V1', content: '# New', baseRevision: null },
      caller,
    );

    // Null is not the absence of the argument: it is a claim about the state,
    // and the server checks it like any other revision.
    expect(result.isError).toBe(false);
  });

  it('refuses set_template with no baseRevision', async () => {
    const result = await gateways().call(
      'set_template',
      {
        notebook: '01JBQ2X00000000000000000V1',
        folder: '01JBQ2X00000000000000000F1',
        content: '# T',
      },
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
    }).call('get_guidance', { notebook: '01JBQ2X00000000000000000V1' }, caller);

    expect(result.isError).toBe(false);
    expect(result.content[0]?.text).toContain('v7');
  });

  it('reads the template with the revision a write has to echo back', async () => {
    const result = await gateways().call(
      'get_template',
      { notebook: '01JBQ2X00000000000000000V1', folder: '01JBQ2X00000000000000000F1' },
      caller,
    );

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
      { notebook: '01JBQ2X00000000000000000V1', content: '# New', baseRevision: null },
      caller,
    );
    const template = await gateways().call(
      'set_template',
      {
        notebook: '01JBQ2X00000000000000000V1',
        folder: '01JBQ2X00000000000000000F1',
        content: '# T',
        baseRevision: null,
      },
      caller,
    );

    expect(JSON.parse(guidance.content[0]?.text ?? '')).toEqual({
      revision: '01JBQ2X00000000000000000V2',
    });
    expect(JSON.parse(template.content[0]?.text ?? '')).toEqual({ revision: 'v6' });
  });

  it('says what to do when the notebook has no guidance yet', async () => {
    const result = await gateways({ knowledge: { guidance: async () => null } }).call(
      'get_guidance',
      { notebook: '01JBQ2X00000000000000000V1' },
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

  it('asks for the method before a notebook is created, and says when to confirm the structure (#252)', () => {
    const create = description('create_notebook');
    expect(create).toContain(`\`${DESIGN_NOTEBOOK_SKILL}\``);
    expect(create).toContain('Build it from the material the person brought');
    expect(create).toContain('propose a structure and confirm it first when there is none');
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
      expect(answer).toContain('build from what they brought');
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
      noteId: '01JBQ2X00000000000000000N2',
      name: null,
      content: 'name: Nova\n\nNo block opens this note.',
      revision: '01JBQ2X00000000000000000V1',
      updatedAt: '2026-03-21T10:00:00.000Z',
    };
    const adapter = gateways({
      knowledge: { createNote: async () => unnamed, updateNote: async () => unnamed },
    });

    const answers = [
      await adapter.call(
        'create_note',
        {
          notebook: '01JBQ2X00000000000000000V1',
          folder: '01JBQ2X00000000000000000F1',
          content: unnamed.content,
        },
        caller,
      ),
      await adapter.call(
        'update_note',
        {
          notebook: '01JBQ2X00000000000000000V1',
          note: '01JBQ2X00000000000000000N2',
          content: unnamed.content,
          baseRevision: 'v0',
        },
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
      expect(parsed['revision']).toBe('01JBQ2X00000000000000000V1');
    }
  });

  it('says nothing more about a note that has a name', async () => {
    const answer = await gateways().call(
      'create_note',
      {
        notebook: '01JBQ2X00000000000000000V1',
        folder: '01JBQ2X00000000000000000F1',
        content: '---\nname: Nova\n---',
      },
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
          noteId: '01JBQ2X00000000000000000N2',
          name: 'Nova',
          content: '---\nname: Nova\n---',
          revision: '01JBQ2X00000000000000000V1',
          updatedAt: '2026-03-21T10:00:00.000Z',
        }),
      },
    });

    await adapter.call(
      'create_folder',
      {
        notebook: '01JBQ2X00000000000000000V1',
        name: 'Glossário',
        description: 'Termos.',
        after: '01JBQ2X00000000000000000F1',
      },
      caller,
    );
    await adapter.call(
      'create_folder',
      { notebook: '01JBQ2X00000000000000000V1', name: 'Fontes', description: 'De onde vem.' },
      caller,
    );
    await adapter.call(
      'create_note',
      {
        notebook: '01JBQ2X00000000000000000V1',
        folder: '01JBQ2X00000000000000000F1',
        content: '---\nname: Nova\n---',
        after: '01JBQ2X00000000000000000N1',
      },
      caller,
    );

    expect(seen[0]).toMatchObject({ afterFolderId: '01JBQ2X00000000000000000F1' });
    expect(seen[1]).not.toHaveProperty('afterFolderId');
    expect(seen[2]).toMatchObject({ afterNoteId: '01JBQ2X00000000000000000N1' });
  });

  it('asks a reorder where the item goes, and reads null as first', async () => {
    const seen: Array<Record<string, unknown>> = [];
    const record = async (_caller: unknown, input: Record<string, unknown>) => {
      seen.push(input);
      return [];
    };
    const adapter = gateways({ knowledge: { reorderFolder: record, reorderNote: record } });

    const missing = await adapter.call(
      'reorder_folder',
      { notebook: '01JBQ2X00000000000000000V1', folder: '01JBQ2X00000000000000000F2' },
      caller,
    );
    await adapter.call(
      'reorder_folder',
      { notebook: '01JBQ2X00000000000000000V1', folder: '01JBQ2X00000000000000000F2', after: null },
      caller,
    );
    await adapter.call(
      'reorder_note',
      {
        notebook: '01JBQ2X00000000000000000V1',
        note: '01JBQ2X00000000000000000N2',
        after: '01JBQ2X00000000000000000N1',
      },
      caller,
    );

    // A missing anchor is a mistake worth an error, never a default.
    expect(missing.isError).toBe(true);
    expect(missing.content[0]?.text).toContain('"after"');
    expect(seen).toEqual([
      {
        notebookId: '01JBQ2X00000000000000000V1',
        folderId: '01JBQ2X00000000000000000F2',
        afterFolderId: null,
      },
      {
        notebookId: '01JBQ2X00000000000000000V1',
        noteId: '01JBQ2X00000000000000000N2',
        afterNoteId: '01JBQ2X00000000000000000N1',
      },
    ]);
  });

  it('answers the siblings in their new order', async () => {
    const folders = await gateways().call(
      'reorder_folder',
      { notebook: '01JBQ2X00000000000000000V1', folder: '01JBQ2X00000000000000000F2', after: null },
      caller,
    );
    const notes = await gateways().call(
      'reorder_note',
      { notebook: '01JBQ2X00000000000000000V1', note: '01JBQ2X00000000000000000N2', after: null },
      caller,
    );

    const ids = (answer: { content: Array<{ text: string }> }, key: string) =>
      (JSON.parse(answer.content[0]?.text ?? '') as Array<Record<string, string>>).map(
        (each) => each[key],
      );
    expect(ids(folders, 'folderId')).toEqual([
      '01JBQ2X00000000000000000F2',
      '01JBQ2X00000000000000000F1',
    ]);
    expect(ids(notes, 'noteId')).toEqual([
      '01JBQ2X00000000000000000N2',
      '01JBQ2X00000000000000000N1',
    ]);
  });

  it('issues the next number of a folder as a write that is not idempotent', async () => {
    // RN-AGT-036: a second call issues another number, so a retry is not free.
    const tool = TOOL_CATALOG.find((each) => each.name === 'next_number');
    expect(tool?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    });
    const answer = await gateways().call(
      'next_number',
      { notebook: '01JBQ2X00000000000000000V1', folder: '01JBQ2X00000000000000000F1' },
      caller,
    );
    expect(JSON.parse(answer.content[0]?.text ?? '')).toEqual({
      folder: '01JBQ2X00000000000000000F1',
      number: 42,
    });
  });

  it('declares both reorders as writes that destroy nothing', () => {
    for (const name of ['reorder_folder', 'reorder_note']) {
      const tool = TOOL_CATALOG.find((each) => each.name === name);
      expect(tool?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false });
    }
  });
});

describe('A file is kept whole, sent in parts (#240, RN-PRT-027, RN-AGT-041)', () => {
  const transfer = (upload: Record<string, unknown>) => ({
    transferId: '01JBQ2X0000000000000000VP1',
    kind: 'agent',
    status: 'running',
    notebookId: '01JBQ2X00000000000000000V1',
    notebookName: 'Atas',
    requestedAt: '2026-09-26T12:00:00.000Z',
    finishedAt: null,
    done: 0,
    total: 3,
    bytes: 20_000_000,
    failure: null,
    fileName: 'quadro.jpg',
    upload: {
      mimeType: 'image/jpeg',
      purpose: 'A foto do quadro, para a ata',
      platform: 'Claude',
      transport: 'url',
      sha256: 'a'.repeat(64),
      partSize: 8_388_608,
      partCount: 3,
      received: [],
      lastPartAt: null,
      ...upload,
    },
  });

  it('answers an address per part by URL, and what to do with them', async () => {
    let sent: Record<string, unknown> | null = null;
    const answer = await gateways({
      knowledge: {
        beginFileUpload: async (_caller: unknown, input: Record<string, unknown>) => {
          sent = input;
          return {
            transfer: transfer({}),
            missing: [1, 2, 3],
            targets: [1, 2, 3].map((part) => ({ part, url: `https://store/p${part}` })),
            expiresAt: '2026-09-26T13:00:00.000Z',
          };
        },
      },
    }).call(
      'begin_file_upload',
      {
        notebook: '01JBQ2X00000000000000000V1',
        name: 'quadro.jpg',
        mimeType: 'image/jpeg',
        size: 20_000_000,
        sha256: 'A'.repeat(64),
        purpose: 'A foto do quadro, para a ata',
        transport: 'url',
      },
      caller,
    );

    expect(answer.isError).toBe(false);
    // The hash travels as the API reads it, whatever case the agent typed.
    expect(sent).toMatchObject({
      notebookId: '01JBQ2X00000000000000000V1',
      sha256: 'a'.repeat(64),
      transport: 'url',
    });
    const body = JSON.parse(answer.content[0]?.text ?? '') as Record<string, unknown>;
    expect(body['targets']).toHaveLength(3);
    // The host the parts go to, which a client that allows hosts one by one
    // has to be told about (#241, #243).
    expect(body['partsHost']).toBe('store');
    expect(body['missing']).toEqual([1, 2, 3]);
    expect(String(body['next'])).toContain('PUT');
  });

  it('says which parts are still missing, and when to finish', async () => {
    const answer = await gateways({
      knowledge: {
        sendFilePart: async () => ({
          transfer: transfer({ transport: 'inline', received: [1] }),
          missing: [2, 3],
          targets: [],
          expiresAt: null,
        }),
      },
    }).call(
      'send_file_part',
      {
        upload: '01JBQ2X00000000000000000P1',
        part: 1,
        sha256: 'b'.repeat(64),
        contentBase64: 'AAAA',
      },
      caller,
    );
    const body = JSON.parse(answer.content[0]?.text ?? '') as Record<string, unknown>;
    expect(body['missing']).toEqual([2, 3]);
    expect(body['next']).toBe('Send the parts still missing: 2, 3.');
  });

  it('answers the reference to write once the file is kept', async () => {
    const answer = await gateways({
      knowledge: {
        finishFileUpload: async () => ({
          fileId: '01JBQ2X0000000000000000F01',
          notebookId: '01JBQ2X00000000000000000V1',
          name: 'quadro.jpg',
          bytes: 20_000_000,
        }),
      },
    }).call('finish_file_upload', { upload: '01JBQ2X00000000000000000P1' }, caller);
    expect(JSON.parse(answer.content[0]?.text ?? '')).toMatchObject({
      reference: '![[quadro.jpg]]',
    });
  });

  it('lists the open uploads with the hash an agent resumes one by', async () => {
    const answer = await gateways({
      knowledge: { listFileUploads: async () => [transfer({ received: [1, 2] })] },
    }).call('list_file_uploads', {}, caller);
    const body = JSON.parse(answer.content[0]?.text ?? '') as {
      uploads: Array<Record<string, unknown>>;
    };
    expect(body.uploads[0]).toMatchObject({
      upload: '01JBQ2X0000000000000000VP1',
      sha256: 'a'.repeat(64),
      received: [1, 2],
      purpose: 'A foto do quadro, para a ata',
    });
  });

  it('teaches the way in a skill the handshake lists, and keep_file points to it', () => {
    const skill = SKILLS.find((each) => each.name === 'keep-files');
    expect(skill?.body).toContain('begin_file_upload');
    expect(skill?.body).toContain('transport: "url"');
    const keep = TOOL_CATALOG.find((each) => each.name === 'keep_file');
    expect(keep?.description).toContain('begin_file_upload');
    expect(keep?.description).toContain('keep-files');
    // What was seen on 2026-09-26: a chat that recompresses the attachment,
    // and an agent that kept the small copy in silence (#243, RN-AGT-042).
    expect(keep?.description).toContain('tell them both sizes');
    expect(skill?.body).toContain('request_file');
    expect(skill?.body).toContain('Aguardando você');
    expect(skill?.body).not.toContain('Anexar arquivo');
    expect(skill?.body).toContain('host_not_allowed');
  });

  it('holds a kept file to the one the person sent by its bytes, and keeps its name (#246)', () => {
    const skill = SKILLS.find((each) => each.name === 'keep-files')?.body ?? '';
    // ChatGPT pointed a note at a thumbnail of 7,500 bytes kept earlier under
    // a similar name, and called a copy reduced to 2048 px the original.
    expect(skill).toContain('is the one the person sent only when its\nsize matches');
    expect(skill).toContain('the file you\nreceived');
    expect(skill).toContain('Keep a file under the name the person gave it');
    const list = TOOL_CATALOG.find((each) => each.name === 'list_files');
    expect(list?.description).toContain('only when its bytes match');
  });
});
