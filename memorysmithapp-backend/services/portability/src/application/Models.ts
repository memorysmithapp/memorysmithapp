/**
 * Notebook models (#344, #353): declaring a notebook of the subscription as a
 * model, and freezing it into versions.
 *
 * Only the owner of the subscription declares a model, edits what it says of
 * itself and creates its versions, because a model and its versions occupy the
 * storage of the subscription; editing the model notebook itself follows the
 * permissions of any notebook. A version is an export of the model notebook
 * without history, kept under the prefix of its model and counted once, as a
 * kept export is (RN-PRT-020); it never changes after it is created.
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
  checkedChangelog,
  checkedDeclaration,
  type ModelDeclaration,
  type ModelStore,
  type NotebookModel,
} from '../domain/NotebookModel.js';
import type { NotebookDocument } from '../domain/NotebookDocumentBuilder.js';
import { startedTransfer, type Transfer, type TransferStore } from '../domain/Transfer.js';
import type { StorageBudget, TransferQueue } from './Transfers.js';

/** A notebook of THIS subscription, never one reached through a share. */
export interface OwnNotebooks {
  own(notebookId: string): Promise<{ name: string; noteCount: number } | null>;
}

/** Reads the snapshot a version froze, as the export document it is. */
export interface VersionReader {
  read(key: string, versionId: string | null): Promise<NotebookDocument | null>;
}

/** Who asks, as the model needs to know it. */
export interface ModelCaller {
  readonly subscriptionId: string;
  readonly userId: string;
  /** Whether they own the subscription, which declaring and versioning ask (#353). */
  readonly isOwner: boolean;
}

export interface ModelDependencies {
  readonly models: ModelStore;
  readonly transfers: TransferStore;
  readonly notebooks: OwnNotebooks;
  readonly queue: TransferQueue;
  readonly budget: StorageBudget;
  readonly versions: VersionReader;
}

/** A version, as its model shows it: the frozen meta and the export that holds it. */
export interface ModelVersion {
  readonly number: number;
  readonly changelog: string;
  readonly createdAt: string;
  readonly status: Transfer['status'];
  readonly bytes: number;
  readonly transferId: string;
  readonly transfer: Transfer;
}

const ownerOnly = (): DomainError =>
  DomainError.forbiddenVisible('Only the owner of the subscription declares and versions a model');

function versionOf(transfer: Transfer): ModelVersion | null {
  if (!transfer.model) return null;
  return {
    number: transfer.model.number,
    changelog: transfer.model.changelog,
    createdAt: transfer.requestedAt,
    status: transfer.status,
    bytes: transfer.bytes,
    transferId: transfer.transferId,
    transfer,
  };
}

/** The versions of a model, the newest first, from the exports of its owner. */
export async function versionsOf(
  transfers: TransferStore,
  model: NotebookModel,
): Promise<ModelVersion[]> {
  const listed = await transfers.list(model.ownerUserId);
  return listed
    .filter((transfer) => transfer.kind === 'export' && transfer.notebookId === model.notebookId)
    .map(versionOf)
    .filter((version): version is ModelVersion => version !== null)
    .sort((a, b) => b.number - a.number);
}

/** Declares a notebook of the subscription as a model, or says again what it is. */
export class DeclareModel {
  constructor(
    private readonly deps: ModelDependencies,
    private readonly caller: ModelCaller,
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
      nextVersion: held?.nextVersion ?? 1,
    };
    await this.deps.models.put(model);
    return ok(model);
  }
}

/** A model of the subscription, for whoever may read its notebook. */
export class GetModel {
  constructor(
    private readonly deps: Pick<ModelDependencies, 'models' | 'transfers'>,
    private readonly canRead: (notebookId: string) => Promise<boolean>,
  ) {}

  async execute(
    notebookId: string,
  ): Promise<Result<{ model: NotebookModel; versions: ModelVersion[] }, DomainError>> {
    // A notebook the caller may not read is answered as one with no model,
    // whether it has one or not (INV-09).
    if (!(await this.canRead(notebookId))) return err(DomainError.notFound('Model not found'));
    const model = await this.deps.models.get(notebookId);
    if (!model) return err(DomainError.notFound('Model not found'));
    return ok({ model, versions: await versionsOf(this.deps.transfers, model) });
  }
}

/** The models of the subscription its caller may read, with the name of each notebook. */
export class ListModels {
  constructor(
    private readonly deps: Pick<ModelDependencies, 'models' | 'notebooks'>,
    private readonly canRead: (notebookId: string) => Promise<boolean>,
  ) {}

  async execute(): Promise<Result<Array<{ model: NotebookModel; name: string }>, DomainError>> {
    const models = await this.deps.models.list();
    const readable: Array<{ model: NotebookModel; name: string }> = [];
    for (const model of models) {
      if (!(await this.canRead(model.notebookId))) continue;
      const notebook = await this.deps.notebooks.own(model.notebookId);
      if (notebook) readable.push({ model, name: notebook.name });
    }
    return ok(readable);
  }
}

/**
 * Freezes the model notebook into its next version (#353): a number taken
 * once, the changelog the author wrote, what the model says of itself as it is
 * now, and an export of the notebook without history, built by the worker.
 */
