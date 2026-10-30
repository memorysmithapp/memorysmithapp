/**
 * The context a note was written against (#348): the Guidance of the
 * notebook, the Template of the folder the note is in, and the structure of
 * the notebook, each by its revision.
 *
 * The context is advisory. Guidance, folders and Templates guide how a note
 * is written; they are not rules the server checks a note against (INV-05).
 * So a note written against a context that changed meanwhile is saved, and the
 * caller is told what changed; whether the note needs adjusting is theirs to
 * judge. It is a notice, never a lock: a context change committing in the
 * same instant as the write may go unreported.
 */

/** A part of the context a note is written against. */
export type ContextPart = 'guidance' | 'template' | 'structure';

export interface NoteContext {
  /** The revision of the Guidance, or null when the notebook has none. */
  readonly guidance: string | null;
  /** The revision of the folder's Template, or null when the folder has none. */
  readonly template: string | null;
  /**
   * The revision of the notebook itself, which every change of its folders
   * advances, and also a change of its name or description: a notice may
   * name the structure when only those changed, which is accepted.
   */
  readonly structure: string;
}

/** What a revision of a note records of its context. */
export interface NoteContextRecord {
  /** What the caller declared it read. */
  readonly read: NoteContext;
  /** What differed from the current context when the revision was written. */
  readonly stale: readonly ContextPart[];
}

/** What a write answers when the context it declared had changed. */
export interface ContextNotice {
  readonly changed: readonly ContextPart[];
  readonly current: NoteContext;
}

export const NoteContexts = {
  /** The parts of `read` that differ from `current`, in a stable order. */
  staleParts(read: NoteContext, current: NoteContext): ContextPart[] {
    const stale: ContextPart[] = [];
    if (read.guidance !== current.guidance) stale.push('guidance');
    if (read.template !== current.template) stale.push('template');
    if (read.structure !== current.structure) stale.push('structure');
    return stale;
  },
};
