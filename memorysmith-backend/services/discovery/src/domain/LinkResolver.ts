/**
 * What a target becomes, once there is a notebook to resolve it against.
 *
 * Resolution used to be a lookup: one slug, one note, one edge. Specification
 * 0.6.0 makes it a question with three answers and, for the first one, a
 * count — because two notes may carry one name (RN-KNW-037) and a link into
 * both is two edges, never the first one, since there is no order to appeal
 * to (RN-DSC-042).
 *
 * **Step 7 before step 8 is the whole of what keeps the frontmatter out of the
 * graph.** A name always wins; an alias resolves ONLY what no name matched
 * (RN-DSC-052). The objection that used to keep aliases out of resolution
 * entirely was that one could move an edge invisibly — editing a third note,
 * neither end of the link, to take a link away from the note it had landed on.
 * An alias that may only take what nothing holds cannot do that. What it can
 * do is create an edge where a pending link was, and lose it again the day
 * somebody writes the note that owns the name (RN-DSC-053).
 *
 * **And that is the price: resolution is no longer monotonic.** Writing a note
 * used to only ever create edges. Now it can destroy one, in a note nobody
 * touched, so whoever holds the projection has to re-resolve what it holds by
 * alias whenever a name appears, changes or goes.
 */

/** What a notebook answers to: its names, its aliases and its attachments. */
export interface NotebookNames {
  /** Note identifiers by the name they carry. Several notes may share one. */
  readonly byName: ReadonlyMap<string, readonly string[]>;
  /** Note identifiers by each alias they declare (RN-DSC-052). */
  readonly byAlias: ReadonlyMap<string, readonly string[]>;
  /** The names of the files that are not notes, extension included (§5.8). */
  readonly attachments: ReadonlySet<string>;
}

export type ResolutionKind = 'note' | 'attachment' | 'pending';

export interface Resolution {
  readonly target: string;
  readonly kind: ResolutionKind;
  /** Whether the notes were found by name or by alias; `null` when neither. */
  readonly by: 'name' | 'alias' | null;
  /** Every note the target resolves to. Two notes with one name are two. */
  readonly noteIds: readonly string[];
}

/** A name is compared after NFC and folded in no other way (§5.3). */
const asName = (raw: string): string => raw.normalize('NFC');

/**
 * Builds the index a notebook is resolved against. The names are the `name:`
 * of each note, read by the kernel, and the aliases come from the same
 * frontmatter — which is the reason resolution stopped being the business of
 * one extractor: a note points with its body and answers with both.
 */
export function notebookNames(
  notes: ReadonlyArray<{
    readonly noteId: string;
    readonly name: string | null;
    readonly aliases?: readonly string[];
  }>,
  attachments: readonly string[] = [],
): NotebookNames {
  const byName = new Map<string, string[]>();
  const byAlias = new Map<string, string[]>();

  for (const note of notes) {
    if (note.name) {
      const key = asName(note.name);
      byName.set(key, [...(byName.get(key) ?? []), note.noteId]);
    }
    for (const alias of note.aliases ?? []) {
      const key = asName(alias);
      if (key.length === 0) continue;
      byAlias.set(key, [...(byAlias.get(key) ?? []), note.noteId]);
    }
  }

  return { byName, byAlias, attachments: new Set(attachments.map(asName)) };
}

/**
 * One target, resolved by the order the specification fixes: every note whose
 * NAME matches, then — only if none did — every note whose ALIAS matches,
 * then an attachment, then nothing.
 *
 * An attachment reference renders and is never an edge (RN-DSC-044): the graph
 * is between notes, and a name matching nothing is reported as pending rather
 * than treated as an error.
 */
export function resolveTarget(target: string, names: NotebookNames): Resolution {
  const key = asName(target);

  const byName = names.byName.get(key);
  if (byName && byName.length > 0) {
    return { target: key, kind: 'note', by: 'name', noteIds: byName };
  }

  const byAlias = names.byAlias.get(key);
  if (byAlias && byAlias.length > 0) {
    return { target: key, kind: 'note', by: 'alias', noteIds: byAlias };
  }

  if (names.attachments.has(key)) {
    return { target: key, kind: 'attachment', by: null, noteIds: [] };
  }

  return { target: key, kind: 'pending', by: null, noteIds: [] };
}

/** Every target of one note, resolved against the same notebook. */
export function resolveTargets(
  targets: readonly string[],
  names: NotebookNames,
): readonly Resolution[] {
  return targets.map((target) => resolveTarget(target, names));
}
