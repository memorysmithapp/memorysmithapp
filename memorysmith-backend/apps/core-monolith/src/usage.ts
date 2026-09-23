/**
 * What fills the space of a subscription (#197, RN-SUB-024), joined HERE.
 *
 * The answer has four owners and none of them may read the table of another:
 * the content, by kind and by notebook, is Knowledge's; the kept exports are
 * Portability's; the quota is Access's; and which notebooks the requester sees
 * is decided by Knowledge over the role Access resolved. A composition root is
 * what joins them, exactly as it joins the storage budget the session reads —
 * and `usedBytes` IS that budget, so the two can never disagree.
 *
 * Every number is a counter. Nothing on this path lists a note or a file.
 */

import { DomainError, ok, type Result } from '@memorysmith/kernel';
import type { SubscriptionUsageDto } from '@memorysmith/contracts';
import type { SubscriptionUsageQuery } from '@memorysmith/svc-access/adapters/http';
import type { RequestContext, StorageState } from '@memorysmith/svc-knowledge/domain';
import type { KnowledgeUsage } from '@memorysmith/svc-knowledge/application/usage';
import type { KeptUsage } from '@memorysmith/svc-portability/domain/transfer';

export interface UsageSources {
  /** The requester's standing in the subscription, which Access resolves. */
  readonly resolve: () => Promise<Result<RequestContext, DomainError>>;
  /** What Knowledge holds, with the notebooks this requester sees. */
  readonly knowledge: (ctx: RequestContext) => Promise<Result<KnowledgeUsage, DomainError>>;
  /** What the kept exports occupy, from Portability. */
  readonly kept: () => Promise<KeptUsage>;
  /** The budget the session reports: the used bytes and the quota. */
  readonly budget: () => Promise<StorageState>;
}

const NOTHING_KEPT: KeptUsage = { count: 0, bytes: 0, byNotebook: new Map() };

export class SubscriptionUsageReport implements SubscriptionUsageQuery {
  constructor(private readonly sources: UsageSources) {}

  async execute(): Promise<Result<SubscriptionUsageDto, DomainError>> {
    const ctx = await this.sources.resolve();
    if (!ctx.ok) return ctx;

    const [knowledge, kept, budget] = await Promise.all([
      this.sources.knowledge(ctx.value),
      // A transient failure of the other table must not fail the panel: the
      // session reads the kept bytes the same forgiving way.
      this.sources.kept().catch(() => NOTHING_KEPT),
      this.sources.budget(),
    ]);
    if (!knowledge.ok) return knowledge;

    const totals = knowledge.value.subscription;
    const notebooks = knowledge.value.notebooks
      .map((line) => {
        const exports = kept.byNotebook.get(line.notebookId);
        return {
          notebookId: line.notebookId,
          name: line.name,
          // What the notebook occupies includes the exports made of it, so for
          // the owner the lines add up to the total the quota is about.
          bytes: line.bytes + (exports?.bytes ?? 0),
          notes: line.notes,
          folders: line.folders,
          files: line.files,
          exports: exports?.count ?? 0,
        };
      })
      .sort((left, right) => right.bytes - left.bytes || left.name.localeCompare(right.name, 'en'));

    return ok({
      usedBytes: Math.max(0, budget.usedBytes),
      quotaBytes: budget.limitBytes,
      byType: {
        notes: { count: totals.noteCount, bytes: totals.noteBytes },
        files: { count: totals.fileCount, bytes: totals.fileBytes },
        exports: { count: kept.count, bytes: kept.bytes },
        others: { count: totals.otherCount, bytes: totals.otherBytes },
      },
      counts: {
        notebooks: totals.notebooks,
        folders: totals.folders,
        revisions: totals.revisions,
      },
      notebooks,
    });
  }
}

/** The one refusal a session with no subscription gets, as every Access route gives it. */
export function noSubscription(): Result<never, DomainError> {
  return { ok: false, error: DomainError.forbidden('This session carries no active subscription') };
}
