/**
 * McpToolAdapter: the anticorruption layer of the Agent Access context
 * (architecture-guide.md, section 13.1).
 *
 * It translates a tool call into a use case command and back, forwarding the
 * caller's own token, from which the core resolves the Authorship (section
 * 12.1). No MCP vocabulary crosses into the core
 * (RN-AGT-008), and no core vocabulary leaks out untranslated.
 *
 * Errors are answered as `isError` with ACTIONABLE text, and a missing
 * argument comes back with the template of the folder when that is what the
 * caller needs to try again (RN-AGT-003).
 */

import type { Deployment } from '@memorysmith/contracts';
import { TOOL_CATALOG } from './catalog.js';
import { PRODUCTION_DEFAULT } from './environment.js';
import { whoAmI } from './whoami.js';
import { DESIGN_NOTEBOOK_SKILL, SKILLS, skillNamed } from './skills.js';
import {
  GatewayError,
  type AccessGateway,
  type AgentCaller,
  type AuditGateway,
  type DiscoveryGateway,
  type KnowledgeGateway,
  type NoteContent,
  type RelatedNode,
} from './gateway.js';

export interface ToolResult {
  readonly content: Array<{ type: 'text'; text: string }>;
  readonly isError: boolean;
}

export interface Gateways {
  readonly access: AccessGateway;
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

/**
 * The revision a write is based on. Null is a legitimate value and means the
 * slot is empty, so it cannot be defaulted away: a missing argument is a
 * mistake worth an error, and an explicit null is an assertion about the
 * current state (RN-AGT-016).
 */
function revisionArgument(args: Record<string, unknown>, tool: string): string | null {
  const value = args['baseRevision'];
  if (value === null) return null;
  if (typeof value !== 'string' || value.length === 0) {
    const definition = TOOL_CATALOG.find((each) => each.name === tool);
    throw new GatewayError(
      'VALIDATION',
      `${tool} requires "baseRevision": the revision you read, or null if nothing is written yet.`,
      { expected: definition?.inputSchema },
    );
  }
  return value;
}

function renderRelated(node: RelatedNode, indent = 0): string {
  const line = `${'  '.repeat(indent)}- ${node.name} (${node.noteId})`;
  return [line, ...node.children.map((child) => renderRelated(child, indent + 1))].join('\n');
}

/**
 * What an agent is told when a write leaves a note with no name, the absence
 * RN-KNW-036 has reported. Agents wrote a whole folder of notes answered with
 * `"name": null` and never noticed, because a null does not say why. The
 * notice is a sentence and not a refusal: the note was written.
 */
export const UNNAMED_NOTE_NOTICE =
  'This note has no name: its content states no `name:` inside a frontmatter block, the ' +
  'lines between the two `---` that open the note. It is stored, rendered and searchable, ' +
  'and no link can reach it. If it should be linked, write `name:` in that block with ' +
  'update_note, and check the template of its folder, which the next note will follow.';

/**
 * The note a write answers, with the notice first when it has no name, so it is
 * read before a long body. It is a field of the one JSON document and never a
 * second content block, so a client reading the answer as JSON keeps reading it.
 */
function noteAnswer(note: NoteContent): ToolResult {
  return json(note.name === null ? { notice: UNNAMED_NOTE_NOTICE, ...note } : note);
}

export class McpToolAdapter {
  constructor(
    private readonly gateways: Gateways,
    private readonly deployment: Deployment = PRODUCTION_DEFAULT,
  ) {}

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
    const { access, knowledge, discovery, audit } = this.gateways;

