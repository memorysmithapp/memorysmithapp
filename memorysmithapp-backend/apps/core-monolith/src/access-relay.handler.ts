/**
 * The outbox relay of mv-access: DynamoDB Streams to EventBridge (ADR-006).
 *
 * The same relay as the Knowledge one, over the table of Access. Until 0.10.0
 * nothing drained this stream, so the events Access writes to its outbox —
 * a member's role changed, a member removed, a subscription reviewed — were
 * kept and never published, and the trail never heard of them. Sharing a
 * notebook is recorded in the trail of that notebook (RN-ACC-024 to
 * RN-ACC-028), which is what made the gap one a person would see.
 *
 * No event of Access moves a counter, so this relay only publishes.
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
  tableName: required('ACCESS_TABLE'),
  busName: required('EVENT_BUS_NAME'),
  source: 'memorysmith.access',
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
