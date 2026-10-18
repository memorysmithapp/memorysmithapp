/**
 * The correlation id on a message of a queue: a job the API hands a worker
 * carries the id of the request that asked for it as a message attribute, so
 * the body of the job stays what its contract says.
 *
 * Plain shapes rather than the types of the SDK, which this package does not
 * import: what the SQS client sends and what the Lambda event delivers.
 */

import { currentCorrelationId } from './scope.js';

const ATTRIBUTE = 'correlationId';

/** What to spread into a `SendMessageCommand` so the job carries the id in course. */
export function correlationAttributes(): {
  MessageAttributes?: Record<string, { DataType: 'String'; StringValue: string }>;
} {
  const correlationId = currentCorrelationId();
  return correlationId
    ? { MessageAttributes: { [ATTRIBUTE]: { DataType: 'String', StringValue: correlationId } } }
    : {};
}

/** The id a delivered SQS record carries, when the sender put one on it. */
export function correlationIdOfRecord(record: {
  messageAttributes?: Record<string, { stringValue?: string | undefined } | undefined>;
}): string | undefined {
  const value = record.messageAttributes?.[ATTRIBUTE]?.stringValue;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
