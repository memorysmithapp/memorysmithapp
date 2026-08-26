/**
 * Use cases of the Audit context.
 *
 * The service consumes EVERY event of the bus, from every service, and the
 * only thing it ever does with them is append (RN-AUD-001).
 */

import { DomainError, err, Instant, ok, type Result } from '@memorysmith/kernel';
import {
  type AuditEvent,
  revisionAt,
  type AuditTrail,
  type RevisionReader,
} from '../domain/index.js';

/**
 * Appends what the consumer handed over. Validating the envelope against its
 * contract is the job of the inbound adapter: Zod lives on the edge, never in
 * a use case (architecture-guide.md, section 4.1).
 */
export class RecordEvents {
  constructor(private readonly trail: AuditTrail) {}

  async execute(events: AuditEvent[]): Promise<Result<{ appended: number }, DomainError>> {
    if (events.length === 0) return ok({ appended: 0 });
    await this.trail.append(events);
    return ok({ appended: events.length });
  }
}

export class GetNoteHistory {
  constructor(private readonly trail: AuditTrail) {}

  /** Indexed by NoteId, so it survives the note changing vault (RN-AUD-004). */
  async execute(noteId: string): Promise<Result<AuditEvent[], DomainError>> {
    return ok(await this.trail.timelineOf('NOTE', noteId));
  }
}

export class GetVaultActivity {
  constructor(private readonly trail: AuditTrail) {}

  async execute(input: {
    vaultId: string;
    from?: string | undefined;
    to?: string | undefined;
  }): Promise<Result<AuditEvent[], DomainError>> {
    const from = input.from ? Instant.fromISO(input.from) : null;
    if (from && !from.ok) return from;
    const to = input.to ? Instant.fromISO(input.to) : null;
    if (to && !to.ok) return to;

    return ok(
      await this.trail.activityOf(
        input.vaultId,
        from?.ok ? from.value : null,
        to?.ok ? to.value : null,
      ),
    );
  }
}

/**
 * read_note(asOf): what the note said on a date, rebuilt from the trail. It is
 * what lets a piece of work be redone by reading the base as it stood on the
 * date it was issued (RN-AUD-005).
 */
export class ReadRevision {
  constructor(
    private readonly trail: AuditTrail,
    private readonly content: RevisionReader,
  ) {}

  async execute(input: {
    noteId: string;
    asOf?: string | undefined;
    versionId?: string | undefined;
  }): Promise<Result<{ event: AuditEvent; content: string }, DomainError>> {
    const timeline = await this.trail.timelineOf('NOTE', input.noteId);
    if (timeline.length === 0) return err(DomainError.notFound('Note not found'));

    const chosen = input.versionId
      ? (timeline.find((event) => event.contentRef?.versionId === input.versionId) ?? null)
      : await this.atDate(timeline, input.asOf);
    if (!chosen) {
      return err(DomainError.notFound('No revision of this note exists for that moment'));
    }
    if (!chosen.contentRef) {
      return err(DomainError.notFound('That event carries no content revision'));
    }

    return ok({ event: chosen, content: await this.content.read(chosen.contentRef) });
  }

  private async atDate(
    timeline: AuditEvent[],
    asOf: string | undefined,
  ): Promise<AuditEvent | null> {
    if (!asOf) {
      const withContent = timeline.filter((event) => event.changedContent);
      return withContent[withContent.length - 1] ?? null;
    }
    const instant = Instant.fromISO(asOf);
    if (!instant.ok) return null;
    return revisionAt(timeline, instant.value);
  }
}
