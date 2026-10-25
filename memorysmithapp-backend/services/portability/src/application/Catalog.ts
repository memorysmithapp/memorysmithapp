/**
 * The community catalog (#360): publishing a model, withdrawing it, finding
 * and reading what is published, creating a notebook from it, and reporting
 * it to the operator of the platform, who may withdraw it.
 *
 * A published model is read where it is, in its author's subscription,
 * through its catalog entry and nothing else (#356): the entry names the
 * subscription and the retained versions, and every public read starts from
 * it. Nothing is copied by publishing, so publishing and withdrawing change
 * no storage, and a notebook created from a published model is written and
 * counted in the subscription of whoever creates it.
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
  type CatalogReport,
  type CatalogReports,
  type CatalogStore,
  type CatalogVersion,
  type PublicModel,
} from '../domain/CommunityCatalog.js';
import type { NotebookDocument } from '../domain/NotebookDocumentBuilder.js';
import type { ModelStore, NotebookModel } from '../domain/NotebookModel.js';
import { referenceReport, resolveValues, fillText } from '../domain/ParameterFilling.js';
import type { Transfer, TransferStore } from '../domain/Transfer.js';
import { freshUploadKey } from './ImportNotebook.js';
import {
  versionsOf,
  type ModelCaller,
  type OwnNotebooks,
  type VersionCopier,
  type VersionReader,
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

/** Tells the author that the operator withdrew their model (#358). */
export interface AuthorNotifier {
  withdrawn(entry: CatalogEntry, reason: string): Promise<void>;
}

/** Who publishes: the name the catalog shows, and the e-mail it never shows (#357). */
export interface Author {
  readonly name: string | null;
  readonly email: string;
}

/** The operator of the platform, who holds no subscription (INV-12). */
export interface PlatformActor {
  readonly userId: string;
  readonly isPlatformAdmin: boolean;
}

export interface PublicationDependencies {
  readonly models: ModelStore;
  readonly transfers: TransferStore;
  readonly notebooks: OwnNotebooks;
  readonly catalog: CatalogStore;
  readonly cache: CatalogCache;
}

const LANGUAGE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const ownerOnly = (): DomainError =>
  DomainError.forbiddenVisible('Only the owner of the subscription publishes a model');

/** The versions of a model a catalog entry retains: every ready one, the newest first. */
async function retainedVersions(
  transfers: TransferStore,
  model: NotebookModel,
): Promise<{ versions: CatalogVersion[]; name: string | null }> {
  const ready = (await versionsOf(transfers, model)).filter(
    (version) => version.status === 'ready' && version.transfer.key,
  );
  return {
    versions: ready.map((version) => ({
      number: version.number,
      changelog: version.changelog,
      createdAt: version.createdAt,
      bytes: version.bytes,
      key: version.transfer.key ?? '',
      versionId: version.transfer.versionId ?? null,
      parameters: version.transfer.model?.parameters ?? model.parameters,
    })),
    name: ready[0]?.transfer.notebookName ?? null,
  };
}

/**
 * Says the entry of a published model again from its versions (#360): a
 * version made ready joins it, a deleted one leaves it, and a model with no
 * version left is withdrawn. A model not published, or withdrawn by the
 * operator, is left as it is.
 */
export async function refreshPublication(
  deps: Pick<PublicationDependencies, 'models' | 'transfers' | 'catalog' | 'cache'>,
  notebookId: string,
): Promise<void> {
  const model = await deps.models.get(notebookId);
  if (!model?.publicId) return;
  const entry = await deps.catalog.get(model.publicId);
  if (!entry) return;
  const { versions, name } = await retainedVersions(deps.transfers, model);
  if (versions.length === 0) {
    await deps.catalog.remove(model.publicId);
    await deps.models.put({ ...model, publicId: null });
    await deps.cache.invalidate(model.publicId);
    return;
  }
  await deps.catalog.put({
    ...entry,
    name: name ?? entry.name,
    objective: model.objective,
    description: model.description,
    audience: model.audience,
    basedOn: model.basedOn,
    versions,
  });
}

