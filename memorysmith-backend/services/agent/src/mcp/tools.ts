/**
 * McpToolAdapter: the anticorruption layer of the Agent Access context
 * (architecture-guide.md, section 13.1).
 *
 * It translates a tool call into a use case command and back, and it resolves
 * the Authorship from the token. No MCP vocabulary crosses into the core
 * (RN-AGT-008), and no core vocabulary leaks out untranslated.
 *
 * Errors are answered as `isError` with ACTIONABLE text, and a missing
 * argument comes back with the template of the folder when that is what the
 * caller needs to try again (RN-AGT-003).
 */

import { TOOL_CATALOG } from './catalog.js';
import { whoAmI } from './whoami.js';
import {
  GatewayError,
  type AgentCaller,
  type AuditGateway,
  type DiscoveryGateway,
  type KnowledgeGateway,
  type RelatedNode,
} from './gateway.js';

export interface ToolResult {
  readonly content: Array<{ type: 'text'; text: string }>;
  readonly isError: boolean;
}

export interface Gateways {
  readonly knowledge: KnowledgeGateway;
  readonly discovery: DiscoveryGateway;
  readonly audit: AuditGateway;
}

function text(value: string, isError = false): ToolResult {
  return { content: [{ type: 'text', text: value }], isError };
}

function json(value: unknown): ToolResult {
  return text(JSON.stringify(value, null, 2));
}

function requireString(args: Record<string, unknown>, name: string, tool: string): string {
  const value = args[name];
  if (typeof value !== 'string' || value.length === 0) {
    const definition = TOOL_CATALOG.find((each) => each.name === tool);
    throw new GatewayError('VALIDATION', `${tool} requires the argument "${name}".`, {
      expected: definition?.inputSchema,
    });
  }
  return value;
}

function renderRelated(node: RelatedNode, indent = 0): string {
  const line = `${'  '.repeat(indent)}- ${node.title} (${node.noteId})`;
  return [line, ...node.children.map((child) => renderRelated(child, indent + 1))].join('\n');
}

export class McpToolAdapter {
  constructor(private readonly gateways: Gateways) {}

  async call(
    name: string,
    args: Record<string, unknown>,
    caller: AgentCaller,
  ): Promise<ToolResult> {
    try {
      return await this.dispatch(name, args, caller);
    } catch (error) {
      if (error instanceof GatewayError) {
        // Actionable text, plus whatever the caller needs for the next attempt.
        const details = error.details ? `\n\n${JSON.stringify(error.details, null, 2)}` : '';
        return text(`${error.code}: ${error.message}${details}`, true);
      }
      throw error;
    }
  }

  private async dispatch(
    name: string,
    args: Record<string, unknown>,
    caller: AgentCaller,
  ): Promise<ToolResult> {
    const { knowledge, discovery, audit } = this.gateways;

    switch (name) {
      case 'whoami': {
        // The reach is read, not described: a list of vaults the caller cannot
        // actually open would be a help that lies on its first step.
        const vaults = await knowledge.listVaults(caller);
        return text(whoAmI(caller, vaults));
      }

      case 'list_vaults': {
        const vaults = await knowledge.listVaults(caller);
        if (vaults.length === 0) {
          return text(
            'This connector reaches no vault yet. Ask the owner of the subscription to create ' +
              'one and write its guidance before you try to read or write anything.',
          );
        }
        return json(vaults);
      }

      case 'get_vault_context':
        // Markdown, not JSON: this document IS the product, and it is meant to
        // be read (software-vision.md, section 9.2).
        return text(
          await knowledge.vaultContext(caller, requireString(args, 'vault', 'get_vault_context')),
        );

      case 'get_template': {
        const template = await knowledge.template(
          caller,
          requireString(args, 'vault', 'get_template'),
          requireString(args, 'folder', 'get_template'),
        );
        return template
          ? text(template.content)
          : text('This folder carries no template. Follow the guidance of the vault instead.');
      }

      case 'list_notes': {
        const folder = typeof args['folder'] === 'string' ? args['folder'] : undefined;
        return json(
          await knowledge.listNotes(caller, requireString(args, 'vault', 'list_notes'), folder),
        );
      }

      case 'read_note': {
        const vault = requireString(args, 'vault', 'read_note');
        const note = requireString(args, 'note', 'read_note');
        const asOf = typeof args['asOf'] === 'string' ? args['asOf'] : null;
        const read = asOf
          ? await audit.revisionAt(caller, { vaultId: vault, noteId: note, asOf })
          : await knowledge.readNote(caller, vault, note);
        return json(read);
      }

      case 'create_note': {
        const created = await knowledge.createNote(caller, {
          vaultId: requireString(args, 'vault', 'create_note'),
          folderId: requireString(args, 'folder', 'create_note'),
          title: requireString(args, 'title', 'create_note'),
          content: requireString(args, 'content', 'create_note'),
        });
        return json(created);
      }

      case 'update_note': {
        const updated = await knowledge.updateNote(caller, {
          vaultId: requireString(args, 'vault', 'update_note'),
          noteId: requireString(args, 'note', 'update_note'),
          content: requireString(args, 'content', 'update_note'),
          baseRevision: requireString(args, 'baseRevision', 'update_note'),
        });
        return json(updated);
      }

      case 'search_notes':
        return json(
          await knowledge.searchNotes(
            caller,
            requireString(args, 'vault', 'search_notes'),
            requireString(args, 'query', 'search_notes'),
          ),
        );

      case 'semantic_search':
        return json(
          await discovery.semanticSearch(caller, {
            vaultId: requireString(args, 'vault', 'semantic_search'),
            query: requireString(args, 'query', 'semantic_search'),
            ...(typeof args['k'] === 'number' ? { k: args['k'] } : {}),
            ...(typeof args['folder'] === 'string' ? { folderId: args['folder'] } : {}),
          }),
        );

      case 'related_notes': {
        const tree = await discovery.relatedNotes(caller, {
          vaultId: requireString(args, 'vault', 'related_notes'),
          noteId: requireString(args, 'note', 'related_notes'),
          ...(typeof args['depth'] === 'number' ? { depth: args['depth'] } : {}),
        });
        return text(renderRelated(tree));
      }

      case 'backlinks':
        return json(
          await discovery.backlinks(
            caller,
            requireString(args, 'vault', 'backlinks'),
            requireString(args, 'note', 'backlinks'),
          ),
        );

      case 'note_history':
        return json(
          await audit.noteHistory(
            caller,
            requireString(args, 'vault', 'note_history'),
            requireString(args, 'note', 'note_history'),
          ),
        );

      default:
        return text(`Unknown tool: ${name}`, true);
    }
  }
}
