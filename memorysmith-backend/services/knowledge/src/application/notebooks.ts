/**
 * Notebook use cases (architecture-guide.md, section 14.1).
 *
 * FIXED RULE, NO EXCEPTION: every Knowledge use case loads the notebook and calls
 * policy.require BEFORE anything else (section 14.2). The three inputs of that
 * decision arrive at no extra cost, because the ceilings came back in the
 * same Query that loaded the notebook.
 */

import {
  type Authorship,
  type ContentRef,
  DomainError,
  err,
  ok,
  Role,
  Slug,
  NotebookId,
  NotebookRoleLimit,
  type Result,
  type UserId,
} from '@memorysmith/kernel';
import { AuthorizationPolicy, type RequestContext } from '../domain/access/AuthorizationPolicy.js';
import { composeNotebookContext } from '../domain/services/NotebookContextComposer.js';
import { Guidance } from '../domain/content-slot/Guidance.js';
import { Notebook } from '../domain/notebook/Notebook.js';
import { ShortText, NotebookName } from '../domain/values.js';
import type {
  ContentSlotRepository,
  ContentStore,
  NotebookRepository,
} from '../domain/ports/index.js';
import { admitWrite, type StorageBudget } from '../domain/services/StorageQuota.js';

export interface NotebookDependencies {
  readonly notebooks: NotebookRepository;
  /** The Guidance of a notebook and the Template of a folder (RN-KNW-044). */
  readonly slots: ContentSlotRepository;
  readonly content: ContentStore;
  /** What the plan allows and what is already stored (RN-SUB-021). */
  readonly storage: StorageBudget;
  /**
   * The attribute names the specification reserves, injected from the
   * composition root because it is the layer allowed to read the specification
   * (RN-AGT-025). Neither the domain nor the application reads one.
   */
  readonly reservedVocabulary: readonly string[];
}

/** Loads a notebook and authorizes in one step, so no caller can forget. */
async function loadAuthorized(
  deps: NotebookDependencies,
  ctx: RequestContext,
  notebookId: NotebookId,
  action: 'read' | 'write' | 'administer',
): Promise<Result<Notebook, DomainError>> {
  const notebook = await deps.notebooks.findById(notebookId);
  // A notebook of another subscription never even reaches here: the key the
  // repository builds carries the subscription of the token (RN-SUB-004).
  if (!notebook) return err(DomainError.notFound('Notebook not found'));
  /**
   * A deleted notebook answers like one that does not exist, to every operation
   * and every context: this single line is what makes the soft delete real for
   * the folders, the templates, the guidance and every note inside, since all
   * of them come through here. Restoring is the one path that loads it
   * anyway, and it does so explicitly.
   */
  if (notebook.isDeleted) return err(DomainError.notFound('Notebook not found'));

  const allowed = AuthorizationPolicy.require(ctx, notebook, action);
  if (!allowed.ok) return allowed;
  return ok(notebook);
}

export class CreateNotebook {
  constructor(private readonly deps: NotebookDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    name: string;
    description: string;
    subscriptionId: Parameters<typeof Notebook.create>[0]['subscriptionId'];
    by: Authorship;
  }): Promise<Result<Notebook, DomainError>> {
    // Creating a notebook is a subscription-level decision: OWNER or EDITOR.
    const role = input.ctx.isOwner ? Role.OWNER : input.ctx.role;
    if (!role.canWrite()) {
      return err(DomainError.forbiddenVisible('Creating a notebook requires the EDITOR role'));
    }

    const name = NotebookName.create(input.name);
    if (!name.ok) return name;
    const description = ShortText.create(input.description);
    if (!description.ok) return description;

    /**
     * Idempotency, the same shape create_note already has (RN-AGT-004): the
     * slug is the address of the notebook, so a second call with the same name
     * finds the first notebook instead of creating a twin nobody can reach. The
     * transaction carries the guard too, which is what settles a race; this
     * read is what turns the race into a good answer when there is none.
     */
    const slug = Slug.from(name.value.value);
    if (!slug.ok) return slug;
    const existing = await this.deps.notebooks.findBySlug(slug.value);
    if (existing) {
      return err(
        DomainError.conflict('A notebook with this slug already exists in this subscription', {
          code: 'ALREADY_EXISTS',
          notebookId: existing.id.value,
          slug: slug.value.value,
        }),
      );
    }

    const notebook = Notebook.create({
      id: NotebookId.generate(),
      subscriptionId: input.subscriptionId,
      name: name.value,
      description: description.value,
      by: input.by,
    });
    if (!notebook.ok) return notebook;

    const saved = await this.deps.notebooks.save(notebook.value);
    return saved.ok ? ok(notebook.value) : err(saved.error);
  }
}

