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

const vaultArgument = {
  type: 'string',
  description: 'Identifier of the vault, as returned by list_vaults.',
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
      'itself, the subscription the token is fixed to and the vaults within reach, and then ' +
      'it lays out the reading path: the guidance of a vault, the folder tree with the ' +
      'purpose of each folder, and the template of the folder you are about to write in. ' +
      'Call it first when you do not know this vault yet.',
    inputSchema: object({}),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'list_vaults',
    title: 'List vaults',
    description:
      'Lists the vaults this connector can reach, with their description and note count. ' +
      'Start here: every other tool takes a vault identifier from this list.',
    inputSchema: object({}),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'get_vault_context',
    title: 'Read the vault context',
    description:
      'THE MAIN CALL. Returns the guidance of the vault in full, followed by its folder tree ' +
      'with the description, the defined order, the note count and which folders carry a ' +
      'template. Read this before writing anything: the guidance declares the conventions of ' +
      'this vault, and the folder descriptions say what belongs where.',
    inputSchema: object({ vault: vaultArgument }, ['vault']),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'get_template',
    title: 'Read the folder template',
    description:
      'Returns the template of a folder, which is the suggested layout of the notes kept ' +
      'there. Call this before create_note whenever the folder has one; the server does not ' +
      'validate content against it, so following it is what keeps the vault coherent.',
    inputSchema: object(
      { vault: vaultArgument, folder: { type: 'string', description: 'Folder identifier.' } },
      ['vault', 'folder'],
    ),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'list_notes',
    title: 'List notes',
    description:
      'Index of the notes of a vault, or of a single folder, in the ORDER DEFINED by whoever ' +
      'authored the vault. The order is content, not decoration: it says where to start.',
    inputSchema: object(
      {
        vault: vaultArgument,
        folder: { type: 'string', description: 'Optional: restrict to one folder.' },
      },
      ['vault'],
    ),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'read_note',
    title: 'Read a note',
    description:
      'Returns the complete Markdown of a note and its current revision. With asOf, returns ' +
      'the revision that was in force on that date, rebuilt from the audit trail, which is ' +
      'what lets a past piece of work be redone against the base as it stood then.',
    inputSchema: object(
      {
        vault: vaultArgument,
        note: { type: 'string', description: 'Note identifier.' },
        asOf: {
          type: 'string',
          description: 'Optional ISO 8601 date. Returns the revision in force at that moment.',
        },
      },
      ['vault', 'note'],
    ),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'create_note',
    title: 'Create a note',
    description:
      'Creates a note in a folder. Read get_template for that folder first. If a note with ' +
      'the same slug already exists, this fails with ALREADY_EXISTS and returns the identifier ' +
      'of the existing note: no second note is ever created and no suffix is ever invented, so ' +
      'a retry is safe.',
    inputSchema: object(
      {
        vault: vaultArgument,
        folder: { type: 'string', description: 'Folder that will hold the note.' },
        title: { type: 'string', description: 'Title; the slug is derived from it.' },
        content: { type: 'string', description: 'The Markdown body of the note.' },
      },
      ['vault', 'folder', 'title', 'content'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'update_note',
    title: 'Update a note',
    description:
      'Replaces the body of a note. baseRevision is REQUIRED and must be the revision you read: ' +
      'if the note changed meanwhile, this fails with CONFLICT and returns the current content, ' +
      'so you can choose between redoing and merging. Blind overwrite is not accepted.',
    inputSchema: object(
      {
        vault: vaultArgument,
        note: { type: 'string', description: 'Note identifier.' },
        content: { type: 'string', description: 'The new Markdown body.' },
        baseRevision: {
          type: 'string',
          description: 'The revision this edit is based on, as returned by read_note.',
        },
      },
      ['vault', 'note', 'content', 'baseRevision'],
    ),
    annotations: { readOnlyHint: false, destructiveHint: true },
  },
  {
    name: 'search_notes',
    title: 'Search notes by title',
    description:
      'Lexical search over the titles and folders of a vault. It matches how a note is named ' +
      'and where it sits, not what it says: to find a note by subject, walk the link graph ' +
      'with related_notes or browse the folder with list_notes.',
    inputSchema: object(
      { vault: vaultArgument, query: { type: 'string', description: 'What to look for.' } },
      ['vault', 'query'],
    ),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'related_notes',
    title: 'Read the dependency tree of a note',
    description:
      'Walks the link graph from a note and returns the tree of notes it depends on. In a ' +
      'regulated vault this is the trail of grounding: which norms a finding rests on. Depth ' +
      'is capped at 3 and the traversal at 200 nodes.',
    inputSchema: object(
      {
        vault: vaultArgument,
        note: { type: 'string', description: 'Note to start from.' },
        depth: { type: 'number', description: 'How many hops to follow, 1 to 3. Default 2.' },
      },
      ['vault', 'note'],
    ),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'backlinks',
    title: 'List what points at a note',
    description:
      'Returns the notes that link to this one, which is how a vault says what a note is used for.',
    inputSchema: object(
      { vault: vaultArgument, note: { type: 'string', description: 'Note identifier.' } },
      ['vault', 'note'],
    ),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'note_history',
    title: 'Read the history of a note',
    description:
      'The timeline of a note: who changed it, when, and with which agent. It survives the ' +
      'note changing folder and vault, because it is keyed by the note identifier.',
    inputSchema: object(
      { vault: vaultArgument, note: { type: 'string', description: 'Note identifier.' } },
      ['vault', 'note'],
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
  'list_vaults',
  'get_vault_context',
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
