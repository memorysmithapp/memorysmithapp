/**
 * What the Audit context hands over when an export was asked to carry the
 * history of a notebook (RN-PRT-022).
 *
 * It lives HERE, in the composition root, for the same reason the export
 * source does: the trail belongs to Audit, and having Portability query it
 * directly would invert the one-way arrow between the contexts
 * (architecture-guide.md §3.1).
 *
 * It answers the entries and the revisions they name. Each revision is fetched
 * by the exact pair its entry carries — the content and the version — and
 * never by listing the versions of an object: listing them belongs to the
 * purge and to nothing else (rule 8). A revision that cannot be fetched is
 * left out rather than failing the export: the entry stays, saying that
 * something was written, and the export of a notebook is not lost over one
 * body whose bytes are already gone.
 */

import type { AuditEvent, AuditTrail, RevisionReader } from '@memorysmith/svc-audit/domain';
import type { HistorySource } from '@memorysmith/svc-portability/application';
import type { DocumentHistory } from '@memorysmith/svc-portability/domain';

/** How many revisions are read from the object store at once. */
const READ_CONCURRENCY = 24;

export class AuditHistorySource implements HistorySource {
  constructor(
    private readonly trail: AuditTrail,
    private readonly revisions: RevisionReader,
  ) {}

  async of(notebookId: string): Promise<DocumentHistory> {
    const entries = await this.trail.activityOf(notebookId, null, null);
    // Oldest first: a history is read forwards, and an import replays it.
    const ordered = [...entries].sort(
      (left, right) => left.occurredAt.epochMillis - right.occurredAt.epochMillis,
    );

    const wanted = new Map<string, AuditEvent>();
    for (const entry of ordered) {
      if (entry.contentRef) {
        wanted.set(
          keyOf({
            contentId: entry.contentRef.contentId.value,
            versionId: entry.contentRef.versionId,
          }),
          entry,
        );
      }
    }

    const revisions: Record<string, string> = {};
    const keys = [...wanted.keys()];
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(READ_CONCURRENCY, keys.length) }, async () => {
        for (let index = next++; index < keys.length; index = next++) {
          const key = keys[index] as string;
          const entry = wanted.get(key);
          if (!entry?.contentRef) continue;
          try {
            revisions[key] = await this.revisions.read(entry.contentRef);
          } catch {
            // Already destroyed, or never reachable. The entry stays.
          }
        }
      }),
    );

    return {
      entries: ordered.map((entry) => ({
        eventId: entry.eventId,
        type: entry.type,
        subject: entry.subject,
        subjectId: entry.subjectId,
        occurredAt: entry.occurredAt.toISOString(),
        authorship: entry.authorship.toJSON(),
        contentRef: entry.contentRef ? entry.contentRef.toJSON() : null,
        payload: entry.payload,
      })),
      revisions,
    };
  }
}

/** The pair an entry carries, which is how a revision is addressed. */
export const keyOf = (ref: { contentId: string; versionId: string }): string =>
  `${ref.contentId}#${ref.versionId}`;
