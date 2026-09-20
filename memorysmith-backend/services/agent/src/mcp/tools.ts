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

/**
 * Where a reordered item goes. Required, and null is a statement — first —
 * exactly as null is on baseRevision: a missing argument is a mistake worth an
 * error, never a default (RN-AGT-029).
 */
function anchorArgument(args: Record<string, unknown>, tool: string): string | null {
  const value = args['after'];
  if (value === null) return null;
  if (typeof value !== 'string' || value.length === 0) {
    const definition = TOOL_CATALOG.find((each) => each.name === tool);
    throw new GatewayError(
      'VALIDATION',
      `${tool} requires "after": the identifier of the sibling it goes right after, or null to put it first.`,
      { expected: definition?.inputSchema },
    );
  }
  return value;
}

/** On a creation the anchor is optional, and without one the item goes last. */
/** An argument that may be left out, which is most of what a file carries. */
function optionalString(args: Record<string, unknown>, name: string): string | undefined {
  const value = args[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function optionalStrings(args: Record<string, unknown>, name: string): string[] | undefined {
  const value = args[name];
  return Array.isArray(value) ? value.map((each) => String(each)) : undefined;
}

function optionalAnchor(args: Record<string, unknown>): string | undefined {
  const value = args['after'];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function renderRelated(node: RelatedNode, indent = 0): string {
  // Two notes of one name live in two folders, and the folder is what tells
  // the two lines apart.
  const line = `${'  '.repeat(indent)}- ${node.name} (${node.noteId}, folder ${node.folderId})`;
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

/**
 * The refusal of a name its folder already holds, said the way an agent can act
 * on (RN-AGT-030): which note holds it, and the two things to do next. It is
 * also what a create retried after a lost answer receives, and there the note
 * named IS the one the first call wrote (RN-AGT-024).
 */
function nameTakenAnswer(error: GatewayError): string | null {
  const details = error.details as { code?: string; noteId?: string; name?: string } | undefined;
  if (details?.code !== 'ALREADY_EXISTS' || !details.noteId) return null;
  return (
    `ALREADY_EXISTS: this folder already holds a note named "${details.name ?? ''}", ` +
    `${details.noteId}, and a folder holds one note of each name. Nothing was written. ` +
    'If that note is the one you meant, as it is when a call retried after its answer was ' +
    'lost lands here, read it with read_note and change it with update_note. Otherwise ' +
    'choose another name, or write it in another folder, where the folder tells the two apart.'
  );
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
        const taken = nameTakenAnswer(error);
        if (taken) return text(taken, true);
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
              'get_skill and confirming with them the structure you propose. Creating a notebook ' +
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
        const kept = await knowledge.keptExportsOf(caller, notebook);
        await knowledge.deleteNotebook(caller, notebook);
        return text(
          `The notebook ${notebook} is gone, with its folders, its templates, its guidance and ` +
            'every note in it. Nothing brings it back, and its content is destroyed shortly ' +
            'after. Its name is free again.' +
            // An export is a document and not a part of the notebook, so it
            // stays — and it is the one way back from a deletion by mistake
            // (RN-PRT-020, RN-PRT-021).
            (kept > 0
              ? ` There ${kept === 1 ? 'is 1 export' : `are ${kept} exports`} of this notebook in ` +
                'Transfers, and they stay there: importing one creates the notebook again, with ' +
                'new identifiers.'
              : ''),
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
        const revision = await knowledge.setGuidance(
          caller,
          notebook,
          requireString(args, 'content', 'set_guidance'),
          // Null is a legitimate value here, and it means the slot is empty,
          // so it cannot be defaulted away: a missing argument is a mistake,
          // and a null one is an assertion about the current state.
          revisionArgument(args, 'set_guidance'),
        );
        // The revision this write produced, so the next write names it with no
        // read in between (RN-AGT-016).
        return json({ revision });
      }

      case 'delete_guidance': {
        const notebook = requireString(args, 'notebook', 'delete_guidance');
        await knowledge.deleteGuidance(caller, notebook);
        return text(
          `The notebook ${notebook} no longer declares how it wants to be written. Its folders, ` +
            'templates and notes are untouched; write a new guidance with set_guidance, passing ' +
            'baseRevision: null.',
        );
      }

      case 'create_folder': {
        const parent = typeof args['parent'] === 'string' ? args['parent'] : undefined;
        const after = optionalAnchor(args);
        const folder = await knowledge.createFolder(caller, {
          notebookId: requireString(args, 'notebook', 'create_folder'),
          name: requireString(args, 'name', 'create_folder'),
          description: requireString(args, 'description', 'create_folder'),
          ...(parent === undefined ? {} : { parentFolderId: parent }),
          ...(after === undefined ? {} : { afterFolderId: after }),
        });
        return json(folder);
      }

      case 'reorder_folder':
        // The siblings in their new order, so the agent sees the result
        // without reading the tree again.
        return json(
          await knowledge.reorderFolder(caller, {
            notebookId: requireString(args, 'notebook', 'reorder_folder'),
            folderId: requireString(args, 'folder', 'reorder_folder'),
            afterFolderId: anchorArgument(args, 'reorder_folder'),
          }),
        );

      case 'delete_folder': {
        const removed = await knowledge.deleteFolder(caller, {
          notebookId: requireString(args, 'notebook', 'delete_folder'),
          folderId: requireString(args, 'folder', 'delete_folder'),
          policy: requireString(args, 'policy', 'delete_folder'),
        });
        return json(removed);
      }

      case 'set_template': {
        const revision = await knowledge.setTemplate(caller, {
          notebookId: requireString(args, 'notebook', 'set_template'),
          folderId: requireString(args, 'folder', 'set_template'),
          content: requireString(args, 'content', 'set_template'),
          baseRevision: revisionArgument(args, 'set_template'),
        });
        return json({ revision });
      }

      case 'delete_template': {
        const folder = requireString(args, 'folder', 'delete_template');
        await knowledge.deleteTemplate(
          caller,
          requireString(args, 'notebook', 'delete_template'),
          folder,
        );
        return text(
          `The folder ${folder} no longer suggests a layout for the notes kept there. The ` +
            'folder, its description and its notes are untouched.',
        );
      }

      case 'next_number': {
        const folder = requireString(args, 'folder', 'next_number');
        const number = await knowledge.nextNumber(
          caller,
          requireString(args, 'notebook', 'next_number'),
          folder,
        );
        return json({ folder, number });
      }

      case 'delete_note': {
        const note = requireString(args, 'note', 'delete_note');
        await knowledge.deleteNote(caller, requireString(args, 'notebook', 'delete_note'), note);
        return text(
          `The note ${note} left the listings and the search, for good. Nothing brings it back, ` +
            'and its content is destroyed shortly after. The links that pointed at it are now ' +
            'pending rather than lost.',
        );
      }

      /**
       * What a notebook keeps beside its notes (#166). The name is what a
       * note addresses with `![[name]]`, and the type is what decides how it
       * is drawn \u2014 the extension of the name decides nothing.
       */
      case 'keep_file': {
        const notebook = requireString(args, 'notebook', 'keep_file');
        const kept = await knowledge.keepFile(caller, notebook, {
          name: requireString(args, 'name', 'keep_file'),
          description: optionalString(args, 'description') ?? '',
          mimeType: requireString(args, 'mimeType', 'keep_file'),
          tags: optionalStrings(args, 'tags') ?? [],
          path: optionalString(args, 'path') ?? '/',
          contentBase64: requireString(args, 'contentBase64', 'keep_file'),
        });
        return json({
          ...kept,
          reference: `![[${kept.name}]]`,
          note: 'Write that reference in a note and the page draws this file.',
        });
      }

      case 'list_files':
        return json({
          files: await knowledge.listFiles(caller, requireString(args, 'notebook', 'list_files')),
        });

      case 'delete_file': {
        const file = requireString(args, 'file', 'delete_file');
        await knowledge.deleteFile(caller, requireString(args, 'notebook', 'delete_file'), file);
        return text(
          `The file ${file} is gone, for good, and its bytes are destroyed shortly after. ` +
            'Every note that showed it now renders a pending reference, and its name is free ' +
            'again.',
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
        // The revision travels with the content, as it does for the guidance:
        // it is what the next set_template has to state (RN-AGT-016).
        return template
          ? json({ content: template.content, revision: template.revision })
          : text('This folder carries no template. Follow the guidance of the notebook instead.');
      }

      case 'list_notes': {
        const folder = typeof args['folder'] === 'string' ? args['folder'] : undefined;
        const cursor = typeof args['cursor'] === 'string' ? args['cursor'] : undefined;
        const limit = typeof args['limit'] === 'number' ? args['limit'] : undefined;
        return json(
          await knowledge.listNotes(caller, {
            notebookId: requireString(args, 'notebook', 'list_notes'),
            ...(folder === undefined ? {} : { folderId: folder }),
            ...(cursor === undefined ? {} : { cursor }),
            ...(limit === undefined ? {} : { limit }),
          }),
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
        const after = optionalAnchor(args);
        const created = await knowledge.createNote(caller, {
          notebookId: requireString(args, 'notebook', 'create_note'),
          folderId: requireString(args, 'folder', 'create_note'),
          content: requireString(args, 'content', 'create_note'),
          ...(after === undefined ? {} : { afterNoteId: after }),
        });
        return noteAnswer(created);
      }

      case 'update_note': {
        const updated = await knowledge.updateNote(caller, {
          notebookId: requireString(args, 'notebook', 'update_note'),
          noteId: requireString(args, 'note', 'update_note'),
          content: requireString(args, 'content', 'update_note'),
          baseRevision: requireString(args, 'baseRevision', 'update_note'),
          message: optionalString(args, 'message'),
        });
        return noteAnswer(updated);
      }

      case 'reorder_note':
        return json(
          await knowledge.reorderNote(caller, {
            notebookId: requireString(args, 'notebook', 'reorder_note'),
            noteId: requireString(args, 'note', 'reorder_note'),
            afterNoteId: anchorArgument(args, 'reorder_note'),
          }),
        );

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
