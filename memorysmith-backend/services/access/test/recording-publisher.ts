import type { DomainEvent, EventPublisher } from '@memorysmith/kernel';

/** Captures the event stream so a test can assert on what was published. */
export class RecordingEventPublisher implements EventPublisher {
  readonly published: DomainEvent[] = [];

  async publish(events: DomainEvent[]): Promise<void> {
    this.published.push(...events);
  }

  ofType(type: string): DomainEvent[] {
    return this.published.filter((event) => event.type === type);
  }
}
