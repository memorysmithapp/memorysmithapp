/**
 * What fills the space of the subscription, as far as Knowledge holds it
 * (#197, RN-SUB-024).
 *
 * Every number here comes from a counter the relay keeps; nothing lists a note
 * or a file. The one listing on the path is the listing of notebooks, which is
 * what decides WHICH of them the requester sees and what each is called now.
 *
 * Two halves, answered differently on purpose:
 *
 *  - **The totals are about the subscription**, which is what the quota is
 *    about, and they are the same whoever asks.
 *  - **The lines per notebook are about the requester**: only a notebook they
 *    may read is listed, by the same rule that answers `404` for one they may
 *    not (rule 9). A notebook deleted and waiting for its purge still holds its
 *    bytes, so it stays listed until the purge ends, for whoever could read it.
 *
 * The kept exports are not here: they belong to Portability, and the
 * composition root is where the two meet.
 */

import { NotebookId, ok, type DomainError, type Result } from '@memorysmith/kernel';
import { AuthorizationPolicy, type RequestContext } from '../domain/access/AuthorizationPolicy.js';
import type { Notebook } from '../domain/notebook/Notebook.js';
import type { NotebookRepository } from '../domain/ports/index.js';
import {
  EMPTY_NOTEBOOK_USAGE,
  type NotebookUsageCounters,
  type StorageUsageReader,
  type SubscriptionUsageCounters,
} from '../domain/services/StorageUsage.js';

export interface UsageDependencies {
  readonly notebooks: NotebookRepository;
  readonly usage: StorageUsageReader;
}

/** One notebook the requester sees, and what it holds. */
export interface NotebookUsageLine extends NotebookUsageCounters {
  readonly notebookId: string;
  readonly name: string;
}

export interface KnowledgeUsage {
  readonly subscription: SubscriptionUsageCounters;
  readonly notebooks: readonly NotebookUsageLine[];
}

export class ReadStorageUsage {
  constructor(private readonly deps: UsageDependencies) {}

  async execute(input: { ctx: RequestContext }): Promise<Result<KnowledgeUsage, DomainError>> {
    const [snapshot, live] = await Promise.all([
      this.deps.usage.read(),
      this.deps.notebooks.listAll(),
    ]);

    const seen = new Set(live.map((notebook) => notebook.id.value));
    // The lines whose notebook is no longer listed: deleted and waiting for the
    // purge, or already gone and waiting for the relay to say so. Loading one
    // tells the two apart, and there are only ever a few.
    const pending: Notebook[] = [];
    for (const notebookId of snapshot.notebooks.keys()) {
      if (seen.has(notebookId)) continue;
      const id = NotebookId.create(notebookId);
      if (!id.ok) continue;
      const found = await this.deps.notebooks.findById(id.value);
      if (found) pending.push(found);
    }

    const lines = [...live, ...pending]
      .filter((notebook) => AuthorizationPolicy.effectiveRole(input.ctx, notebook).canRead())
      .map((notebook) => ({
        notebookId: notebook.id.value,
        name: notebook.name.value,
        ...(snapshot.notebooks.get(notebook.id.value) ?? EMPTY_NOTEBOOK_USAGE),
      }));

    return ok({ subscription: snapshot.subscription, notebooks: lines });
  }
}
