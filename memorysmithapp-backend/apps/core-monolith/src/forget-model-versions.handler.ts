/**
 * The function that deletes the versions notebook models kept before #431
 * (#434, ADR-028). It runs in AWS so that what starts it — the staging command
 * and the workflow of production maintenance — reaches no table and no bucket,
 * as the rebuild of the link graph does (ADR-017): its own role reads and
 * deletes the records of transfers, deletes the archives under `models/` and says the
 * catalog entries again, and nothing else.
 *
 * It reports unless asked to apply, and a second run finds nothing left.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { S3ArchiveStore } from '@memorysmithapp/svc-portability/adapters/s3';
import { forgetModelVersions, type ForgetSummary } from './forget-model-versions.js';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const archives = new S3ArchiveStore(new S3Client({}), required('CONTENT_BUCKET'));

export async function handler(event: { mode?: string } | null): Promise<ForgetSummary> {
  return forgetModelVersions({
    db,
    tableName: required('PORTABILITY_TABLE'),
    archives,
    apply: event?.mode === 'apply',
  });
}
