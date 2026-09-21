/**
 * Where the history an archive carried is written back (RN-PRT-023).
 *
 * It lives HERE, in the composition root, for the reason the import writer
 * does: the trail belongs to Audit, Portability may not import it, and joining
 * the two is what a composition root is for.
 *
 * Two things are worth saying about what this is and is not.
 *
 * **It appends, and that is all it can do.** The contract of the trail is that
 * nothing alters an entry and that removing one belongs to the purge alone
 * (RN-AUD-001, RN-AUD-011). A second principal that appends changes neither.
 *
 * **Every entry it writes is validated like an event of the bus**, through the
 * same parser, because an archive is a file anybody can craft. An entry that
 * does not match the contract of its type is not written, and the import fails
 * with it rather than writing half a history.
 */

import { toAuditEvent } from '@memorysmith/svc-audit/adapters/consumer';
import type { AuditTrail } from '@memorysmith/svc-audit/domain';
import { parseEvent } from '@memorysmith/contracts';
import type { TrailWriter } from '@memorysmith/svc-portability/application/import';

export class ImportedTrailWriter implements TrailWriter {
  constructor(
    private readonly trail: AuditTrail,
    private readonly subscriptionId: string,
  ) {}

  async append(entries: Parameters<TrailWriter['append']>[0]): Promise<void> {
    const events = entries.map((entry) =>
      toAuditEvent(
        parseEvent({
          eventId: entry.eventId,
          type: entry.type,
          occurredAt: entry.occurredAt,
          // The subscription is THIS one, whatever the archive came from: an
          // entry belongs to the subscription that holds the notebook it is
          // about, and every key of this system starts there (rule 1).
          subscriptionId: this.subscriptionId,
          subject: entry.subject,
          subjectId: entry.subjectId,
          authorship: entry.authorship,
          contentRef: entry.contentRef,
          payload: entry.payload,
        }),
        entry.importedBy,
      ),
    );
    await this.trail.append(events);
  }
}