export class CreateModelVersion {
  constructor(
    private readonly deps: ModelDependencies,
    private readonly caller: ModelCaller,
  ) {}

  async execute(input: {
    notebookId: string;
    changelog: string;
    by: Authorship;
  }): Promise<Result<ModelVersion, DomainError>> {
    if (!this.caller.isOwner) return err(ownerOnly());
    const model = await this.deps.models.get(input.notebookId);
    if (!model) return err(DomainError.notFound('Model not found'));
    const notebook = await this.deps.notebooks.own(input.notebookId);
    if (!notebook) return err(DomainError.notFound('Notebook not found'));
    const changelog = checkedChangelog(input.changelog);
    if (!changelog.ok) return changelog;

    // A version counts in the storage of the plan like any kept export, so a
    // plan with no room refuses it before the work (RN-SUB-021).
    const budget = await this.deps.budget.current();
    if (budget.usedBytes >= budget.limitBytes) {
      return err(
        DomainError.limitExceeded('The storage of this plan is full: delete something first'),
      );
    }

    const number = await this.deps.models.takeVersionNumber(input.notebookId);
    if (number === null) return err(DomainError.notFound('Model not found'));

    const transfer: Transfer = {
      ...startedTransfer({
        transferId: ulid(),
        kind: 'export',
        // The versions of a model are its owner's exports, wherever the
        // person creating one sits, so they are listed in one place.
        userId: model.ownerUserId,
        notebookId: input.notebookId,
        notebookName: notebook.name,
        requestedAt: Instant.now().toISOString(),
        total: notebook.noteCount,
      }),
      model: {
        number,
        changelog: changelog.value,
        objective: model.objective,
        description: model.description,
        audience: model.audience,
        parameters: model.parameters,
        basedOn: model.basedOn,
      },
    };
    await this.deps.transfers.put(transfer);
    await this.deps.queue.send({
      subscriptionId: this.caller.subscriptionId,
      userId: model.ownerUserId,
      transferId: transfer.transferId,
      kind: 'export',
      notebookId: input.notebookId,
      selection: null,
      modelVersion: true,
    });
    return ok(versionOf(transfer) as ModelVersion);
  }
}

/** What a version holds, read from its snapshot (#353): what is reviewed before it is distributed. */
export interface VersionView {
  readonly model: NotebookModel;
  readonly version: ModelVersion;
  readonly document: NotebookDocument;
}

export class ViewModelVersion {
  constructor(
    private readonly deps: Pick<ModelDependencies, 'models' | 'transfers' | 'versions'>,
    private readonly canRead: (notebookId: string) => Promise<boolean>,
  ) {}

  async execute(input: {
    notebookId: string;
    number: number;
  }): Promise<Result<VersionView, DomainError>> {
    if (!(await this.canRead(input.notebookId))) {
      return err(DomainError.notFound('Version not found'));
    }
    const model = await this.deps.models.get(input.notebookId);
    if (!model) return err(DomainError.notFound('Version not found'));
    const version = (await versionsOf(this.deps.transfers, model)).find(
      (each) => each.number === input.number,
    );
    if (!version) return err(DomainError.notFound('Version not found'));
    if (version.status !== 'ready' || !version.transfer.key) {
      return err(DomainError.conflict('This version is still being created, or it failed'));
    }
    const document = await this.deps.versions.read(
      version.transfer.key,
      version.transfer.versionId,
    );
    if (!document) return err(DomainError.notFound('Version not found'));
    return ok({ model, version, document });
  }
}

/**
 * Deletes one version (#353): its bytes are destroyed and stop being counted,
 * and the notebooks created from it are not touched, because each one is a
 * completed copy.
 */
export class DeleteModelVersion {
  constructor(
    private readonly deps: Pick<ModelDependencies, 'models' | 'transfers'>,
    private readonly caller: ModelCaller,
    private readonly destroy: (transfer: Transfer) => Promise<void>,
  ) {}

  async execute(input: { notebookId: string; number: number }): Promise<Result<void, DomainError>> {
    if (!this.caller.isOwner) return err(ownerOnly());
    const model = await this.deps.models.get(input.notebookId);
    if (!model) return err(DomainError.notFound('Version not found'));
    const version = (await versionsOf(this.deps.transfers, model)).find(
      (each) => each.number === input.number,
    );
    if (!version) return err(DomainError.notFound('Version not found'));
    if (version.status === 'running') {
      return err(
        DomainError.conflict('This version is still being created: delete it once it ends'),
      );
    }
    await this.destroy(version.transfer);
    return ok();
  }
}

/**
 * The notebook of a model was deleted (#353): its model and every version go
 * with it, definitively (INV-08), and nothing created from it is touched.
 */
export class ForgetModel {
  constructor(
    private readonly deps: Pick<ModelDependencies, 'models' | 'transfers'>,
    private readonly destroy: (transfer: Transfer) => Promise<void>,
  ) {}

  async execute(notebookId: string): Promise<void> {
    const model = await this.deps.models.get(notebookId);
    if (!model) return;
    for (const version of await versionsOf(this.deps.transfers, model)) {
      await this.destroy(version.transfer);
    }
    await this.deps.models.remove(notebookId);
  }
}
