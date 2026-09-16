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
  }): Promise<Result<ImportJob, DomainError>> {
    // A key of another subscription is not readable and not addressable: the
    // prefix is checked before the store is asked (rules 1 and 2).
    if (!input.uploadKey.startsWith(`s/${this.subscriptionId}/imports/`)) {
      return err(DomainError.notFound('Upload not found'));
    }

    const archive = await this.uploads.read(input.uploadKey);
    if (!archive) return err(DomainError.notFound('Upload not found'));

    try {
      const document = this.readDocument(archive);
      if (!document.ok) return document;
      return await this.write(document.value, input.name, input.by);
    } finally {
      // The upload is discarded whichever way the import ended: it was the
      // means of getting the bytes here and it is not a copy of the notebook.
      await this.uploads.discard(input.uploadKey);
    }
  }

  private readDocument(archive: Buffer): Result<NotebookDocument, DomainError> {
    let entries: Record<string, string>;
    try {
      entries = this.unzip(archive);
    } catch {
      return err(DomainError.validation('That file is not a .notebook archive'));
    }

    const json = Object.entries(entries).find(([name]) => name.endsWith('.json'))?.[1];
    if (json === undefined) {
      return err(DomainError.validation('That archive carries no notebook document'));
    }

    let document: NotebookDocument;
    try {
      document = this.parse(json);
    } catch {
      return err(DomainError.validation('That notebook document does not match the format'));
    }

    if (!READABLE_DOCUMENT_VERSIONS.includes(document.documentVersion)) {
      return err(
        DomainError.validation(
          `This build reads notebook documents of version ${READABLE_DOCUMENT_VERSIONS.join(', ')}, and that one is ${document.documentVersion}`,
        ),
      );
    }

    // A folder holds one live note of each name (RN-KNW-042), and a document
    // that says otherwise is refused here, whole, before anything is written:
    // finding it on the second note of the pair would mean undoing a notebook
    // half written (RN-PRT-014). The name is read by the same function
    // Knowledge reads it with, so the two cannot disagree.
    const seen = new Set<string>();
    for (const note of document.notes) {
      const name = noteName(note.body);
      if (name === null) continue;
      const key = JSON.stringify([note.folderId, name]);
      if (seen.has(key)) {
        return err(
          DomainError.validation(
            `That notebook document has two notes named "${name}" in one folder, and a folder holds one note of each name`,
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
  ): Promise<Result<ImportJob, DomainError>> {
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

    if (document.notebook.guidance !== null) {
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

      if (folder.template !== null) {
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

    for (const note of [...document.notes].sort(byPosition)) {
      const folderId = minted.get(note.folderId);
      if (folderId === undefined) {
        return undo(
          err(DomainError.validation(`A note points at a folder the document does not carry`)),
        );
      }
      // The body is written as it was, so the name, the links and the facets
      // of the imported notebook are read from it by the same rules (#96, #97).
      const written = await this.writer.createNote({
        notebookId,
        folderId,
        content: note.body,
        by,
      });
      if (!written.ok) return undo(written);
    }

    return ok({
      importId: ulid(),
      notebookId,
      status: 'imported',
      folderCount: document.folders.length,
      noteCount: document.notes.length,
    });
  }
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
