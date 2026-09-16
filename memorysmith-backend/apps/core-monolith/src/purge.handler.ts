/**
 * The purge worker: a queue of deletion events, and what each of them left
 * behind stops existing (RN-KNW-047, architecture-guide.md §12.4 and §17).
 *
 * It is a separate entrypoint on the same bundle for the same reason the relay
 * is: it is triggered by a queue rather than by a request, and its IAM policy
 * is one nothing else in the system has — it is the only principal allowed to
 * delete a version of an object of the content bucket.
 *
 * A message whose work does not fit in one invocation is continued by sending
 * the same message back to the queue. The queue delivers with a delay far
 * longer than the window of §10.2, so a note that landed in a folder at the
 * instant of its removal is already there when the purge walks it.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import type { SubscriptionId } from '@memorysmith/kernel';
import { ContentPurge } from '@memorysmith/svc-knowledge/adapters/purge';
import { S3ContentPurger } from '@memorysmith/svc-knowledge/adapters/purger';

interface QueueEvent {
  detail?: unknown;
  Records?: Array<{ body?: string }>;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const s3 = new S3Client({});
const sqs = new SQSClient({});
const bucket = required('CONTENT_BUCKET');
const queueUrl = required('PURGE_QUEUE_URL');

const purge = new ContentPurge({
  db,
  tableName: required('KNOWLEDGE_TABLE'),
  // Per subscription, from the envelope: the worker serves no request, so
  // there is no claim to take it from (§8.2).
  purgerFor: (subscriptionId: SubscriptionId) => new S3ContentPurger(subscriptionId, s3, bucket),
});

export async function handler(event: QueueEvent): Promise<void> {
  const bodies = event.Records
    ? event.Records.map((record) => record.body ?? '{}')
    : [JSON.stringify(event.detail ?? event)];

  for (const body of bodies) {
    const parsed = JSON.parse(body) as { detail?: unknown };
    const envelope = (parsed.detail ?? parsed) as Parameters<ContentPurge['run']>[0];
    const outcome = await purge.run(envelope);

    if (!outcome.done) {
      // What is left carries on in a message of its own, with the same
      // envelope: the worker reads the partition again and finds less.
      await sqs.send(
        new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: JSON.stringify(envelope) }),
      );
    }
  }
}
