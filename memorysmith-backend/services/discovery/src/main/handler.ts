/**
 * The discovery projector: EventBridge rule to SQS to this function, with a
 * dead-letter queue (architecture-guide.md, section 11.3).
 *
 * The queue is what absorbs a batch ingestion burst, and it is why a retry or
 * a failure of the projector never touches the hot path of the write.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { SubscriptionId } from '@memorysmith/kernel';
import { parseEvent } from '@memorysmith/contracts';
import {
  DynamoContentIndex,
  DynamoFacetIndex,
  DynamoLinkGraph,
  DynamoProjectedVersions,
  DynamoStructureProjection,
} from '../adapters/aws.js';
import { ProjectNote, ProjectStructure } from '../application/projections.js';
import { dispatch } from '../adapters/dispatch.js';

interface QueueEvent {
  detail?: unknown;
  Records?: Array<{ body?: string; messageId?: string }>;
}

/** What the queue reads back: only the records named here come back (#141). */
interface BatchResponse {
  batchItemFailures: Array<{ itemIdentifier: string }>;
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
const table = required('DISCOVERY_TABLE');
const bucket = required('CONTENT_BUCKET');

/** Every projection is built per subscription, like every repository (PE2). */
function projectorsFor(subscriptionId: SubscriptionId) {
  const content = {
    read: async (ref: { contentId: string; versionId: string }): Promise<string> => {
      const response = await s3.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: `s/${subscriptionId.value}/c/${ref.contentId}.md`,
          VersionId: ref.versionId,
        }),
      );
      return (await response.Body?.transformToString('utf-8')) ?? '';
    },
  };

  return {
    note: new ProjectNote({
      graph: new DynamoLinkGraph(subscriptionId, db, table),
      facets: new DynamoFacetIndex(subscriptionId, db, table),
      index: new DynamoContentIndex(subscriptionId, db, table),
      structure: new DynamoStructureProjection(subscriptionId, db, table),
      content,
      versions: new DynamoProjectedVersions(subscriptionId, db, table),
    }),
    structure: new ProjectStructure(new DynamoStructureProjection(subscriptionId, db, table)),
  };
}

/**
 * Each record is projected on its own, and a record that fails is reported by
 * itself. It used to throw out of the loop, which sent the whole batch of up to
 * ten back to the queue — the records already projected included — to be
 * projected again six minutes later, over whatever had been written since
 * (#141). The version gate makes a redelivery harmless; this makes it rare.
 */
export async function handler(event: QueueEvent): Promise<BatchResponse> {
  if (!event.Records) {
    if (event.detail !== undefined) await projectOne(event.detail);
    return { batchItemFailures: [] };
  }

  const failures: BatchResponse['batchItemFailures'] = [];
  for (const record of event.Records) {
    try {
      const parsed = JSON.parse(record.body ?? '{}') as { detail?: unknown };
      await projectOne(parsed.detail ?? parsed);
    } catch (error) {
      console.error('A projection failed and goes back to the queue alone', error);
      failures.push({ itemIdentifier: record.messageId ?? '' });
    }
  }
  return { batchItemFailures: failures };
}

async function projectOne(each: unknown): Promise<void> {
  // Validated against the contract on this side too: an envelope only the
  // producer knows is how a projection starts lying quietly (section 19).
  const envelope = parseEvent(each);
  const subscriptionId = SubscriptionId.fromClaim(envelope.subscriptionId);
  if (!subscriptionId.ok) return;
  await dispatch(projectorsFor(subscriptionId.value), envelope);
}
