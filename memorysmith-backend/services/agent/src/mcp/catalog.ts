/**
 * THE TOOL CATALOG IS THE PUBLIC CONTRACT OF THE PRODUCT
 * (software-vision.md, section 9.1). The internal API exists to serve the UI;
 * it is this surface that external clients consume, and it is this surface the
 * versioning policy protects.
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

import { DESIGN_NOTEBOOK_SKILL } from './skills.js';

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

function object(
  properties: Record<string, unknown>,
  required: string[] = [],
): Record<string, unknown> {
  return { type: 'object', properties, required, additionalProperties: false };
}

export const TOOL_CATALOG: readonly ToolDefinition[] = [
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
      'and every notebook tool takes its identifier from this list. Call whoami before it: ' +
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
      `BEFORE calling it, read the skill \`${DESIGN_NOTEBOOK_SKILL}\` with get_skill and confirm ` +
      'with the person the structure you propose: its guidance, folders and templates follow ' +
      'from what the notebook will hold, and a notebook created before that gets a structure ' +
      'nobody chose. Then write its guidance with set_guidance: a notebook without guidance ' +
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
      'Removes a notebook from every listing. It is REVERSIBLE and destroys nothing: the folders, ' +
      'the notes and every past revision stay exactly where they are, and the history remains ' +
      'readable. Only the owner of the subscription may do this, and it takes the whole notebook ' +
      'out of reach at once, so confirm with the person before calling it.',
    inputSchema: object({ notebook: notebookArgument }, ['notebook']),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  },
  {
    name: 'get_notebook_context',
    title: 'Read the notebook context',
    description:
      'THE MAIN CALL. Returns the guidance of the notebook in full, followed by its folder tree ' +
      'with the identifier of each folder, its description, the defined order, the note count ' +
      'and which folders carry a template. Read this before writing anything: the guidance ' +
      'declares the conventions of this notebook, the folder descriptions say what belongs where, ' +
      'and the identifiers are what you pass to get_template, create_note and list_notes.',
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
      'after; reorder_folder changes the order later.',
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
    name: 'delete_folder',
    title: 'Delete a folder',
    description:
      'Removes a folder from the tree of a notebook. There is NO implicit policy: with ' +
      'REJECT_IF_NOT_EMPTY a folder that holds subfolders or notes is refused, and with CASCADE ' +
      'the whole subtree goes and every note in it is deleted, as delete_note deletes one. A ' +
      'subtree holding more than 200 notes is refused: remove its subfolders one at a time. A ' +
      'note deleted this way cannot be restored, because its folder is gone. Call ' +
      'get_notebook_context first to see what the folder holds, and confirm with the person ' +
      'before cascading.',
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
    name: 'list_notes',
    title: 'List notes',
    description:
      'Index of the notes of a notebook, or of a single folder, in the ORDER DEFINED by whoever ' +
      'authored the notebook. The order is content, not decoration: it says where to start.',
    inputSchema: object(
      {
        notebook: notebookArgument,
        folder: {
          type: 'string',
          description:
            'Optional: restrict to one folder, by the identifier get_notebook_context prints.',
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
      'string to pass back unchanged as baseRevision when you edit it. With asOf, returns ' +
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
      'holds. THIS TOOL ALWAYS CREATES: calling it twice writes two notes, because ' +
      'a notebook may hold two notes with one name, so a retry after a transport failure is NOT ' +
      'safe. Read the note back before retrying. The note goes last in its folder unless you ' +
      'pass after.',
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
      },
      ['notebook', 'folder', 'content'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'update_note',
    title: 'Update a note',
    description:
      'Replaces the body of a note. baseRevision is REQUIRED and must be the revision you read: ' +
      'if the note changed meanwhile, this fails with CONFLICT and returns the current content, ' +
      'so you can choose between redoing and merging. Blind overwrite is not accepted. This is ' +
      'also how a note is renamed: change the `name:` of its frontmatter.',
    inputSchema: object(
      {
        notebook: notebookArgument,
        note: { type: 'string', description: 'Note identifier.' },
        content: { type: 'string', description: 'The new Markdown body.' },
        baseRevision: {
          type: 'string',
          description: 'The revision this edit is based on, as returned by read_note.',
        },
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
      'folder, its content and its history. Answers the notes of the folder in their new order.',
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
    name: 'delete_note',
    title: 'Delete a note',
    description:
      'Removes a note from the listings and from the search. It is REVERSIBLE and destroys no ' +
      'byte: the history of the note stays readable by its identifier, and the links that ' +
      'pointed at it become pending rather than lost.',
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
    name: 'note_history',
    title: 'Read the history of a note',
    description:
      'The timeline of a note: who changed it, when, and with which agent. It survives the ' +
      'note changing folder and notebook, because it is keyed by the note identifier. It ' +
      'answers a list of entries, each with occurredAt, type, userId, agentName, ' +
      'agentClientId (null for a write the person made without a connector) and revision ' +
      '(null for an event that wrote no content), which read_note takes as asOf.',
    inputSchema: object(
      { notebook: notebookArgument, note: { type: 'string', description: 'Note identifier.' } },
      ['notebook', 'note'],
    ),
    annotations: { readOnlyHint: true },
  },
];

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
