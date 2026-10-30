/**
 * McpToolAdapter: the anticorruption layer of the Agent Access context.
 *
 * It translates a tool call into a use case command and back, forwarding the
 * caller's own token, from which the core resolves the Authorship (INV-07). No
 * MCP vocabulary crosses into the core, and no core vocabulary
 * leaks out untranslated.
 *
 * Errors are answered as `isError` with ACTIONABLE text, and a missing
 * argument comes back with the signature the tool is served with, which is
 * what the caller needs to try again (RN-AGT-003).
 */

import {
  groupHistory,
  ulidSchema,
  type Deployment,
  type PreviewDto,
  type TransferDto,
  type UploadStatusDto,
  type NoteOrder,
} from '@memorysmithapp/contracts';
import { argumentsOf, CATALOG_VERSION, TOOL_CATALOG, toolSignature } from './catalog.js';
import { refreshSteps } from './refresh.js';
import { PRODUCTION_DEFAULT } from './environment.js';
import { whoAmI } from './whoami.js';
import { noticesOf, type NoteNotice } from './notices.js';
import { DESIGN_NOTEBOOK_SKILL, SKILLS, skillNamed } from './skills.js';
import {
  GatewayError,
  type AccessGateway,
  type AgentCaller,
  type AuditGateway,
  type DiscoveryGateway,
  type HistoryEntry,
  type KnowledgeGateway,
  type NoteContent,
  type NoteContextRevisions,
  type NotebookListing,
  type RelatedNode,
  type ShareAccessName,
} from './gateway.js';

/**
 * What a result carries: text, and an image where a tool answers one (#260).
 * An image is base64 with its type, as MCP declares it; a client that does not
 * hand images to its model keeps the text beside it.
 */
export type ToolContent =
  | { readonly type: 'text'; readonly text: string }
  | {
      readonly type: 'image';
      readonly data: string;
      readonly mimeType: string;
      /** Never set: an image has no text, and reading one beside the text answers nothing. */
      readonly text?: undefined;
    };

export interface ToolResult {
  readonly content: ToolContent[];
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

/**
 * The arguments that carry an identifier, in every tool that takes one. Each
 * is read in either case and passed on in its canonical form (#247), and a
 * value that is not an identifier is refused the same way by every tool,
 * before any service is asked (#248): one tool answering "not found" where the
 * others answer "not an identifier" sent an agent after a notebook it had.
 */
const IDENTIFIER_ARGUMENTS = [
  'notebook',
  'folder',
  'note',
  'file',
  'upload',
  'parent',
  'after',
  'preview',
];

function canonicalIdentifiers(
  args: Record<string, unknown>,
  tool: string,
): Record<string, unknown> {
  const canonical = { ...args };
  for (const name of IDENTIFIER_ARGUMENTS) {
    const value = args[name];
    if (typeof value !== 'string' || value.length === 0) continue;
    const parsed = ulidSchema.safeParse(value);
    if (!parsed.success) {
      throw new GatewayError(
        'VALIDATION',
        `${tool}: "${name}" is not an identifier: "${value}". An identifier is the 26 ` +
          'characters list_notebooks, get_notebook_context, list_notes, list_files, ' +
          'list_file_uploads and preview_note answer, in either case.',
      );
    }
    canonical[name] = parsed.data;
  }
  return canonical;
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

/** How a folder orders its notes: one of the two, or a refusal saying which they are. */
function noteOrderArgument(args: Record<string, unknown>, tool: string): NoteOrder {
  const value = args['noteOrder'];
  if (value === 'manual' || value === 'alphabetical') return value;
  throw new GatewayError('VALIDATION', `${tool} takes noteOrder as "manual" or "alphabetical".`, {
    noteOrder: value ?? null,
  });
}

/**
 * The revision a write is based on. Null is a legitimate value and means the
 * slot is empty, so it cannot be defaulted away: a missing argument is a
 * mistake worth an error, and an explicit null is an assertion about the
 * current state (RN-KNW-034).
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

/**
 * An argument that may be left out, but not given empty: an empty name or
 * description is a mistake to say, never a change to make.
 */
function changedText(
  args: Record<string, unknown>,
  name: string,
  tool: string,
): string | undefined {
  const value = args[name];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new GatewayError('VALIDATION', `${tool} takes "${name}" as text that is not empty.`, {
      [name]: value ?? null,
    });
  }
  return value;
}

/** Where a folder moves: under a folder, to the top of the tree with null, or nowhere. */
function parentArgument(args: Record<string, unknown>): string | null | undefined {
  const value = args['parent'];
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string' || value.length === 0) {
    throw new GatewayError(
      'VALIDATION',
      'update_folder takes "parent" as the identifier of a folder, or null for the top of the tree.',
      { parent: value },
    );
  }
  return value;
}

/** On a creation the anchor is optional, and without one the item goes last. */
/** A whole number the tool cannot do without, such as the size of a file. */
function requireInteger(args: Record<string, unknown>, name: string, tool: string): number {
  const value = args[name];
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    const definition = TOOL_CATALOG.find((each) => each.name === tool);
    throw new GatewayError('VALIDATION', `${tool} requires "${name}" as a whole number.`, {
      expected: definition?.inputSchema,
    });
  }
  return value;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/**
 * What an upload answers, in the words the agent acts on (RN-PRT-027): what
 * is missing, and where each missing part goes when it goes by URL.
 */
function uploadAnswer(status: UploadStatusDto, next: string): ToolResult {
  const upload = status.transfer.upload;
  return json({
    upload: status.transfer.transferId,
    name: status.transfer.fileName,
    notebook: status.transfer.notebookId,
    transport: upload?.transport,
    partSize: upload?.partSize,
    partCount: upload?.partCount,
    received: upload?.received ?? [],
    missing: status.missing,
    ...(status.targets.length > 0
      ? {
          // The host every part goes to, which a client that allows hosts one
          // by one has to be told about (#241, #243).
          partsHost: hostOf(status.targets[0]?.url ?? ''),
          targets: status.targets,
          targetsExpireAt: status.expiresAt,
        }
      : {}),
    next,
  });
}

