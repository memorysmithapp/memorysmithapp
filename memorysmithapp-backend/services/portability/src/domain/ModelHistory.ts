/**
 * The history of a notebook model (#431): what changed in its notebook, when,
 * through which connector, and the line its author left — the history a note
 * already has, said of the whole model.
 *
 * Nothing is stored for it. The changes are the entries the audit trail keeps
 * of the notebook, read as they are; a model holds no copy of itself, so what
 * a notebook created from it starts as is the notebook as it stands, and this
 * says how it came to stand there.
 *
 * Two things are left out of the trail here, and nothing is changed in it
 * (INV-06): what is not a change of the model a notebook would start as — who
 * the notebook was shared with, a ceiling of a role, a purge — and the saves of
 * one edit session past the first, which become one change saying how many
 * saves it held and since when, as the history of a note groups them.
 */

/** An entry of the trail of the model notebook, as this context reads it. */
export interface TrailEntry {
  readonly occurredAt: string;
  readonly type: string;
  readonly subject: string;
  readonly subjectId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  /** The connector that wrote it, or null for a person in the interface. */
  readonly agent: string | null;
}

/** One change of a model, as its history lists it. */
export interface ModelChange {
  /** When the change, or the last save of its session, happened. */
  readonly occurredAt: string;
  /** When the first save of its session happened; `occurredAt` for a change of one. */
  readonly since: string;
  readonly saves: number;
  readonly type: string;
  readonly subject: string;
  readonly subjectId: string;
  /** The name of what changed, when the change says it. */
  readonly name: string | null;
  readonly agent: string | null;
  readonly message: string | null;
}

/**
 * The changes of a notebook a notebook created from it would carry: its
 * content, its structure, its files, tables and dashboards, and its name.
 */
export const MODEL_CHANGE_TYPES: ReadonlySet<string> = new Set([
  'NotebookCreated',
  'NotebookRenamed',
  'GuidanceUpdated',
  'GuidanceDeleted',
  'FolderAdded',
  'FolderRenamed',
  'FolderDescribed',
  'FolderNotesOrdered',
  'FolderMoved',
  'FolderReordered',
  'FolderRemoved',
  'TemplateUpdated',
  'TemplateDeleted',
  'FileKept',
  'FileDeleted',
  'TableCreated',
  'TableAltered',
  'TableDeleted',
  'RowsInserted',
  'RowsUpdated',
  'RowsDeleted',
  'DashboardCreated',
  'DashboardChanged',
  'DashboardDeleted',
  'NoteCreated',
  'NoteUpdated',
  'NoteReordered',
  'NoteMoved',
  'NoteDeleted',
  'NoteRestored',
]);

/** How many changes a history answers, the newest first. */
export const MODEL_HISTORY_LIMIT = 200;

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** The name a change says of what it changed: a note, a folder, a file, a table, a dashboard. */
function nameOf(entry: TrailEntry): string | null {
  return text(entry.payload['name']) ?? text(entry.payload['table']);
}

/**
 * The history of a model from the trail of its notebook, the newest change
 * first: only what a notebook created from it would carry, an edit session as
 * one change, and at most `limit` changes, saying whether older ones were left.
 */
export function modelHistoryOf(
  trail: readonly TrailEntry[],
  limit: number = MODEL_HISTORY_LIMIT,
): { changes: ModelChange[]; truncated: boolean } {
  const newestFirst = trail
    .filter((entry) => MODEL_CHANGE_TYPES.has(entry.type))
    .slice()
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const changes: ModelChange[] = [];
  let open: { change: ModelChange; session: string } | null = null;
  for (const entry of newestFirst) {
    const session = text(entry.payload['session']);
    // A save of the session already open, on the same subject, joins it: the
    // first save met is the newest, so each one older moves `since` back.
    if (
      open &&
      session !== null &&
      open.session === session &&
      open.change.subjectId === entry.subjectId
    ) {
      open.change = {
        ...open.change,
        since: entry.occurredAt,
        saves: open.change.saves + 1,
        message: open.change.message ?? text(entry.payload['message']),
      };
      changes[changes.length - 1] = open.change;
      continue;
    }
    if (changes.length === limit) return { changes, truncated: true };
    const change: ModelChange = {
      occurredAt: entry.occurredAt,
      since: entry.occurredAt,
      saves: 1,
      type: entry.type,
      subject: entry.subject,
      subjectId: entry.subjectId,
      name: nameOf(entry),
      agent: entry.agent,
      message: text(entry.payload['message']),
    };
    changes.push(change);
    open = session === null ? null : { change, session };
  }
  return { changes, truncated: false };
}
