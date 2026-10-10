/**
 * The edge of an HTTP API: one line per request, written when the answer is
 * known (architecture-guide.md, section 17).
 *
 * The correlation id is the one an upstream hop handed in its header — the
 * connector, when it calls the core on an agent's behalf — or the id API
 * Gateway gave the request, which is the same id its access log carries, so a
 * line of the function and a line of the gateway are found by one value. It is
 * answered in the same header, for whoever needs to quote it.
 */

import type { Context, ErrorHandler, MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { routePath } from 'hono/route';
import { errorFieldsOf, outcomeOfStatus, type Channel } from './fields.js';
import { writeOperation } from './logger.js';
import { CORRELATION_HEADER, annotate, correlationIdFrom, openScope, runInScope } from './scope.js';

/** The id API Gateway gave this request, when the function runs behind one. */
function gatewayRequestId(c: Context): unknown {
  const env = c.env as { event?: { requestContext?: { requestId?: unknown } } } | undefined;
  return env?.event?.requestContext?.requestId;
}

/**
 * The template of the route that answered, never the path itself: a path
 * carries identifiers in its segments, and a template is a name code chose.
 */
function routeTemplate(c: Context): string {
  try {
    return `${c.req.method} ${routePath(c)}`;
  } catch {
    return `${c.req.method} unmatched`;
  }
}

export interface OperationLogOptions {
  /** Every request of this API comes through one channel, when it is known up front. */
  readonly channel?: Channel;
}

/** Mounted first, so that every request — a refusal and a preflight included — is written. */
export function operationLog(options: OperationLogOptions = {}): MiddlewareHandler {
  return async (c, next) => {
    const scope = openScope(
      correlationIdFrom(c.req.header(CORRELATION_HEADER), gatewayRequestId(c)),
      options.channel ? { channel: options.channel } : {},
    );
    const started = performance.now();
    await runInScope(scope, next);
    const status = c.res.status;
    c.res.headers.set(CORRELATION_HEADER, scope.correlationId);
    writeOperation({
      ...scope.annotations,
      operation: scope.annotations.operation ?? routeTemplate(c),
      outcome: status >= 500 ? 'error' : (scope.annotations.outcome ?? outcomeOfStatus(status)),
      durationMs: performance.now() - started,
      correlationId: scope.correlationId,
      status,
    });
  };
}

/**
 * The error handler of an app that logs through `operationLog`: what was thrown
 * goes on the line of the request — its class and frames, never its message —
 * and the answer is the one Hono gives by default. Hono's own handler printed
 * the whole error, message included, outside any line.
 */
export const operationErrorHandler: ErrorHandler = (error, c) => {
  if (error instanceof HTTPException) {
    // An answer Hono was told to give, whose status says how it ended.
    annotate({ errorName: error.name });
    return error.getResponse();
  }
  annotate({ outcome: 'error', ...errorFieldsOf(error) });
  return c.text('Internal Server Error', 500);
};
