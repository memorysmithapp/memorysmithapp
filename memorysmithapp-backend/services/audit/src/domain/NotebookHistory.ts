/**
 * The history of a notebook (#431, #446): what changed in it, when, through
 * which connector, and the line its author left — the history a note already
 * has, said of the whole notebook. A notebook model shows the history of its
 * notebook, and the community shows a published model's without who.
 *
 * Nothing is stored for it. The changes are the entries the trail keeps of the
 * notebook, read as they are, and three things are left out of them while
 * nothing is changed in the trail (INV-06): what is not a change of what the
 * notebook holds — who it was shared with, a ceiling of a role, a purge — the
 * saves of one edit session past the first, which become one change saying how
 * many saves it held and since when, as the history of a note groups them, and
 * what an import wrote as it created the notebook from a model, which is its
 * creation.
 */

/** An entry of the trail of a notebook, as its history reads it. */
export interface TrailEntry {
  readonly occurredAt: string;
  readonly type: string;
  readonly subject: string;
  readonly subjectId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  /** The connector that wrote it, or null for a person in the interface. */
  readonly agent: string | null;
  /**
   * The instant its authorship was stamped. One request stamps every write it
   * makes with one, so an import's writes carry the instant of the
   * NotebookCreated that opened them; absent, nothing is folded.
   */
  readonly at?: string | undefined;
  /** Whether the person asking wrote it; absent where who is never said. */
  readonly you?: boolean | undefined;
}

/** One change of a notebook, as its history lists it. */
export interface NotebookChange {
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
  /** The model a notebook was created from, by its name then; only on its creation (#446). */
  readonly fromModel: string | null;
  /** Whether the person asking made the change, when who is said. */
  readonly you?: boolean | undefined;
}

/**
 * The changes of what a notebook holds: its content, its structure, its files,
 * tables and dashboards, and its name — what a notebook created from it, when
 * it is a model, would carry.
 */
export const HISTORY_CHANGE_TYPES: ReadonlySet<string> = new Set([
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
export const HISTORY_LIMIT = 200;

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** The name a change says of what it changed: a note, a folder, a file, a table, a dashboard. */
function nameOf(entry: TrailEntry): string | null {
  return text(entry.payload['name']) ?? text(entry.payload['table']);
}

/** The model a creation says it came from, by its name then (#446). */
function fromModelOf(entry: TrailEntry): string | null {
  if (entry.type !== 'NotebookCreated') return null;
  const origin = entry.payload['fromModel'];
  return origin && typeof origin === 'object'
    ? text((origin as Record<string, unknown>)['name'])
    : null;
}

/** What makes the writes of one request one: the instant stamped and the connector. */
function stampOf(entry: TrailEntry): string | null {
  return entry.at ? `${entry.at}|${entry.agent ?? ''}` : null;
}

/**
 * The history of a notebook from its trail, the newest change first: only
 * what the notebook holds, an edit session as one change, what an import wrote
 * as it created the notebook from a model folded into its creation, and at most `limit`
 * changes, saying whether older ones were left.
 */
export function notebookHistoryOf(
  trail: readonly TrailEntry[],
  limit: number = HISTORY_LIMIT,
): { changes: NotebookChange[]; truncated: boolean } {
  // A notebook created from a model is written by its import under one
  // authorship: everything stamped as its NotebookCreated was is that
  // creation (#446). Only such a creation folds anything, so two requests that
  // happen to share an instant never hide one another.
  const creations = new Set(
    trail
      .filter((entry) => entry.type === 'NotebookCreated' && fromModelOf(entry) !== null)
      .map(stampOf)
      .filter((stamp): stamp is string => stamp !== null),
  );
  const newestFirst = trail
    .filter((entry) => HISTORY_CHANGE_TYPES.has(entry.type))
    .filter((entry) => {
      const stamp = stampOf(entry);
      return entry.type === 'NotebookCreated' || stamp === null || !creations.has(stamp);
    })
    .slice()
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const changes: NotebookChange[] = [];
  let open: { change: NotebookChange; session: string } | null = null;
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
    const change: NotebookChange = {
      occurredAt: entry.occurredAt,
      since: entry.occurredAt,
      saves: 1,
      type: entry.type,
      subject: entry.subject,
      subjectId: entry.subjectId,
      name: nameOf(entry),
      agent: entry.agent,
      message: text(entry.payload['message']),
      fromModel: fromModelOf(entry),
      ...(entry.you === undefined ? {} : { you: entry.you }),
    };
    changes.push(change);
    open = session === null ? null : { change, session };
  }
  return { changes, truncated: false };
}