    switch (name) {
      case 'whoami': {
        // The reach is read, not described: a list of notebooks the caller cannot
        // actually open would be a help that lies on its first step.
        // So is the connector: the one the proxy recorded for this token, and
        // never a guess from what else the token carries.
        const [connector, notebooks] = await Promise.all([
          access.connector(caller),
          knowledge.listNotebooks(caller),
        ]);
        return text(whoAmI(caller, connector, notebooks, this.deployment));
      }

      case 'get_skill': {
        const wanted = requireString(args, 'name', 'get_skill');
        const skill = skillNamed(wanted);
        if (!skill) {
          // The names of what exists, so the next attempt is informed rather
          // than guessed (RN-AGT-003).
          throw new GatewayError('NOT_FOUND', `There is no skill named "${wanted}".`, {
            available: SKILLS.map((each) => ({ name: each.name, task: each.task })),
          });
        }
        return text(skill.body);
      }

      case 'list_notebooks': {
        const notebooks = await knowledge.listNotebooks(caller);
        if (notebooks.length === 0) {
          // Said to a connector that can create one: sending it to somebody
          // else is how an agent stopped to ask who manages its connection.
          return text(
            'This connector reaches no notebook yet. When the person asks for one, create it ' +
              `with create_notebook, after reading the skill \`${DESIGN_NOTEBOOK_SKILL}\` with ` +
              'get_skill and asking them for samples of what it will hold. Creating a notebook ' +
              'takes the EDITOR role, and a connection without it is refused and told so.',
          );
        }
        return json(notebooks);
      }

      case 'create_notebook': {
        const created = await knowledge.createNotebook(caller, {
          name: requireString(args, 'name', 'create_notebook'),
          description: requireString(args, 'description', 'create_notebook'),
        });
        return json(created);
      }

      case 'delete_notebook': {
        const notebook = requireString(args, 'notebook', 'delete_notebook');
        await knowledge.deleteNotebook(caller, notebook);
        return text(
          `The notebook ${notebook} is out of every listing. Nothing was destroyed: its notes and ` +
            'their history are intact, and it can be brought back.',
        );
      }

      case 'get_guidance': {
        const found = await knowledge.guidance(
          caller,
          requireString(args, 'notebook', 'get_guidance'),
        );
        if (!found) {
          return text(
            'This notebook has no guidance yet. Write one with set_guidance, passing ' +
              'baseRevision: null, which is what an empty slot expects.',
          );
        }
        return json(found);
      }

      case 'set_guidance': {
        const notebook = requireString(args, 'notebook', 'set_guidance');
        await knowledge.setGuidance(
          caller,
          notebook,
          requireString(args, 'content', 'set_guidance'),
          // Null is a legitimate value here, and it means the slot is empty,
          // so it cannot be defaulted away: a missing argument is a mistake,
          // and a null one is an assertion about the current state.
          revisionArgument(args, 'set_guidance'),
        );
        return text(
          'The guidance of this notebook was replaced. Read it back with get_notebook_context to see ' +
            'it as the next agent will.',
        );
      }

      case 'create_folder': {
        const parent = typeof args['parent'] === 'string' ? args['parent'] : undefined;
        const folder = await knowledge.createFolder(caller, {
          notebookId: requireString(args, 'notebook', 'create_folder'),
          name: requireString(args, 'name', 'create_folder'),
          description: requireString(args, 'description', 'create_folder'),
          ...(parent === undefined ? {} : { parentFolderId: parent }),
        });
        return json(folder);
      }

      case 'delete_folder': {
        const removed = await knowledge.deleteFolder(caller, {
          notebookId: requireString(args, 'notebook', 'delete_folder'),
          folderId: requireString(args, 'folder', 'delete_folder'),
          policy: requireString(args, 'policy', 'delete_folder'),
        });
        return json(removed);
      }

      case 'set_template': {
        await knowledge.setTemplate(caller, {
          notebookId: requireString(args, 'notebook', 'set_template'),
          folderId: requireString(args, 'folder', 'set_template'),
          content: requireString(args, 'content', 'set_template'),
          baseRevision: revisionArgument(args, 'set_template'),
        });
        return text('The template of this folder was replaced. Read it back with get_template.');
      }

      case 'delete_note': {
        const note = requireString(args, 'note', 'delete_note');
        await knowledge.deleteNote(caller, requireString(args, 'notebook', 'delete_note'), note);
        return text(
          `The note ${note} left the listings and the search. Nothing was destroyed: its ` +
            'history stays readable by note_history, and the links that pointed at it are now ' +
            'pending rather than lost.',
        );
      }

      case 'get_notebook_context':
        // Markdown, not JSON: this document IS the product, and it is meant to
        // be read (software-vision.md, section 9.2).
        return text(
          await knowledge.notebookContext(
            caller,
            requireString(args, 'notebook', 'get_notebook_context'),
          ),
        );

      case 'get_template': {
        const template = await knowledge.template(
          caller,
          requireString(args, 'notebook', 'get_template'),
          requireString(args, 'folder', 'get_template'),
        );
        return template
          ? text(template.content)
          : text('This folder carries no template. Follow the guidance of the notebook instead.');
      }

      case 'list_notes': {
        const folder = typeof args['folder'] === 'string' ? args['folder'] : undefined;
        return json(
          await knowledge.listNotes(caller, requireString(args, 'notebook', 'list_notes'), folder),
        );
      }

      case 'read_note': {
        const notebook = requireString(args, 'notebook', 'read_note');
        const note = requireString(args, 'note', 'read_note');
        const asOf = typeof args['asOf'] === 'string' ? args['asOf'] : null;
        const read = asOf
          ? await audit.revisionAt(caller, { notebookId: notebook, noteId: note, asOf })
          : await knowledge.readNote(caller, notebook, note);
        return json(read);
      }

      case 'create_note': {
        const created = await knowledge.createNote(caller, {
          notebookId: requireString(args, 'notebook', 'create_note'),
          folderId: requireString(args, 'folder', 'create_note'),
          content: requireString(args, 'content', 'create_note'),
        });
        return noteAnswer(created);
      }

      case 'update_note': {
        const updated = await knowledge.updateNote(caller, {
          notebookId: requireString(args, 'notebook', 'update_note'),
          noteId: requireString(args, 'note', 'update_note'),
          content: requireString(args, 'content', 'update_note'),
          baseRevision: requireString(args, 'baseRevision', 'update_note'),
        });
        return noteAnswer(updated);
      }

      case 'search_notes':
        return json(
          await knowledge.searchNotes(
            caller,
            requireString(args, 'notebook', 'search_notes'),
            requireString(args, 'query', 'search_notes'),
          ),
        );

      case 'related_notes': {
        const tree = await discovery.relatedNotes(caller, {
          notebookId: requireString(args, 'notebook', 'related_notes'),
          noteId: requireString(args, 'note', 'related_notes'),
          ...(typeof args['depth'] === 'number' ? { depth: args['depth'] } : {}),
        });
        return text(renderRelated(tree));
      }

      case 'backlinks':
        return json(
          await discovery.backlinks(
            caller,
            requireString(args, 'notebook', 'backlinks'),
            requireString(args, 'note', 'backlinks'),
          ),
        );

      case 'note_history':
        return json(
          await audit.noteHistory(
            caller,
            requireString(args, 'notebook', 'note_history'),
            requireString(args, 'note', 'note_history'),
          ),
        );

      default:
        return text(`Unknown tool: ${name}`, true);
    }
  }
}
