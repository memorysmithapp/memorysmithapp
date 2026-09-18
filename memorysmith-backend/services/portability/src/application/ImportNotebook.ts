/**
 * Import use case: the product takes a `.notebook` document and writes the notebook
 * it describes (architecture-guide.md §16).
 *
 * A `.notebook` file that nothing can read back is a backup nobody has tested.
 * The export became one document precisely so the door swings both ways, and
 * three decisions keep this half small enough to build and safe enough to run.
 *
 * **An import always creates a new notebook** (RN-PRT-012). No merge, no
 * conflict, no question of what wins: a failed import leaves a notebook somebody
 * can delete, and importing the same file twice gives two notebooks rather than a
 * mess in one. Everything that makes import hard elsewhere comes from writing
 * into something already there.
 *
 * **Identifiers are minted here, never restored** (RN-PRT-013). The ones in
 * the document are internal references — this note sits in that folder — and
 * they are resolved as the notebook is written. A `NoteId` addresses a note
 * inside a subscription and carries a timeline in the audit trail; bringing an
 * old one back would resurrect a history that did not happen, and it would
 * collide the moment somebody imports a file into the subscription it came
 * from.
 *
 * **It is refused whole, before the first write** (RN-PRT-014): a document
 * that does not match the schema, a version of the format this build does not
 * read, and a size the plan does not allow are each answered with the reason
 * and nothing is created.
 *
 * **It may write PART of a document** (RN-PRT-017). A notebook is often wanted
 * for its design rather than for its notes, or for one folder of it, and the
 * only way used to be importing everything and deleting by hand. A folder that
 * is not selected but holds something that is is written as a PATH: its name
 * and its description and nothing else of its own, so a note never arrives
 * without the folder it lives in.
 *
 * **And it is a job with a status** (RN-PRT-018): writing a notebook of several
 * hundred notes does not fit in the 29 seconds of the API, so it reports its
 * progress, and a cancel takes the notebook back down exactly as a failure does.
 */

import {
  DomainError,
  err,
  noteName,
  ok,
  ulid,
  type Authorship,
  type Result,
} from '@memorysmith/kernel';
import type { NotebookDocument } from '../domain/NotebookDocumentBuilder.js';

/** The versions of the document format this build reads. */
export const READABLE_DOCUMENT_VERSIONS: readonly string[] = ['1.0'];

/**
 * Why an import was refused, as a CODE and not as a sentence (RN-PRT-018).
 *
 * The refusal used to be the message of an HTTP error, in en-US, and an import
 * is a job now: what reaches the person is the record of the transfer, read by
 * an interface that speaks two languages. A code is what an interface can turn
 * into words; a sentence is what it ends up showing raw.
 */
export const IMPORT_REFUSALS = {
  notAnArchive: 'NOT_AN_ARCHIVE',
  noDocument: 'NO_DOCUMENT',
  badFormat: 'BAD_FORMAT',
  unreadableVersion: 'UNREADABLE_VERSION',
  twinNames: 'TWIN_NAMES',
  danglingFolder: 'DANGLING_FOLDER',
  cancelled: 'CANCELLED',
} as const;

/** The code of a refusal, when it carries one. */
export function refusalOf(error: DomainError): string {
  const details = error.details as { reason?: string; code?: string } | undefined;
  return details?.reason ?? details?.code ?? error.code;
}

/** Where an uploaded document is read from, and what happens to it after. */
export interface UploadStore {
  /** A short-lived address the client uploads to, under the subscription. */
  presignUpload(key: string, expiresInSeconds: number): Promise<string>;
  read(key: string): Promise<Buffer | null>;
  /** The upload is discarded once the import ends, whichever way it ended. */
  discard(key: string): Promise<void>;
}

/**
 * What writes the notebook. The Knowledge context owns every one of these
 * operations, and Portability may not import it, so it arrives as a port the
 * composition root fills — the same arrangement the export already uses to
 * read a notebook.
 */
