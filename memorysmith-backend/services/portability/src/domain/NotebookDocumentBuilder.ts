/**
 * A notebook as one document (software-vision.md §12, RN-PRT-009).
 *
 * **This is where file names used to come back into existence**, and they do
 * not any more. The export was a tree of `.md` files: the guidance became
 * `GUIDANCE.md`, the template `TEMPLATE.md`, the slug of a note a file name,
 * the order a numeric prefix, and the annotated tree a `STRUCTURE.md` that
 * nothing could read back. Every one of those was a **derivation**, and a
 * derivation on the way out is a second source of truth for what the notebook
 * says — which is exactly what this cycle exists to end.
 *
 * So the document stores what the notebook holds and nothing else: the note
 * bodies byte for byte, the positions as written, the identifiers as they are.
 * The name of a note is read from its body wherever it is needed (RN-PRT-010),
 * and the link destinations are never touched — which used to be a rewrite,
 * correct while a link addressed a file and corruption now that it addresses a
 * name (RN-PRT-004).
 *
 * Deleted notes do not enter the export (RN-PRT-006).
 */

/**
 * The shape is declared here and VALIDATED at the edge, against the schema the
 * contracts package publishes: `domain/` imports only the kernel, and a zod
 * schema is not the kernel. The composition root is what serialises a document
 * through that schema, so what reaches the archive is what the specification
 * of the format describes and nothing else (RN-PRT-011).
 */
export const NOTEBOOK_DOCUMENT_VERSION = '1.2';

/**
 * One entry of the trail, as the archive carries it, and the revisions those
 * entries name (RN-PRT-022). A history whose content cannot be read says that
 * something was written and never what, which is the state this exists to
 * avoid.
 */
export interface DocumentHistory {
  readonly entries: ReadonlyArray<{
    readonly eventId: string;
    readonly type: string;
    readonly subject: string;
    readonly subjectId: string;
    readonly occurredAt: string;
    readonly authorship: {
      readonly userId: string;
      readonly agent: { readonly clientId: string; readonly clientName: string } | null;
      readonly at: string;
    };
    readonly contentRef: {
      readonly contentId: string;
      readonly versionId: string;
      readonly sha256: string;
      readonly bytes: number;
    } | null;
    readonly payload: Record<string, unknown>;
  }>;
  /** Keyed by the pair the entry carries, `{contentId}#{versionId}`. */
  readonly revisions: Record<string, string>;
}

/**
 * One file the notebook keeps, with its bytes base64 (RN-PRT-025).
 *
 * No identifier: an import mints its own, and nothing addresses a file by one.
 * A note reaches a file by NAME, which is what makes the `![[name]]` of an
 * imported note find the picture it always found.
 */
export interface DocumentFile {
  readonly name: string;
  readonly description: string;
  readonly mimeType: string;
  readonly tags: readonly string[];
  readonly path: string;
  readonly bytes: string;
}

export interface NotebookDocument {
  readonly documentVersion: string;
  readonly exportedAt: string;
  readonly notebook: {
    readonly name: string;
    readonly description: string;
    readonly guidance: string | null;
  };
  readonly folders: ReadonlyArray<{
    readonly folderId: string;
    readonly parentFolderId: string | null;
    readonly name: string;
    readonly description: string;
    readonly position: string;
    readonly template: string | null;
    readonly lastNumber?: number;
  }>;
  readonly notes: ReadonlyArray<{
    readonly noteId: string;
    readonly folderId: string;
    readonly position: string;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly body: string;
  }>;
  /** Absent unless the export was asked to carry it (RN-PRT-022). */
  readonly history?: DocumentHistory;
  /** Absent from every document written before `1.2` (RN-PRT-025). */
  readonly files?: readonly DocumentFile[];
}

/** What the Knowledge context hands over, with nothing computed. */
export interface ExportFolder {
  readonly folderId: string;
  readonly parentFolderId: string | null;
  readonly name: string;
  readonly description: string;
  readonly position: string;
  readonly templateContent: string | null;
  /** The last number the folder issued, or nothing when it issued none (RN-PRT-016). */
  readonly lastNumber?: number;
}

export interface ExportNote {
  readonly noteId: string;
  readonly folderId: string;
  readonly position: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly content: string;
}

export interface ExportInput {
  readonly notebookName: string;
  readonly notebookDescription: string;
  readonly guidance: string | null;
  readonly folders: ExportFolder[];
  readonly notes: ExportNote[];
  /** What the trail says about this notebook, when it was asked for. */
  readonly history?: DocumentHistory | undefined;
  /**
   * The files the notebook keeps. They are outside the selection on purpose: a
   * file belongs to the notebook rather than to a folder, and an embed that
   * lands pending because the picture was left behind is a worse default than
   * a larger archive (RN-PRT-025).
   */
  readonly files?: readonly DocumentFile[] | undefined;
}

/**
 * What an export carries, under a selection (RN-PRT-024).
 *
 * It is the same shape a selection takes on the way IN (RN-PRT-017), and for
 * the same reason: a folder that holds something chosen travels **as a path**
 * — its name and its description and nothing else of its own — so a note never
 * arrives without the folder it lives in, and a Template is only ever carried
 * on a folder that is carried.
 *
 * `null` is the whole notebook, which is what almost everyone wants.
 */
