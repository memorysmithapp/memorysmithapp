/**
 * What an import writes with: the Knowledge use cases, behind the port
 * Portability declares.
 *
 * It lives HERE, in the composition root, for the reason `note-catalog.ts`
 * does: writing a notebook belongs to the Knowledge context, Portability may not
 * import it, and joining the two is exactly what a composition root is for.
 *
 * Every call carries the `Authorship` of whoever imported (non-negotiable rule
 * 7), and every one of them goes through the ordinary use case — the quota,
 * the limits and the events of an import are the ones of any other write, and
 * an import that bypassed them would be a second way into the notebook.
 */

import type { Authorship, DomainError, Result } from '@memorysmith/kernel';
import { FolderId, ok, NotebookId, type SubscriptionId } from '@memorysmith/kernel';
import type { NotebookWriter } from '@memorysmith/svc-portability/application/import';
import type {
  CreateNotebook,
  DeleteNotebook,
  PutGuidance,
} from '@memorysmith/svc-knowledge/application/notebooks';
import type {
  CreateFolder,
  PutTemplate,
  RestoreFolderNumber,
} from '@memorysmith/svc-knowledge/application/folders';
import type { CreateNote } from '@memorysmith/svc-knowledge/application/notes';
import type { KeepFile } from '@memorysmith/svc-knowledge/application/files';
import type { ContentStore, RequestContext } from '@memorysmith/svc-knowledge/domain';

export interface KnowledgeWriteUseCases {
  readonly createNotebook: CreateNotebook;
  readonly putGuidance: PutGuidance;
  readonly createFolder: CreateFolder;
  readonly putTemplate: PutTemplate;
  readonly restoreFolderNumber: RestoreFolderNumber;
  readonly createNote: CreateNote;
  /** The files an archive carries back, through the door an upload uses (#166). */
  readonly keepFile: KeepFile;
  readonly deleteNotebook: DeleteNotebook;
}

export class KnowledgeNotebookWriter implements NotebookWriter {
  constructor(
    private readonly useCases: KnowledgeWriteUseCases,
    private readonly ctx: RequestContext,
    private readonly subscriptionId: SubscriptionId,
    /** Where a revision of the past is stored, when a history comes back. */
    private readonly content: ContentStore,
  ) {}

  async createNotebook(input: {
    name: string;
    description: string;
    by: Authorship;
  }): Promise<Result<{ notebookId: string }, DomainError>> {
    const created = await this.useCases.createNotebook.execute({
      ctx: this.ctx,
      name: input.name,
      description: input.description,
      subscriptionId: this.subscriptionId,
      by: input.by,
    });
    return created.ok ? ok({ notebookId: created.value.id.value }) : created;
  }