/**
 * Publishes a model to the community (#360): only its owner, with at least one
 * ready version, a language, a name of their own to be shown by, and CC0 1.0,
 * which every distribution of a model is under and which is accepted once
 * (#357). Publishing again says the entry again.
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
    if (!model || !(await this.deps.notebooks.own(input.notebookId))) {
      return err(DomainError.notFound('Model not found'));
    }
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
    const { versions, name } = await retainedVersions(this.deps.transfers, model);
    if (versions.length === 0) {
      return err(DomainError.conflict('A model is published with at least one ready version'));
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
      name: name ?? '',
      objective: model.objective,
      description: model.description,
      audience: model.audience,
      language,
      basedOn: model.basedOn,
      publishedAt: held?.publishedAt ?? now,
      versions,
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
  if (!entry || entry.versions.length === 0) return null;
  return (await deps.access.grants(entry.subscriptionId)) ? entry : null;
}

/** Finds published models by every word asked, and by language (#358). */
export class SearchCatalog {
  constructor(private readonly deps: CatalogReading) {}

  async execute(query: { text: string; language: string | null }): Promise<PublicModel[]> {
    const granting = new Map<string, boolean>();
    const found: PublicModel[] = [];
    for (const entry of await this.deps.catalog.list()) {
      if (entry.versions.length === 0 || !matches(entry, query)) continue;
      let grants = granting.get(entry.subscriptionId);
      if (grants === undefined) {
        grants = await this.deps.access.grants(entry.subscriptionId);
        granting.set(entry.subscriptionId, grants);
      }
      if (grants) found.push(publicViewOf(entry));
    }
    return found.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}

export class ReadCatalogModel {
  constructor(private readonly deps: CatalogReading) {}

  async execute(publicId: string): Promise<Result<PublicModel, DomainError>> {
    const entry = await visible(this.deps, publicId);
    return entry ? ok(publicViewOf(entry)) : err(DomainError.notFound('Model not found'));
  }
}

/** A published version, read whole: its snapshot and nothing else of the subscription. */
export class ReadCatalogVersion {
  constructor(private readonly deps: CatalogReading & { readonly versions: VersionReader }) {}

  async execute(input: { publicId: string; number: number }): Promise<
    Result<
      {
        model: PublicModel;
        version: CatalogVersion;
        document: NotebookDocument;
        references: { undeclared: string[]; unused: string[] };
      },
      DomainError
    >
  > {
    const entry = await visible(this.deps, input.publicId);
    const version = entry?.versions.find((each) => each.number === input.number);
    if (!entry || !version) return err(DomainError.notFound('Version not found'));
    const document = await this.deps.versions.read(version.key, version.versionId);
    if (!document) return err(DomainError.notFound('Version not found'));
    return ok({
      model: publicViewOf(entry),
      version,
      document,
      references: referenceReport(document, version.parameters),
    });
  }
}

/**
 * Creates a notebook from a published version (#360), for whoever signs in: the
 * snapshot is copied into their own uploads and imported there with its
 * parameters filled in, as from a model of their own (#359).
 */
export class CreateFromCatalog {
  constructor(
    private readonly deps: CatalogReading,
    private readonly caller: ModelCaller,
    private readonly copier: VersionCopier,
    private readonly startImport: StartImport,
  ) {}

