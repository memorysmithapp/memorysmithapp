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
import {
  AgentIdentity,
  Authorship,
  Instant,
  SubscriptionContext,
  UserId,
} from '@memorysmith/kernel';
import { ExportNotebook } from '@memorysmith/svc-portability/application';
import {
  RunExport,
  RunImport,
  type TransferWork,
} from '@memorysmith/svc-portability/application/transfers';
import { ImportNotebook } from '@memorysmith/svc-portability/application/import';
import { S3ArchiveStore, S3UploadStore } from '@memorysmith/svc-portability/adapters/s3';
import { createZip, readZip } from '@memorysmith/svc-portability/adapters/zip';
import { KnowledgeNotebookWriter } from './import-writer.js';
import { AuditHistorySource } from './history-source.js';
import { ImportedTrailWriter } from './trail-writer.js';
import { DynamoAuditTrail } from '@memorysmith/svc-audit/adapters/trail';
import { S3RevisionReader } from '@memorysmith/svc-audit/adapters/content';
import {
  CreateNotebook,
  DeleteNotebook,
  PutGuidance,
} from '@memorysmith/svc-knowledge/application/notebooks';
import {
  CreateFolder,
  PutTemplate,
  RestoreFolderNumber,
} from '@memorysmith/svc-knowledge/application/folders';
import { CreateNote } from '@memorysmith/svc-knowledge/application/notes';
import { KeepFile } from '@memorysmith/svc-knowledge/application/files';
import { ResolveRequestContext } from '@memorysmith/svc-access/application/context';
import { DynamoTransferStore } from '@memorysmith/svc-portability/adapters/dynamo';
import { KnowledgeExportSource } from './export-source.js';
import {
  buildAccess,
  buildKnowledge,
  parseNotebookDocument,
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
  // An import writes as the person who asked for it, so the role they hold in
  // the subscription is read here, from the same place the API reads it.
  accessTable: required('ACCESS_TABLE'),
  /**
   * The worker touches the PROJECTIONS through nothing: they are fed by the
   * events its writes publish. The trail it does touch, in both directions: an
   * export may carry it (RN-PRT-022) and an import brings it back
   * (RN-PRT-023).
   */
  auditTable: required('AUDIT_TABLE'),
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

/**
 * Who every write of an import is attributed to (rule 7). The worker serves no
 * request, so it is rebuilt from the message the API wrote, connector included:
 * an import asked for through a connector is recorded as that connector wrote
 * it (RN-AGT-001).
 */
function authorshipOf(work: TransferWork): Authorship {
  const user = UserId.create(work.authorship?.userId ?? work.userId);
  if (!user.ok) throw new Error(`An import named an unusable author: ${user.error.message}`);

  let agent: AgentIdentity | null = null;
  const named = work.authorship?.agent ?? null;
  if (named) {
    const identity = AgentIdentity.create(named.clientId, named.clientName);
    if (!identity.ok) throw new Error(`An import named an unusable connector`);
    agent = identity.value;
  }

  return Authorship.create(user.value, agent, Instant.now());
}

/**
 * What an import writes with: the ordinary Knowledge use cases, so the quota,
 * the limits and the events of an import are the ones of any other write.
 *
 * The role the person holds in the subscription is resolved here, as the API
 * resolves it: a member who may not write has an import refused on its first
 * write, exactly as they would anywhere else.
 */
async function writerFor(context: SubscriptionContext): Promise<KnowledgeNotebookWriter> {
  const { scoped } = buildAccess(infra, context);
  if (!scoped) throw new Error('unreachable: the worker was given a subscription');
  const resolved = await new ResolveRequestContext(scoped.subscriptions).execute(context);
  if (!resolved.ok) throw new Error(`An import could not be authorised: ${resolved.error.message}`);

  const knowledge = buildKnowledge(infra, context);
  return new KnowledgeNotebookWriter(
    {
      createNotebook: new CreateNotebook(knowledge),
      putGuidance: new PutGuidance(knowledge),
      createFolder: new CreateFolder(knowledge),
      putTemplate: new PutTemplate(knowledge),
      restoreFolderNumber: new RestoreFolderNumber(knowledge),
      createNote: new CreateNote(knowledge),
      keepFile: new KeepFile(knowledge),
      deleteNotebook: new DeleteNotebook(knowledge),
    },
    resolved.value,
    context.subscriptionId,
    // Where a revision of the past lands, when a history comes back with the
    // notebook (RN-PRT-023).
    knowledge.content,
  );
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

    /**
     * The trail of THIS subscription, read for an export that carries the
     * history and written for an import that brings one back (RN-PRT-022,
     * RN-PRT-023).
     */
    const trail = new DynamoAuditTrail(infra.db, infra.auditTable, context.subscriptionId);

    if (work.kind === 'import') {
      const importer = new ImportNotebook(
        new S3UploadStore(infra.s3, infra.contentBucket),
        await writerFor(context),
        readZip,
        parseNotebookDocument,
        work.subscriptionId,
        new ImportedTrailWriter(trail, work.subscriptionId),
        work.transferId,
      );
      await new RunImport(transfers, importer, authorshipOf(work)).execute(work);
      continue;
    }

    const exporter = new ExportNotebook(
      new KnowledgeExportSource(buildKnowledge(infra, context)),
      new S3ArchiveStore(infra.s3, infra.contentBucket),
      createZip,
      work.subscriptionId,
      serializeNotebookDocument,
      new AuditHistorySource(
        trail,
        new S3RevisionReader(context.subscriptionId, infra.s3, infra.contentBucket),
      ),
    );
    await new RunExport(transfers, exporter).execute(work);
  }
}
