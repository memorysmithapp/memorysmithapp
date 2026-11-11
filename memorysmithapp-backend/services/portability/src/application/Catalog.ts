/**
 * The community catalog (#360): publishing a model, withdrawing it, finding
 * and reading what is published, and creating a notebook from it. Only its
 * author withdraws a model (#439).
 *
 * A published model is read where it is, in its author's subscription,
 * through its catalog entry and nothing else (#356): the entry names the
 * subscription and the model notebook, and every public read starts from it.
 * The notebook is read as it stands, so a change its owner makes reaches the
 * catalog (#431). Nothing is copied by publishing, so publishing and
 * withdrawing change no storage, and a notebook created from a published model
 * is written and counted in the subscription of whoever creates it.
 */

import {
  DomainError,
  err,
  Instant,
  ok,
  ulid,
  type Authorship,
  type Result,
} from '@memorysmithapp/kernel';
import {
  matches,
  publicViewOf,
  type CatalogEntry,
  type CatalogStore,
  type PublicModel,
} from '../domain/CommunityCatalog.js';
import type { NotebookDocument } from '../domain/NotebookDocumentBuilder.js';
import type { ModelStore } from '../domain/NotebookModel.js';
import type { ModelChange } from '../domain/ModelHistory.js';
import { referenceReport } from '../domain/ParameterFilling.js';
import type { Transfer } from '../domain/Transfer.js';
import {
  contentsOf,
  startFromModel,
  type ModelCaller,
  type ModelReading,
  type OwnNotebooks,
} from './Models.js';
import type { StartImport } from './Transfers.js';

/** Whether a subscription grants access, which hides its models when it does not (#356). */
export interface SubscriptionAccess {
  grants(subscriptionId: string): Promise<boolean>;
}

/** The edge cache of the public route, emptied of a model that is withdrawn (#356). */
export interface CatalogCache {
  invalidate(publicId: string): Promise<void>;
}

/** Who publishes: the name the catalog shows, and the e-mail it never shows (#357). */
export interface Author {
  readonly name: string | null;
  readonly email: string;
}

export interface PublicationDependencies {
  readonly models: ModelStore;
  readonly notebooks: OwnNotebooks;
  readonly catalog: CatalogStore;
  readonly cache: CatalogCache;
}

const LANGUAGE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const ownerOnly = (): DomainError =>
  DomainError.forbiddenVisible('Only the owner of the subscription publishes a model');

/**
 * Says the entry of a published model again (#431): what the model declares
 * and the name of its notebook, as they are now. A model not published, or
 * withdrawn by the operator, is left as it is.
 */
export async function refreshPublication(
  deps: Pick<PublicationDependencies, 'models' | 'notebooks' | 'catalog'>,
  notebookId: string,
): Promise<void> {
  const model = await deps.models.get(notebookId);
  if (!model?.publicId) return;
  const entry = await deps.catalog.get(model.publicId);
  if (!entry) return;
  const notebook = await deps.notebooks.own(notebookId);
  await deps.catalog.put({
    ...entry,
    name: notebook?.name ?? entry.name,
    objective: model.objective,
    description: model.description,
    audience: model.audience,
    basedOn: model.basedOn,
    parameters: model.parameters,
    updatedAt: Instant.now().toISOString(),
  });
}

/**
 * Publishes a model to the community (#360): only its owner, with a language,
 * a name of their own to be shown by, and CC0 1.0, which every distribution of
 * a model is under and which is accepted once (#357). Publishing again says
 * the entry again.
 */
export class PublishModel {
  constructor(
    private readonly deps: PublicationDependencies,
    private readonly caller: ModelCaller,
  ) {}