export function carried(
  input: ExportInput,
  selection: {
    guidance: boolean;
    folders: readonly string[];
    templates: readonly string[];
    notes: readonly string[];
  } | null,
): ExportInput {
  if (!selection) return input;

  const parentOf = new Map(input.folders.map((folder) => [folder.folderId, folder.parentFolderId]));
  const carriedFolders = new Set<string>();
  const withAncestors = (folderId: string | null): void => {
    let at = folderId;
    while (at !== null && !carriedFolders.has(at)) {
      carriedFolders.add(at);
      at = parentOf.get(at) ?? null;
    }
  };

  for (const folderId of selection.folders) withAncestors(folderId);
  // A Template belongs to its folder, so choosing one carries that folder.
  for (const folderId of selection.templates) withAncestors(folderId);
  const notes = new Set(selection.notes);
  for (const note of input.notes) if (notes.has(note.noteId)) withAncestors(note.folderId);

  const templates = new Set(selection.templates.filter((id) => carriedFolders.has(id)));

  return {
    ...input,
    guidance: selection.guidance ? input.guidance : null,
    folders: input.folders
      .filter((folder) => carriedFolders.has(folder.folderId))
      .map((folder) =>
        templates.has(folder.folderId) ? folder : { ...folder, templateContent: null },
      ),
    notes: input.notes.filter((note) => notes.has(note.noteId)),
  };
}

/**
 * What an archive carries, as the filter of the history has to ask it
 * (RN-PRT-022, #161).
 *
 * An import already leaves out an entry about something the selection left out
 * (RN-PRT-023). An export used to carry the trail of the whole notebook
 * whatever was selected, so a partial archive arrived full of entries naming
 * folders and notes that were not in it — and, worse, carrying the BODY of
 * every revision those entries named, which is how a Guidance nobody asked for
 * travelled inside the history of an archive that had left it out.
 */
export interface CarriedSubjects {
  readonly guidance: boolean;
  readonly folders: ReadonlySet<string>;
  readonly templates: ReadonlySet<string>;
  readonly notes: ReadonlySet<string>;
}

/** What a document carries, read off the document itself and not the request. */
export function subjectsOf(input: ExportInput): CarriedSubjects {
  return {
    guidance: input.guidance !== null,
    folders: new Set(input.folders.map((folder) => folder.folderId)),
    templates: new Set(
      input.folders
        .filter((folder) => folder.templateContent !== null)
        .map((folder) => folder.folderId),
    ),
    notes: new Set(input.notes.map((note) => note.noteId)),
  };
}

/** The entries about the Guidance, which is content of the notebook. */
const GUIDANCE_EVENTS: ReadonlySet<string> = new Set([
  'GuidanceUpdated',
  'GuidanceDeleted',
  'GuidancePurged',
]);

/** The entries about a Template, which is content of its folder. */
const TEMPLATE_EVENTS: ReadonlySet<string> = new Set([
  'TemplateUpdated',
  'TemplateDeleted',
  'TemplatePurged',
]);

/**
 * Whether an entry of the trail belongs in the archive (RN-PRT-022).
 *
 * `null` is the whole notebook, which carries the trail whole — the entries
 * about notes that were DELETED included, since a deleted note travels nowhere
 * else (RN-PRT-006) and deleting the notebook takes its trail with it
 * (RN-AUD-011). That is the one place such an entry survives, so a selection
 * is what drops it and never the default.
 *
 * Under a selection, the subject of an entry is not enough: a `GuidanceUpdated`
 * is about the notebook and a `TemplateUpdated` is about a folder, so each is
 * asked against the thing it is really about.
 */
export function carriesEntry(
  entry: { readonly type: string; readonly subject: string; readonly subjectId: string },
  carried: CarriedSubjects | null,
): boolean {
  if (carried === null) return true;
  if (entry.subject === 'NOTE') return carried.notes.has(entry.subjectId);
  if (entry.subject === 'FOLDER') {
    if (!carried.folders.has(entry.subjectId)) return false;
    return TEMPLATE_EVENTS.has(entry.type) ? carried.templates.has(entry.subjectId) : true;
  }
  if (entry.subject === 'NOTEBOOK') {
    // The life of the notebook always travels: it is what an import reads the
    // old identifier of the notebook off, so that it can re-key the rest.
    return GUIDANCE_EVENTS.has(entry.type) ? carried.guidance : true;
  }
  return false;
}

export function buildNotebookDocument(input: ExportInput, now: string): NotebookDocument {
  return {
    documentVersion: NOTEBOOK_DOCUMENT_VERSION,
    exportedAt: now,
    notebook: {
      name: input.notebookName,
      description: input.notebookDescription,
      guidance: input.guidance,
    },
    folders: input.folders.map((folder) => ({
      folderId: folder.folderId,
      parentFolderId: folder.parentFolderId,
      name: folder.name,
      description: folder.description,
      position: folder.position,
      template: folder.templateContent,
      ...(folder.lastNumber ? { lastNumber: folder.lastNumber } : {}),
    })),
    notes: input.notes.map((note) => ({
      noteId: note.noteId,
      folderId: note.folderId,
      position: note.position,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      // Byte for byte. Nothing here reads it and nothing here rewrites it.
      body: note.content,
    })),
    // Absent unless it was asked for: a document without history is a `1.0`
    // document in every way that matters (RN-PRT-022).
    ...(input.history ? { history: input.history } : {}),
    // And the files, whenever the notebook keeps any (RN-PRT-025).
    ...(input.files && input.files.length > 0 ? { files: input.files } : {}),
  };
}

/** The name the archive is saved as, safe on every file system. */
export function archiveNameOf(notebookName: string): string {
  const safe = notebookName.replace(/[\\/:*?"<>|]/g, '-').trim();
  return `${safe.length > 0 ? safe : 'notebook'}.notebook`;
}
