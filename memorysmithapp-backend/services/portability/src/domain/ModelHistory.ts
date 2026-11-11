/**
 * The history of a notebook model (#431): the history of its notebook, which
 * the Audit context summarizes from the trail (#446) and the composition root
 * hands here. This context reads it and keeps nothing of it.
 */

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
  /** The model the notebook was created from, by its name then; only on its creation (#446). */
  readonly fromModel: string | null;
}

/** The history of a model: the newest change first, and whether older ones were left out. */
export interface ModelHistory {
  readonly changes: ModelChange[];
  readonly truncated: boolean;
}
