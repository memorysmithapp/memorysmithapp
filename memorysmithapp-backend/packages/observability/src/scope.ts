/**
 * The operation in course, and the correlation id it carries.
 *
 * One id follows one request of a person or an agent through everything it
 * causes: the connector's call, the request it makes to the core, the events
 * the core writes to its outbox, and the relay, the projector, the audit
 * consumer and the workers that read them. It travels in an asynchronous scope
 * rather than as an argument, so that the inside of the hexagon never sees it:
 * the edge opens the scope, and the adapters that write an outbox item, send a
 * message or call another API read it from here (INV-03).
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { OperationLine } from './fields.js';

/** The header an id crosses an HTTP hop in, from the connector to the core. */
export const CORRELATION_HEADER = 'x-correlation-id';

/** What the edge and the adapters below it learn about the operation while it runs. */
export type Annotations = Partial<
  Pick<
    OperationLine,
    | 'operation'
    | 'outcome'
    | 'subscriptionId'
    | 'userId'
    | 'channel'
    | 'agentClient'
    | 'eventId'
    | 'errorName'
    | 'errorCode'
    | 'errorFrames'
  >
>;

export interface OperationScope {
  readonly correlationId: string;
  /** Mutable on purpose: whoever learns something of the operation writes it here. */
  annotations: Annotations;
}

const storage = new AsyncLocalStorage<OperationScope>();

const ACCEPTED_ID = /^[A-Za-z0-9._:=+-]{8,128}$/;

/**
 * The id an operation is known by: the one it was handed, when it has the shape
 * of an id, or the one the gateway gave the request, or a new one.
 */
export function correlationIdFrom(handed?: unknown, fallback?: unknown): string {
  if (typeof handed === 'string' && ACCEPTED_ID.test(handed)) return handed;
  if (typeof fallback === 'string' && ACCEPTED_ID.test(fallback)) return fallback;
  return randomUUID();
}

export function openScope(correlationId: string, annotations: Annotations = {}): OperationScope {
  return { correlationId, annotations: { ...annotations } };
}

/** Runs `work` inside the scope: everything it awaits sees the same id. */
export function runInScope<T>(scope: OperationScope, work: () => T): T {
  return storage.run(scope, work);
}

/** The id of the operation in course, or undefined outside of one. */
export function currentCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}

/**
 * Tells the line of the operation in course something it did not know when it
 * started: who the caller is, which tool ran, how a refusal was coded. Outside
 * an operation it does nothing.
 */
export function annotate(annotations: Annotations): void {
  const scope = storage.getStore();
  if (scope) scope.annotations = { ...scope.annotations, ...annotations };
}
