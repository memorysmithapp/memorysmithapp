import { describe, expect, it } from 'vitest';
import { READING_PATH, TOOL_CATALOG, catalogIsWellFormed } from '../src/mcp/catalog.js';
import { McpToolAdapter } from '../src/mcp/tools.js';
import { GatewayError, type AgentCaller } from '../src/mcp/gateway.js';
import { handleMcpRequest } from '../src/mcp.js';
import type { VerifiedAgentToken } from '../src/auth.js';

const caller: AgentCaller = {
  userId: 'user-1',
  clientId: 'https://claude.ai/mcp',
  clientName: 'Claude',
  subscriptionId: '01JBQ2X0000000000000000000',
};

function gateways(overrides: Record<string, unknown> = {}) {
  const knowledge = {
    listVaults: async () => [
      { vaultId: 'v1', name: 'Normas', description: 'Texto normativo', noteCount: 48 },
    ],
    vaultContext: async () => '# Vault: Normas\n\n## Structure\n1. **Normas**: (48 notes)\n',
    template: async () => ({ content: '# Modelo\n\n## Vigencia', folderName: 'Normas' }),
    listNotes: async () => [
      { noteId: 'n1', title: 'Lei 14.133', slug: 'lei-14133', folderId: 'f1', position: 'a0' },
    ],
    readNote: async () => ({
      noteId: 'n1',
      title: 'Lei 14.133',
      content: '# Lei 14.133',
      revision: 'v3',
      updatedAt: '2026-03-20T10:00:00.000Z',
    }),
    createNote: async () => ({
      noteId: 'n2',
      title: 'Nova',
      content: '# Nova',
      revision: 'v1',
      updatedAt: '2026-03-21T10:00:00.000Z',
    }),
    updateNote: async () => ({
      noteId: 'n1',
      title: 'Lei 14.133',
      content: '# Atualizada',
      revision: 'v4',
      updatedAt: '2026-03-22T10:00:00.000Z',
    }),
    searchNotes: async () => [
      { noteId: 'n1', title: 'Lei 14.133', section: null, excerpt: 'Lei 14.133', score: 1 },
    ],
    ...((overrides['knowledge'] as object) ?? {}),
  };
  const discovery = {
    semanticSearch: async () => [
      {
        noteId: 'n1',
        title: 'Lei 14.133',
        section: 'Vigencia',
        excerpt: 'Vigente desde 2021',
        score: 0.82,
      },
    ],
    relatedNotes: async () => ({
      noteId: 'n1',
      title: 'Achado 12',
      depth: 0,
      children: [{ noteId: 'n2', title: 'Lei 14.133', depth: 1, children: [] }],
    }),
    backlinks: async () => [
      { noteId: 'n3', title: 'Achado 12', slug: 'achado-12', folderId: 'f2', position: 'a0' },
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
        revision: 'v3',
      },
    ],
    revisionAt: async () => ({
      noteId: 'n1',
      title: '',
      content: '# Como estava em marco',
      revision: 'v2',
      updatedAt: '2026-03-10T10:00:00.000Z',
    }),
    ...((overrides['audit'] as object) ?? {}),
  };
  return new McpToolAdapter({ knowledge, discovery, audit } as never);
}

