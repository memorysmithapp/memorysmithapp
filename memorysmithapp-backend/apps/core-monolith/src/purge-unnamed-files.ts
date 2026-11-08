/**
 * Entrypoint of the purge of the bytes of files that nothing names (#377).
 * Run it with `pnpm tools data purge-unnamed-files`.
 *
 * It reports before it writes, by identifier and size and never by content,
 * and with `--apply` hands each object to the queue of the purge, the one
 * principal that may destroy a revision (INV-08). Only what is older than
 * `--older-than <hours>`, 24 by default, is chosen, so a keep in flight is
 * never touched. Delivery there is at least once and a second pass changes
 * nothing, so a run that was interrupted is simply run again.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { GetQueueUrlCommand, SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  SAFETY_AGE_HOURS,
  unnamedFiles,
  type UnnamedFile,
} from '@memorysmithapp/svc-knowledge/adapters/unnamed-files';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/** The safety age a run was given, refused when it is not a number of hours. */
export function olderThanOf(argv: readonly string[]): number {
  const at = argv.indexOf('--older-than');
  if (at < 0) return SAFETY_AGE_HOURS;
  const hours = Number(argv[at + 1]);
  if (!Number.isFinite(hours) || hours < 0) {
    throw new Error(
      `--older-than takes a number of hours, and "${argv[at + 1] ?? ''}" is not one.`,
    );
  }
  return hours;
}

/** What the purge is handed for one object: its subscription and its content, nothing else. */
export function envelopeOf(file: UnnamedFile): Record<string, unknown> {
  return {
    type: 'FileUnnamed',
    subscriptionId: file.subscriptionId,
    authorship: null,
    contentRef: null,
    payload: { contentId: file.contentId },
  };
}

export async function main(argv: readonly string[]): Promise<number> {
  const olderThanHours = olderThanOf(argv);
  const files = await unnamedFiles({
    db: DynamoDBDocumentClient.from(new DynamoDBClient({})),
    tableName: required('KNOWLEDGE_TABLE'),
    s3: new S3Client({}),
    bucket: required('CONTENT_BUCKET'),
    olderThanHours,
  });
  const bytes = files.reduce((total, file) => total + file.bytes, 0);
  console.log(
    `${files.length} objects under f/ older than ${olderThanHours} hours are named by no file, ${bytes} bytes.`,
  );
  for (const file of files) {
    console.log(
      `  ${file.subscriptionId} ${file.contentId} ${file.bytes} bytes, ${file.lastModified}`,
    );
  }
  if (!argv.includes('--apply') || files.length === 0) return 0;

  const sqs = new SQSClient({});
  const { QueueUrl } = await sqs.send(
    new GetQueueUrlCommand({ QueueName: required('PURGE_QUEUE') }),
  );
  for (const file of files) {
    await sqs.send(
      new SendMessageCommand({ QueueUrl, MessageBody: JSON.stringify(envelopeOf(file)) }),
    );
  }
  console.log(`${files.length} handed to the purge.`);
  return 0;
}

const invokedDirectly = process.argv[1]?.endsWith('purge-unnamed-files.ts') === true;
if (invokedDirectly) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
