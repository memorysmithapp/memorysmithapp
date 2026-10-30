/**
 * Entrypoint of the purge of what a deleted file left behind (#372, RN-KNW-047).
 * Run it with `pnpm tools data purge-deleted-files`.
 *
 * It reports before it writes, and with `--apply` hands each file to the queue
 * of the purge, the one principal that may destroy a revision (INV-08). Delivery
 * there is at least once and a second pass changes nothing, so a run that was
 * interrupted is simply run again.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { GetQueueUrlCommand, SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { deletedFiles } from '@memorysmithapp/svc-knowledge/adapters/deleted-files';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export async function main(argv: readonly string[]): Promise<number> {
  const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  });
  const files = await deletedFiles({ db, tableName: required('KNOWLEDGE_TABLE') });
  const queue = required('PURGE_QUEUE');

  const bytes = files.reduce(
    (total, file) => total + Number((file.contentRef as { bytes?: number }).bytes ?? 0),
    0,
  );
  console.log(`${files.length} deleted files still hold ${bytes} bytes.`);
  if (!argv.includes('--apply') || files.length === 0) return 0;

  const sqs = new SQSClient({});
  const { QueueUrl } = await sqs.send(new GetQueueUrlCommand({ QueueName: queue }));
  for (const file of files) {
    await sqs.send(new SendMessageCommand({ QueueUrl, MessageBody: JSON.stringify(file) }));
  }
  console.log(`${files.length} handed to the purge.`);
  return 0;
}

const invokedDirectly = process.argv[1]?.endsWith('purge-deleted-files.ts') === true;
if (invokedDirectly) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
