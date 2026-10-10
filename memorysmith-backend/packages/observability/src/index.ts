/**
 * Observability at the edge (architecture-guide.md, section 17): the one line
 * each operation writes, the allow-list it is written from, and the
 * correlation id that ties an operation to everything it caused.
 *
 * Imported by `main/`, by `adapters/` and by the handlers of the composition
 * root, and never by `domain/` or `application/` (rule 3): the inside of the
 * hexagon neither logs nor knows an operation is being observed.
 */

export {
  CHANNELS,
  LOG_LINE_FIELDS,
  LOGGER_FIELDS,
  OPERATION_FIELDS,
  OPERATION_MESSAGE,
  OUTCOMES,
  errorFieldsOf,
  outcomeOfCode,
  outcomeOfStatus,
  sanitize,
  type Channel,
  type OperationField,
  type OperationLine,
  type Outcome,
} from './fields.js';
export { writeOperation } from './logger.js';
export {
  CORRELATION_HEADER,
  annotate,
  correlationIdFrom,
  currentCorrelationId,
  openScope,
  runInScope,
  type Annotations,
  type OperationScope,
} from './scope.js';
export { correlationAttributes, correlationIdOfRecord } from './messages.js';
export {
  observe,
  observeBatch,
  refusedWith,
  startOfEvent,
  type OperationStart,
} from './operation.js';