  async execute(input: {
    notebookId: string;
    language: string;
    acceptLicence: boolean;
    author: Author;
  }): Promise<Result<PublicModel, DomainError>> {
    if (!this.caller.isOwner) return err(ownerOnly());
    const model = await this.deps.models.get(input.notebookId);
    const notebook = await this.deps.notebooks.own(input.notebookId);
    if (!model || !notebook) return err(DomainError.notFound('Model not found'));
    const language = input.language.trim();
    if (!LANGUAGE.test(language)) {
      return err(DomainError.validation('A model is published in a language, such as pt-BR or en'));
    }
    const authorName = input.author.name?.trim() ?? '';
    if (!authorName || authorName === input.author.email) {
      return err(
        DomainError.validation(
          'The catalog shows the name of whoever publishes, never the e-mail: write your name in your profile first',
          { reason: 'AUTHOR_NAME' },
        ),
      );
    }
    if (!model.licenceAcceptedAt && !input.acceptLicence) {
      return err(
        DomainError.conflict(
          'A model is distributed under CC0 1.0: anybody may reuse and republish it freely. Accept the licence to publish it',
          { reason: 'LICENCE', licence: 'CC0-1.0' },
        ),
      );
    }

    const now = Instant.now().toISOString();
    const held = model.publicId ? await this.deps.catalog.get(model.publicId) : null;
    const entry: CatalogEntry = {
      publicId: held?.publicId ?? ulid(),
      subscriptionId: this.caller.subscriptionId,
      notebookId: model.notebookId,
      ownerUserId: model.ownerUserId,
      authorName,
      authorEmail: input.author.email,
      name: notebook.name,
      objective: model.objective,
      description: model.description,
      audience: model.audience,
      language,
      basedOn: model.basedOn,
      publishedAt: held?.publishedAt ?? now,
      updatedAt: now,
      parameters: model.parameters,
    };
    await this.deps.catalog.put(entry);
    await this.deps.models.put({
      ...model,
      publicId: entry.publicId,
      licenceAcceptedAt: model.licenceAcceptedAt ?? now,
    });
    return ok(publicViewOf(entry));
  }
}

/** The owner withdraws a model; what was created from it is untouched (#360). */
export class WithdrawModel {
  constructor(
    private readonly deps: PublicationDependencies,
    private readonly caller: ModelCaller,
  ) {}

  async execute(notebookId: string): Promise<Result<void, DomainError>> {
    if (!this.caller.isOwner) return err(ownerOnly());
    const model = await this.deps.models.get(notebookId);
    if (!model) return err(DomainError.notFound('Model not found'));
    if (!model.publicId) return ok();
    await this.deps.catalog.remove(model.publicId);
    await this.deps.models.put({ ...model, publicId: null });
    await this.deps.cache.invalidate(model.publicId);
    return ok();
  }
}

/** Where a model of the subscription stands in the catalog, for its own pages. */
export class PublicationOf {
  constructor(private readonly deps: Pick<PublicationDependencies, 'models' | 'catalog'>) {}

  async execute(notebookId: string): Promise<PublicModel | null> {
    const model = await this.deps.models.get(notebookId);
    if (!model?.publicId) return null;
    const entry = await this.deps.catalog.get(model.publicId);
    return entry ? publicViewOf(entry) : null;
  }
}

/** What reads the catalog, for anybody: the entries and whether their subscription grants access. */
export interface CatalogReading {
  readonly catalog: CatalogStore;
  readonly access: SubscriptionAccess;
}

async function visible(deps: CatalogReading, publicId: string): Promise<CatalogEntry | null> {
  const entry = await deps.catalog.get(publicId);
  if (!entry) return null;
  return (await deps.access.grants(entry.subscriptionId)) ? entry : null;
}

/** Finds published models by every word asked, and by language (#358). */
export class SearchCatalog {
  constructor(private readonly deps: CatalogReading) {}

