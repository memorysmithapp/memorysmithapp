/**
 * THE TOOL CATALOG IS THE PUBLIC CONTRACT OF THE PRODUCT. The internal API
 * exists to serve the UI; it is this surface that external clients consume, and
 * it is this surface the versioning policy protects.
 *
 * Two rules shape every entry here, and they are not stylistic:
 *
 *  - RN-AGT-009: every tool declares a human-readable title and a read-only or
 *    destructive hint. Those hints are what decide whether a client runs the
 *    call outright or asks the user first, so a tool without them costs
 *    friction on every single invocation.
 *  - RN-AGT-010: reading and writing never share a tool. There is no generic
 *    tool parameterized by operation, and the catalog is built so that it
 *    stays that way as the surface grows.
 */

import { createHash } from 'node:crypto';
import {
  BUILD_DASHBOARDS_SKILL,
  DESIGN_NOTEBOOK_SKILL,
  KEEP_FILES_SKILL,
  KEEP_TABLES_SKILL,
} from './skills.js';

export interface ToolDefinition {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  readonly annotations: {
    readonly readOnlyHint?: boolean;
    readonly destructiveHint?: boolean;
    readonly idempotentHint?: boolean;
    readonly openWorldHint?: boolean;
  };
}

const notebookArgument = {
  type: 'string',
  description: 'Identifier of the notebook, as returned by list_notebooks.',
};

const dashboardArgument = {
  type: 'string',
  description: 'The name of the dashboard, or its identifier, as list_dashboards prints them.',
};

/** A table is named as a note names it: by its name, or by its identifier (#366). */
const tableArgument = {
  type: 'string',
  description: 'The name of the table, or its identifier, as list_tables prints them.',
};

/**
 * Where the identifier comes from is part of the argument (RN-AGT-020). It is
 * printed next to the name of every folder in the notebook context, so an agent
 * that created nothing addresses the tree just as well as the one that built it.
 */
const folderArgument = {
  type: 'string',
  description: 'Folder identifier, as get_notebook_context prints it next to the folder name.',
};

const baseRevisionArgument = {
  type: ['string', 'null'],
  description:
    'The revision this write is based on, exactly as the matching read returned it, or null ' +
    'when nothing has been written to this slot yet. A divergence answers CONFLICT with the ' +
    'current content, so an edit is never lost in silence.',
};

/**
 * The sibling an item goes right after (RN-AGT-029). Required on a reorder, and
 * null is a statement, first, as it is on baseRevision.
 */
const afterFolderArgument = {
  type: ['string', 'null'],
  description:
    'null puts the folder first among its siblings; an identifier puts it right after that ' +
    'sibling, as get_notebook_context prints it. A folder of another level is refused, and ' +
    'the refusal lists the ones of this level.',
};

const afterNoteArgument = {
  type: ['string', 'null'],
  description:
    'null puts the note first in its folder; an identifier puts it right after that note, as ' +
    'list_notes prints it. A note of another folder is refused, and the refusal lists the ' +
    'notes of this one.',
};

/** How a folder orders its notes (RN-KNW-056). */
const noteOrderArgument = {
  type: 'string',
  enum: ['manual', 'alphabetical'],
  description:
    'Optional: how the folder orders its notes. manual, the default, keeps the order they are ' +
    'written in; alphabetical orders them by name.',
};

/**
 * The context a note write declares it read (RN-KNW-061): optional, and never
 * a reason to refuse. Said once, so the three tools that take it say it alike.
 */
const contextArgument = {
  type: 'object',
  description:
    'Optional, and asked for: the revisions you read before writing, so the answer can tell ' +
    'you if somebody changed them meanwhile. guidance and structure as the end of ' +
    'get_notebook_context answers them, template as get_template answers the revision of the ' +
    "folder's template (null when it has none). The note is saved either way.",
  properties: {
    guidance: { type: ['string', 'null'] },
    template: { type: ['string', 'null'] },
    structure: { type: 'string' },
  },
  required: ['guidance', 'template', 'structure'],
  additionalProperties: false,
};

/** What a write answers when its declared context changed (RN-KNW-061). */
const CONTEXT_ANSWERED =
  'When the context you declared changed while you wrote, the note is still saved, and the ' +
  'answer carries `contextChanged` with what changed and the current revisions: reread it, ' +
  'review the note against it and update it if needed. It is a notice, never a lock.';

function object(
  properties: Record<string, unknown>,
  required: string[] = [],
): Record<string, unknown> {
  return { type: 'object', properties, required, additionalProperties: false };
}

/**
 * What a write answers beside the note (RN-AGT-052): said once, so the two
 * tools that write a body say it the same way.
 */
const NOTICES_ANSWERED =
  'The answer carries `notices` when the page will not show the note as typed: each with a ' +
  'code, a line and a column, a `notice` where what is drawn differs from the text (a fence ' +
  'never closed, a heading that skips a level, raw HTML) and a `hint` where the note lacks ' +
  'something the specification reserves (no aliases, no tags). Nothing is refused for them: ' +
  'fix a notice with update_note in the same turn, and weigh a hint against the guidance.';

