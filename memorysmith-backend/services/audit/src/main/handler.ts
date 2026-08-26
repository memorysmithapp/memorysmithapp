/**
 * The audit consumer: every event of the bus, appended and never changed.
 *
 * It is its OWN deployable, and that is the one place where the separation
 * buys something real: the role of this function is what makes the log
 * immutable, and it carries an explicit Deny on UpdateItem and DeleteItem
 * (architecture-guide.md, sections 12.2 and 24).
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoAuditTrail } from '../adapters/outbound/DynamoAuditTrail.js';
import { AuditEventConsumer } from '../adapters/inbound/event-consumer.js';
import { RecordEvents } from '../application/index.js';

interface BusEvent {
  detail?: unknown;
  Records?: Array<{ body?: string }>;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const consumer = new AuditEventConsumer(
  new RecordEvents(
    new DynamoAuditTrail(
      DynamoDBDocumentClient.from(new DynamoDBClient({}), {
        marshallOptions: { removeUndefinedValues: true },
      }),
      required('AUDIT_TABLE'),
    ),
  ),
);

export async function handler(event: BusEvent): Promise<void> {
  // The same function answers a direct bus target and an SQS-buffered one.
  const envelopes = event.Records
    ? event.Records.map((record) => {
        const parsed = JSON.parse(record.body ?? '{}') as { detail?: unknown };
        return parsed.detail ?? parsed;
      })
    : [event.detail].filter((detail) => detail !== undefined);

  await consumer.consume(envelopes);
}
