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

import { DESIGN_NOTEBOOK_SKILL, KEEP_FILES_SKILL } from './skills.js';

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
      'which also names its owner and the access the share grants — with `read`, every write ' +
      'in it is refused. Call whoami before it: ' +
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
      'name. The note goes last in its folder unless you pass after.',
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
    name: 'keep_file',
    title: 'Keep a file in a notebook',
    description:
      'Keeps a file in the notebook so a note can show it: write `![[name]]` in the note and ' +
      'the page draws it. The NAME is what a note addresses, and it is a name like any other ' +
      '\u2014 an extension is yours to write or to leave out, and it decides nothing. What decides ' +
      'how the file is drawn, and whether it may be kept at all, is mimeType: an image, an ' +
      'audio and a video are drawn on the page, and everything else is a card with a download. ' +
      'The bytes travel inline, base64, in this one call, so it suits a file small enough to ' +
      'write out whole without a slip \u2014 a few kilobytes. A photo, a recording or a document ' +
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
            'video/quicktime, and the three Office documents (docx, xlsx, pptx).',
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
        contentBase64: { type: 'string', description: 'The bytes of the file, base64.' },
      },
      ['notebook', 'name', 'mimeType', 'contentBase64'],
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
    name: 'update_note',
    title: 'Update a note',
    description:
      'Replaces the body of a note. baseRevision is REQUIRED and must be the revision you read: ' +
      'if the note changed meanwhile, this fails with CONFLICT and returns the current content, ' +
      'so you can choose between redoing and merging. Blind overwrite is not accepted. This is ' +
      'also how a note is renamed: change the `name:` of its frontmatter. Pass message to say ' +
      'what you changed and why: it is recorded in the history of the note beside the instant ' +
      'and who wrote, and it is what a person reads there months later.',
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
      'handed to the person with request_file, or thrown away with discard_file_upload. It is as ' +
      'recent as the link index, which follows a write within seconds, so right after the last ' +
      'write, run it again.',
    inputSchema: object({ notebook: notebookArgument }, ['notebook']),
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
 * What every tool that writes in a notebook says of a shared one (RN-AGT-046):
 * said once here and appended, so no write tool can be added without it.
 */
const SHARED_REFUSAL =
  ' A notebook shared with this person from another subscription with `read` access refuses ' +
  'this with FORBIDDEN, naming its owner: list_notebooks says which notebooks are shared and ' +
  'with which access.';

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