export interface NotebookWriter {
  createNotebook(input: {
    name: string;
    description: string;
    by: Authorship;
  }): Promise<Result<{ notebookId: string }, DomainError>>;
  setGuidance(input: {
    notebookId: string;
    content: string;
    by: Authorship;
  }): Promise<Result<void, DomainError>>;
  createFolder(input: {
    notebookId: string;
    parentFolderId: string | null;
    name: string;
    description: string;
    by: Authorship;
  }): Promise<Result<{ folderId: string }, DomainError>>;
  setTemplate(input: {
    notebookId: string;
    folderId: string;
    content: string;
    by: Authorship;
  }): Promise<Result<void, DomainError>>;
  createNote(input: {
    notebookId: string;
    folderId: string;
    content: string;
    by: Authorship;
  }): Promise<Result<void, DomainError>>;
  /** Brings the counter of a folder up to the last number it had issued (RN-PRT-016). */
  restoreNumber(input: {
    notebookId: string;
    folderId: string;
    lastNumber: number;
    by: Authorship;
  }): Promise<Result<void, DomainError>>;
  /** Undoes a half-written import, which is why an import creates a notebook. */
  deleteNotebook(input: { notebookId: string; by: Authorship }): Promise<Result<void, DomainError>>;
}

export interface ImportJob {
  readonly importId: string;
  readonly notebookId: string;
  readonly status: 'imported';
  readonly folderCount: number;
  readonly noteCount: number;
  /** Whether the Guidance was among what the selection asked for. */
  readonly guidance: boolean;
  readonly templateCount: number;
}

/**
 * What part of the document to write (RN-PRT-017), by the identifiers the
 * document carries. `null` is the whole document.
 */
export interface ImportSelection {
  readonly guidance: boolean;
  readonly folders: readonly string[];
  readonly templates: readonly string[];
  readonly notes: readonly string[];
}

/** How an import says where it got to, and whether it should still be running. */
export interface ImportProgress {
  /** Notes written so far, out of the notes the selection asked for. */
  wrote(written: number, total: number): Promise<void>;
  /** Answers true when somebody cancelled it: the notebook goes back down. */
  cancelled(): Promise<boolean>;
}

const UPLOAD_TTL_SECONDS = 900;

/** The address a client uploads a document to, before asking for it. */
export class PrepareImport {
  constructor(
    private readonly uploads: UploadStore,
    private readonly subscriptionId: string,
  ) {}

  async execute(): Promise<Result<{ uploadKey: string; uploadUrl: string }, DomainError>> {
    // Under the subscription prefix, like everything else this product stores
    // (non-negotiable rule 1).
    const uploadKey = `s/${this.subscriptionId}/imports/${ulid()}.notebook`;
    return ok({
      uploadKey,
      uploadUrl: await this.uploads.presignUpload(uploadKey, UPLOAD_TTL_SECONDS),
    });
  }
}

export class ImportNotebook {
  constructor(
    private readonly uploads: UploadStore,
    private readonly writer: NotebookWriter,
    private readonly unzip: (archive: Buffer) => Record<string, string>,
    /**
     * Parses and validates the document against the published schema. It is
     * injected for the same reason the export's serialiser is: the schema
     * lives in the contracts package, which this layer may not import.
     */
    private readonly parse: (json: string) => NotebookDocument,
    private readonly subscriptionId: string,
  ) {}

  async execute(input: {
    uploadKey: string;
    /**
     * What to call the notebook this import creates. The document carries a name
     * and the subscription holds each name once (RN-KNW-032), so importing a
     * document into the subscription it came from needs one — and giving one
     * is how "the same file twice gives two notebooks" is true without the server
     * inventing a suffix nobody asked for.
     */
    name: string | null;
    by: Authorship;
    selection?: ImportSelection | null | undefined;
    progress?: ImportProgress | undefined;
  }): Promise<Result<ImportJob, DomainError>> {
    // A key of another subscription is not readable and not addressable: the
    // prefix is checked before the store is asked (rules 1 and 2).
    if (!input.uploadKey.startsWith(`s/${this.subscriptionId}/imports/`)) {
      return err(DomainError.notFound('Upload not found'));
    }

    const archive = await this.uploads.read(input.uploadKey);
    if (!archive) return err(DomainError.notFound('Upload not found'));

    try {
      const selection = input.selection ?? null;
      const document = this.readDocument(archive, selection);
      if (!document.ok) return document;
      return await this.write(document.value, input.name, input.by, selection, input.progress);
    } finally {
      // The upload is discarded whichever way the import ended: it was the
      // means of getting the bytes here and it is not a copy of the notebook.
      //
      // A discard that fails is not a failed import. This runs in a `finally`,
      // so throwing here REPLACES the verdict of the import with the accident
      // of its cleanup — which is how an import that wrote a whole notebook
      // was reported as failed, over a file the bucket was going to expire
      // anyway: the upload wears the lifecycle tag, and the rule of the bucket
      // is what guarantees it goes (RN-PRT-014).
      await this.uploads.discard(input.uploadKey).catch(() => undefined);
    }
  }

