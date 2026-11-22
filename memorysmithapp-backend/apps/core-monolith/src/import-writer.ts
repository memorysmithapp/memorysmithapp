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

import type { Authorship, DomainError, Result } from '@memorysmithapp/kernel';
import { FolderId, ok, NotebookId, type SubscriptionId } from '@memorysmithapp/kernel';
import type { NotebookWriter } from '@memorysmithapp/svc-portability/application/import';
import { notebookStyleOf } from '@memorysmithapp/contracts';
import type {
  CreateNotebook,
  DeleteNotebook,
  PutGuidance,
  StyleNotebook,
} from '@memorysmithapp/svc-knowledge/application/notebooks';
import type {
  CreateFolder,
  PutTemplate,
  RestoreFolderNumber,
} from '@memorysmithapp/svc-knowledge/application/folders';
import type { CreateNote } from '@memorysmithapp/svc-knowledge/application/notes';
import {
  MAX_ASSEMBLED_BYTES,
  type KeepAssembledFile,
  type KeepFile,
} from '@memorysmithapp/svc-knowledge/application/files';
import type { CreateTable, InsertRows } from '@memorysmithapp/svc-knowledge/application/tables';
import type { CreateDashboard } from '@memorysmithapp/svc-knowledge/application/dashboards';
import type { ContentStore, RequestContext } from '@memorysmithapp/svc-knowledge/domain';
import { SYSTEM_NOTES_ID } from '@memorysmithapp/svc-knowledge/domain';

export interface KnowledgeWriteUseCases {
  readonly createNotebook: CreateNotebook;
  readonly putGuidance: PutGuidance;
  readonly styleNotebook: StyleNotebook;
  readonly createFolder: CreateFolder;
  readonly putTemplate: PutTemplate;
  readonly restoreFolderNumber: RestoreFolderNumber;
  readonly createNote: CreateNote;
  /** The files a `1.5` archive carries back, through the door an upload uses (#166). */
  readonly keepFile: KeepFile;
  /**
   * The files a `1.6` archive carries back, each an entry staged as an object
   * of the subscription, through the door an upload in parts uses (RN-PRT-092).
   */
  readonly keepAssembledFile: KeepAssembledFile;
  /** The tables an archive carries, and their rows, through the doors an agent uses (#366). */
  readonly createTable: CreateTable;
  readonly insertRows: InsertRows;
  readonly createDashboard: CreateDashboard;
  readonly deleteNotebook: DeleteNotebook;
}

export class KnowledgeNotebookWriter implements NotebookWriter {
  constructor(
    private readonly useCases: KnowledgeWriteUseCases,
    private readonly ctx: RequestContext,
    private readonly subscriptionId: SubscriptionId,
    /** Where a revision of the past is stored, when a history comes back. */
    private readonly content: ContentStore,
    /**
     * Waits before the next try of a dashboard drawn from the system table,
     * and answers whether to try again (#517); see `createDashboard`.
     */
    private readonly awaitProjection: (attempt: number) => Promise<boolean> = waitForProjection,
  ) {}