export class ListNotebooks {
  constructor(private readonly deps: NotebookDependencies) {}

  /**
   * Every notebook of the subscription, filtered by the effective role. A member
   * sees every notebook; the ceiling controls writing, not seeing (RN-ACC-012).
   */
  async execute(input: { ctx: RequestContext }): Promise<Result<Notebook[], DomainError>> {
    const found = await this.deps.notebooks.listAll();
    return ok(
      found.filter((notebook) => AuthorizationPolicy.effectiveRole(input.ctx, notebook).canRead()),
    );
  }
}

export class GetNotebook {
  constructor(private readonly deps: NotebookDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
  }): Promise<
    Result<
      { notebook: Notebook; guidance: { content: string; ref: ContentRef } | null; role: Role },
      DomainError
    >
  > {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'read');
    if (!notebook.ok) return notebook;

    // The Guidance is an aggregate of its own, so reading it is a read of its
    // own (RN-KNW-044). The tree says whether there is one; this says what it
    // says, and with which revision the next write has to be based on.
    const guidance = await this.deps.slots.findGuidance(input.notebookId);
    return ok({
      notebook: notebook.value,
      guidance: guidance
        ? { content: await this.deps.content.read(guidance.ref), ref: guidance.ref }
        : null,
      role: AuthorizationPolicy.effectiveRole(input.ctx, notebook.value),
    });
  }
}

export class RenameNotebook {
  constructor(private readonly deps: NotebookDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    name: string;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    // Renaming and deleting a notebook belong to the OWNER (software-vision 5.2).
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'administer');
    if (!notebook.ok) return notebook;

    const name = NotebookName.create(input.name);
    if (!name.ok) return name;

    // Renaming into a slug another notebook of the subscription already holds is
    // the same collision as creating one, and gets the same answer.
    const slug = Slug.from(name.value.value);
    if (!slug.ok) return slug;
    const holder = await this.deps.notebooks.findBySlug(slug.value);
    if (holder && !holder.id.equals(notebook.value.id)) {
      return err(
        DomainError.conflict('A notebook with this slug already exists in this subscription', {
          code: 'ALREADY_EXISTS',
          notebookId: holder.id.value,
          slug: slug.value.value,
        }),
      );
    }

    const renamed = notebook.value.rename(name.value, input.by);
    if (!renamed.ok) return renamed;

    const saved = await this.deps.notebooks.save(notebook.value);
    return saved.ok ? ok() : err(saved.error);
  }
}

/**
 * Deleting a notebook is DEFINITIVE (RN-KNW-033): the notebook, its folders,
 * its notes, its Templates and its Guidance leave every listing at once, and
 * what is left of them is purged in the background (RN-KNW-047). It is an
 * OWNER decision, like renaming, because it takes the whole notebook out of
 * reach at once and nothing brings it back (software-vision.md 5.2).
 */
export class DeleteNotebook {
  constructor(private readonly deps: NotebookDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'administer');
    if (!notebook.ok) return notebook;

    const deleted = notebook.value.delete(input.by);
    if (!deleted.ok) return deleted;

    const saved = await this.deps.notebooks.save(notebook.value);
    return saved.ok ? ok() : err(saved.error);
  }
}

/**
 * Writes the content FIRST and the pointer second (section 10.5). If the
 * transaction fails, an unreferenced blob is left in S3: invisible, harmless,
 * collected by the weekly orphan job. The reverse order would produce a
 * pointer to content that does not exist, in the middle of the hot path.
 */

/**
 * The revision guard of the two Content Slots that are not notes (RN-KNW-034).
 *
 * The reason RN-AGT-005 gives for notes holds here with more force, not less:
 * the guidance is the most shared document of a notebook, and the one most likely
 * to be written by two hands at once, a person on the web and an agent over
 * MCP. Last-write-wins there would erase, without a word, what the other just
 * wrote.
 *
 * The current content travels with the refusal, so the caller can choose
 * between redoing and merging instead of guessing what changed.
 */
