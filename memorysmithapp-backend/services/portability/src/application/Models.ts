/**
 * Notebook models (#344, #431): declaring a notebook of the subscription as a
 * model, reading it as it stands with the history of its changes, and creating
 * independent notebooks from it.
 *
 * Only the owner of the subscription declares a model and edits what it says
 * of itself; editing the model notebook itself follows the permissions of any
 * notebook. A model keeps no copy of its notebook (#431): whoever reads it,
 * its owner, a model reader or the community, reads the notebook where it is,
 * and a notebook created from it is a copy of the notebook at that moment,
 * built by the worker as an export is and written as an import is.
 */

import {
  DomainError,
  err,
  Instant,
  ok,
  type Authorship,
  type Result,
} from '@memorysmithapp/kernel';
import {
  checkedDeclaration,
  type ModelDeclaration,
  type ModelStore,
  type NotebookModel,
} from '../domain/NotebookModel.js';
import {
  buildNotebookDocument,
  type DocumentModel,
  type NotebookDocument,
} from '../domain/NotebookDocumentBuilder.js';
import type { ModelChange, ModelHistory } from '../domain/ModelHistory.js';
import type { ExportSource } from './ExportNotebook.js';
import type { Transfer, TransferStore } from '../domain/Transfer.js';
import type { StartImport } from './Transfers.js';
import { fillText, referenceReport, resolveValues } from '../domain/ParameterFilling.js';

/** A notebook of THIS subscription, never one reached through a share. */
export interface OwnNotebooks {
  own(notebookId: string): Promise<{ name: string; noteCount: number } | null>;
}

/** Who asks, as the model needs to know it. */
export interface ModelCaller {
  readonly subscriptionId: string;
  readonly userId: string;
  /** Whether they own the subscription, which declaring a model asks (#353). */
  readonly isOwner: boolean;
}

/**
 * How a model notebook is read where it is (#431): its parts as they stand,
 * through the reader an export uses, and the entries the trail keeps of it.
 */
export interface ModelReading {
  readonly source: ExportSource;
  /** The history of the model notebook, summarized from its trail by Audit (#446). */
  history(notebookId: string): Promise<ModelHistory>;
}

export interface ModelDependencies {
  readonly models: ModelStore;
  readonly notebooks: OwnNotebooks;
}

/**
 * Where the model of a notebook is read from (#355): the caller's own
 * subscription, or the one an accepted share of the notebook names, a model
 * reader's included. It is resolved by the composition root, which sees the
 * shares; nothing of it comes from the request (INV-02).
 */
export interface ModelSource {
  readonly subscriptionId: string;
  /** The name of the model notebook, which a notebook created from it is named after. */
  readonly name: string;
  readonly deps: { readonly models: ModelStore; readonly reading: ModelReading };
  /** The e-mail of the owner who shared it, or null for a model of one's own. */
  readonly sharedBy: string | null;
}

export interface ModelSources {
  /** The source of the model of a notebook the caller may read, or null (INV-09). */
  of(notebookId: string): Promise<ModelSource | null>;
  /** The models of notebooks shared with the caller and open now, with the name of each. */
  shared(): Promise<Array<{ model: NotebookModel; name: string; sharedBy: string }>>;
}

/** A model as it is listed, and from whom when it was shared. */
export interface ListedModel {
  readonly model: NotebookModel;
  readonly name: string;
  readonly sharedBy: string | null;
}

const ownerOnly = (): DomainError =>
  DomainError.forbiddenVisible('Only the owner of the subscription declares a model');

/**
 * The versions a model had before #431, kept as exports of its owner: what
 * deleting its notebook still destroys, and what the job that deletes every
 * one of them finds.
 */
export async function legacyVersionsOf(
  transfers: TransferStore,
  model: Pick<NotebookModel, 'notebookId' | 'ownerUserId'>,
): Promise<Transfer[]> {
  return (await transfers.list(model.ownerUserId)).filter(
    (transfer) =>
      transfer.kind === 'export' &&
      transfer.notebookId === model.notebookId &&
      transfer.model !== undefined,
  );
}

/**
 * What a model notebook holds now (#431), read through the reader an export
 * uses, without its history and without the bytes of its files: the document
 * a notebook created from it would start as, at this moment.
 */
export async function contentsOf(
  reading: ModelReading,
  notebookId: string,
): Promise<NotebookDocument | null> {
  const input = await reading.source.load(notebookId, undefined, { fileBytes: false });
  return input ? buildNotebookDocument(input, Instant.now().toISOString(), null) : null;
}

/** Declares a notebook of the subscription as a model, or says again what it is. */
export class DeclareModel {
  constructor(
    private readonly deps: ModelDependencies,
    private readonly caller: ModelCaller,
    /**
     * What else says the model again once it is declared: the entry of a
     * published model, which the community reads (#431).
     */
    private readonly declared: (notebookId: string) => Promise<void> = async () => undefined,
  ) {}

