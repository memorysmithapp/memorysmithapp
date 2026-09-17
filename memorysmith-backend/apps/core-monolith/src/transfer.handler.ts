/**
 * The transfer worker: a queue of jobs, and the work neither the API nor a
 * person should wait on (RN-PRT-019, architecture-guide.md §16 and §17).
 *
 * It is a separate entrypoint on the same bundle for the same reason the relay
 * and the purge are: it is triggered by a queue rather than by a request, and
 * the 29 seconds of the API are exactly what it exists to escape. Building the
 * archive of a notebook means reading every note of it.
 *
 * Per subscription, FROM THE MESSAGE: the worker serves no request, so there is
 * no claim to take the subscription from (§8.2). The message is written by the
 * API, which took it from the token.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { SubscriptionContext } from '@memorysmith/kernel';
import { ExportNotebook } from '@memorysmith/svc-portability/application';
import { RunExport, type TransferWork } from '@memorysmith/svc-portability/application/transfers';
import { S3ArchiveStore } from '@memorysmith/svc-portability/adapters/s3';
import { createZip } from '@memorysmith/svc-portability/adapters/zip';
import { DynamoTransferStore } from '@memorysmith/svc-portability/adapters/dynamo';
import { KnowledgeExportSource } from './export-source.js';
import {
  buildKnowledge,
  serializeNotebookDocument,
  type Infrastructure,
} from './composition-root.js';

interface QueueEvent {
  Records?: Array<{ body?: string }>;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const infra: Infrastructure = {
  db: DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  }),
  s3: new S3Client({}),
  knowledgeTable: required('KNOWLEDGE_TABLE'),
  // The worker reads the notebook and writes the transfer, and touches
  // neither access, nor the trail, nor the projections.
  accessTable: '',
  auditTable: '',
  discoveryTable: '',
  portabilityTable: required('PORTABILITY_TABLE'),
  contentBucket: required('CONTENT_BUCKET'),
};

/**
 * The context of the subscription the message names. It carries the person who
 * asked, because everything an export reads it reads as them.
 */
function contextOf(work: TransferWork): SubscriptionContext {
  const context = SubscriptionContext.fromClaims({
    sub: work.userId,
    subscription_id: work.subscriptionId,
    subscription_status: 'active',
  });
  if (!context.ok)
    throw new Error(`A transfer named an unusable subscription: ${context.error.message}`);
  return context.value;
}

export async function handler(event: QueueEvent): Promise<void> {
  for (const record of event.Records ?? []) {
    const work = JSON.parse(record.body ?? '{}') as TransferWork;
    const context = contextOf(work);

    const transfers = new DynamoTransferStore(
      infra.db,
      infra.portabilityTable,
      work.subscriptionId,
    );
    const exporter = new ExportNotebook(
      new KnowledgeExportSource(buildKnowledge(infra, context)),
      new S3ArchiveStore(infra.s3, infra.contentBucket),
      createZip,
      work.subscriptionId,
      serializeNotebookDocument,
    );

    await new RunExport(transfers, exporter).execute(work);
  }
}