export async function guardRevision(
  read: (ref: ContentRef) => Promise<string>,
  current: ContentRef | null,
  baseRevision: string | null,
): Promise<Result<void, DomainError>> {
  const now = current?.versionId ?? null;
  if (now === baseRevision) return ok();

  return err(
    DomainError.conflict('The content changed since the revision you based this write on', {
      currentRevision: now,
      currentContent: current ? await read(current) : null,
    }),
  );
}
export class PutGuidance {
  constructor(private readonly deps: NotebookDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    content: string;
    baseRevision: string | null;
    by: Authorship;
  }): Promise<Result<ContentRef, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'write');
    if (!notebook.ok) return notebook;

    const guidance = await this.deps.slots.findGuidance(input.notebookId);
    const current = guidance?.ref ?? null;
    const fresh = await guardRevision(
      (ref) => this.deps.content.read(ref),
      current,
      input.baseRevision,
    );
    if (!fresh.ok) return fresh;

    // Identical bytes are not a write: nothing reaches the store, and the
    // answer is the revision in force, which is the one the next write has to
    // state (RN-KNW-028).
    if (current?.matchesContent(input.content)) return ok(current);

    // Checked BEFORE the content is written, so a refused write leaves nothing
    // behind in the store: a guidance replaces the previous one, so what it
    // costs is the difference between them.
    const admitted = admitWrite(
      await this.deps.storage.current(),
      Buffer.byteLength(input.content, 'utf8') - (current?.bytes ?? 0),
    );
    if (!admitted.ok) return admitted;

    const ref = current
      ? await this.deps.content.overwrite(current.contentId, input.content)
      : await this.deps.content.create(input.content);

    const slot =
      guidance ??
      Guidance.create({
        subscriptionId: notebook.value.subscriptionId,
        notebookId: input.notebookId,
        ref,
        by: input.by,
      });
    if (guidance) {
      const replaced = guidance.replace(ref, input.by);
      if (!replaced.ok) return replaced;
    }
    if (!slot.hasChanges) return ok(ref); // identical bytes: no revision

    const saved = await this.deps.slots.save(slot);
    return saved.ok ? ok(ref) : err(saved.error);
  }
}

/**
 * Deleting the Guidance of a notebook. The notebook stays, and it goes back to
 * saying nothing about how it wants to be written (RN-KNW-045).
 */
export class DeleteGuidance {
  constructor(private readonly deps: NotebookDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'write');
    if (!notebook.ok) return notebook;

    const guidance = await this.deps.slots.findGuidance(input.notebookId);
    if (!guidance) return err(DomainError.notFound('This notebook has no guidance'));

    const deleted = guidance.delete(input.by);
    if (!deleted.ok) return deleted;

    const saved = await this.deps.slots.save(guidance);
    return saved.ok ? ok() : err(saved.error);
  }
}

/** The composed document the agent reads: guidance plus the annotated tree. */
export class GetNotebookContext {
  constructor(private readonly deps: NotebookDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
  }): Promise<Result<string, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'read');
    if (!notebook.ok) return notebook;

    const slot = await this.deps.slots.findGuidance(input.notebookId);
    const guidance = slot ? await this.deps.content.read(slot.ref) : null;
    return ok(
      composeNotebookContext({
        notebook: notebook.value,
        guidance,
        reservedVocabulary: this.deps.reservedVocabulary,
      }),
    );
  }
}

export class SetNotebookRoleLimit {
  constructor(private readonly deps: NotebookDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    userId: UserId;
    /** The only admitted value is VIEWER (RN-ACC-012). */
    limit: string;
    subscriptionRole: Role;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'administer');
    if (!notebook.ok) return notebook;

    const limit = NotebookRoleLimit.create(input.limit);
    if (!limit.ok) return limit;
    // RN-ACC-011: the ceiling only demotes. Setting one above the member's
    // role is refused with VALIDATION rather than silently ignored.
    if (!input.subscriptionRole.atLeast(limit.value.role)) {
      return err(
        DomainError.validation('A notebook ceiling can only lower a role, never raise it'),
      );
    }

    const applied = notebook.value.setRoleLimit(input.userId, limit.value, input.by);
    if (!applied.ok) return applied;

    const saved = await this.deps.notebooks.save(notebook.value);
    return saved.ok ? ok() : err(saved.error);
  }
}

export class ClearNotebookRoleLimit {
  constructor(private readonly deps: NotebookDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    userId: UserId;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'administer');
    if (!notebook.ok) return notebook;

    const cleared = notebook.value.clearRoleLimit(input.userId, input.by);
    if (!cleared.ok) return cleared;

    const saved = await this.deps.notebooks.save(notebook.value);
    return saved.ok ? ok() : err(saved.error);
  }
}

export { loadAuthorized };