  private readDocument(
    archive: Buffer,
    selection: ImportSelection | null,
  ): Result<NotebookDocument, DomainError> {
    let entries: Record<string, string>;
    try {
      entries = this.unzip(archive);
    } catch {
      return err(
        DomainError.validation('That file is not a .notebook archive', {
          reason: IMPORT_REFUSALS.notAnArchive,
        }),
      );
    }

    const json = Object.entries(entries).find(([name]) => name.endsWith('.json'))?.[1];
    if (json === undefined) {
      return err(
        DomainError.validation('That archive carries no notebook document', {
          reason: IMPORT_REFUSALS.noDocument,
        }),
      );
    }

    let document: NotebookDocument;
    try {
      document = this.parse(json);
    } catch {
      return err(
        DomainError.validation('That notebook document does not match the format', {
          reason: IMPORT_REFUSALS.badFormat,
        }),
      );
    }

    if (!READABLE_DOCUMENT_VERSIONS.includes(document.documentVersion)) {
      return err(
        DomainError.validation(
          `This build reads notebook documents of version ${READABLE_DOCUMENT_VERSIONS.join(', ')}, and that one is ${document.documentVersion}`,
          { reason: IMPORT_REFUSALS.unreadableVersion, version: document.documentVersion },
        ),
      );
    }

    // A folder holds one live note of each name (RN-KNW-042), and a document
    // that says otherwise is refused here, whole, before anything is written:
    // finding it on the second note of the pair would mean undoing a notebook
    // half written (RN-PRT-014). The name is read by the same function
    // Knowledge reads it with, so the two cannot disagree.
    // Only among the notes the selection asked for: two notes of one name in
    // one folder are a conflict a person resolves by leaving one out, without
    // editing the file (RN-PRT-017).
    const seen = new Set<string>();
    for (const note of document.notes) {
      if (selection && !selection.notes.includes(note.noteId)) continue;
      const name = noteName(note.body);
      if (name === null) continue;
      const key = JSON.stringify([note.folderId, name]);
      if (seen.has(key)) {
        return err(
          DomainError.validation(
            `That notebook document has two notes named "${name}" in one folder, and a folder holds one note of each name`,
            { reason: IMPORT_REFUSALS.twinNames, name },
          ),
        );
      }
      seen.add(key);
    }
    return ok(document);
  }

  /**
   * Writes the notebook, in the order the tree requires: a folder before the
   * folders under it, and a folder before the notes in it. Every write carries
   * the authorship of whoever imported (non-negotiable rule 7), and the first
   * failure — a quota refusal included — takes the whole notebook back down,
   * because an import that stopped halfway is not a notebook anybody asked for.
   */
  private async write(
    document: NotebookDocument,
    name: string | null,
    by: Authorship,
    selection: ImportSelection | null,
    progress: ImportProgress | undefined,
  ): Promise<Result<ImportJob, DomainError>> {
    const chosen = plan(document, selection);
    const created = await this.writer.createNotebook({
      name: name ?? document.notebook.name,
      description: document.notebook.description,
      by,
    });
    if (!created.ok) return created;
    const notebookId = created.value.notebookId;

    const undo = async (failure: Result<never, DomainError>) => {
      await this.writer.deleteNotebook({ notebookId, by });
      return failure;
    };

    /** A cancel takes the notebook down whole, exactly as a failure does. */
    const stopped = async (): Promise<boolean> => {
      if (!(await progress?.cancelled())) return false;
      await this.writer.deleteNotebook({ notebookId, by });
      return true;
    };

    if (document.notebook.guidance !== null && chosen.guidance) {
      const guidance = await this.writer.setGuidance({
        notebookId,
        content: document.notebook.guidance,
        by,
      });
      if (!guidance.ok) return undo(guidance);
    }

    // The identifiers of the document are internal references, and this is the
    // map that resolves them to the ones this subscription mints (RN-PRT-013).
    const minted = new Map<string, string>();
    for (const folder of orderedFolders(document)) {
      // A folder nothing selected, with nothing selected under it, is not
      // written at all.
      if (!chosen.folders.has(folder.folderId)) continue;
      const parentFolderId =
        folder.parentFolderId === null ? null : (minted.get(folder.parentFolderId) ?? null);
      const written = await this.writer.createFolder({
        notebookId,
        parentFolderId,
        name: folder.name,
        description: folder.description,
        by,
      });
      if (!written.ok) return undo(written);
      minted.set(folder.folderId, written.value.folderId);

      if (folder.template !== null && chosen.templates.has(folder.folderId)) {
        const template = await this.writer.setTemplate({
          notebookId,
          folderId: written.value.folderId,
          content: folder.template,
          by,
        });
        if (!template.ok) return undo(template);
      }

      if (folder.lastNumber !== undefined) {
        const restored = await this.writer.restoreNumber({
          notebookId,
          folderId: written.value.folderId,
          lastNumber: folder.lastNumber,
          by,
        });
        if (!restored.ok) return undo(restored);
      }
    }

    const notes = [...document.notes]
      .filter((note) => chosen.notes.has(note.noteId))
      .sort(byPosition);
    let written = 0;
    for (const note of notes) {
      if (await stopped()) {
        return err(
          DomainError.validation('The import was cancelled', {
            reason: IMPORT_REFUSALS.cancelled,
          }),
        );
      }
      const folderId = minted.get(note.folderId);
      if (folderId === undefined) {
        return undo(
          err(
            DomainError.validation('A note points at a folder the document does not carry', {
              reason: IMPORT_REFUSALS.danglingFolder,
            }),
          ),
        );
      }
      // The body is written as it was, so the name, the links and the facets
      // of the imported notebook are read from it by the same rules (#96, #97).
      const wrote = await this.writer.createNote({
        notebookId,
        folderId,
        content: note.body,
        by,
      });
      if (!wrote.ok) return undo(wrote);
      written += 1;
      await progress?.wrote(written, notes.length);
    }

    if (await stopped()) {
      return err(
        DomainError.validation('The import was cancelled', { reason: IMPORT_REFUSALS.cancelled }),
      );
    }

    // What was actually WRITTEN under the selection, and not what the document
    // carries (RN-PRT-015).
    return ok({
      importId: ulid(),
      notebookId,
      status: 'imported',
      folderCount: chosen.folders.size,
      noteCount: notes.length,
      guidance: document.notebook.guidance !== null && chosen.guidance,
      templateCount: [...chosen.templates].filter((folderId) =>
        document.folders.some((folder) => folder.folderId === folderId && folder.template !== null),
      ).length,
    });
  }
}