  async execute(input: {
    notebookId: string;
    declaration: ModelDeclaration;
  }): Promise<Result<NotebookModel, DomainError>> {
    if (!this.caller.isOwner) return err(ownerOnly());
    const notebook = await this.deps.notebooks.own(input.notebookId);
    if (!notebook) return err(DomainError.notFound('Notebook not found'));
    const declared = checkedDeclaration(input.declaration);
    if (!declared.ok) return declared;

    const now = Instant.now().toISOString();
    const held = await this.deps.models.get(input.notebookId);
    const model: NotebookModel = {
      notebookId: input.notebookId,
      ...declared.value,
      ownerUserId: held?.ownerUserId ?? this.caller.userId,
      declaredAt: held?.declaredAt ?? now,
      updatedAt: now,
      licenceAcceptedAt: held?.licenceAcceptedAt ?? null,
      publicId: held?.publicId ?? null,
    };
    await this.deps.models.put(model);
    await this.declared(model.notebookId);
    return ok(model);
  }
}

/**
 * A model, for whoever may read its notebook or holds a share of it (#355),
 * with the name of its notebook and from whom when it was shared.
 */
export class GetModel {
  constructor(private readonly sources: ModelSources) {}

  async execute(
    notebookId: string,
  ): Promise<Result<{ model: NotebookModel; name: string; sharedBy: string | null }, DomainError>> {
    // A notebook the caller may not read is answered as one with no model,
    // whether it has one or not (INV-09).
    const source = await this.sources.of(notebookId);
    if (!source) return err(DomainError.notFound('Model not found'));
    const model = await source.deps.models.get(notebookId);
    if (!model) return err(DomainError.notFound('Model not found'));
    return ok({ model, name: source.name, sharedBy: source.sharedBy });
  }
}

/**
 * The models its caller may use: those of the subscription whose notebook they
 * may read, with the name of each, and those shared with them (#355).
 */
export class ListModels {
  constructor(
    private readonly deps: Pick<ModelDependencies, 'models' | 'notebooks'>,
    private readonly canRead: (notebookId: string) => Promise<boolean>,
    private readonly sources: ModelSources,
  ) {}

  /**
   * The models of the subscription and the ones shared are read at once, and
   * of each model whether it may be read and its name at once too (#420): the
   * list answers once, so it waits for the slowest of its reads, never for
   * their sum.
   */
  async execute(): Promise<Result<ListedModel[], DomainError>> {
    const [own, shared] = await Promise.all([this.own(), this.sources.shared()]);
    return ok([...own, ...shared]);
  }

  private async own(): Promise<ListedModel[]> {
    const read = await Promise.all(
      (await this.deps.models.list()).map(async (model): Promise<ListedModel | null> => {
        const [readable, notebook] = await Promise.all([
          this.canRead(model.notebookId),
          this.deps.notebooks.own(model.notebookId),
        ]);
        return readable && notebook ? { model, name: notebook.name, sharedBy: null } : null;
      }),
    );
    return read.filter((listed) => listed !== null);
  }
}

/** What a model holds now, read whole (#431): what is reviewed before it is shared. */
export interface ModelContents {
  readonly model: NotebookModel;
  readonly document: NotebookDocument;
  /** What the notebook writes and the model declares, compared (RN-PRT-064). */
  readonly references: { undeclared: string[]; unused: string[] };
}

/** The model notebook as it stands, for whoever reads the model (#431). */
export class ViewModel {
  constructor(private readonly sources: ModelSources) {}

  async execute(notebookId: string): Promise<Result<ModelContents, DomainError>> {
    const source = await this.sources.of(notebookId);
    if (!source) return err(DomainError.notFound('Model not found'));
    const model = await source.deps.models.get(notebookId);
    if (!model) return err(DomainError.notFound('Model not found'));
    const document = await contentsOf(source.deps.reading, notebookId);
    if (!document) return err(DomainError.notFound('Model not found'));
    return ok({ model, document, references: referenceReport(document, model.parameters) });
  }
}

/** The history of a model, for whoever reads it (#431): the changes of its notebook. */
export class ReadModelHistory {
  constructor(private readonly sources: ModelSources) {}

  async execute(
    notebookId: string,
  ): Promise<Result<{ changes: ModelChange[]; truncated: boolean }, DomainError>> {
    const source = await this.sources.of(notebookId);
    if (!source) return err(DomainError.notFound('Model not found'));
    if (!(await source.deps.models.get(notebookId))) {
      return err(DomainError.notFound('Model not found'));
    }
    return ok(await source.deps.reading.history(notebookId));
  }
}

/**
 * The notebook of a model was deleted (#353): its model goes with it,
 * definitively (INV-08), with any version kept from before #431, and nothing
 * created from it is touched.
 */
export class ForgetModel {
  constructor(
    private readonly deps: Pick<ModelDependencies, 'models'> & {
      readonly transfers: TransferStore;
    },
    private readonly destroy: (transfer: Transfer) => Promise<void>,
  ) {}