describe('The tool catalog is the public contract', () => {
  it('publishes the thirteen tools of the product', () => {
    expect(TOOL_CATALOG.map((tool) => tool.name)).toEqual([
      'whoami',
      'list_vaults',
      'get_vault_context',
      'get_template',
      'list_notes',
      'read_note',
      'create_note',
      'update_note',
      'search_notes',
      'semantic_search',
      'related_notes',
      'backlinks',
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
    expect(writers.map((tool) => tool.name)).toEqual(['create_note', 'update_note']);
    for (const tool of TOOL_CATALOG) {
      const readable = tool.annotations.readOnlyHint === true;
      const writable = tool.annotations.readOnlyHint === false;
      expect(readable !== writable).toBe(true);
    }
  });

  it('declares create_note as idempotent and update_note as destructive', () => {
    const create = TOOL_CATALOG.find((tool) => tool.name === 'create_note');
    const update = TOOL_CATALOG.find((tool) => tool.name === 'update_note');
    expect(create?.annotations.idempotentHint).toBe(true);
    expect(create?.annotations.destructiveHint).toBe(false);
    expect(update?.annotations.destructiveHint).toBe(true);
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
    expect(answer).toContain('Claude');
    expect(answer).toContain(caller.subscriptionId);
  });

  it('falls back to the identifier when the token carries no e-mail', async () => {
    const result = await gateways().call('whoami', {}, caller);
    expect(result.content[0]?.text ?? '').toContain('user-1');
  });

  it('lists the vaults actually within reach, not a description of them', async () => {
    const result = await gateways().call('whoami', {}, caller);
    const answer = result.content[0]?.text ?? '';
    expect(answer).toContain('Normas');
    expect(answer).toContain('48 note(s)');
  });

  it('says plainly when there is no vault yet', async () => {
    const empty = gateways({ knowledge: { listVaults: async () => [] } });
    const result = await empty.call('whoami', {}, caller);
    expect(result.content[0]?.text ?? '').toContain('No vault yet');
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

describe('The tool adapter translates in both directions', () => {
  it('returns the vault context as Markdown, not as JSON', async () => {
    const result = await gateways().call('get_vault_context', { vault: 'v1' }, caller);
    expect(result.isError).toBe(false);
    expect(result.content[0]?.text).toContain('# Vault: Normas');
    expect(result.content[0]?.text).toContain('## Structure');
  });

  it('answers a missing argument with the schema of the tool', async () => {
    // RN-AGT-003: the error carries what the next attempt needs.
    const result = await gateways().call('create_note', { vault: 'v1' }, caller);
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('create_note requires the argument "folder"');
    expect(result.content[0]?.text).toContain('title');
  });

  it('passes ALREADY_EXISTS through with the identifier of the existing note', async () => {
    const adapter = gateways({
      knowledge: {
        createNote: async () => {
          throw new GatewayError('CONFLICT', 'A note with this slug already exists', {
            code: 'ALREADY_EXISTS',
            noteId: 'n1',
          });
        },
      },
    });
    const result = await adapter.call(
      'create_note',
      { vault: 'v1', folder: 'f1', title: 'Lei 14.133', content: '# Lei' },
      caller,
    );
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('ALREADY_EXISTS');
    expect(result.content[0]?.text).toContain('n1');
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
      { vault: 'v1', note: 'n1', content: '# Nova', baseRevision: 'v3' },
      caller,
    );
    expect(result.content[0]?.text).toContain('Conteudo atual');
  });

  it('reads a past revision through the audit trail when asOf is given', async () => {
    const result = await gateways().call(
      'read_note',
      { vault: 'v1', note: 'n1', asOf: '2026-03-15T00:00:00.000Z' },
      caller,
    );
    expect(result.content[0]?.text).toContain('Como estava em marco');
  });

  it('renders the dependency tree as an indented outline', async () => {
    const result = await gateways().call('related_notes', { vault: 'v1', note: 'n1' }, caller);
    expect(result.content[0]?.text).toBe('- Achado 12 (n1)\n  - Lei 14.133 (n2)');
  });

  it('says something useful when the connector reaches no vault', async () => {
    const adapter = gateways({ knowledge: { listVaults: async () => [] } });
    const result = await adapter.call('list_vaults', {}, caller);
    expect(result.isError).toBe(false);
    expect(result.content[0]?.text).toContain('reaches no vault yet');
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
    expect(tools).toHaveLength(13);
  });

  it('refuses a tool call from a token with no subscription', async () => {
    const unbound: VerifiedAgentToken = { sub: 'user-1', clientId: 'x', payload: {} };
    const response = await handleMcpRequest(
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'list_vaults' } },
      unbound,
      gateways(),
    );
    const result = (response as { result: { isError: boolean; content: Array<{ text: string }> } })
      .result;
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('not bound to a subscription');
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