/**
 * What the selection resolves to, over the document (RN-PRT-017).
 *
 * A folder that holds something selected is written even when it was not
 * selected itself, **as a path**: its name and its description, and no Template
 * of its own. So the set of folders is the closure of the selection upwards,
 * and the set of Templates is not.
 */
function plan(
  document: NotebookDocument,
  selection: ImportSelection | null,
): { guidance: boolean; folders: Set<string>; templates: Set<string>; notes: Set<string> } {
  if (!selection) {
    return {
      guidance: true,
      folders: new Set(document.folders.map((folder) => folder.folderId)),
      templates: new Set(document.folders.map((folder) => folder.folderId)),
      notes: new Set(document.notes.map((note) => note.noteId)),
    };
  }

  const parentOf = new Map(
    document.folders.map((folder) => [folder.folderId, folder.parentFolderId]),
  );
  const folders = new Set<string>();
  const withAncestors = (folderId: string | null): void => {
    let at = folderId;
    while (at !== null && !folders.has(at)) {
      folders.add(at);
      at = parentOf.get(at) ?? null;
    }
  };

  for (const folderId of selection.folders) withAncestors(folderId);
  const notes = new Set(selection.notes);
  for (const note of document.notes) {
    if (notes.has(note.noteId)) withAncestors(note.folderId);
  }
  // A Template is only ever written on a folder that is being written.
  const templates = new Set(selection.templates.filter((folderId) => folders.has(folderId)));

  return { guidance: selection.guidance, folders, templates, notes };
}

/** Parents before children, and siblings in the order the document states. */
function orderedFolders(document: NotebookDocument): NotebookDocument['folders'] {
  const byParent = new Map<string | null, NotebookDocument['folders'][number][]>();
  for (const folder of document.folders) {
    byParent.set(folder.parentFolderId, [...(byParent.get(folder.parentFolderId) ?? []), folder]);
  }

  const ordered: NotebookDocument['folders'][number][] = [];
  const walk = (parentFolderId: string | null): void => {
    for (const folder of [...(byParent.get(parentFolderId) ?? [])].sort(byPosition)) {
      ordered.push(folder);
      walk(folder.folderId);
    }
  };
  walk(null);
  return ordered;
}

function byPosition(a: { position: string }, b: { position: string }): number {
  return a.position < b.position ? -1 : a.position > b.position ? 1 : 0;
}