  async setGuidance(input: {
    notebookId: string;
    content: string;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const notebookId = NotebookId.create(input.notebookId);
    if (!notebookId.ok) return notebookId;
    const written = await this.useCases.putGuidance.execute({
      ctx: this.ctx,
      notebookId: notebookId.value,
      content: input.content,
      // The notebook was created by this import moments ago, so there is nothing
      // to conflict with: the slot is empty and this write says so.
      baseRevision: null,
      by: input.by,
    });
    return written.ok ? ok() : written;
  }

  async createFolder(input: {
    notebookId: string;
    parentFolderId: string | null;
    name: string;
    description: string;
    by: Authorship;
  }): Promise<Result<{ folderId: string }, DomainError>> {
    const notebookId = NotebookId.create(input.notebookId);
    if (!notebookId.ok) return notebookId;
    const parent = input.parentFolderId === null ? null : FolderId.create(input.parentFolderId);
    if (parent && !parent.ok) return parent;

    const created = await this.useCases.createFolder.execute({
      ctx: this.ctx,
      notebookId: notebookId.value,
      parentFolderId: parent?.ok ? parent.value : null,
      name: input.name,
      description: input.description,
      afterFolderId: null,
      by: input.by,
    });
    return created.ok ? ok({ folderId: created.value.id.value }) : created;
  }

  async setTemplate(input: {
    notebookId: string;
    folderId: string;
    content: string;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const notebookId = NotebookId.create(input.notebookId);
    if (!notebookId.ok) return notebookId;
    const folderId = FolderId.create(input.folderId);
    if (!folderId.ok) return folderId;

    const written = await this.useCases.putTemplate.execute({
      ctx: this.ctx,
      notebookId: notebookId.value,
      folderId: folderId.value,
      content: input.content,
      baseRevision: null,
      by: input.by,
    });
    return written.ok ? ok() : written;
  }

  /**
   * One file of the archive, kept under the notebook the import created
   * (RN-PRT-025).
   *
   * It goes through `KeepFile`, which is the same door an upload uses: the
   * declared type is checked against the bytes, the quota is asked, and a name
   * the notebook already holds is refused. An import is not a way around the
   * check that decides what a file IS.
   */
  async keepFile(input: {
    notebookId: string;
    name: string;
    description: string;
    mimeType: string;
    tags: readonly string[];
    path: string;
    bytes: Uint8Array;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const notebookId = NotebookId.create(input.notebookId);
    if (!notebookId.ok) return notebookId;
    const kept = await this.useCases.keepFile.execute({
      ctx: this.ctx,
      notebookId: notebookId.value,
      name: input.name,
      description: input.description,
      mimeType: input.mimeType,
      tags: input.tags,
      path: input.path,
      bytes: input.bytes,
      by: input.by,
    });
    return kept.ok ? ok() : kept;
  }

  async createNote(input: {
    notebookId: string;
    folderId: string;
    content: string;
    by: Authorship;
  }): Promise<Result<{ noteId: string }, DomainError>> {
    const notebookId = NotebookId.create(input.notebookId);
    if (!notebookId.ok) return notebookId;
    const folderId = FolderId.create(input.folderId);
    if (!folderId.ok) return folderId;

    const created = await this.useCases.createNote.execute({
      ctx: this.ctx,
      notebookId: notebookId.value,
      folderId: folderId.value,
      // The body as the document carries it. The name, the links and the
      // facets of the imported notebook are read from these bytes by the same
      // rules that read any other note.
      content: input.content,
      afterNoteId: null,
      by: input.by,
    });
    // The identifier it minted, which is what re-keys the history the archive
    // carried onto the notebook this import wrote (RN-PRT-023).
    return created.ok ? ok({ noteId: created.value.id.value }) : created;
  }

  /**
   * One body of the past, stored as content of THIS subscription (RN-PRT-023).
   *
   * It goes straight to the content store and through no use case, and that is
   * the one place an import does: there is no note to write, no quota event to
   * raise and no aggregate to change — it is a revision that already happened,
   * and what the trail needs is somewhere to point.
   */
  async storeRevision(input: {
    content: string;
  }): Promise<
    Result<{ contentId: string; versionId: string; sha256: string; bytes: number }, DomainError>
  > {
    const ref = await this.content.create(input.content);
    return ok({
      contentId: ref.contentId.value,
      versionId: ref.versionId,
      sha256: ref.sha256,
      bytes: ref.bytes,
    });
  }

  async restoreNumber(input: {
    notebookId: string;
    folderId: string;
    lastNumber: number;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const notebookId = NotebookId.create(input.notebookId);
    if (!notebookId.ok) return notebookId;
    const folderId = FolderId.create(input.folderId);
    if (!folderId.ok) return folderId;
    return this.useCases.restoreFolderNumber.execute({
      ctx: this.ctx,
      notebookId: notebookId.value,
      folderId: folderId.value,
      lastNumber: input.lastNumber,
      by: input.by,
    });
  }

  async deleteNotebook(input: {
    notebookId: string;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const notebookId = NotebookId.create(input.notebookId);
    if (!notebookId.ok) return notebookId;
    const deleted = await this.useCases.deleteNotebook.execute({
      ctx: this.ctx,
      notebookId: notebookId.value,
      by: input.by,
    });
    return deleted.ok ? ok() : deleted;
  }
}