  /**
   * Each subscription of an author is asked once, and all of them at once
   * (#420): the answer waits for the slowest of them, never for their sum.
   *
   * The newest published first, and a page at a time when a limit is asked
   * (#432): the cursor is where the next page starts, null on the last one. A
   * search that asks no limit answers every model it finds.
   */
  async execute(query: {
    text: string;
    language: string | null;
    limit?: number | undefined;
    cursor?: string | null | undefined;
  }): Promise<{ models: PublicModel[]; next: string | null; total: number }> {
    const candidates = (await this.deps.catalog.list()).filter((entry) => matches(entry, query));
    const subscriptions = [...new Set(candidates.map((entry) => entry.subscriptionId))];
    const answers = await Promise.all(subscriptions.map((id) => this.deps.access.grants(id)));
    const granting = new Map(subscriptions.map((id, at) => [id, answers[at] === true]));
    const found = candidates
      .filter((entry) => granting.get(entry.subscriptionId))
      .map(publicViewOf)
      .sort(
        (a, b) =>
          b.publishedAt.localeCompare(a.publishedAt) || a.publicId.localeCompare(b.publicId),
      );
    if (query.limit === undefined) return { models: found, next: null, total: found.length };
    const from = cursorOffset(query.cursor);
    const to = from + query.limit;
    // How many it found, which a pager says as "page 2 of 5" (#438).
    return {
      models: found.slice(from, to),
      next: to < found.length ? String(to) : null,
      total: found.length,
    };
  }
}

/** Where a page of the search starts: the cursor the last page answered, or the start. */
function cursorOffset(cursor: string | null | undefined): number {
  const offset = Number(cursor ?? 0);
  return Number.isInteger(offset) && offset > 0 ? offset : 0;
}

export class ReadCatalogModel {
  constructor(private readonly deps: CatalogReading) {}

  async execute(publicId: string): Promise<Result<PublicModel, DomainError>> {
    const entry = await visible(this.deps, publicId);
    return entry ? ok(publicViewOf(entry)) : err(DomainError.notFound('Model not found'));
  }
}

/**
 * Where a published model notebook is read, for the public route (#431): the
 * subscription and the owner an entry names, and nothing a request says
 * (INV-02).
 */
export type ReadingOf = (
  entry: Pick<CatalogEntry, 'subscriptionId' | 'ownerUserId'>,
) => ModelReading;

/** A published model, read whole as it stands, and nothing else of its subscription (#431). */
export class ReadCatalogContents {
  constructor(private readonly deps: CatalogReading & { readonly readingOf: ReadingOf }) {}

  async execute(publicId: string): Promise<
    Result<
      {
        model: PublicModel;
        document: NotebookDocument;
        references: { undeclared: string[]; unused: string[] };
      },
      DomainError
    >
  > {
    const entry = await visible(this.deps, publicId);
    if (!entry) return err(DomainError.notFound('Model not found'));
    const document = await contentsOf(this.deps.readingOf(entry), entry.notebookId);
    if (!document) return err(DomainError.notFound('Model not found'));
    return ok({
      model: { ...publicViewOf(entry), name: document.notebook.name },
      document,
      references: referenceReport(document, entry.parameters),
    });
  }
}

/** The history of a published model: when and what, never who (#431). */
export class ReadCatalogHistory {
  constructor(private readonly deps: CatalogReading & { readonly readingOf: ReadingOf }) {}

  async execute(
    publicId: string,
  ): Promise<
    Result<{ changes: Array<Omit<ModelChange, 'agent'>>; truncated: boolean }, DomainError>
  > {
    const entry = await visible(this.deps, publicId);
    if (!entry) return err(DomainError.notFound('Model not found'));
    const history = await this.deps.readingOf(entry).history(entry.notebookId);
    return ok({
      changes: history.changes.map(({ agent: _never, ...change }) => change),
      truncated: history.truncated,
    });
  }
}

/**
 * Creates a notebook from a published model (#360, #431), for whoever signs
 * in: the model notebook, as it stands, is copied into their own uploads and
 * imported there with its parameters filled in, as from a model of their own.
 */
export class CreateFromCatalog {
  constructor(
    private readonly deps: CatalogReading,
    private readonly startImport: StartImport,
  ) {}

  async execute(input: {
    publicId: string;
    name: string;
    values: Readonly<Record<string, unknown>>;
    by: Authorship;
  }): Promise<Result<Transfer, DomainError>> {
    const entry = await visible(this.deps, input.publicId);
    if (!entry) return err(DomainError.notFound('Model not found'));
    return startFromModel(this.startImport, {
      subscriptionId: entry.subscriptionId,
      notebookId: entry.notebookId,
      ownerUserId: entry.ownerUserId,
      modelName: entry.name,
      parameters: entry.parameters,
      name: input.name,
      values: input.values,
      by: input.by,
    });
  }
}
