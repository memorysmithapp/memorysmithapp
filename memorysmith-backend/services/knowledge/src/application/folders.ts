/**
 * Folder use cases. Every one of them is form A of the transaction: the tree
 * changes, so the aggregate is locked on its version and the guards travel in
 * the same write (architecture-guide.md, section 10.1).
 */

import {
  type Authorship,
  type ContentRef,
  DomainError,
  err,
  type FolderId,
  ok,
  type NotebookId,
  type Result,
} from '@memorysmith/kernel';
import type { RequestContext } from '../domain/access/AuthorizationPolicy.js';
import type { Folder } from '../domain/notebook/Folder.js';
import { FolderDescription, FolderName, RemovalPolicy } from '../domain/values.js';
import { guardRevision, loadAuthorized, type NotebookDependencies } from './notebooks.js';
import { admitWrite } from '../domain/services/StorageQuota.js';

export class CreateFolder {
  constructor(private readonly deps: NotebookDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    parentFolderId: FolderId | null;
    name: string;
    description: string;
    afterFolderId: FolderId | null;
    by: Authorship;
  }): Promise<Result<Folder, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'write');
    if (!notebook.ok) return notebook;

    const name = FolderName.create(input.name);
    if (!name.ok) return name;
    // Mandatory: it is what steers where the agent writes (RN-KNW-006).
    const description = FolderDescription.create(input.description);
    if (!description.ok) return description;

    const folder = notebook.value.addFolder(
      input.parentFolderId,
      name.value,
      description.value,
      input.afterFolderId,
      input.by,
    );
    if (!folder.ok) return folder;

    const saved = await this.deps.notebooks.save(notebook.value);
    return saved.ok ? ok(folder.value) : err(saved.error);
  }
}

export class PatchFolder {
  constructor(private readonly deps: NotebookDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    folderId: FolderId;
    name?: string | undefined;
    description?: string | undefined;
    parentFolderId?: FolderId | null | undefined;
    afterFolderId?: FolderId | null | undefined;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'write');
    if (!notebook.ok) return notebook;

    if (input.name !== undefined) {
      const name = FolderName.create(input.name);
      if (!name.ok) return name;
      const renamed = notebook.value.renameFolder(input.folderId, name.value, input.by);
      if (!renamed.ok) return renamed;
    }
    if (input.description !== undefined) {
      const description = FolderDescription.create(input.description);
      if (!description.ok) return description;
      const described = notebook.value.describeFolder(input.folderId, description.value, input.by);
      if (!described.ok) return described;
    }
    if (input.parentFolderId !== undefined) {
      const moved = notebook.value.moveFolder(
        input.folderId,
        input.parentFolderId,
        input.afterFolderId ?? null,
        input.by,
      );
      if (!moved.ok) return moved;
    }

    if (!notebook.value.hasChanges) return ok();
    const saved = await this.deps.notebooks.save(notebook.value);
    return saved.ok ? ok() : err(saved.error);
  }
}

/** A single write on the moved item, whatever the number of siblings. */
export class ReorderFolder {
  constructor(private readonly deps: NotebookDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    folderId: FolderId;
    afterFolderId: FolderId | null;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'write');
    if (!notebook.ok) return notebook;

    const reordered = notebook.value.reorderFolder(input.folderId, input.afterFolderId, input.by);
    if (!reordered.ok) return reordered;

    const saved = await this.deps.notebooks.save(notebook.value);
    return saved.ok ? ok() : err(saved.error);
  }
}

export class RemoveFolder {
  constructor(private readonly deps: NotebookDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    folderId: FolderId;
    /** No implicit default: the policy is explicit or it is not (RN-KNW-007). */
    policy: string;
    by: Authorship;
  }): Promise<Result<FolderId[], DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'write');
    if (!notebook.ok) return notebook;

    const policy = RemovalPolicy.create(input.policy);
    if (!policy.ok) return policy;

    const removed = notebook.value.removeFolder(input.folderId, policy.value, input.by);
    if (!removed.ok) return removed;

    const saved = await this.deps.notebooks.save(notebook.value);
    return saved.ok ? ok(removed.value) : err(saved.error);
  }
}

/** The template is a Content Slot like any other; only the pointer differs. */
export class PutTemplate {
  constructor(private readonly deps: NotebookDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    folderId: FolderId;
    content: string;
    baseRevision: string | null;
    by: Authorship;
    // The reference this write produced, so the caller can base the next
    // write on it instead of on the one it loaded with (RN-AGT-005).
  }): Promise<Result<ContentRef, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'write');
    if (!notebook.ok) return notebook;

    const folder = notebook.value.folders.get(input.folderId);
    if (!folder) return err(DomainError.notFound('Folder not found in this notebook'));

    const fresh = await guardRevision(
      (ref) => this.deps.content.read(ref),
      folder.templateRef,
      input.baseRevision,
    );
    if (!fresh.ok) return fresh;

    // Before the write reaches the store, and against the difference: a
    // template replaces the previous one (RN-SUB-021).
    const admitted = admitWrite(
      await this.deps.storage.current(),
      Buffer.byteLength(input.content, 'utf8') - (folder.templateRef?.bytes ?? 0),
    );
    if (!admitted.ok) return admitted;

    const ref = folder.templateRef
      ? await this.deps.content.overwrite(folder.templateRef.contentId, input.content)
      : await this.deps.content.create(input.content);

    const attached = notebook.value.attachTemplate(input.folderId, ref, input.by);
    if (!attached.ok) return attached;
    // Identical bytes change nothing, and the reference is still the one the
    // next write has to name.
    if (!notebook.value.hasChanges) return ok(ref);

    const saved = await this.deps.notebooks.save(notebook.value);
    return saved.ok ? ok(ref) : err(saved.error);
  }
}

export class GetTemplate {
  constructor(private readonly deps: NotebookDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    folderId: FolderId;
  }): Promise<Result<{ content: string; folderName: string } | null, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'read');
    if (!notebook.ok) return notebook;

    const folder = notebook.value.folders.get(input.folderId);
    if (!folder) return err(DomainError.notFound('Folder not found in this notebook'));
    if (!folder.templateRef) return ok(null);

    return ok({
      content: await this.deps.content.read(folder.templateRef),
      folderName: folder.name.value,
    });
  }
}