  async execute(input: {
    publicId: string;
    number: number;
    name: string;
    values: Readonly<Record<string, unknown>>;
    by: Authorship;
  }): Promise<Result<Transfer, DomainError>> {
    const entry = await visible(this.deps, input.publicId);
    const version = entry?.versions.find((each) => each.number === input.number);
    if (!entry || !version) return err(DomainError.notFound('Version not found'));
    const values = resolveValues(version.parameters, input.values);
    if (!values.ok) return values;

    const uploadKey = freshUploadKey(this.caller.subscriptionId);
    if (!(await this.copier.copyFrom(version.key, uploadKey))) {
      return err(DomainError.notFound('Version not found'));
    }
    return this.startImport.execute({
      uploadKey,
      name: input.name.trim() || fillText(entry.name, values.value),
      selection: null,
      by: input.by,
      fill: {
        declarations: version.parameters,
        values: Object.fromEntries([...values.value].map(([key, each]) => [key, each.value])),
      },
      origin: {
        subscriptionId: entry.subscriptionId,
        notebookId: entry.notebookId,
        version: version.number,
      },
    });
  }
}

/** A person who signed in reports a published model to the operator (#358). */
export class ReportModel {
  constructor(
    private readonly deps: CatalogReading & { readonly reports: CatalogReports },
    private readonly reporterUserId: string,
  ) {}

  async execute(input: { publicId: string; reason: string }): Promise<Result<void, DomainError>> {
    const reason = input.reason.trim();
    if (reason.length === 0 || reason.length > 1000) {
      return err(DomainError.validation('A report says why, in at most 1000 characters'));
    }
    if (!(await visible(this.deps, input.publicId))) {
      return err(DomainError.notFound('Model not found'));
    }
    await this.deps.reports.add({
      reportId: ulid(),
      publicId: input.publicId,
      reason,
      reporterUserId: this.reporterUserId,
      reportedAt: Instant.now().toISOString(),
    });
    return ok();
  }
}

function operatorOnly(actor: PlatformActor): Result<void, DomainError> {
  return actor.isPlatformAdmin
    ? ok()
    : err(DomainError.forbidden('Only the operator of the platform reads the reports'));
}

/** The reports waiting for the operator, each with the model it is about, if still published. */
export class ListReports {
  constructor(
    private readonly deps: { readonly catalog: CatalogStore; readonly reports: CatalogReports },
    private readonly actor: PlatformActor,
  ) {}

  async execute(): Promise<
    Result<Array<{ report: CatalogReport; model: PublicModel | null }>, DomainError>
  > {
    const allowed = operatorOnly(this.actor);
    if (!allowed.ok) return allowed;
    const listed: Array<{ report: CatalogReport; model: PublicModel | null }> = [];
    for (const report of await this.deps.reports.list()) {
      const entry = await this.deps.catalog.get(report.publicId);
      listed.push({ report, model: entry ? publicViewOf(entry) : null });
    }
    return ok(listed);
  }
}

/**
 * The operator withdraws a model from the catalog (#358): its entry is deleted
 * and nothing else, because a platform session reaches no customer content
 * (INV-12), and the author is told by e-mail why.
 */
export class WithdrawByOperator {
  constructor(
    private readonly deps: {
      readonly catalog: CatalogStore;
      readonly cache: CatalogCache;
      readonly notifier: AuthorNotifier;
    },
    private readonly actor: PlatformActor,
  ) {}

  async execute(input: { publicId: string; reason: string }): Promise<Result<void, DomainError>> {
    const allowed = operatorOnly(this.actor);
    if (!allowed.ok) return allowed;
    const reason = input.reason.trim();
    if (reason.length === 0) {
      return err(DomainError.validation('A withdrawal says why, which the author is told'));
    }
    const entry = await this.deps.catalog.get(input.publicId);
    if (!entry) return err(DomainError.notFound('Model not found'));
    await this.deps.catalog.remove(entry.publicId);
    await this.deps.cache.invalidate(entry.publicId);
    await this.deps.notifier.withdrawn(entry, reason);
    return ok();
  }
}

export class DismissReport {
  constructor(
    private readonly deps: { readonly reports: CatalogReports },
    private readonly actor: PlatformActor,
  ) {}

  async execute(reportId: string): Promise<Result<void, DomainError>> {
    const allowed = operatorOnly(this.actor);
    if (!allowed.ok) return allowed;
    await this.deps.reports.remove(reportId);
    return ok();
  }
}
