/**
 * The wrapper every handler goes through: it opens the scope of the operation,
 * times it, and writes its one line when it ends, however it ends.
 *
 * The HTTP edge has its own form of it, a middleware (`./hono`), because the
 * route and the status are only known there; the workers use these.
 */

import {
  errorFieldsOf,
  outcomeOfCode,
  type Channel,
  type OperationLine,
  type Outcome,
} from './fields.js';
import { writeOperation } from './logger.js';
import { correlationIdFrom, openScope, runInScope, type Annotations } from './scope.js';

export interface OperationStart extends Annotations {
  readonly operation: string;
  /** The id handed in by whatever caused this: an envelope, a message, a header. */
  readonly correlationId?: string | undefined;
}

function now(): number {
  return performance.now();
}

/**
 * Runs one operation and writes its line. A throw is written as `error`, with
 * the class and the frames of what was thrown, and thrown again: the wrapper
 * observes, it never decides what a failure means to the queue or the caller.
 * An outcome the operation annotated itself — a refusal it answered rather
 * than threw — is the one written when it returns.
 */
export async function observe<T>(start: OperationStart, work: () => Promise<T>): Promise<T> {
  const { correlationId: handed, ...annotations } = start;
  const scope = openScope(correlationIdFrom(handed), annotations);
  const started = now();
  const line = (outcome: Outcome): OperationLine => ({
    ...scope.annotations,
    operation: scope.annotations.operation ?? start.operation,
    outcome,
    durationMs: now() - started,
    correlationId: scope.correlationId,
  });
  try {
    const result = await runInScope(scope, work);
    writeOperation(line(scope.annotations.outcome ?? 'ok'));
    return result;
  } catch (error) {
    scope.annotations = { ...scope.annotations, ...errorFieldsOf(error) };
    writeOperation(line('error'));
    throw error;
  }
}

/**
 * Runs the work of a batch once and writes one line per item it carried, each
 * with the id and the identity of its own item and the duration of the whole.
 * The relay and the audit consumer handle a batch as a unit, and the question
 * asked of their log is about one event: what became of it.
 */
export async function observeBatch<I, T>(
  items: readonly I[],
  startOf: (item: I) => OperationStart,
  work: () => Promise<T>,
): Promise<T> {
  const started = now();
  const lines = (outcome: Outcome, failure: Annotations = {}): void => {
    const durationMs = now() - started;
    for (const item of items) {
      const { correlationId, ...annotations } = startOf(item);
      writeOperation({
        ...annotations,
        ...failure,
        outcome,
        durationMs,
        ...(correlationId ? { correlationId } : {}),
      });
    }
  };
  try {
    const result = await work();
    lines('ok');
    return result;
  } catch (error) {
    lines('error', errorFieldsOf(error));
    throw error;
  }
}

/**
 * Who caused an event, read from its envelope without trusting its shape: the
 * subscription, the person, the connector when an agent wrote it, the event and
 * the correlation id the outbox writer put on it. Nothing of the payload.
 */
export function startOfEvent(envelope: unknown, operation?: string): OperationStart {
  const record = (typeof envelope === 'object' && envelope !== null ? envelope : {}) as Record<
    string,
    unknown
  >;
  const authorship = (
    typeof record['authorship'] === 'object' && record['authorship'] !== null
      ? record['authorship']
      : {}
  ) as Record<string, unknown>;
  const agent = authorship['agent'] as { clientName?: unknown } | null | undefined;
  const type = typeof record['type'] === 'string' ? record['type'] : 'UnknownEvent';
  const channel: Channel = agent ? 'mcp' : 'web';
  return {
    operation: operation ?? type,
    ...(typeof record['correlationId'] === 'string'
      ? { correlationId: record['correlationId'] }
      : {}),
    ...(typeof record['subscriptionId'] === 'string'
      ? { subscriptionId: record['subscriptionId'] }
      : {}),
    ...(typeof authorship['userId'] === 'string' ? { userId: authorship['userId'] } : {}),
    ...(typeof record['eventId'] === 'string' ? { eventId: record['eventId'] } : {}),
    ...(typeof record['authorship'] === 'object' ? { channel } : {}),
    ...(agent && typeof agent.clientName === 'string' ? { agentClient: agent.clientName } : {}),
  };
}

/** A refusal the operation answered rather than threw, told to its line by its code. */
export function refusedWith(code: string): Annotations {
  return { outcome: outcomeOfCode(code), errorCode: code };
}