/**
 * An upload or a request as the connector lists it: who opened it, what for and
 * how far it got — what deciding to finish, hand over or throw it away takes.
 */
function openUploadOf(each: TransferDto): Record<string, unknown> {
  if (each.kind === 'request') {
    return {
      upload: each.transferId,
      kind: 'request',
      name: each.fileName,
      notebook: each.notebookId,
      notebookName: each.notebookName,
      status: each.status,
      waitingFor: 'person',
      purpose: each.request?.purpose,
      mimeType: each.request?.mimeType,
      openedBy: each.request?.platform ?? null,
      expectedSize: each.request?.expectedSize ?? null,
      startedAt: each.requestedAt,
    };
  }
  return {
    upload: each.transferId,
    kind: 'upload',
    name: each.fileName,
    notebook: each.notebookId,
    notebookName: each.notebookName,
    status: each.status,
    failure: each.failure,
    size: each.bytes,
    sha256: each.upload?.sha256,
    purpose: each.upload?.purpose,
    openedBy: each.upload?.platform ?? null,
    transport: each.upload?.transport,
    partCount: each.upload?.partCount,
    received: each.upload?.received ?? [],
    startedAt: each.requestedAt,
    lastPartAt: each.upload?.lastPartAt ?? null,
  };
}

/** An argument that may be left out, which is most of what a file carries. */
function optionalString(args: Record<string, unknown>, name: string): string | undefined {
  const value = args[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * The types whose bytes are text, which `keep_file` takes as `content` (#309).
 * An agent with no code writes base64 by hand, and a round of the evaluation
 * kept a 669-byte drawing as 678 bytes that way: copying characters it already
 * holds is what it does without a slip, encoding them is not.
 */
const TEXT_FILE_TYPES: ReadonlySet<string> = new Set(['image/svg+xml', 'text/csv']);

/** The bytes of keep_file, base64, from exactly one of `content` and `contentBase64`. */
function keptBytes(args: Record<string, unknown>, mimeType: string): string {
  const text = args['content'];
  const encoded = args['contentBase64'];
  const hasText = typeof text === 'string' && text.length > 0;
  const hasEncoded = typeof encoded === 'string' && encoded.length > 0;
  if (hasText === hasEncoded) {
    throw new GatewayError(
      'VALIDATION',
      'keep_file takes the bytes once: as "content", the text of an SVG, or as "contentBase64".',
    );
  }
  if (hasText) {
    if (!TEXT_FILE_TYPES.has(mimeType.trim().toLowerCase())) {
      throw new GatewayError(
        'VALIDATION',
        `"content" is the text of a file whose type is text (${[...TEXT_FILE_TYPES].join(', ')}); ` +
          `the bytes of ${mimeType} travel as "contentBase64".`,
      );
    }
    // Exactly the characters written, as UTF-8: nothing trimmed, no line ending changed.
    return Buffer.from(text, 'utf8').toString('base64');
  }
  return encoded as string;
}

/**
 * The Tables of the notebook, in its context (#366): what an agent has to know
 * exists before it writes, so rows go where a table for them already is and a
 * note shows a table rather than copying it. Nothing when there are none.
 */
function tablesSection(
  tables: ReadonlyArray<{
    name: string;
    description: string;
    schema: Record<string, unknown>;
    key: string[] | null;
    rows: number;
  }>,
): string {
  if (tables.length === 0) return '';
  const lines = tables.map((table) => {
    const columns = Object.keys((table.schema['properties'] as Record<string, unknown>) ?? {});
    const key = table.key ? `; key ${table.key.join(', ')}` : '';
    const about = table.description ? ` \u2014 ${table.description}` : '';
    return `- **${table.name}**${about} (${table.rows} rows; columns ${columns.join(', ')}${key})`;
  });
  return [
    '## Tables',
    '',
    'Structured data this notebook keeps. Read the rows with query_table; list_tables gives each schema.',
    '',
    ...lines,
  ].join('\n');
}

/** An array argument a tool requires, refused by name when it is missing. */
function requireArray(args: Record<string, unknown>, name: string, tool: string): unknown[] {
  const value = args[name];
  if (!Array.isArray(value) || value.length === 0) {
    throw new GatewayError('VALIDATION', `${tool} requires "${name}", a list of at least one.`);
  }
  return value;
}

/** What a write of rows answers, in words and by row (#366). */
function rowsWritten(written: {
  operationId: string;
  inserted: string[];
  updated: string[];
  deleted: string[];
}) {
  return {
    operationId: written.operationId,
    inserted: written.inserted.length,
    updated: written.updated.length,
    deleted: written.deleted.length,
    rowIds: [...written.inserted, ...written.updated, ...written.deleted],
  };
}

function optionalStrings(args: Record<string, unknown>, name: string): string[] | undefined {
  const value = args[name];
  return Array.isArray(value) ? value.map((each) => String(each)) : undefined;
}

function optionalAnchor(args: Record<string, unknown>): string | undefined {
  const value = args['after'];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Why a preview drew nothing, in the words an agent acts on (RN-AGT-050).
 */
const PREVIEW_FAILURES: Readonly<Record<string, string>> = {
  NOT_FOUND:
    'the note, or the folder of the draft, is not in this notebook, or not one this ' +
    'connection reads. Check the identifier with list_notes or get_notebook_context.',
  PART_NOT_FOUND:
    'the note holds no such part. A section is addressed by the text of its heading, ' +
    '`#Section`; a block by the identifier written at its end, `#^block`.',
  SESSION:
    'the page could not be opened as the person, because the session of this connection ' +
    'ended. Start the preview again; if it repeats, the person reconnects the connector.',
  TIMED_OUT: 'the page was not drawn in time. Start the preview again with preview_note.',
};

/**
 * A preview drawn (#260, RN-AGT-050): the image, and one line with the size it
 * was drawn at and whether it was cut — which is what a client that shows the
 * model no image still gets.
 */
function previewAnswer(preview: PreviewDto): ToolResult {
  if (preview.status === 'running') {
    return text(
      `The preview ${preview.previewId} is still being drawn. Ask again with get_preview in a ` +
        'few seconds: a drawing takes from 3 to 15 seconds, more the first time in a while.',
    );
  }
  const image = preview.image;
  if (preview.status === 'failed' || !image) {
    const failure = preview.failure ?? 'FAILED';
    return text(
      `${failure}: nothing was drawn: ` +
        (PREVIEW_FAILURES[failure] ?? 'the drawing failed. Start it again with preview_note.'),
      true,
    );
  }
  const line = image.cut
    ? `Drawn at ${image.width}×${image.drawnHeight} px and cut at ${image.height}: the image ` +
      `shows the top ${image.width}×${image.height}. Preview a part, \`#Section\` or ` +
      '`#^block`, to see the rest.'
    : `Drawn at ${image.width}×${image.height} px.`;
  return {
    content: [
      { type: 'image', data: image.base64, mimeType: image.mimeType },
      { type: 'text', text: line },
    ],
    isError: false,
  };
}

/**
 * The history as the screen shows it (RN-AUD-013): a run of saves of one edit
 * session of the interface is one entry, with how many saves it made, from
 * when to when, and each of its revisions, which `read_note` takes as `asOf`.
 * A write outside a session, every write of an agent included, is an entry of
 * its own, as it always was.
 */
export function historyAnswer(entries: readonly HistoryEntry[]): unknown[] {
  return groupHistory(entries).map((group) => {
    if (group.kind === 'entry') {
      const { session: _none, ...entry } = group.entry;
      return entry;
    }
    const first = group.entries[0]!;
    const last = group.entries.at(-1)!;
    return {
      type: 'EditSession',
      session: group.session,
      saves: group.entries.length,
      startedAt: first.occurredAt,
      occurredAt: last.occurredAt,
      userId: last.userId,
      agentName: last.agentName,
      agentClientId: last.agentClientId,
      revision: last.revision,
      revisions: group.entries.map((entry) => ({
        occurredAt: entry.occurredAt,
        type: entry.type,
        revision: entry.revision,
        message: entry.message,
      })),
    };
  });
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
function noteAnswer(note: NoteContent, notices: readonly NoteNotice[] = []): ToolResult {
  // A note with no name already opens with the notice that says so, so the
  // diagnosis does not say it a second time.
  const said =
    note.name === null ? notices.filter((each) => each.code !== 'name-missing') : notices;
  const named = note.name === null ? { notice: UNNAMED_NOTE_NOTICE, ...note } : { ...note };
  // The note was saved; what changed of the context it was written against is
  // for the agent to weigh, and this says how (RN-KNW-061).
  const body = note.contextChanged ? { ...named, contextNotice: CONTEXT_CHANGED_NOTICE } : named;
  return json(said.length > 0 ? { ...body, notices: said } : body);
}

/**
 * What an agent does when the context it declared changed while it wrote
 * (RN-KNW-061): said once, so every write that can be told says it alike.
 */
export const CONTEXT_CHANGED_NOTICE =
  'The note was saved, but what you declared in `context` had changed meanwhile: ' +
  '`contextChanged` says which part and the current revisions. Somebody else changed it; it ' +
  'is guidance, not a rule, so judge it. Read it again — get_notebook_context for the ' +
  'guidance and the structure, get_template for the template — review this note against it, ' +
  'and if it needs adjusting, update_note it under its own revision, declaring the current ' +
  'context. Never resend the same content with the new revisions without that review.';

/** The access a share grants, as an agent acts on it (RN-AGT-046, RN-ACC-032). */
const ACCESS_SAYS: Record<ShareAccessName, string> = {
  reader:
    'Read it whole; every write here is refused, so do not follow the guidance below into ' +
    'writing — say whose notebook it is instead.',
  'content-editor':
    'You may write, move and delete its notes and keep its files, following its guidance; ' +
    'its folders, guidance and templates are refused: propose a change to them to the person ' +
    'instead.',
  'notebook-editor':
    'It is written as any notebook is, its folders, guidance and templates included; sharing ' +
    'it and deleting it stay with its owner.',
};

/** What a notebook shared with this person says before anything else. */
export function sharedBanner(shared: NotebookListing): string {
  const access = shared.access ?? 'reader';
  const pending = shared.pendingAccess
    ? ` The owner offered \`${shared.pendingAccess}\`, which waits for this person to accept ` +
      'it in the web interface; until then, what is said here applies.'
    : '';
  return (
    `> **Shared with this person by ${shared.owner ?? 'its owner'}, with \`${access}\` ` +
    `access.** ${ACCESS_SAYS[access] ?? ACCESS_SAYS.reader}${pending}`
  );
}

/** The revisions a note write declares as `context`, closing the notebook context (RN-KNW-061). */
export function contextRevisionsSection(revisions: {
  guidance: string | null;
  structure: string;
}): string {
  return [
    '## Context revisions',
    '',
    'What you read here, by revision. Declare it as `context` of create_note, update_note and ' +
      'move_note, with the `revision` get_template answers for the folder you write in (null ' +
      'when it has no template), and the answer tells you if any of it changed while you ' +
      'wrote:',
    '',
    '```json',
    JSON.stringify({
      guidance: revisions.guidance,
      template: null,
      structure: revisions.structure,
    }),
    '```',
  ].join('\n');
}

/** The `context` a write declares, or undefined when it declares none (RN-KNW-061). */
function contextArgument(
  args: Record<string, unknown>,
  tool: string,
): NoteContextRevisions | undefined {
  const raw = args['context'];
  if (raw === undefined || raw === null) return undefined;
  const value = raw as Record<string, unknown>;
  const revision = (key: string) =>
    value[key] === null || typeof value[key] === 'string'
      ? (value[key] as string | null)
      : undefined;
  const guidance = revision('guidance');
  const template = revision('template');
  if (
    typeof raw !== 'object' ||
    guidance === undefined ||
    template === undefined ||
    typeof value['structure'] !== 'string'
  ) {
    throw new GatewayError(
      'VALIDATION',
      `${tool} takes \`context\` as the revisions you read: guidance and template, each a ` +
        'revision or null when there is none, and structure, as the end of ' +
        'get_notebook_context and get_template answer them. Nothing was written.',
    );
  }
  return { guidance, template, structure: value['structure'] };
}

/**
 * How many notes the sweep reads the notices of, the most recently written
 * first, and how long it may spend reading them: a call to the connector dies
 * at about thirty seconds and the function at fifteen (RN-AGT-052).
 */
export const CHECK_NOTICES_LIMIT = 200;

/** How long create_notebook_from_model waits for the worker, and how often it looks. */
const CREATION_WAIT_MS = 20_000;
const CREATION_POLL_MS = 1_000;

/** The values of the parameters an agent passed, by name. */
function valuesOf(args: Record<string, unknown>): Record<string, unknown> {
  return args['values'] && typeof args['values'] === 'object'
    ? (args['values'] as Record<string, unknown>)
    : {};
}

/**
 * Waits for a notebook created from a version to be written (#359): most are
 * written in seconds, and one that takes longer answers the transfer to follow.
 */
async function createdFrom(
  started: TransferDto,
  read: (transferId: string) => Promise<TransferDto>,
): Promise<Record<string, unknown>> {
  let transfer = started;
  for (let waited = 0; transfer.status === 'running' && waited < CREATION_WAIT_MS;) {
    await new Promise((resolve) => setTimeout(resolve, CREATION_POLL_MS));
    waited += CREATION_POLL_MS;
    transfer = await read(started.transferId);
  }
  return transfer.status === 'ready'
    ? { notebook: transfer.notebookId, name: transfer.notebookName, status: 'ready' }
    : {
        transfer: transfer.transferId,
        status: transfer.status,
        failure: transfer.failure,
        next:
          transfer.status === 'running'
            ? 'The notebook is still being written: list_notebooks shows it once it is.'
            : 'The notebook was not created; the failure says why.',
      };
}
const CHECK_NOTICES_BUDGET_MS = 8_000;
const CHECK_NOTICES_PARALLEL = 10;

/**
 * The refusal of a name its folder already holds, said the way an agent can act
 * on (RN-AGT-030): which note holds it, and the two things to do next. It is
 * also what a create retried after a lost answer receives, and there the note
 * named IS the one the first call wrote (RN-AGT-024).
 */
function nameTakenAnswer(error: GatewayError, tool: string): string | null {
  const details = error.details as { code?: string; noteId?: string; name?: string } | undefined;
  if (details?.code !== 'ALREADY_EXISTS' || !details.noteId) return null;
  // A move carries the name it already has: there is no retry to recognise,
  // only two notes of one name, of which one has to change or stay (RN-AGT-049).
  if (tool === 'move_note') {
    return (
      `ALREADY_EXISTS: the destination folder already holds a note named ` +
      `"${details.name ?? ''}", ${details.noteId}, and a folder holds one note of each name. ` +
      'Nothing was moved. Read that note with read_note: if it is the same material, tell the ' +
      'person before merging the two; otherwise rename one of them with update_note, or leave ' +
      'the note where it is.'
    );
  }
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
    const outOfCatalogue = this.outOfCatalogue(name, args);
    if (outOfCatalogue) return text(await this.staleList(outOfCatalogue, caller), true);
    try {
      return await this.dispatch(name, canonicalIdentifiers(args, name), caller);
    } catch (error) {
      if (error instanceof GatewayError) {
        const taken = nameTakenAnswer(error, name);
        if (taken) return text(taken, true);
        // Actionable text, plus whatever the caller needs for the next attempt.
        const details = error.details ? `\n\n${JSON.stringify(error.details, null, 2)}` : '';
        return text(`${error.code}: ${error.message}${details}`, true);
      }
      throw error;
    }
  }

  /**
   * The notices of the notes of a notebook (RN-AGT-052), the most recently
   * written first and at most CHECK_NOTICES_LIMIT of them, only those that say
   * the page differs from what was typed: a hint about a missing alias on
   * every note would bury the one fence left open. The links are the sweep's
   * own answer and are not repeated here. Reading stops at its time budget,
   * and says how far it got.
   */
  private async noticesOfNotebook(
    caller: AgentCaller,
    notebookId: string,
  ): Promise<{
    notices: Array<NoteNotice & { note: { noteId: string; name: string | null } }>;
    read: { notes: number; of: number; complete: boolean };
    stale: Array<{ note: { noteId: string; name: string | null }; changed: readonly string[] }>;
  }> {
    const started = Date.now();
    const recent = await this.gateways.knowledge.recentNotes(caller, notebookId);
    // Every note whose live revision was written against a context that had
    // already changed, from the same listing (RN-KNW-062).
    const stale = recent
      .filter((each) => (each.staleContext?.length ?? 0) > 0)
      .map((each) => ({
        note: { noteId: each.noteId, name: each.name },
        changed: each.staleContext ?? [],
      }));
    const wanted = recent.slice(0, CHECK_NOTICES_LIMIT);
    const notices: Array<NoteNotice & { note: { noteId: string; name: string | null } }> = [];
    let read = 0;
    for (let at = 0; at < wanted.length; at += CHECK_NOTICES_PARALLEL) {
      if (Date.now() - started > CHECK_NOTICES_BUDGET_MS) break;
      const batch = wanted.slice(at, at + CHECK_NOTICES_PARALLEL);
      const found = await Promise.all(
        batch.map(async (each) => {
          const note = await this.gateways.knowledge.readNote(caller, notebookId, each.noteId);
          const said = await noticesOf(note.content ?? '', ['notice']);
          return said.map((notice) => ({
            note: { noteId: each.noteId, name: each.name },
            ...notice,
          }));
        }),
      );
      read += batch.length;
      notices.push(...found.flat());
    }
    return {
      notices,
      read: { notes: read, of: recent.length, complete: read === recent.length },
      stale,
    };
  }

  /**
   * A call the catalogue does not answer, told as what it most likely is: a
   * list the client kept from an older catalogue (RN-AGT-047). A tool that is
   * not there, an argument the tool does not take and one it requires and did
   * not get are the three a stale list produces, and each says the signature
   * this server serves rather than refusing bare. Null when the call fits.
   */
  private outOfCatalogue(name: string, args: Record<string, unknown>): string | null {
    const tool = TOOL_CATALOG.find((each) => each.name === name);
    if (!tool) {
      return (
        `UNKNOWN_TOOL: there is no tool named "${name}" in the catalogue this server serves, ` +
        `\`${CATALOG_VERSION}\`. whoami lists every tool it has, with its arguments.`
      );
    }
    const { names, required } = argumentsOf(tool);
    const unknown = Object.keys(args).filter((key) => !names.includes(key));
    const missing = [...required].filter((key) => args[key] === undefined);
    if (unknown.length === 0 && missing.length === 0) return null;
    return [
      `VALIDATION: ${name} was called with arguments that do not fit it as this server serves it.`,
      ...missing.map((key) => `${name} requires the argument "${key}".`),
      ...unknown.map((key) => `${name} takes no argument "${key}".`),
      `Nothing was done. The tool is \`${toolSignature(tool)}\`, in the catalogue \`${CATALOG_VERSION}\`.`,
    ].join(' ');
  }

  /**
   * The refusal, and the way out of the one cause the agent cannot fix by
   * itself. The connector is read only here, on a refusal, so a call that fits
   * costs nothing more; failing to read it gives the steps of both clients.
   */
  private async staleList(refusal: string, caller: AgentCaller): Promise<string> {
    const connector = await this.gateways.access.connector(caller).catch(() => null);
    return [
      refusal,
      '',
      'If the list of tools your client gave you shows this tool or these arguments, that list',
      'is older than the server. Tell the person, and ask them to refresh it:',
      '',
      ...refreshSteps(connector).map((step) => `- ${step}`),
    ].join('\n');
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
              'get_skill, which says when to build from what they brought and when to propose a ' +
              'structure first. Creating a notebook ' +
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
        // read in between (RN-KNW-034).
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
          ...(args['noteOrder'] === undefined
            ? {}
            : { noteOrder: noteOrderArgument(args, 'create_folder') }),
        });
        return json(folder);
      }

      case 'set_note_order':
        return json(
          await knowledge.setNoteOrder(caller, {
            notebookId: requireString(args, 'notebook', 'set_note_order'),
            folderId: requireString(args, 'folder', 'set_note_order'),
            noteOrder: noteOrderArgument(args, 'set_note_order'),
          }),
        );

      case 'update_folder': {
        const name = changedText(args, 'name', 'update_folder');
        const description = changedText(args, 'description', 'update_folder');
        const parent = parentArgument(args);
        if (name === undefined && description === undefined && parent === undefined) {
          throw new GatewayError(
            'VALIDATION',
            'update_folder changes something: pass name, description or parent. Nothing was ' +
              'written.',
          );
        }
        return json(
          await knowledge.updateFolder(caller, {
            notebookId: requireString(args, 'notebook', 'update_folder'),
            folderId: requireString(args, 'folder', 'update_folder'),
            ...(name === undefined ? {} : { name }),
            ...(description === undefined ? {} : { description }),
            ...(parent === undefined ? {} : { parentFolderId: parent }),
          }),
        );
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
        const mimeType = requireString(args, 'mimeType', 'keep_file');
        const kept = await knowledge.keepFile(caller, notebook, {
          name: requireString(args, 'name', 'keep_file'),
          description: optionalString(args, 'description') ?? '',
          mimeType,
          tags: optionalStrings(args, 'tags') ?? [],
          path: optionalString(args, 'path') ?? '/',
          contentBase64: keptBytes(args, mimeType),
        });
        return json({
          ...kept,
          reference: `![[${kept.name}]]`,
          note:
            'Write that reference in a note and the page draws this file. bytes and sha256 are ' +
            'what was kept: when you know the size or the hash of the file you were given and ' +
            'they differ, tell the person before anything else, since what was kept is not ' +
            'their file.',
        });
      }

      /**
       * An upload in parts (#240, RN-PRT-027, RN-AGT-041): a file kept whole,
       * its bytes sent by URL from the disk or inline part by part, each part
       * held to its hash and the whole to the hash declared at the start.
       */
      case 'begin_file_upload': {
        const transport = requireString(args, 'transport', 'begin_file_upload');
        const partSize = args['partSize'];
        const status = await knowledge.beginFileUpload(caller, {
          notebookId: requireString(args, 'notebook', 'begin_file_upload'),
          name: requireString(args, 'name', 'begin_file_upload'),
          mimeType: requireString(args, 'mimeType', 'begin_file_upload'),
          size: requireInteger(args, 'size', 'begin_file_upload'),
          sha256: requireString(args, 'sha256', 'begin_file_upload').toLowerCase(),
          purpose: requireString(args, 'purpose', 'begin_file_upload'),
          transport: transport === 'inline' ? 'inline' : 'url',
          ...(typeof partSize === 'number' ? { partSize } : {}),
          ...(optionalString(args, 'description') === undefined
            ? {}
            : { description: optionalString(args, 'description') }),
          ...(optionalStrings(args, 'tags') === undefined
            ? {}
            : { tags: optionalStrings(args, 'tags') }),
          ...(optionalString(args, 'path') === undefined
            ? {}
            : { path: optionalString(args, 'path') }),
        });
        return uploadAnswer(
          status,
          status.targets.length > 0
            ? 'PUT the bytes of each part to its url, with nothing else in the request: part n is ' +
                'the bytes from (n - 1) * partSize, partSize long. Then call finish_file_upload.'
            : 'Send each part with send_file_part, its SHA-256 beside its base64. Then call ' +
                'finish_file_upload.',
        );
      }

      case 'send_file_part': {
        const status = await knowledge.sendFilePart(
          caller,
          requireString(args, 'upload', 'send_file_part'),
          requireInteger(args, 'part', 'send_file_part'),
          {
            sha256: requireString(args, 'sha256', 'send_file_part').toLowerCase(),
            contentBase64: requireString(args, 'contentBase64', 'send_file_part'),
          },
        );
        return uploadAnswer(
          status,
          status.missing.length === 0
            ? 'Every part arrived: call finish_file_upload.'
            : `Send the parts still missing: ${status.missing.join(', ')}.`,
        );
      }

      case 'file_upload_status': {
        const status = await knowledge.fileUploadStatus(
          caller,
          requireString(args, 'upload', 'file_upload_status'),
        );
        return uploadAnswer(
          status,
          status.transfer.status === 'failed'
            ? `This upload failed (${status.transfer.failure ?? 'unknown'}): start a new one from the file.`
            : status.missing.length === 0
              ? 'Every part arrived: call finish_file_upload.'
              : `Send the parts still missing: ${status.missing.join(', ')}.`,
        );
      }

      case 'finish_file_upload': {
        const kept = await knowledge.finishFileUpload(
          caller,
          requireString(args, 'upload', 'finish_file_upload'),
        );
        return json({
          ...kept,
          reference: `![[${kept.name}]]`,
          note: 'The file is kept. Write that reference in a note and the page draws it.',
        });
      }

      case 'list_file_uploads': {
        const uploads = await knowledge.listFileUploads(
          caller,
          optionalString(args, 'notebook') ?? null,
        );
        return json({ uploads: uploads.map(openUploadOf) });
      }

      /**
       * A file asked of the person instead of sent (#253, RN-PRT-030, RN-AGT-045):
       * from nothing, or made of an upload the agent could not finish.
       */
      case 'request_file': {
        const upload = optionalString(args, 'upload');
        const size = args['size'];
        const sha256 = optionalString(args, 'sha256');
        const request = await knowledge.requestFile(
          caller,
          upload !== undefined
            ? { fromUpload: upload }
            : {
                notebookId: requireString(args, 'notebook', 'request_file'),
                name: requireString(args, 'name', 'request_file'),
                mimeType: requireString(args, 'mimeType', 'request_file'),
                purpose: requireString(args, 'purpose', 'request_file'),
                ...(optionalString(args, 'description') === undefined
                  ? {}
                  : { description: optionalString(args, 'description') }),
                ...(optionalStrings(args, 'tags') === undefined
                  ? {}
                  : { tags: optionalStrings(args, 'tags') }),
                ...(optionalString(args, 'path') === undefined
                  ? {}
                  : { path: optionalString(args, 'path') }),
                ...(typeof size === 'number' && Number.isInteger(size) && size > 0 ? { size } : {}),
                ...(sha256 === undefined ? {} : { sha256: sha256.toLowerCase() }),
              },
        );
        return json({
          request: request.transferId,
          name: request.fileName,
          notebook: request.notebookId,
          reference: `![[${request.fileName ?? ''}]]`,
          next:
            'The person keeps the file from Transfers, under this name. Write the reference ' +
            'where the file belongs, if it is not written yet, and tell them the file is ' +
            'waiting for them there: the note draws it the moment it is kept, which list_files ' +
            'will say.',
        });
      }

      case 'discard_file_upload': {
        const upload = requireString(args, 'upload', 'discard_file_upload');
        await knowledge.discardFileUpload(caller, upload);
        return text(
          `The upload ${upload} is gone: its parts are thrown away and the room it held is ` +
            'given back. A request is dismissed the same way.',
        );
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

      // The Tables of a notebook and their rows (#366).
      case 'list_tables':
        return json({
          tables: await knowledge.listTables(
            caller,
            requireString(args, 'notebook', 'list_tables'),
          ),
        });

      case 'create_table': {
        const schema = args['schema'];
        if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) {
          throw new GatewayError(
            'VALIDATION',
            'create_table requires "schema", a JSON Schema object.',
          );
        }
        return json(
          await knowledge.createTable(caller, requireString(args, 'notebook', 'create_table'), {
            name: requireString(args, 'name', 'create_table'),
            description: optionalString(args, 'description') ?? '',
            schema: schema as Record<string, unknown>,
            key: optionalStrings(args, 'key') ?? null,
          }),
        );
      }

      case 'alter_table':
        return json(
          await knowledge.alterTable(
            caller,
            requireString(args, 'notebook', 'alter_table'),
            requireString(args, 'table', 'alter_table'),
            requireArray(args, 'changes', 'alter_table'),
          ),
        );

      case 'delete_table': {
        const table = requireString(args, 'table', 'delete_table');
        const deleted = await knowledge.deleteTable(
          caller,
          requireString(args, 'notebook', 'delete_table'),
          table,
        );
        return text(
          `The table ${table} is gone, for good, with its ${deleted.rows} rows, destroyed shortly ` +
            'after. Every note that showed it now says it is missing, and its name is free again.',
        );
      }

      case 'query_table': {
        const page = args['page'];
        const pageSize = args['pageSize'];
        return json(
          await knowledge.queryTable(
            caller,
            requireString(args, 'notebook', 'query_table'),
            requireString(args, 'table', 'query_table'),
            {
              where: optionalString(args, 'where') ?? null,
              ...(Array.isArray(args['sort']) ? { sort: args['sort'] as never } : {}),
              ...(typeof page === 'number' ? { page } : {}),
              ...(typeof pageSize === 'number' ? { pageSize } : {}),
              ...(typeof args['aggregate'] === 'object' && args['aggregate'] !== null
                ? { aggregate: args['aggregate'] as never }
                : {}),
            },
          ),
        );
      }

      case 'insert_rows': {
        const mode = args['mode'] === 'upsert' ? 'upsert' : 'insert';
        return json(
          rowsWritten(
            await knowledge.insertRows(
              caller,
              requireString(args, 'notebook', 'insert_rows'),
              requireString(args, 'table', 'insert_rows'),
              { rows: requireArray(args, 'rows', 'insert_rows'), mode },
            ),
          ),
        );
      }

      case 'import_table': {
        const table = optionalString(args, 'table');
        const sheet = optionalString(args, 'sheet');
        return json(
          await knowledge.importTable(caller, requireString(args, 'notebook', 'import_table'), {
            file: requireString(args, 'fileName', 'import_table'),
            ...(table ? { table } : {}),
            ...(sheet ? { sheet } : {}),
            mode: args['mode'] === 'upsert' ? 'upsert' : 'insert',
            dryRun: args['dryRun'] === true,
          }),
        );
      }

      case 'update_rows':
        return json(
          rowsWritten(
            await knowledge.updateRows(
              caller,
              requireString(args, 'notebook', 'update_rows'),
              requireString(args, 'table', 'update_rows'),
              requireArray(args, 'updates', 'update_rows'),
            ),
          ),
        );

      case 'delete_rows':
        return json(
          rowsWritten(
            await knowledge.deleteRows(
              caller,
              requireString(args, 'notebook', 'delete_rows'),
              requireString(args, 'table', 'delete_rows'),
              requireArray(args, 'targets', 'delete_rows'),
            ),
          ),
        );

      case 'get_notebook_context': {
        // Markdown, not JSON: this document IS the product, and it is meant to
        // be read.
        const notebook = requireString(args, 'notebook', 'get_notebook_context');
        const [context, reach, revisions, tables] = await Promise.all([
          knowledge.notebookContext(caller, notebook),
          knowledge.listNotebooks(caller),
          knowledge.contextRevisions(caller, notebook),
          knowledge.listTables(caller, notebook),
        ]);
        // A notebook shared from another subscription says so before anything
        // else, because the guidance it opens with asks to be written in, and
        // what a share lets this person write is its access (RN-AGT-046).
        const shared = reach.find(
          (each) => each.ownership === 'shared' && each.notebookId === notebook,
        );
        const body = [context.trimEnd(), tablesSection(tables), contextRevisionsSection(revisions)]
          .filter((part) => part.length > 0)
          .join('\n\n');
        return text(shared ? `${sharedBanner(shared)}\n\n${body}` : body);
      }

      case 'get_template': {
        const template = await knowledge.template(
          caller,
          requireString(args, 'notebook', 'get_template'),
          requireString(args, 'folder', 'get_template'),
        );
        // The revision travels with the content, as it does for the guidance:
        // it is what the next set_template has to state (RN-KNW-034).
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
        const content = requireString(args, 'content', 'create_note');
        const declared = contextArgument(args, 'create_note');
        const created = await knowledge.createNote(caller, {
          notebookId: requireString(args, 'notebook', 'create_note'),
          folderId: requireString(args, 'folder', 'create_note'),
          content,
          ...(after === undefined ? {} : { afterNoteId: after }),
          ...(declared ? { context: declared } : {}),
        });
        return noteAnswer(created, await noticesOf(content));
      }

      case 'update_note': {
        const content = requireString(args, 'content', 'update_note');
        const declared = contextArgument(args, 'update_note');
        const updated = await knowledge.updateNote(caller, {
          notebookId: requireString(args, 'notebook', 'update_note'),
          noteId: requireString(args, 'note', 'update_note'),
          content,
          baseRevision: requireString(args, 'baseRevision', 'update_note'),
          message: optionalString(args, 'message'),
          ...(declared ? { context: declared } : {}),
        });
        return noteAnswer(updated, await noticesOf(content));
      }

      case 'reorder_note':
        return json(
          await knowledge.reorderNote(caller, {
            notebookId: requireString(args, 'notebook', 'reorder_note'),
            noteId: requireString(args, 'note', 'reorder_note'),
            afterNoteId: anchorArgument(args, 'reorder_note'),
          }),
        );

      case 'move_note': {
        const after = optionalAnchor(args);
        const declared = contextArgument(args, 'move_note');
        const moved = await knowledge.moveNote(caller, {
          notebookId: requireString(args, 'notebook', 'move_note'),
          noteId: requireString(args, 'note', 'move_note'),
          folderId: requireString(args, 'folder', 'move_note'),
          ...(after === undefined ? {} : { afterNoteId: after }),
          ...(declared ? { context: declared } : {}),
        });
        return json(
          moved.contextChanged ? { ...moved, contextNotice: CONTEXT_CHANGED_NOTICE } : moved,
        );
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

      // ---- Notebook models (#353, #354, #359) -----------------------------
      case 'declare_model': {
        const parameters = Array.isArray(args['parameters']) ? args['parameters'] : [];
        return json(
          await knowledge.declareModel(caller, requireString(args, 'notebook', 'declare_model'), {
            objective: requireString(args, 'objective', 'declare_model'),
            description: optionalString(args, 'description') ?? '',
            audience: optionalString(args, 'audience') ?? '',
            parameters: parameters as never,
            basedOn: optionalString(args, 'basedOn') ?? null,
          }),
        );
      }

      case 'get_model':
        return json(await knowledge.model(caller, requireString(args, 'notebook', 'get_model')));

      case 'list_models':
        return json({ models: await knowledge.listModels(caller) });

      case 'create_model_version': {
        const notebook = requireString(args, 'notebook', 'create_model_version');
        const tables = Array.isArray(args['tables'])
          ? (args['tables'] as Array<Record<string, unknown>>).map((each) => ({
              name: String(each['name'] ?? ''),
              rows: each['rows'] === true,
            }))
          : undefined;
        const version = await knowledge.createModelVersion(
          caller,
          notebook,
          optionalString(args, 'changelog') ?? '',
          tables,
        );
        return json({
          ...version,
          next:
            `The version is being built. Call get_model with this notebook until version ` +
            `${version.number} is ready, then read_model_version to review it with the person.`,
        });
      }

      case 'read_model_version':
        return json(
          await knowledge.modelVersion(
            caller,
            requireString(args, 'notebook', 'read_model_version'),
            requireInteger(args, 'version', 'read_model_version'),
          ),
        );

      case 'delete_model_version':
        await knowledge.deleteModelVersion(
          caller,
          requireString(args, 'notebook', 'delete_model_version'),
          requireInteger(args, 'version', 'delete_model_version'),
        );
        return json({ deleted: true });

      case 'create_notebook_from_model': {
        const started = await knowledge.createFromModel(caller, {
          notebookId: requireString(args, 'notebook', 'create_notebook_from_model'),
          version: requireInteger(args, 'version', 'create_notebook_from_model'),
          name: optionalString(args, 'name') ?? '',
          values: valuesOf(args),
        });
        return json(await createdFrom(started, (id) => knowledge.transfer(caller, id)));
      }

      // ---- The community catalog (#360) -----------------------------------
      case 'publish_model':
        return json(
          await knowledge.publishModel(caller, requireString(args, 'notebook', 'publish_model'), {
            language: requireString(args, 'language', 'publish_model'),
            acceptLicence: args['acceptLicence'] === true,
          }),
        );

      case 'withdraw_model':
        await knowledge.withdrawModel(caller, requireString(args, 'notebook', 'withdraw_model'));
        return json({ withdrawn: true });

      case 'search_community_models':
        return json({
          models: await knowledge.searchCommunity(caller, {
            text: optionalString(args, 'query') ?? '',
            language: optionalString(args, 'language') ?? null,
          }),
        });

      case 'read_community_model':
        return json(
          await knowledge.communityModel(
            caller,
            requireString(args, 'model', 'read_community_model'),
          ),
        );

      case 'read_community_version':
        return json(
          await knowledge.communityVersion(
            caller,
            requireString(args, 'model', 'read_community_version'),
            requireInteger(args, 'version', 'read_community_version'),
          ),
        );

      case 'create_notebook_from_community_model': {
        const started = await knowledge.createFromCommunity(caller, {
          publicId: requireString(args, 'model', 'create_notebook_from_community_model'),
          version: requireInteger(args, 'version', 'create_notebook_from_community_model'),
          name: optionalString(args, 'name') ?? '',
          values: valuesOf(args),
        });
        return json(await createdFrom(started, (id) => knowledge.transfer(caller, id)));
      }

      case 'check_notebook': {
        // The sweep reads the links from Discovery and what is still on its way
        // from Portability (RN-DSC-064): a name the person was asked for is a
        // pending link that waits for them, not a note still to write.
        const notebook = requireString(args, 'notebook', 'check_notebook');
        const [check, open, notices] = await Promise.all([
          discovery.checkNotebook(caller, notebook),
          knowledge.listFileUploads(caller, notebook),
          this.noticesOfNotebook(caller, notebook),
        ]);
        const waiting = new Map<string, 'person' | 'upload'>();
        for (const each of open) {
          if (each.status !== 'running' || !each.fileName) continue;
          const name = each.fileName.normalize('NFC');
          if (each.kind === 'request') waiting.set(name, 'person');
          else if (!waiting.has(name)) waiting.set(name, 'upload');
        }
        return json({
          pending: check.pending.map((each) => ({
            ...each,
            waitingFor: waiting.get(each.target.normalize('NFC')) ?? null,
          })),
          orphans: check.orphans,
          unshownFiles: check.unshownFiles,
          openUploads: open.filter((each) => each.status === 'running').map(openUploadOf),
          notices: notices.notices,
          noticesRead: notices.read,
          staleContext: notices.stale,
        });
      }

      /**
       * How a note, a draft or a part of either is drawn (#260, RN-AGT-050):
       * two steps, because drawing takes longer than a call may wait.
       */
      case 'preview_note': {
        const notebook = requireString(args, 'notebook', 'preview_note');
        const note = optionalString(args, 'note');
        const content = typeof args['content'] === 'string' ? args['content'] : undefined;
        const folder = optionalString(args, 'folder');
        const part = optionalString(args, 'part');
        if ((note === undefined) === (content === undefined)) {
          throw new GatewayError(
            'VALIDATION',
            'preview_note takes `note`, a note already written, or `content`, a draft not ' +
              'written yet: exactly one of the two. Nothing was drawn.',
          );
        }
        if (note !== undefined && folder !== undefined) {
          throw new GatewayError(
            'VALIDATION',
            'preview_note takes `folder` with `content`, the folder a draft would be written ' +
              'in; a note is drawn where it is. Nothing was drawn.',
          );
        }
        const started = await knowledge.startPreview(caller, {
          notebookId: notebook,
          ...(note === undefined ? {} : { noteId: note }),
          ...(content === undefined ? {} : { content }),
          ...(folder === undefined ? {} : { folderId: folder }),
          ...(part === undefined ? {} : { part }),
        });
        return json({
          preview: started.previewId,
          notebook,
          next:
            'Call get_preview with this preview and notebook in a few seconds: a drawing takes ' +
            'from 3 to 15 seconds, more the first time in a while.',
        });
      }

      case 'get_preview': {
        requireString(args, 'notebook', 'get_preview');
        return previewAnswer(
          await knowledge.getPreview(caller, requireString(args, 'preview', 'get_preview')),
        );
      }

      case 'note_history':
        return json(
          historyAnswer(
            await audit.noteHistory(
              caller,
              requireString(args, 'notebook', 'note_history'),
              requireString(args, 'note', 'note_history'),
            ),
          ),
        );

      default:
        return text(`Unknown tool: ${name}`, true);
    }
  }
}
