/**
 * The outbox relay: DynamoDB Streams to EventBridge (ADR-006).
 *
 * It is a separate entrypoint on the same bundle, because it is triggered by
 * the stream rather than by a request, and because its IAM policy is different:
 * it reads the stream and publishes to the bus, and writes only the counters.
 */

import { unmarshall } from '@aws-sdk/util-dynamodb';
import type { AttributeValue } from '@aws-sdk/client-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { OutboxRelay, envelopeOf } from '@memorysmithapp/svc-knowledge/adapters/relay';
import { observeBatch, startOfEvent } from '@memorysmithapp/observability';

interface StreamEvent {
  Records?: Array<{
    eventName?: string;
    dynamodb?: { NewImage?: Record<string, AttributeValue> };
  }>;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const relay = new OutboxRelay({
  db: DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  }),
  bus: new EventBridgeClient({}),
  tableName: required('KNOWLEDGE_TABLE'),
  busName: required('EVENT_BUS_NAME'),
  source: 'memorysmith.knowledge',
});

export async function handler(event: StreamEvent): Promise<void> {
  const items = (event.Records ?? [])
    // Only new outbox rows: an update or a delete carries nothing to publish.
    .filter((record) => record.eventName === 'INSERT' && record.dynamodb?.NewImage)
    .map((record) => unmarshall(record.dynamodb?.NewImage ?? {}));

  // One line per event published, under the id of the request that wrote it.
  // The batch is published as a unit, and fails as one.
  const events = items.filter((item) => item['entity'] === 'EVENT').map(envelopeOf);
  await observeBatch(
    events,
    (envelope) => startOfEvent(envelope),
    () => relay.process(items),
  );
}