  async execute(notebookId: string): Promise<void> {
    const model = await this.deps.models.get(notebookId);
    if (!model) return;
    for (const version of await legacyVersionsOf(this.deps.transfers, model)) {
      await this.destroy(version);
    }
    await this.deps.models.remove(notebookId);
  }
}

/**
 * Creates an independent notebook from a model (#359, #431): the parameters
 * the model declares are filled in with what the person supplied, or refused
 * before anything is written when one is required and missing or not of its
 * type (#354). The worker copies the model notebook as it stands when it runs,
 * without its history, into the caller's uploads and imports it there as any
 * kept export is, every identifier minted anew. The import records which model
 * it came from, as information only: nothing of the model is read again once
 * the notebook exists.
 *
 * A model shared with the caller is read in its owner's subscription and the
 * notebook is written in the caller's own (#355), and counts there.
 */
export class CreateFromModel {
  constructor(
    private readonly sources: ModelSources,
    private readonly startImport: StartImport,
  ) {}

  async execute(input: {
    notebookId: string;
    /** The name of the new notebook; the name of the model, filled in, when empty. */
    name: string;
    values: Readonly<Record<string, unknown>>;
    by: Authorship;
  }): Promise<Result<Transfer, DomainError>> {
    const source = await this.sources.of(input.notebookId);
    if (!source) return err(DomainError.notFound('Model not found'));
    const model = await source.deps.models.get(input.notebookId);
    if (!model) return err(DomainError.notFound('Model not found'));
    return startFromModel(this.startImport, {
      subscriptionId: source.subscriptionId,
      notebookId: input.notebookId,
      ownerUserId: model.ownerUserId,
      modelName: source.name,
      parameters: model.parameters,
      name: input.name,
      values: input.values,
      by: input.by,
    });
  }
}

/**
 * Starts the import of a copy of a model notebook, wherever the model was
 * reached from: one's own, a share, or the community catalog (#431).
 */
export async function startFromModel(
  startImport: StartImport,
  input: {
    subscriptionId: string;
    notebookId: string;
    ownerUserId: string;
    modelName: string;
    parameters: NotebookModel['parameters'];
    name: string;
    values: Readonly<Record<string, unknown>>;
    by: Authorship;
  },
): Promise<Result<Transfer, DomainError>> {
  const values = resolveValues(input.parameters, input.values);
  if (!values.ok) return values;
  return startImport.execute({
    fromModel: {
      subscriptionId: input.subscriptionId,
      notebookId: input.notebookId,
      ownerUserId: input.ownerUserId,
      name: input.modelName,
    },
    name: input.name.trim() || fillText(input.modelName, values.value),
    selection: null,
    by: input.by,
    fill: {
      declarations: input.parameters,
      values: Object.fromEntries([...values.value].map(([key, each]) => [key, each.value])),
    },
    origin: { subscriptionId: input.subscriptionId, notebookId: input.notebookId },
  });
}

/**
 * The model an export of its notebook carries (#397, RN-PRT-073): what it says
 * of itself. Its history is the history of the notebook, which the export
 * carries when it carries the history (#431).
 */
export class CarriedModel {
  constructor(private readonly deps: Pick<ModelDependencies, 'models'>) {}

  async of(notebookId: string): Promise<DocumentModel | null> {
    const model = await this.deps.models.get(notebookId);
    if (!model) return null;
    return {
      objective: model.objective,
      description: model.description,
      audience: model.audience,
      parameters: model.parameters,
      basedOn: model.basedOn,
    };
  }
}

/** What restoring a model wrote, for the report of the import. */
export interface RestoredModel {
  /** False when the person importing does not own the subscription, who alone declares one. */
  readonly declared: boolean;
}

/**
 * Declares again, in the subscription an import writes in, the model the
 * document carried (#397, RN-PRT-073), its owner the person importing. Only
 * the owner of the subscription declares a model (RN-PRT-033): anybody else
 * imports the notebook alone. A publication in the community catalog is never
 * carried, so the model arrives unpublished and with no licence accepted, and
 * the versions a `1.4` document carries are left out, since a model has none
 * (#431).
 */
export class RestoreModel {
  constructor(
    private readonly deps: { readonly models: ModelStore },
    private readonly caller: ModelCaller,
  ) {}

  async restore(input: {
    notebookId: string;
    notebookName: string;
    model: DocumentModel;
  }): Promise<Result<RestoredModel, DomainError>> {
    if (!this.caller.isOwner) return ok({ declared: false });
    const declared = checkedDeclaration(input.model);
    if (!declared.ok) return declared;

    const now = Instant.now().toISOString();
    await this.deps.models.put({
      notebookId: input.notebookId,
      ...declared.value,
      ownerUserId: this.caller.userId,
      declaredAt: now,
      updatedAt: now,
      licenceAcceptedAt: null,
      publicId: null,
    });
    return ok({ declared: true });
  }
}
