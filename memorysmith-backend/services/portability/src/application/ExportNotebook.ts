/**
 * Export use case (architecture-guide.md, section 16).
 *
 * A notebook leaves as **one document**, zipped, with the extension `.notebook`
 * (RN-PRT-009). It is built from the Notebook aggregate and its notes; the bodies
 * come from the ContentStore through the CURRENT ContentRef of each one, and
 * they are copied and never processed.
 *
 * Nothing derived is written (RN-PRT-010): no name, no slug, no numeric
 * prefix. What used to derive them was the materialised tree, and it is gone
 * with the file names it existed to invent.
 *
 * Deleted notes do not enter the export (RN-PRT-006).
 *
 * **It runs in a worker and not in a request** (RN-PRT-019). Building the
 * archive means reading every note of the notebook, and the function behind the
 * API stops at 29 seconds: a notebook large enough could not be exported at
 * all, and the button said only that it had failed. What this answers is where
 * the archive landed; the link that reaches it is issued at the moment of each
 * download, and never stored.
 */

import { DomainError, err, ok, ulid, type Instant, type Result } from '@memorysmith/kernel';
import {
  archiveNameOf,
  buildNotebookDocument,
  type DocumentHistory,
  type ExportInput,
  type NotebookDocument,
} from '../domain/NotebookDocumentBuilder.js';

/** What the Knowledge context hands over for an export. */
export interface ExportSource {
  /**
   * `report` is called as the bodies are read, which is the only part of an
   * export whose length depends on the notebook. It is what the progress of
   * the job is made of (RN-PRT-019).
   */
  load(
    notebookId: string,
    report?: (readNotes: number, totalNotes: number) => void,
  ): Promise<ExportInput | null>;
}

/**
 * What the Audit context hands over when an export was asked for the history
 * of the notebook (RN-PRT-022).
 *
 * It answers the entries AND the revisions they name, because a history whose
 * content cannot be read says only that something was written. Each revision is
 * fetched by the exact pair its entry carries, never by listing: listing the
 * versions of an object belongs to the purge and to nothing else (rule 8).
 */
export interface HistorySource {
  of(notebookId: string): Promise<DocumentHistory>;
}

/** Where the archive lands, and how the caller reaches it. */
export interface ArchiveStore {
  /**
   * Answers the revision it wrote. An export is written once and never
   * overwritten, so that revision IS the object: deleting it by version
   * destroys the bytes without listing anything and without leaving a delete
   * marker behind (RN-PRT-020).
   */
  put(key: string, archive: Buffer): Promise<{ versionId: string | null }>;
  /**
   * A short-lived URL for that one object. `filename` is what the browser
   * saves it as: the identifier addresses the object, the name of the notebook
   * is what the person recognizes in their downloads folder.
   */
  presign(key: string, expiresInSeconds: number, filename: string): Promise<string>;
  /** Destroys one revision of one archive, and nothing else can be reached. */
  destroy(key: string, versionId: string): Promise<void>;
}

/** Where the archive of one export landed, and what it holds. */
export interface StoredArchive {
  readonly key: string;
  readonly versionId: string | null;
  readonly notebookName: string;
  readonly noteCount: number;
  readonly bytes: number;
}

export class ExportNotebook {
  constructor(
    private readonly source: ExportSource,
    private readonly archives: ArchiveStore,
    private readonly zip: (files: Array<{ path: string; content: string }>, now: Date) => Buffer,
    private readonly subscriptionId: string,
    /**
     * Turns the document into the bytes of the one entry of the archive, and
     * validates it against the published schema on the way. It is injected
     * because the schema lives in the contracts package, which neither the
     * domain nor this layer may import (RN-PRT-011).
     */
    private readonly serialize: (document: NotebookDocument) => { entry: string; content: string },
    /**
     * Absent where no history can be reached — the harness of a test that does
     * not exercise it. An export that asks for one without it carries none.
     */
    private readonly history: HistorySource | null = null,
  ) {}

  async execute(input: {
    notebookId: string;
    now: Instant;
    /**
     * Carries the trail of the notebook, and every revision it names, so the
     * archive is what a deletion cannot take back (RN-PRT-022). It is what
     * makes the archive larger, and it counts in the storage of the plan like
     * any kept export (RN-SUB-021).
     */
    withHistory?: boolean | undefined;
    report?: ((readNotes: number, totalNotes: number) => void) | undefined;
  }): Promise<Result<StoredArchive, DomainError>> {
    const source = await this.source.load(input.notebookId, input.report);
    if (!source) return err(DomainError.notFound('Notebook not found'));

    const history =
      input.withHistory && this.history ? await this.history.of(input.notebookId) : undefined;

    // Validated against the published schema before it is written: the export
    // writes nothing the schema does not describe, which is what makes the
    // format a specification rather than whatever this function happened to
    // produce (RN-PRT-011).
    const document = buildNotebookDocument({ ...source, history }, input.now.toISOString());
    const written = this.serialize(document);
    const archive = this.zip(
      [{ path: written.entry, content: written.content }],
      new Date(input.now.epochMillis),
    );

    // The archive lives under the same subscription prefix as everything else.
    const key = `s/${this.subscriptionId}/exports/${ulid()}.notebook`;
    const { versionId } = await this.archives.put(key, archive);

    return ok({
      key,
      versionId,
      notebookName: archiveNameOf(source.notebookName),
      noteCount: source.notes.length,
      bytes: archive.length,
    });
  }
}