const DEFINITIONS: readonly ToolDefinition[] = [
  {
    name: 'whoami',
    title: 'Who you are, and how to write here',
    description:
      'Answers two questions at once: who this connection acts as, and how this product ' +
      'expects to be used. It names the person who authorized the connector, the connector ' +
      'itself, the subscription the token is fixed to and the notebooks within reach, and then ' +
      'it lays out the reading path: the guidance of a notebook, the folder tree with the ' +
      'purpose of each folder, and the template of the folder you are about to write in, and ' +
      'it indexes the skills, the written method of each task the path does not teach. ' +
      'Call it before any other tool.',
    inputSchema: object({}),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'get_skill',
    title: 'Read a skill: the method for a task',
    description:
      'Returns the written method for one task, by name. The names come from whoami and from ' +
      'the instructions of this server, which both index them, and a skill is meant to be read ' +
      'BEFORE the task, not after it went wrong. It teaches: it never validates and never ' +
      'writes anything.',
    inputSchema: object(
      {
        name: {
          type: 'string',
          description: 'Name of the skill, as whoami lists it. For example: design-notebook.',
        },
      },
      ['name'],
    ),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'list_notebooks',
    title: 'List notebooks',
    description:
      'Lists the notebooks this connector can reach, with their description and note count, ' +
      'and every notebook tool takes its identifier from this list. Each says its ownership: ' +
      '`own`, of this subscription, or `shared`, shared with this person from another one, ' +
      'which also names its owner and the access the share grants: `reader` writes nothing, ' +
      '`content-editor` writes notes and files but not folders, guidance or templates, ' +
      '`notebook-editor` writes all of them; `pendingAccess` is an increase waiting for the ' +
      "person's acceptance, which grants nothing until accepted. Call whoami before it: " +
      'whoami lists the same notebooks, together with how to write in them and the skills to ' +
      'read before a task.',
    inputSchema: object({}),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'create_notebook',
    title: 'Create a notebook',
    description:
      'Creates a notebook in this subscription: a notebook of Markdown notes, organised in folders ' +
      'and described by a guidance and by the templates of its folders — not a Jupyter notebook. ' +
      `BEFORE calling it, read the skill \`${DESIGN_NOTEBOOK_SKILL}\` with get_skill: its ` +
      'guidance, folders and templates follow from what the notebook will hold. Build it from ' +
      'the material the person brought to the conversation when there is some, and say what ' +
      'you built; propose a structure and confirm it first when there is none, since a notebook ' +
      'created before either gets a structure nobody chose. Then write its guidance with ' +
      'set_guidance: a notebook without guidance ' +
      'tells the next agent nothing about how it wants to be written. ' +
      'If a notebook with the same name already exists, this fails with ALREADY_EXISTS and returns ' +
      'the identifier of the existing one: no second notebook is created and no suffix is invented, ' +
      'so a retry is safe.',
    inputSchema: object(
      {
        name: { type: 'string', description: 'Name of the notebook; the slug is derived from it.' },
        description: {
          type: 'string',
          description: 'What this notebook is for, in one line. It is shown wherever it is listed.',
        },
      },
      ['name', 'description'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'delete_notebook',
    title: 'Delete a notebook',
    description:
      'Deletes a notebook, and everything in it: its folders, its templates, its guidance and ' +
      'every note, with every past revision of each. It is DEFINITIVE — there is no undo and no ' +
      'trash — and it takes effect at once, while the content itself is destroyed in the ' +
      'background shortly after. Only the owner of the subscription may do this. Read what is ' +
      'in it with get_notebook_context and confirm with the person, naming the notebook, before ' +
      'calling it.',
    inputSchema: object({ notebook: notebookArgument }, ['notebook']),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  },
  {
    name: 'get_notebook_context',
    title: 'Read the notebook context',
    description:
      'THE MAIN CALL. Returns the guidance of the notebook in full, followed by its folder tree ' +
      'with the identifier of each folder, its description, the defined order, the notes it holds ' +
      'directly and those in its subfolders, how many notes and folders the notebook holds, ' +
      'and which folders carry a template. Read this before writing anything: the guidance ' +
      'declares the conventions of this notebook, the folder descriptions say what belongs where, ' +
      'and the identifiers are what you pass to get_template, create_note and list_notes. It ' +
      'ends with the revisions of what you read, to declare as `context` when you write a note.',
    inputSchema: object({ notebook: notebookArgument }, ['notebook']),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'get_guidance',
    title: 'Read the guidance of a notebook, with its revision',
    description:
      'The guidance as it is stored, plus the revision to pass back as baseRevision when you ' +
      'replace it. get_notebook_context shows the guidance inside a composed document, which is ' +
      'what you read to understand the notebook; this is what you read to WRITE it.',
    inputSchema: object({ notebook: notebookArgument }, ['notebook']),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'set_guidance',
    title: 'Write the guidance of a notebook',
    description:
      'Replaces the guidance of a notebook, which is the document that declares how THIS notebook ' +
      'wants to be written: its conventions, its vocabulary, what belongs in it and what does ' +
      'not. It is read by every agent that writes here, so write it for one, in Markdown, and ' +
      'open it with the paragraph that says what the notebook is, never with a heading: the ' +
      'Notebook Context prints the name of the notebook as one right above it. Then ' +
      'read the current one with get_guidance, which also gives you the baseRevision. The ' +
      'answer is the revision this write produced: pass it as baseRevision to write again, and ' +
      'read the result with get_notebook_context to see it as the next agent will. When the ' +
      'notebook already has a guidance, confirm with the person before replacing it: every ' +
      'agent that writes here follows what it says. Writing the first guidance of a notebook ' +
      'the person asked you to design is part of that design.',
    inputSchema: object(
      {
        notebook: notebookArgument,
        content: { type: 'string', description: 'The complete guidance, in Markdown.' },
        baseRevision: baseRevisionArgument,
      },
      ['notebook', 'content', 'baseRevision'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: true },
  },
  {
    name: 'delete_guidance',
    title: 'Delete the guidance of a notebook',
    description:
      'Removes the guidance of a notebook. The notebook keeps its folders, its templates and ' +
      'every note; it simply stops declaring how it wants to be written, and the next agent ' +
      'that comes here has only the folder descriptions to go by. Read the current one with ' +
      'get_guidance first and confirm with the person: replacing it is usually what they ' +
      'meant, and set_guidance does that in one call.',
    inputSchema: object({ notebook: notebookArgument }, ['notebook']),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  },
  {
    name: 'create_folder',
    title: 'Create a folder',
    description:
      'Creates a folder in a notebook. The description is REQUIRED and is not decoration: it is ' +
      'what tells the next agent what belongs in this folder, and it travels in every reading ' +
      'of the notebook context. Pass parent to nest it under another folder. The order of ' +
      'folders is content, and a new folder goes last among its siblings unless you pass ' +
      'after; reorder_folder changes the order later. A folder orders its own notes by hand ' +
      'unless you pass noteOrder: alphabetical, for a folder of records looked up by name — ' +
      'minutes, decisions, articles — where each note then appears by its name; ' +
      'set_note_order changes it later.',
    inputSchema: object(
      {
        notebook: notebookArgument,
        name: { type: 'string', description: 'Name of the folder.' },
        description: {
          type: 'string',
          description: 'What belongs in this folder. Required, and read by whoever writes here.',
        },
        parent: {
          type: 'string',
          description:
            'Optional: identifier of the folder this one goes under, as get_notebook_context ' +
            'prints it next to the folder name.',
        },
        after: {
          type: 'string',
          description:
            'Optional: identifier of the sibling folder this one goes right after, as ' +
            'get_notebook_context prints it. Without it the folder goes last among its siblings.',
        },
        noteOrder: noteOrderArgument,
      },
      ['notebook', 'name', 'description'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  {
    name: 'reorder_folder',
    title: 'Reorder a folder',
    description:
      'Moves a folder among its siblings, the folders under the same parent. The order is ' +
      'content: get_notebook_context numbers the folders by it and it tells the next agent ' +
      'where to start, so a folder name needs no number. Pass after: null to put the folder ' +
      'first, or the identifier of the sibling it goes right after. Only the order changes: ' +
      'the folder keeps its parent, its notes and its identifier. Answers the siblings in ' +
      'their new order.',
    inputSchema: object(
      { notebook: notebookArgument, folder: folderArgument, after: afterFolderArgument },
      ['notebook', 'folder', 'after'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'set_note_order',
    title: 'Set how a folder orders its notes',
    description:
      'Sets how the notes of a folder are ordered. manual keeps the order written into the ' +
      'folder, which create_note and reorder_note place: right for a folder read in sequence, ' +
      'such as the chapters of a guide or the steps of a process. alphabetical orders them by ' +
      'name, numbers by value so Ata 2 comes before Ata 10, a note with no name last: right for ' +
      'a folder of records looked up by name. In an alphabetical folder a note appears by its ' +
      'name wherever it is listed, and reorder_note is refused. The places notes had are kept, ' +
      'so turning a folder back to manual shows the order it had. Answers the folder as it now ' +
      'is.',
    inputSchema: object(
      {
        notebook: notebookArgument,
        folder: folderArgument,
        noteOrder: { ...noteOrderArgument, description: 'Required. manual or alphabetical.' },
      },
      ['notebook', 'folder', 'noteOrder'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'update_folder',
    title: 'Rename, describe or move a folder',
    description:
      'Changes a folder that already exists, keeping its identifier, its notes, its subfolders ' +
      'and its template. Pass name to rename it, description to change what it says belongs ' +
      'in it, and parent to move it under another folder of the same notebook, or null to the ' +
      'top of the tree; pass only what changes. The description is what directs the next ' +
      'agent that writes here, so keep it saying what the folder holds now. Nothing is ' +
      'written to any note: a link finds a note by its name, never by its folder, so every ' +
      'link keeps working. A name a sibling folder holds is refused, a description holds 1 to ' +
      '500 characters, and a folder cannot move into its own subtree or past six levels; a ' +
      'refusal changes nothing. A moved folder goes last among its new siblings, and ' +
      'reorder_folder places it. Answers the folder as it now is.',
    inputSchema: object(
      {
        notebook: notebookArgument,
        folder: folderArgument,
        name: { type: 'string', description: 'Optional: the new name of the folder.' },
        description: {
          type: 'string',
          description:
            'Optional: what now belongs in this folder, 1 to 500 characters, read by whoever ' +
            'writes here.',
        },
        parent: {
          type: ['string', 'null'],
          description:
            'Optional: identifier of the folder this one moves under, as get_notebook_context ' +
            'prints it, or null to move it to the top of the tree. Leave it out to keep the ' +
            'folder where it is.',
        },
      },
      ['notebook', 'folder'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'delete_folder',
    title: 'Delete a folder',
    description:
      'Removes a folder from the tree of a notebook. There is NO implicit policy: with ' +
      'REJECT_IF_NOT_EMPTY a folder that holds subfolders or notes is refused, and with CASCADE ' +
      'the whole subtree goes — every subfolder, every note in it and every template — ' +
      'DEFINITIVELY, with no undo and no trash. There is no ceiling on what one call takes, so ' +
      'a CASCADE over a large subtree deletes all of it. Call get_notebook_context first to see ' +
      'what the folder holds, and confirm with the person before cascading.',
    inputSchema: object(
      {
        notebook: notebookArgument,
        folder: folderArgument,
        policy: {
          type: 'string',
          enum: ['REJECT_IF_NOT_EMPTY', 'CASCADE'],
          description: 'Required. What to do when the folder is not empty.',
        },
      },
      ['notebook', 'folder', 'policy'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: true },
  },
  {
    name: 'get_template',
    title: 'Read the folder template',
    description:
      'Returns the template of a folder, which is the suggested layout of the notes kept ' +
      'there, with the revision to pass back as baseRevision when you replace it. Call this ' +
      'before create_note whenever the folder has one; the server does not ' +
      'validate content against it, so following it is what keeps the notebook coherent.',
    inputSchema: object({ notebook: notebookArgument, folder: folderArgument }, [
      'notebook',
      'folder',
    ]),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'set_template',
    title: 'Write the template of a folder',
    description:
      'Replaces the template of a folder, which is the suggested layout of the notes kept there. ' +
      'Read the current one with get_template, which gives you the baseRevision, or pass null ' +
      'when the folder has none; the answer is the revision this write produced, for the next ' +
      'write. The server does not validate any note against it, so what it buys is coherence, not ' +
      'enforcement: write the skeleton a good note in this folder would follow. Open it with ' +
      'the frontmatter block — the lines between the two `---` at the top — carrying `name:`, ' +
      'which is where every note written from it states its name, and show the structure of ' +
      'the body with headings from `#`.',
    inputSchema: object(
      {
        notebook: notebookArgument,
        folder: folderArgument,
        content: { type: 'string', description: 'The template, in Markdown.' },
        baseRevision: baseRevisionArgument,
      },
      ['notebook', 'folder', 'content', 'baseRevision'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: true },
  },
  {
    name: 'delete_template',
    title: 'Delete the template of a folder',
    description:
      'Removes the template of a folder. The folder stays, with its notes and its ' +
      'description, and stops suggesting a layout for what is written there; the notes ' +
      'already written keep the shape they have, because the server never validated one ' +
      'against the template anyway. Confirm with the person, and prefer set_template when ' +
      'what they want is a different skeleton rather than none.',
    inputSchema: object({ notebook: notebookArgument, folder: folderArgument }, [
      'notebook',
      'folder',
    ]),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  },
  {
    name: 'next_number',
    title: 'Issue the next number of a folder',
    description:
      'Issues the next whole number of a folder and answers it: 1 for a folder that never ' +
      'issued one, then 2, 3 and on. A number is issued once and never again, not even after ' +
      'the note that carried it is deleted, and a number you ask for and do not use leaves a ' +
      'gap. Use it when the Guidance says a folder numbers its notes, such as records that ' +
      'multiply: the name is the convention the Guidance states, such as EV-00042, and the ' +
      'description goes in the text of a link, [[EV-00042|what it shows]]. Ask for a number ' +
      'only when you are about to write the note that carries it. The server writes no name ' +
      'and checks none against the number.',
    inputSchema: object({ notebook: notebookArgument, folder: folderArgument }, [
      'notebook',
      'folder',
    ]),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'list_notes',
    title: 'List notes',
    description:
      'Index of the notes of a notebook, or of a single folder, in the ORDER DEFINED by whoever ' +
      'authored the notebook. The order is content, not decoration: it says where to start. ' +
      'A folder that orders its notes by name lists them by name. ' +
      'Each note comes as its identifier, name, folder and position, one page at a time: the ' +
      'answer is { notes, nextCursor }, and while nextCursor is not null pass it back as cursor ' +
      'to read the next page. Read a note with read_note, and find notes by their text with ' +
      'search_notes instead of reading the whole index.',
    inputSchema: object(
      {
        notebook: notebookArgument,
        folder: {
          type: 'string',
          description:
            'Optional: restrict to one folder, by the identifier get_notebook_context prints.',
        },
        limit: {
          type: 'number',
          description: 'Optional: how many notes one page holds, 100 when omitted and at most 500.',
        },
        cursor: {
          type: 'string',
          description: 'Optional: the nextCursor of the previous page, to continue from it.',
        },
      },
      ['notebook'],
    ),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'read_note',
    title: 'Read a note',
    description:
      'Returns the complete Markdown of a note and its current revision, as `revision`: a ' +
      'string to pass back unchanged as baseRevision when you edit it. It also answers ' +
      '`folder`, the names of the folders from the root down to the one the note lives in, and ' +
      '`links`, every link target the note writes with the notes it reaches, each with its ' +
      'identifier and folder: a target reaching two notes lists both, and a target no note ' +
      'carries yet is `pending`. The links are as recent as the link index, which follows a ' +
      'write within seconds. With asOf, returns ' +
      'the revision that was in force on that date, rebuilt from the audit trail, which is ' +
      'what lets a past piece of work be redone against the base as it stood then.',
    inputSchema: object(
      {
        notebook: notebookArgument,
        note: { type: 'string', description: 'Note identifier.' },
        asOf: {
          type: 'string',
          description: 'Optional ISO 8601 date. Returns the revision in force at that moment.',
        },
      },
      ['notebook', 'note'],
    ),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'create_note',
    title: 'Create a note',
    description:
      'Creates a note in a folder. Read get_template for that folder first. Write the name of ' +
      'the note in `name:`, in the frontmatter that opens the content: it is the title the page ' +
      'shows and what every link looks for, and the skill `write-notes` says what the body ' +
      'holds. A folder holds one note of each name: a name the folder already holds is ' +
      'refused, naming the note that holds it, so a call retried after its answer was lost ' +
      'finds the note it made instead of writing a twin. A note with no name reserves nothing, ' +
      'so retrying one of those writes a second. Another folder may hold a note of the same ' +
      'name. The note goes last in its folder unless you pass after; in a folder that orders ' +
      'its notes by name it appears by its name, wherever after puts it. ' +
      NOTICES_ANSWERED +
      ' ' +
      CONTEXT_ANSWERED,
    inputSchema: object(
      {
        notebook: notebookArgument,
        folder: {
          type: 'string',
          description:
            'Folder that will hold the note, by the identifier get_notebook_context prints ' +
            'next to its name.',
        },
        content: { type: 'string', description: 'The Markdown body of the note.' },
        after: {
          type: 'string',
          description:
            'Optional: identifier of the note this one goes right after, as list_notes prints ' +
            'it. Without it the note goes last in its folder.',
        },
        context: contextArgument,
      },
      ['notebook', 'folder', 'content'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'keep_file',
    title: 'Keep a file in a notebook',
    description:
      'Keeps a file in the notebook so a note can show it: write `![[name]]` in the note and ' +
      'the page draws it. The NAME is what a note addresses, and it is a name like any other ' +
      '\u2014 an extension is yours to write or to leave out, and it decides nothing. What decides ' +
      'how the file is drawn, and whether it may be kept at all, is mimeType: an image, an ' +
      'audio and a video are drawn on the page, and everything else is a card with a download. ' +
      'The bytes travel in this one call, so it suits a file of a few kilobytes: an SVG or a ' +
      'CSV as its text in `content`, copied exactly as you were given it, and any other type in ' +
      '`contentBase64`, which you write without a slip only when code encodes it \u2014 base64 ' +
      'written by hand slips even on a small file. A photo, a recording or a document ' +
      'of any real size is sent with begin_file_upload instead, whole and at its own ' +
      `resolution, as the skill \`${KEEP_FILES_SKILL}\` describes. Keep what the person gave you: ` +
      'when the bytes you hold are fewer than what they sent — a chat that recompresses ' +
      'attachments — tell them both sizes before keeping anything. The type is checked against the bytes, so ' +
      'a declaration they do not support is refused naming both. A notebook keeps one file of ' +
      'each name; the path only organises, so moving a file never breaks a note.',
    inputSchema: object(
      {
        notebook: notebookArgument,
        name: {
          type: 'string',
          description:
            'What a note addresses with `![[name]]`. An extension is optional and decides nothing.',
        },
        description: {
          type: 'string',
          description: 'What this file is, for whoever reads the notebook without opening it.',
        },
        mimeType: {
          type: 'string',
          description:
            'The type of the content, which is what decides how it is drawn. One of: ' +
            'image/png, image/jpeg, image/webp, image/gif, image/svg+xml, application/pdf, ' +
            'audio/mpeg, audio/wav, audio/ogg, audio/webm, video/mp4, video/webm, ' +
            'video/quicktime, the three Office documents (docx, xlsx, pptx) and text/csv, the ' +
            'rows a table imports.',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: the subjects of this file, the way a note carries tags.',
        },
        path: {
          type: 'string',
          description:
            'Optional: where it sits, written like a path, `/desenhos/arquitetura`. It ' +
            'organises and never addresses: the name is what a note writes.',
        },
        content: {
          type: 'string',
          description:
            'The file as text, for an SVG or a CSV: every character exactly as you were given it, ' +
            'nothing reformatted. Give this or contentBase64, never both.',
        },
        contentBase64: {
          type: 'string',
          description: 'The bytes of the file, base64. Give this or content, never both.',
        },
      },
      ['notebook', 'name', 'mimeType'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'begin_file_upload',
    title: 'Start sending a file in parts',
    description:
      'Starts keeping a file whole, at its own size and resolution: a photo, a recording, a PDF. ' +
      'Declare the file first \u2014 its name, type, size in bytes and the SHA-256 of the whole ' +
      'file \u2014 and then send it in parts. With transport "url" every part has an address, and ' +
      'a script PUTs the bytes from the disk to it, so they never pass through what you write: ' +
      'use it whenever you can run a command with network access. The parts are 8 MiB each, the ' +
      'last one shorter. With transport "inline" you send each part yourself with ' +
      'send_file_part, and choose its size with partSize. The file is kept by ' +
      'finish_file_upload once every part arrived, and only if the whole hashes to what you ' +
      'declared here. Up to 100 MB by URL; inline suits what you write out whole, a few tens of ' +
      'kilobytes. The answer names partsHost, the host every part goes to. The room is reserved now, and the ' +
      'person sees the upload in Transfers until it becomes a file. Read the skill ' +
      `\`${KEEP_FILES_SKILL}\` first.`,
    inputSchema: object(
      {
        notebook: notebookArgument,
        name: {
          type: 'string',
          description: 'What a note addresses with `![[name]]`. An extension is optional.',
        },
        mimeType: {
          type: 'string',
          description: 'The type of the content, from the list keep_file accepts.',
        },
        size: { type: 'integer', description: 'The size of the whole file, in bytes.' },
        sha256: {
          type: 'string',
          description: 'The SHA-256 of the whole file, in lowercase hex.',
        },
        purpose: {
          type: 'string',
          description:
            'What the file is for, in a sentence the person recognises in Transfers, such as ' +
            '"photo of the whiteboard of the meeting, for the note of its minutes". It becomes ' +
            'the description of the file when you give none.',
        },
        transport: {
          type: 'string',
          enum: ['url', 'inline'],
          description:
            '"url": a signed address per part, which a script PUTs to. "inline": the parts ' +
            'travel in send_file_part.',
        },
        partSize: {
          type: 'integer',
          description:
            'Inline only: the bytes of every part but the last, from 1024 to 1048576, at most ' +
            '256 parts. Choose what you write out without a slip; 24576 is a good start.',
        },
        description: {
          type: 'string',
          description: 'Optional: what this file is, for whoever reads the notebook.',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: the subjects of this file.',
        },
        path: {
          type: 'string',
          description:
            'Optional: where it sits, written like a path. It organises and never addresses.',
        },
      },
      ['notebook', 'name', 'mimeType', 'size', 'sha256', 'purpose', 'transport'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'send_file_part',
    title: 'Send one part of a file',
    description:
      'Sends one part of an upload whose transport is "inline": its bytes in base64 and the ' +
      'SHA-256 of those bytes. A part whose bytes do not match its hash is refused and nothing ' +
      'of it is kept, so send it again. A part sent twice replaces itself. Parts count from 1, ' +
      'each exactly partSize bytes but the last.',
    inputSchema: object(
      {
        upload: { type: 'string', description: 'The upload, as begin_file_upload answered it.' },
        part: { type: 'integer', description: 'The number of the part, from 1.' },
        sha256: {
          type: 'string',
          description: 'The SHA-256 of the bytes of this part, in lowercase hex.',
        },
        contentBase64: { type: 'string', description: 'The bytes of this part, base64.' },
      },
      ['upload', 'part', 'sha256', 'contentBase64'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'file_upload_status',
    title: 'See what an upload is missing',
    description:
      'Which parts of an upload arrived and which are missing, and, for an upload by URL, a ' +
      'fresh address for every missing part. Addresses last an hour: ask here again for new ' +
      'ones. This is also how an upload stopped halfway is resumed.',
    inputSchema: object(
      { upload: { type: 'string', description: 'The upload, as begin_file_upload answered it.' } },
      ['upload'],
    ),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'finish_file_upload',
    title: 'Finish an upload and keep the file',
    description:
      'Joins the parts and keeps the file, when every part arrived, the whole hashes to the ' +
      'SHA-256 declared at the start and the bytes support the declared type. The upload then ' +
      'leaves Transfers, and the answer is the reference to write in a note. Bytes that do not ' +
      'hash to what was declared end the upload as failed, with nothing kept: start again ' +
      'from the file. Any other refusal \u2014 a part missing, a name taken meanwhile, the ' +
      'notebook no longer reachable \u2014 leaves the upload open, to finish again.',
    inputSchema: object(
      { upload: { type: 'string', description: 'The upload, as begin_file_upload answered it.' } },
      ['upload'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'list_file_uploads',
    title: 'List the open uploads',
    description:
      'The uploads of the person that have not become files yet, newest first, each with the ' +
      'name, the SHA-256 of its whole file, the parts that arrived and when the last one did, ' +
      'and the files requested from the person and still waiting for them, as `kind: "request"`. ' +
      'Read it before starting an upload: an upload of the same file, found by its SHA-256, is ' +
      'resumed with file_upload_status instead of sent again.',
    inputSchema: object(
      {
        notebook: {
          type: 'string',
          description: 'Optional: only the uploads going to this notebook.',
        },
      },
      [],
    ),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'request_file',
    title: 'Ask the person for a file',
    description:
      'Asks the person for a file instead of sending it, when you cannot send its bytes: a ' +
      'sandbox with no network, where no part of an upload by URL ever arrives, or a copy of an ' +
      'attachment your client reduced. Write `![[name]]` where the file belongs first; the person ' +
      'keeps the file from Transfers, under this name, and that reference draws it. Name an ' +
      '`upload` you could not finish and the request is made of it — its name, type, description, ' +
      'tags, path and purpose — and replaces it, its parts thrown away and its room given back; ' +
      'otherwise declare the file as begin_file_upload does. A size and SHA-256 you know are shown ' +
      'to the person as a reference, never enforced. Asking again for a name the notebook already ' +
      'waits for answers the same request. `list_files` says when the file is kept.',
    inputSchema: object(
      {
        upload: {
          type: 'string',
          description:
            'Optional: an upload you could not finish, as begin_file_upload answered it. The ' +
            'request takes everything from it and replaces it.',
        },
        notebook: {
          ...notebookArgument,
          description: 'The notebook the file goes to, when no upload is named.',
        },
        name: {
          type: 'string',
          description:
            'The name a note addresses the file by, `![[name]]`: the one the person gave it.',
        },
        mimeType: { type: 'string', description: 'The type of the file, such as image/jpeg.' },
        purpose: {
          type: 'string',
          description:
            'What the file is for, in a sentence the person recognises in Transfers, such as ' +
            '*the photo of the whiteboard of the planning meeting, for its minutes*.',
        },
        description: { type: 'string', description: 'Optional: what the file is.' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional: its tags.' },
        path: { type: 'string', description: 'Optional: where it sits, such as /atas.' },
        size: {
          type: 'integer',
          description: 'Optional: the size in bytes you know of the file.',
        },
        sha256: {
          type: 'string',
          description: 'Optional: the SHA-256 you know of the file, in lowercase hex.',
        },
      },
      [],
    ),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'discard_file_upload',
    title: 'Throw an upload away',
    description:
      'Throws away an upload that is not going to become a file — its parts, and the room it ' +
      'reserved — or dismisses a request the person has not fulfilled. Use it on an attempt you ' +
      'are giving up, so none is left open in Transfers; to hand an upload to the person instead, ' +
      'use request_file with that upload. Any upload open on a notebook may be thrown away, ' +
      "another agent's included: `list_file_uploads` says who opened each, what for and when its " +
      'last part arrived, which is what to decide on.',
    inputSchema: object(
      {
        upload: {
          type: 'string',
          description: 'The upload or request, as list_file_uploads answers it.',
        },
      },
      ['upload'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  },
  {
    name: 'list_files',
    title: 'List the files of a notebook',
    description:
      'Every file the notebook keeps, with the name a note addresses it by, what it is, its ' +
      'type, its size in bytes, its tags and where it sits. Read it before keeping one, so a note ' +
      'points at what is already there instead of a second copy of it. The size is what tells a ' +
      'file apart from another of a similar name: one already kept stands for the file the person ' +
      'sent only when its bytes match.',
    inputSchema: object({ notebook: notebookArgument }, ['notebook']),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'delete_file',
    title: 'Delete a file',
    description:
      'Deletes a file of the notebook. It is DEFINITIVE \u2014 there is no undo and no trash \u2014 its ' +
      'bytes are destroyed shortly after, and every note that showed it renders a pending ' +
      'reference from that instant. Its name is free again at once.',
    inputSchema: object(
      {
        notebook: notebookArgument,
        file: { type: 'string', description: 'File identifier, as list_files prints it.' },
      },
      ['notebook', 'file'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  },
  {
    name: 'list_tables',
    title: 'List the tables of a notebook',
    description:
      'Every Table the notebook keeps: its name, what it is for, its schema in JSON Schema, its ' +
      'key and how many rows it holds. Read it before creating a table, so rows go where a table ' +
      'for them already is, and before writing rows, so they fit the schema. The count of rows ' +
      'is kept as the rows are written and may take a moment to show the last write.',
    inputSchema: object({ notebook: notebookArgument }, ['notebook']),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'create_table',
    title: 'Create a table',
    description:
      `Creates a Table in the notebook: structured data a note shows through a query. Read the skill \`${KEEP_TABLES_SKILL}\` first. \`schema\` ` +
      'is JSON Schema: { "type": "object", "properties": { column: { "type": ... } }, "required": ' +
      '[...] }. A column is "string", "number", "integer", "boolean", { "type": "string", ' +
      '"format": "date" } (2026-10-29), { "type": "string", "format": "date-time" } or ' +
      '{ "type": "array", "items": { "type": "string" } }, and may take enum, default, ' +
      'description, minimum, maximum and maxLength. Nothing else is accepted, and what is ' +
      'refused is named. A column name is one word (letters, digits, _ and -), because a filter ' +
      'names it as column:value. `key` names the columns that identify a row, such as the date, ' +
      'description and amount of a bank statement, so writing the same rows again changes them ' +
      'instead of adding them twice; leave it out when rows have no identity of their own. ' +
      'Describe each column: the description is what the next agent reads to know what goes ' +
      'there. Show the person the schema before creating it.',
    inputSchema: object(
      {
        notebook: notebookArgument,
        name: { type: 'string', description: 'The name of the table, unique in the notebook.' },
        description: { type: 'string', description: 'What the table is for.' },
        schema: { type: 'object', description: 'The columns, in JSON Schema.' },
        key: {
          type: 'array',
          items: { type: 'string' },
          description: 'The columns that identify a row, when rows have an identity.',
        },
      },
      ['notebook', 'name', 'schema'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'alter_table',
    title: 'Change the schema of a table',
    description:
      'Changes a table with one or more changes, applied in order, all or none: ' +
      '{ "op": "rename-table", "to" }, { "op": "describe", "description" }, ' +
      '{ "op": "add-column", "name", "schema", "required"? }, { "op": "rename-column", "column", ' +
      '"to" }, { "op": "remove-column", "column" }, { "op": "change-column", "column", "schema", ' +
      '"required"? } and { "op": "set-key", "columns" } (null removes the key). A change never ' +
      'leaves a row invalid: converting a column, tightening a constraint, making a column ' +
      'required or setting a key happens only when every row fits, and otherwise nothing changes ' +
      'and the answer names the rows that do not fit, so you can fix them first. Removing a ' +
      'column removes its values from every row, for good. Renaming does not rewrite the notes ' +
      'that show the table.',
    inputSchema: object(
      {
        notebook: notebookArgument,
        table: tableArgument,
        changes: {
          type: 'array',
          items: { type: 'object' },
          description: 'The changes, in order.',
        },
      },
      ['notebook', 'table', 'changes'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  },
  {
    name: 'delete_table',
    title: 'Delete a table',
    description:
      'Deletes a table and every row it holds. It is DEFINITIVE — there is no undo and no ' +
      'trash — the rows are destroyed shortly after, and every note that shows the table says ' +
      'it is missing from that instant. Its name is free again at once. Say how many rows go ' +
      'before you ask the person to confirm.',
    inputSchema: object({ notebook: notebookArgument, table: tableArgument }, [
      'notebook',
      'table',
    ]),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  },
  {
    name: 'query_table',
    title: 'Read the rows of a table',
    description:
      'Reads the rows of a table, filtered, sorted and paged, each with its rowId and its values ' +
      'by column. `where` is the language of the search, where a field is a column: ' +
      '`status:paid`, `amount:>100`, `amount:30..200`, `date:2026-10` (October), ' +
      '`date:>=2026-10-01`, `-status:cancelled`, `a OR b`, and a bare word looks in every column ' +
      'that holds text, with case and accents ignored. A column the table does not have is ' +
      'refused, naming it. `sort` orders by up to five columns; pages hold up to 100 rows. ' +
      'This is how an agent reads the data a note shows: read_note returns the query as written. ' +
      '`aggregate` adds the rows the filter keeps up: { "group": "date:month", "measures": ' +
      '["sum(amount)", "count()"] } answers `groups`, each with its key and the value of each ' +
      'measure; a sum is exact. Group by a column or by a period of a date (day, week, month, ' +
      'quarter, year).',
    inputSchema: object(
      {
        notebook: notebookArgument,
        table: tableArgument,
        where: { type: 'string', description: 'The filter, in the language of the search.' },
        sort: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              column: { type: 'string' },
              direction: { type: 'string', enum: ['asc', 'desc'] },
            },
            required: ['column'],
          },
          description: 'The order, first column first. Insertion order when absent.',
        },
        page: { type: 'integer', minimum: 1, description: 'The page, from 1.' },
        pageSize: { type: 'integer', minimum: 1, maximum: 100, description: 'Rows per page; 25.' },
        aggregate: {
          type: 'object',
          properties: {
            group: { type: 'string', description: 'A column, or a period of a date: date:month.' },
            measures: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 6 },
          },
          required: ['measures'],
          description:
            'Adds the filtered rows up instead of listing them: measures count(), sum(col), ' +
            'avg(col), min(col), max(col), by group when given.',
        },
      },
      ['notebook', 'table'],
    ),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'insert_rows',
    title: 'Insert rows into a table',
    description:
      'Writes up to 50 rows into a table, each an object of values by column name, all or none: ' +
      'every value is checked against its column, a default fills what a row leaves out, and one ' +
      'row that does not fit refuses the call, naming it, and keeps nothing. A number travels ' +
      'as a JSON number, or as text when it carries more digits than a float holds; a date as ' +
      '2026-10-29. With mode "insert", a row whose key the table already holds is refused; with ' +
      '"upsert", that row is changed with the columns given and keeps the others, which is how ' +
      'the same statement read twice is written once. For more rows, call again; for a CSV or an ' +
      'Excel file, send the file and use import_table.',
    inputSchema: object(
      {
        notebook: notebookArgument,
        table: tableArgument,
        rows: {
          type: 'array',
          items: { type: 'object' },
          minItems: 1,
          maxItems: 50,
          description: 'The rows, each by column name.',
        },
        mode: {
          type: 'string',
          enum: ['insert', 'upsert'],
          description: 'insert, the default, or upsert.',
        },
      },
      ['notebook', 'table', 'rows'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'import_table',
    title: 'Import rows from a CSV or an Excel file',
    description:
      'Reads the rows of a CSV or an Excel workbook (.xlsx) the notebook keeps, by its name, `fileName`, as ' +
      'list_files prints it: the first line is the header, each line after it a row. With no ' +
      '`table`, or with `dryRun: true`, it writes NOTHING and answers the schema the sheet ' +
      'suggests, the column each header becomes and the first rows: show them to the person, ' +
      'then create_table and call this again with the table. With a table, every header must be ' +
      'one of its columns, and every line is checked before the first is written: one that does ' +
      'not fit refuses the whole file, naming its line. A CSV may be written in pt-BR: a ' +
      'semicolon between fields, 1.250,75 as a number and 29/10/2026 as a date. `sheet` picks a ' +
      'sheet of a workbook, the first one by default. `mode: "upsert"` changes the rows whose ' +
      'key the table already holds instead of refusing them. Keep the file first, as the skill ' +
      `\`${KEEP_FILES_SKILL}\` says, or ask the person for it with request_file.`,
    inputSchema: object(
      {
        notebook: notebookArgument,
        fileName: {
          type: 'string',
          description: 'The name of the kept file, as list_files prints it.',
        },
        table: tableArgument,
        sheet: { type: 'string', description: 'The sheet of a workbook; the first by default.' },
        mode: {
          type: 'string',
          enum: ['insert', 'upsert'],
          description: 'insert, the default, or upsert.',
        },
        dryRun: { type: 'boolean', description: 'true reads and proposes, and writes nothing.' },
      },
      ['notebook', 'fileName'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'update_rows',
    title: 'Update rows of a table',
    description:
      'Changes up to 50 rows, each named by its rowId, as query_table prints it, or by the values ' +
      'of its key: [{ "target": { "rowId" } | { "key": { column: value } }, "set": { column: ' +
      'value } }]. The columns set change and the others stay; null clears a column that is not ' +
      'required. A column of the key is never changed here, because the key names the row: ' +
      'delete the row and insert it again instead. All or none.',
    inputSchema: object(
      {
        notebook: notebookArgument,
        table: tableArgument,
        updates: { type: 'array', items: { type: 'object' }, minItems: 1, maxItems: 50 },
      },
      ['notebook', 'table', 'updates'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'delete_rows',
    title: 'Delete rows of a table',
    description:
      'Deletes up to 50 rows, each named by its rowId or by the values of its key: ' +
      '[{ "rowId" } | { "key": { column: value } }]. It is DEFINITIVE: the history keeps that ' +
      'the rows were deleted, by whom and when, and never what they held. All or none.',
    inputSchema: object(
      {
        notebook: notebookArgument,
        table: tableArgument,
        targets: { type: 'array', items: { type: 'object' }, minItems: 1, maxItems: 50 },
      },
      ['notebook', 'table', 'targets'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  },
  {
    name: 'list_dashboards',
    title: 'List the dashboards of a notebook',
    description:
      'Every Dashboard the notebook keeps, with what it is for and its definition: the layout, ' +
      'the filters and each component with the table it draws from. Read it before building one, ' +
      'so a dashboard that already shows the data is changed instead of copied.',
    inputSchema: object({ notebook: notebookArgument }, ['notebook']),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'create_dashboard',
    title: 'Create a dashboard',
    description:
      `Builds a Dashboard over the tables of the notebook. Read the skill \`${BUILD_DASHBOARDS_SKILL}\` ` +
      'first: it has the whole definition. In short: { "layout": one-column | two-columns | ' +
      'three-columns | header-two-columns | sidebar | grid, "refreshSeconds"?: 60 or more, ' +
      '"filters"?: [{ "id", "type": "period", "column": a date column, "default"?: "2026-10" }], ' +
      '"components": [{ "id", "type", "title"?, "slot" (or "grid": { x, y, w, h } on 12 ' +
      'columns), "source": { "table", "where"?, "group"?, "measure" | "measures" }, "options"? }] ' +
      '}. Types: kpi (one measure), pie, donut, bar, line, area (a group and measures), table ' +
      '(rows), gantt (options title, start, end), kanban (options lane, card) and text (options ' +
      'markdown). The definition is checked against the tables and refused naming what they ' +
      'cannot answer. A dashboard keeps no data: it shows what the tables hold when it is read. ' +
      'Look at it with preview_dashboard before you call it done.',
    inputSchema: object(
      {
        notebook: notebookArgument,
        name: { type: 'string', description: 'The name of the dashboard, unique in the notebook.' },
        description: { type: 'string', description: 'What the dashboard is for.' },
        definition: { type: 'object', description: 'The layout, filters and components.' },
      },
      ['notebook', 'name', 'definition'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'update_dashboard',
    title: 'Change a dashboard',
    description:
      'Changes the name, the description or the definition of a dashboard. A definition given ' +
      'replaces the one kept, whole: read it with list_dashboards, change it, and send it all. ' +
      'It is checked against the tables as a new one is.',
    inputSchema: object(
      {
        notebook: notebookArgument,
        dashboard: dashboardArgument,
        name: { type: 'string', description: 'A new name.' },
        description: { type: 'string', description: 'A new description.' },
        definition: {
          type: 'object',
          description: 'The whole definition, replacing the one kept.',
        },
      },
      ['notebook', 'dashboard'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'read_dashboard',
    title: 'Read what a dashboard shows',
    description:
      'What every component of a dashboard shows now: the value of an indicator, the groups of ' +
      'a chart, the rows of a table, a Gantt or a Kanban, computed from the tables at this ' +
      'moment. `filters` chooses a period for each filter of the dashboard, null for all. A ' +
      'component whose table is gone, or whose filter no longer fits, says so with its status.',
    inputSchema: object(
      {
        notebook: notebookArgument,
        dashboard: dashboardArgument,
        filters: {
          type: 'object',
          description: 'A period by filter id, as { "periodo": "2026-10" }.',
        },
      },
      ['notebook', 'dashboard'],
    ),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'delete_dashboard',
    title: 'Delete a dashboard',
    description:
      'Deletes a dashboard. It is DEFINITIVE, and its name is free again at once. Its tables and ' +
      'their rows are untouched: a dashboard only shows them.',
    inputSchema: object({ notebook: notebookArgument, dashboard: dashboardArgument }, [
      'notebook',
      'dashboard',
    ]),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  },
  {
    name: 'preview_dashboard',
    title: 'See how a dashboard is drawn',
    description:
      'Starts drawing a dashboard whole, as the person sees it on a computer, and answers a ' +
      '`preview` at once: get_preview answers the PNG once it is drawn, a few seconds later. ' +
      'Look at it after you build or change a dashboard, and fix what reads badly before you ' +
      'call it done: a chart squeezed into a narrow column, a Kanban with one lane, a title that ' +
      'says nothing.',
    inputSchema: object({ notebook: notebookArgument, dashboard: dashboardArgument }, [
      'notebook',
      'dashboard',
    ]),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'update_note',
    title: 'Update a note',
    description:
      'Replaces the body of a note. baseRevision is REQUIRED and must be the revision you read: ' +
      'if the note changed meanwhile, this fails with CONFLICT and returns the current content, ' +
      'so you can choose between redoing and merging. Blind overwrite is not accepted. This is ' +
      'also how a note is renamed: change the `name:` of its frontmatter. Pass message to say ' +
      'what you changed and why: it is recorded in the history of the note beside the instant ' +
      'and who wrote, and it is what a person reads there months later. ' +
      NOTICES_ANSWERED +
      ' ' +
      CONTEXT_ANSWERED,
    inputSchema: object(
      {
        notebook: notebookArgument,
        note: { type: 'string', description: 'Note identifier.' },
        content: { type: 'string', description: 'The new Markdown body.' },
        baseRevision: {
          type: 'string',
          description: 'The revision this edit is based on, as returned by read_note.',
        },
        message: {
          type: 'string',
          description: 'One line about this change, recorded in the history of the note. Optional.',
        },
        context: contextArgument,
      },
      ['notebook', 'note', 'content', 'baseRevision'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: true },
  },
  {
    name: 'reorder_note',
    title: 'Reorder a note',
    description:
      'Moves a note within its folder. The order is content: list_notes answers the notes in ' +
      'it, and it says where to start reading. Pass after: null to put the note first, or the ' +
      'identifier of the note it goes right after. Only the order changes: the note keeps its ' +
      'folder, its content and its history, and move_note is what takes it to another folder. ' +
      'Answers the notes of the folder in their new order. ' +
      'A folder that orders its notes by name refuses it: there a note appears by its name, and ' +
      'get_notebook_context says which folders do.',
    inputSchema: object(
      {
        notebook: notebookArgument,
        note: { type: 'string', description: 'Note identifier.' },
        after: afterNoteArgument,
      },
      ['notebook', 'note', 'after'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'move_note',
    title: 'Move a note to another folder',
    description:
      'Moves a note to another folder of the same notebook. It stays the same note: its ' +
      'identifier, its content and its whole history go with it, and note_history answers ' +
      'every revision it had, plus the move. Every link to it keeps working, because a link ' +
      'finds a note by its name and never by its folder. This is how a note changes folder — ' +
      'when a notebook moves its notes along a lifecycle, from a draft to what was published, ' +
      'for one — and never by creating a copy and deleting the original: deleting is ' +
      'definitive and takes the history with it. A destination that already holds a note of ' +
      'its name refuses the move, naming that note, and nothing changes. The note goes last ' +
      'in the destination unless you pass after; in a folder that orders its notes by name it ' +
      'appears by its name, wherever after puts it. A note already in that folder is refused: ' +
      'reorder_note moves it within its folder. Answers the note in its new folder and ' +
      'position. Declare the context of the destination folder as `context` to be told if it ' +
      'changed. ' +
      CONTEXT_ANSWERED,
    inputSchema: object(
      {
        notebook: notebookArgument,
        note: { type: 'string', description: 'Note identifier.' },
        folder: {
          type: 'string',
          description:
            'Folder the note moves to, of the same notebook, by the identifier ' +
            'get_notebook_context prints next to its name.',
        },
        after: {
          type: 'string',
          description:
            'Optional: identifier of a note of the destination folder this one goes right ' +
            'after, as list_notes prints it. Without it the note goes last there.',
        },
        context: contextArgument,
      },
      ['notebook', 'note', 'folder'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'delete_note',
    title: 'Delete a note',
    description:
      'Removes a note from the listings and from the search. It is DEFINITIVE: there is no undo ' +
      'and no trash, and the content itself is destroyed in the background shortly after. The ' +
      'links that pointed at it become pending rather than lost. Confirm with the person, naming ' +
      'the note, before calling it.',
    inputSchema: object(
      { notebook: notebookArgument, note: { type: 'string', description: 'Note identifier.' } },
      ['notebook', 'note'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  },
  {
    name: 'search_notes',
    title: 'Search notes by text',
    description:
      'Searches the text of a notebook: the body of every note, its name, its folder and its ' +
      'headings. Matching is literal and by substring, accents and case ignored, so a term ' +
      'written once inside one note is found by typing part of it. It does NOT search by ' +
      'meaning: a note that discusses a subject in other words will not come back. ' +
      'The query accepts: several terms (all must match), "an exact phrase", -exclusion, ' +
      'OR, parentheses, and the fields name:, folder:, content: and section:. ' +
      'Any other prefix is read as a frontmatter attribute of the notebook, so maturity:evergreen ' +
      'or tags:audit work when the notebook writes them; call get_notebook_context to learn which ' +
      'attributes this notebook actually uses.',
    inputSchema: object(
      {
        notebook: notebookArgument,
        query: {
          type: 'string',
          description: 'What to look for. Supports fields, quotes, -exclusion, OR and groups.',
        },
      },
      ['notebook', 'query'],
    ),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'related_notes',
    title: 'Read the dependency tree of a note',
    description:
      'Walks the link graph from a note and returns the tree of notes it depends on. In a ' +
      'regulated notebook this is the trail of grounding: which norms a finding rests on. Depth ' +
      'is capped at 3 and the traversal at 200 nodes.',
    inputSchema: object(
      {
        notebook: notebookArgument,
        note: { type: 'string', description: 'Note to start from.' },
        depth: { type: 'number', description: 'How many hops to follow, 1 to 3. Default 2.' },
      },
      ['notebook', 'note'],
    ),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'backlinks',
    title: 'List what points at a note',
    description:
      'Returns the notes that link to this one, which is how a notebook says what a note is used for.',
    inputSchema: object(
      { notebook: notebookArgument, note: { type: 'string', description: 'Note identifier.' } },
      ['notebook', 'note'],
    ),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'check_notebook',
    title: 'Check what a notebook left pending',
    description:
      'The sweep to run before saying a piece of work is done. Returns `pending`, every name ' +
      'the notebook links to that no note or file carries yet, each with the notes that link to ' +
      'it; `orphans`, the notes nothing links to; `unshownFiles`, the files kept that no note ' +
      'names; and `openUploads`, the uploads not finished and the files requested from the ' +
      'person. A pending link is fine on purpose: a note still to write, or a file the person ' +
      'was asked for, which it says as `waitingFor`. One with `likelyMeant` looks broken instead ' +
      '— it almost reaches a note or a file the notebook has, in another case, without its ' +
      'accents or as the start of a longer name — and the link is what to fix. A file no note ' +
      'shows may be kept on purpose: tell the person which. An upload left open is finished, ' +
      'handed to the person with request_file, or thrown away with discard_file_upload. ' +
      '`notices` lists, note by note, where the page will not show what was typed — a fence ' +
      'never closed, a heading that skips a level, a footnote with no definition — read from ' +
      'the most recently written notes, up to 200, with `noticesRead` saying how many were read ' +
      'of how many. `staleContext` lists the notes written against a context — guidance, ' +
      'template or structure — that had already changed when they were written: review each ' +
      'against the current one, and it leaves the list once rewritten declaring the current ' +
      'context. It is as recent as the link index, which follows a write within seconds, so ' +
      'right after the last write, run it again.',
    inputSchema: object({ notebook: notebookArgument }, ['notebook']),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'preview_note',
    title: 'See how a note is drawn',
    description:
      'Starts drawing a note, or a part of it, as the person will see it on the page, and ' +
      'answers a `preview` at once: get_preview answers the image once it is drawn, a few ' +
      'seconds later. Pass `note` for a note already written, or `content` for a draft not ' +
      'written yet — exactly one — with the `folder` it would be written in, so its links and ' +
      'embeds resolve against this notebook as they will once it is. Pass `part` for one ' +
      'section or block, as an embed addresses one: `#Section` or `#^block`. The image is ' +
      '760 pixels wide, the reading width, in the light theme, and at most 1600 high: ' +
      'preview a part rather than a long note. Use it to check what you cannot see from the ' +
      'Markdown — a table, a callout, a diagram, one form inside another — before handing the ' +
      'work over, or before writing a draft. It writes nothing in the notebook.',
    inputSchema: object(
      {
        notebook: notebookArgument,
        note: {
          type: 'string',
          description: 'Optional: the note to draw, as written. Pass this or content.',
        },
        content: {
          type: 'string',
          description: 'Optional: the Markdown of a draft to draw. Pass this or note.',
        },
        folder: {
          type: 'string',
          description:
            'Optional, with content: the folder the draft would be written in, as ' +
            'get_notebook_context prints it.',
        },
        part: {
          type: 'string',
          description: 'Optional: one section, `#Section`, or one block, `#^block`, alone.',
        },
      },
      ['notebook'],
    ),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'get_preview',
    title: 'See the image of a preview',
    description:
      'Answers the image preview_note started, once it is drawn: a PNG, and a line with the ' +
      'size it was drawn at and whether it was cut at 1600 pixels. While it is still being ' +
      'drawn it says so: ask again in a few seconds. When nothing could be drawn it says why ' +
      '— the note or the folder is not in the notebook, the part is not in the note. A client ' +
      'that does not show images to the model receives the line alone.',
    inputSchema: object(
      {
        notebook: notebookArgument,
        preview: { type: 'string', description: 'The preview, as preview_note answered it.' },
      },
      ['notebook', 'preview'],
    ),
    annotations: { readOnlyHint: true },
  },
  // ---- Notebook models (#353, #354, #359) ---------------------------------
  {
    name: 'declare_model',
    title: 'Declare a notebook as a model',
    description:
      'Declares a notebook of this subscription as a MODEL, from which other notebooks are ' +
      'created, or declares it again to change what it says of itself. Only the owner of the ' +
      'subscription may. A model is not a template: a template is the suggested shape of the ' +
      'notes of one folder, a model is a whole notebook to be copied. Write in the notebook ' +
      'itself `{{name}}` wherever a value goes, and declare each name here once, with what it ' +
      `is, an example, its type and whether it is required or what it defaults to. Read the skill ` +
      '`derive-model` first when the model comes from a notebook that worked, and `design-notebook` ' +
      'when it is designed from scratch. Answers the model and its versions.',
    inputSchema: object(
      {
        notebook: notebookArgument,
        objective: { type: 'string', description: 'What a notebook created from it is for.' },
        description: { type: 'string', description: 'Optional: what it holds, in one line.' },
        audience: { type: 'string', description: 'Optional: who it is for.' },
        parameters: {
          type: 'array',
          description:
            'Each value a notebook created from it fills in, by the name its `{{name}}` writes.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              example: { type: 'string' },
              type: { type: 'string', enum: ['text', 'list', 'boolean', 'date'] },
              required: { type: 'boolean' },
              default: {
                description:
                  'The value of one not required, of its type: a text, a list of texts, true or ' +
                  'false, or a date as YYYY-MM-DD. It may be empty: "" for a text or a date, [] for ' +
                  'a list, and an empty one writes nothing where the parameter stands.',
              },
            },
            required: ['name', 'type', 'required'],
            additionalProperties: false,
          },
        },
        basedOn: {
          type: ['string', 'null'],
          description: 'Optional credit to what it is based on, shown with it; never required.',
        },
      },
      ['notebook', 'objective'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'get_model',
    title: 'Read the model of a notebook',
    description:
      'What a notebook declared as a model says of itself — its objective, audience and ' +
      'parameters — and its versions, the newest first, each with its number, changelog and ' +
      'status. A model shared with this person from another subscription names its owner in ' +
      '`sharedBy`, and only its owner versions it. `licence` is `CC0-1.0` once the model was ' +
      'distributed: whoever receives it may reuse and republish it freely, the community ' +
      'included, so say so before the person shares one. A notebook that is no model answers ' +
      'NOT_FOUND.',
    inputSchema: object({ notebook: notebookArgument }, ['notebook']),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'list_models',
    title: 'List the models this person can use',
    description:
      'The notebooks of this subscription declared as models, and the models shared with this ' +
      'person from another subscription, which name their owner in `sharedBy`, each with its ' +
      'objective and parameters: what create_notebook_from_model can create a notebook from. A ' +
      'notebook created from a shared model is written in this subscription and counts here.',
    inputSchema: object({}),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'create_model_version',
    title: 'Create a version of a model',
    description:
      'Freezes the model notebook as it is now into its next version, 1, 2, …, with a ' +
      'changelog saying what changed since the last. A version never changes afterwards, ' +
      'counts once in the storage, and is what notebooks are created from. Only the owner of ' +
      'the subscription may, after reviewing the notebook with them. It is built in the ' +
      'background: get_model says when its status is ready, and read_model_version then shows ' +
      'exactly what it holds, and what it writes as `{{name}}` without declaring. The tables of ' +
      'the notebook go with their rows unless `tables` says otherwise: each named table with ' +
      '`rows: true` or with its schema alone, `rows: false`, and a table not named stays out. ' +
      'Rows that go are public once the model is published: ask the person.',
    inputSchema: object(
      {
        notebook: notebookArgument,
        changelog: { type: 'string', description: 'What changed since the last version.' },
        tables: {
          type: 'array',
          items: {
            type: 'object',
            properties: { name: { type: 'string' }, rows: { type: 'boolean' } },
            required: ['name', 'rows'],
          },
          description:
            'What the version carries of each table; every table with its rows when absent.',
        },
      },
      ['notebook'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'read_model_version',
    title: 'Read a version of a model whole',
    description:
      'Everything a version holds — its guidance, folders, templates, notes and files, its ' +
      'parameters and changelog — and `references`: the `{{name}}` it writes that no parameter ' +
      'declares, which a notebook created from it would keep, and the parameters nothing ' +
      'uses. Review it with the person before the version is shared.',
    inputSchema: object(
      {
        notebook: notebookArgument,
        version: { type: 'integer', description: 'The number of the version.' },
      },
      ['notebook', 'version'],
    ),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'delete_model_version',
    title: 'Delete a version of a model',
    description:
      'Deletes one version of a model and frees its storage. Notebooks already created from it ' +
      'are not touched. Only the owner of the subscription may; confirm with them first.',
    inputSchema: object(
      {
        notebook: notebookArgument,
        version: { type: 'integer', description: 'The number of the version.' },
      },
      ['notebook', 'version'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  },
  {
    name: 'create_notebook_from_model',
    title: 'Create a notebook from a model',
    description:
      'Creates an independent notebook of this subscription from a version of a model, with ' +
      'a value for each of its parameters, by name: one not given takes its default, and a ' +
      'required one missing, or a value not of its type, is refused before anything is ' +
      'written, naming each. Ask the person for the values first, using the description and ' +
      'example of each parameter. Every `{{name}}` is filled in; the new notebook depends on ' +
      'nothing of the model afterwards. It waits for the notebook to be written and answers ' +
      'its identifier, or the transfer to follow when it takes longer.',
    inputSchema: object(
      {
        notebook: { ...notebookArgument, description: 'The model, by its notebook identifier.' },
        version: {
          type: 'integer',
          description: 'The version to create from, usually the latest.',
        },
        name: {
          type: 'string',
          description: 'Optional: the name of the new notebook; the name of the model, filled in.',
        },
        values: {
          type: 'object',
          description: 'The value of each parameter, by its name.',
          additionalProperties: true,
        },
      },
      ['notebook', 'version', 'values'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'publish_model',
    title: 'Publish a model to the community',
    description:
      'Publishes a model of this subscription to the community catalog, where anybody, with ' +
      'an account or not, finds it and reads every version kept, and whoever signs in creates ' +
      'notebooks from it. Only the owner of the subscription publishes, and the model needs a ' +
      'ready version. Every distribution of a model is under CC0 1.0: anybody may reuse and ' +
      'republish it freely, so say so to the person and pass acceptLicence only once they ' +
      'agree. The catalog shows the name of their account, never the e-mail; a refusal with ' +
      'reason AUTHOR_NAME means they write their name in their profile first. Publishing again ' +
      'says the entry again. It answers what anybody will see of the model.',
    inputSchema: object(
      {
        notebook: { ...notebookArgument, description: 'The model, by its notebook identifier.' },
        language: {
          type: 'string',
          description: 'The language the model is written in, as a BCP 47 tag: pt-BR, en.',
        },
        acceptLicence: {
          type: 'boolean',
          description: 'True once the person accepted CC0 1.0 for this model.',
        },
      },
      ['notebook', 'language'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'withdraw_model',
    title: 'Withdraw a model from the community',
    description:
      'Withdraws a published model from the community catalog. The model and its versions ' +
      'stay in this subscription, and nothing anybody created from it is touched; what was ' +
      'already copied stays with whoever copied it.',
    inputSchema: object(
      { notebook: { ...notebookArgument, description: 'The model, by its notebook identifier.' } },
      ['notebook'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  },
  {
    name: 'search_community_models',
    title: 'Search the community models',
    description:
      'Finds the models published to the community, by every word given in their name, ' +
      'objective, description, audience or author, and by language. Each answers its public ' +
      'identifier, what it is for, its author, its parameters and its versions. Offer one ' +
      'before designing a notebook from scratch, when it fits what the person wants.',
    inputSchema: object({
      query: { type: 'string', description: 'Optional: words to find.' },
      language: { type: 'string', description: 'Optional: a BCP 47 tag, such as pt or en.' },
    }),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'read_community_model',
    title: 'Read a community model',
    description:
      'A model published to the community, by its public identifier: what it is for, who it ' +
      'is for, its author and credit, its parameters, and every version its author keeps, the ' +
      'newest first, each with its number, date and changelog.',
    inputSchema: object(
      { model: { type: 'string', description: 'The public identifier of the model.' } },
      ['model'],
    ),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'read_community_version',
    title: 'Read a version of a community model',
    description:
      'A version of a published model, whole: its Guidance, every folder with its Template, ' +
      'every note and the files it keeps, with `{{name}}` where a value goes. Read it with the ' +
      'person before creating a notebook from it.',
    inputSchema: object(
      {
        model: { type: 'string', description: 'The public identifier of the model.' },
        version: { type: 'integer', description: 'The number of the version.' },
      },
      ['model', 'version'],
    ),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'create_notebook_from_community_model',
    title: 'Create a notebook from a community model',
    description:
      'Creates an independent notebook of this subscription from a version of a model ' +
      'published to the community, with a value for each of its parameters, by name, as ' +
      'create_notebook_from_model does; it is written and counted here, and depends on ' +
      'nothing of the model afterwards. Ask the person for the values first.',
    inputSchema: object(
      {
        model: { type: 'string', description: 'The public identifier of the model.' },
        version: {
          type: 'integer',
          description: 'The version to create from, usually the latest.',
        },
        name: {
          type: 'string',
          description: 'Optional: the name of the new notebook; the name of the model, filled in.',
        },
        values: {
          type: 'object',
          description: 'The value of each parameter, by its name.',
          additionalProperties: true,
        },
      },
      ['model', 'version', 'values'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'note_history',
    title: 'Read the history of a note',
    description:
      'The timeline of a note: who changed it, when, and with which agent. It survives the ' +
      'note moving to another folder, because it is keyed by the note identifier. It ' +
      'answers a list of entries, each with occurredAt, type, userId, agentName, ' +
      'agentClientId (null for a write the person made without a connector) and revision ' +
      '(null for an event that wrote no content), which read_note takes as asOf. A person ' +
      'editing in the interface saves as they type, so a run of saves of one edit session is ' +
      'one entry of type EditSession, with its session, saves, startedAt, occurredAt and its ' +
      'revisions, each a revision of its own that read_note takes as asOf.',
    inputSchema: object(
      { notebook: notebookArgument, note: { type: 'string', description: 'Note identifier.' } },
      ['notebook', 'note'],
    ),
    annotations: { readOnlyHint: true },
  },
];

/**
 * What every tool that writes in a notebook says of a shared one (RN-AGT-054):
 * said once here and appended, so no write tool can be added without it.
 */
const SHARED_REFUSAL =
  ' A notebook shared with this person from another subscription refuses what its access does ' +
  'not allow with FORBIDDEN, naming its owner: list_notebooks says which notebooks are shared ' +
  'and with which access.';

function writesInANotebook(tool: ToolDefinition): boolean {
  const writes =
    tool.annotations.readOnlyHint === false || tool.annotations.destructiveHint === true;
  const properties =
    (tool.inputSchema as { properties?: Record<string, unknown> }).properties ?? {};
  return writes && 'notebook' in properties;
}

export const TOOL_CATALOG: readonly ToolDefinition[] = DEFINITIONS.map((tool) =>
  writesInANotebook(tool) ? { ...tool, description: tool.description + SHARED_REFUSAL } : tool,
);

/** The arguments a tool declares, in the order it declares them, and the required ones. */
export function argumentsOf(tool: ToolDefinition): { names: string[]; required: Set<string> } {
  const properties = tool.inputSchema['properties'];
  const required = tool.inputSchema['required'];
  return {
    names: typeof properties === 'object' && properties !== null ? Object.keys(properties) : [],
    required: new Set(Array.isArray(required) ? required.map(String) : []),
  };
}

/**
 * A tool as a model compares it against its own list (RN-AGT-047):
 * `update_note(notebook, note, content, baseRevision, message?)`, an optional
 * argument marked by `?`. A whole schema per tool would cost every `whoami`
 * thousands of tokens, and a hash is something a model cannot compute over the
 * list it holds.
 */
export function toolSignature(tool: ToolDefinition): string {
  const { names, required } = argumentsOf(tool);
  return `${tool.name}(${names.map((name) => (required.has(name) ? name : `${name}?`)).join(', ')})`;
}

/**
 * The version of the catalogue: a short hash of the name, the description and
 * the arguments of every tool, so it changes with anything a client keeps of
 * the list, and with nothing else.
 */
export const CATALOG_VERSION = createHash('sha256')
  .update(
    JSON.stringify(
      TOOL_CATALOG.map(({ name, description, inputSchema }) => [name, description, inputSchema]),
    ),
  )
  .digest('hex')
  .slice(0, 8);

/**
 * The reading path this product is built around, as tool names.
 *
 * It is declared here, next to the catalog, because `whoami` narrates it and a
 * narration that names a tool nobody implements is worse than no help at all.
 * `catalogIsWellFormed` checks that every step exists, so a rename breaks the
 * build instead of shipping a lie.
 */
export const READING_PATH = [
  'list_notebooks',
  'get_notebook_context',
  'get_template',
  'create_note',
] as const;

/** No tool enters the catalog without a title and a hint (RN-AGT-009). */
export function catalogIsWellFormed(): boolean {
  const named = new Set(TOOL_CATALOG.map((tool) => tool.name));
  return (
    TOOL_CATALOG.every(
      (tool) =>
        tool.title.length > 0 &&
        (tool.annotations.readOnlyHint !== undefined ||
          tool.annotations.destructiveHint !== undefined),
    ) && READING_PATH.every((step) => named.has(step))
  );
}