  async createNotebook(input: {
    name: string;
    description: string;
    by: Authorship;
    fromModel?: { name: string } | undefined;
  }): Promise<Result<{ notebookId: string }, DomainError>> {
    const created = await this.useCases.createNotebook.execute({
      ctx: this.ctx,
      name: input.name,
      description: input.description,
      subscriptionId: this.subscriptionId,
      by: input.by,
      ...(input.fromModel ? { fromModel: input.fromModel.name } : {}),
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

  async setStyle(input: {
    notebookId: string;
    style: Readonly<Record<string, unknown>>;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const notebookId = NotebookId.create(input.notebookId);
    if (!notebookId.ok) return notebookId;
    // The document was validated against the published schema, and a style it
    // carried whole is read whole: a setting it lacks is the default (#493).
    const styled = await this.useCases.styleNotebook.execute({
      ctx: this.ctx,
      notebookId: notebookId.value,
      style: notebookStyleOf(input.style),
      by: input.by,
    });
    return styled.ok ? ok() : styled;
  }

  async createFolder(input: {
    notebookId: string;
    parentFolderId: string | null;
    name: string;
    description: string;
    noteOrder: 'manual' | 'alphabetical';
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
      noteOrder: input.noteOrder,
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
   * check that decides what a file IS. Its ceiling is the one of a file sent in
   * parts, not the 4 MB of a request: the bytes come from the archive, and
   * an archive carries every file an upload kept (#381).
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
      maxBytes: MAX_ASSEMBLED_BYTES,
    });
    return kept.ok ? ok() : kept;
  }

  /**
   * It goes through `KeepAssembledFile`, the door a file sent in parts goes
   * through: the type is checked against the first bytes of the entry, the
   * quota is asked for its size, a name already held is refused, and the whole
   * is hashed as it is read and held to the SHA-256 the document declares
   * before it is copied where a file lives (RN-PRT-092). The bytes never pass
   * whole through the memory of the worker (RN-PRT-093).
   */
  async keepStagedFile(input: {
    notebookId: string;
    name: string;
    description: string;
    mimeType: string;
    tags: readonly string[];
    path: string;
    staged: { key: string; versionId: string; size: number; sha256: string };
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const notebookId = NotebookId.create(input.notebookId);
    if (!notebookId.ok) return notebookId;
    const kept = await this.useCases.keepAssembledFile.execute({
      ctx: this.ctx,
      notebookId: notebookId.value,
      name: input.name,
      description: input.description,
      mimeType: input.mimeType,
      tags: input.tags,
      path: input.path,
      assembled: input.staged,
      by: input.by,
    });
    return kept.ok ? ok() : kept;
  }

  async createTable(input: {
    notebookId: string;
    name: string;
    description: string;
    schema: Record<string, unknown>;
    key: readonly string[] | null;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const notebookId = NotebookId.create(input.notebookId);
    if (!notebookId.ok) return notebookId;
    const created = await this.useCases.createTable.execute({
      ctx: this.ctx,
      notebookId: notebookId.value,
      name: input.name,
      description: input.description,
      schema: input.schema,
      key: input.key,
      by: input.by,
    });
    return created.ok ? ok() : created;
  }

  async createDashboard(input: {
    notebookId: string;
    name: string;
    description: string;
    definition: Record<string, unknown>;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const notebookId = NotebookId.create(input.notebookId);
    if (!notebookId.ok) return notebookId;
    /*
      A dashboard drawn from the system table names columns the notes declare,
      and the notes of this import were written a moment ago: until Discovery
      projects them, the system table has none of their attributes, and the
      definition is refused for a column it will have in seconds (#517). It is
      tried again while the projection lands, and the last refusal is the
      answer once the wait is over.
    */
    for (let attempt = 1; ; attempt += 1) {
      const created = await this.useCases.createDashboard.execute({
        ctx: this.ctx,
        notebookId: notebookId.value,
        name: input.name,
        description: input.description,
        definition: input.definition,
        by: input.by,
      });
      if (created.ok) return ok();
      const waiting = created.error.code === 'VALIDATION' && drawsFromSystemTable(input.definition);
      if (!waiting || !(await this.awaitProjection(attempt))) return created;
    }
  }

  async insertRows(input: {
    notebookId: string;
    table: string;
    rows: ReadonlyArray<Record<string, unknown>>;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const notebookId = NotebookId.create(input.notebookId);
    if (!notebookId.ok) return notebookId;
    const written = await this.useCases.insertRows.execute({
      ctx: this.ctx,
      notebookId: notebookId.value,
      table: input.table,
      rows: input.rows,
      // A table with a key was written once under each key, so an upsert
      // and an insert write the same; upsert never refuses a row the call
      // before it wrote.
      mode: 'upsert',
      by: input.by,
    });
    return written.ok ? ok() : written;
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

/** Whether a definition draws from a system table (RN-KNW-094). */
function drawsFromSystemTable(definition: Record<string, unknown>): boolean {
  const components = (definition['components'] ?? []) as Array<{
    source?: { table?: unknown } | null;
  }>;
  return components.some((each) => {
    const table = each?.source?.table;
    return (
      typeof table === 'string' &&
      (table.trim().toLowerCase().startsWith('system-') || table.toUpperCase() === SYSTEM_NOTES_ID)
    );
  });
}

/** Up to about a minute in all, the time a projection is given to land. */
const PROJECTION_WAITS_MS = [1_000, 2_000, 4_000, 8_000, 15_000, 15_000, 15_000];

async function waitForProjection(attempt: number): Promise<boolean> {
  const wait = PROJECTION_WAITS_MS[attempt - 1];
  if (wait === undefined) return false;
  await new Promise((resolve) => setTimeout(resolve, wait));
  return true;
}
