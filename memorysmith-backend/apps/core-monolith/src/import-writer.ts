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
import type { RequestContext } from '@memorysmith/svc-knowledge/domain';

export interface KnowledgeWriteUseCases {
  readonly createNotebook: CreateNotebook;
  readonly putGuidance: PutGuidance;
  readonly createFolder: CreateFolder;
  readonly putTemplate: PutTemplate;
  readonly restoreFolderNumber: RestoreFolderNumber;
  readonly createNote: CreateNote;
  readonly deleteNotebook: DeleteNotebook;
}

export class KnowledgeNotebookWriter implements NotebookWriter {
  constructor(
    private readonly useCases: KnowledgeWriteUseCases,
    private readonly ctx: RequestContext,
    private readonly subscriptionId: SubscriptionId,
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

  async createNote(input: {
    notebookId: string;
    folderId: string;
    content: string;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
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
    return created.ok ? ok() : created;
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
