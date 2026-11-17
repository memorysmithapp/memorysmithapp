/**
 * The maintenance function of Portability, named after its first job: it
 * deletes the versions notebook models kept before #431 (#434, ADR-028), and,
 * invoked with `job: "discard-file-requests"`, discards the file requests and
 * the inline uploads left open when they were retired (#469, #468).
 *
 * It runs in AWS so that what starts it — the staging command and the workflow
 * of production maintenance — reaches no table and no bucket, as the rebuild of
 * the link graph does (ADR-017): its own role reads and deletes the records of
 * transfers and their counters, deletes the archives under `models/` and the
 * parts under `uploads/`, and says the catalog entries again, and nothing else.
 *
 * It reports unless asked to apply, and a second run finds nothing left.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { S3ArchiveStore } from '@memorysmithapp/svc-portability/adapters/s3';
import { forgetModelVersions, type ForgetSummary } from './forget-model-versions.js';
import { discardFileRequests, type DiscardSummary } from './discard-file-requests.js';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const s3 = new S3Client({});
const archives = new S3ArchiveStore(s3, required('CONTENT_BUCKET'));

export async function handler(
  event: { mode?: string; job?: string } | null,
): Promise<ForgetSummary | DiscardSummary> {
  if (event?.job === 'discard-file-requests') {
    const bucket = required('CONTENT_BUCKET');
    return discardFileRequests({
      db,
      tableName: required('PORTABILITY_TABLE'),
      destroy: async (key, versionId) => {
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key, VersionId: versionId }));
      },
      apply: event.mode === 'apply',
    });
  }
  return forgetModelVersions({
    db,
    tableName: required('PORTABILITY_TABLE'),
    archives,
    apply: event?.mode === 'apply',
  });
}
