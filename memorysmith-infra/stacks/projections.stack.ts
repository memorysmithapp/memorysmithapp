/**
 * The two event consumers: the audit trail and the discovery projections
 * (architecture-guide.md, sections 11.3, 12.2 and 24).
 *
 * svc-audit IS ITS OWN DEPLOYABLE, and this is the one place where the
 * separation buys something real: its role carries the explicit Deny that
 * makes the log immutable. A monolith could not offer that without a dedicated
 * principal, which is exactly what this stack creates.
 *
 * The discovery projector sits behind a queue with a dead-letter queue: the
 * queue absorbs a batch ingestion burst, and a retry or a failure there never
 * touches the hot path of the write.
 */

import { Duration, Stack, type StackProps } from 'aws-cdk-lib';
import { Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction, SqsQueue } from 'aws-cdk-lib/aws-events-targets';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Alarm, ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import type { Construct } from 'constructs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ServiceLambda } from '../constructs/service-lambda.js';
import type { DataStack } from './data.stack.js';

const here = dirname(fileURLToPath(import.meta.url));
const backend = join(here, '..', '..', 'memorysmith-backend');

export interface ProjectionsStackProps extends StackProps {
  readonly data: DataStack;
}

export class ProjectionsStack extends Stack {
  constructor(scope: Construct, id: string, props: ProjectionsStackProps) {
    super(scope, id, props);

    // ---- svc-audit ----------------------------------------------------------

    const audit = new ServiceLambda(this, 'AuditConsumer', {
      entry: join(backend, 'services', 'audit', 'src', 'main', 'handler.ts'),
      description: 'Appends every event of the bus to the audit trail. Append-only by IAM.',
      environment: { AUDIT_TABLE: props.data.auditTable.table.tableName },
      timeout: Duration.seconds(30),
    });

    // The guarantee: allow Put, DENY Update and Delete. There is no path, by
    // bug or by operator, that rewrites the past.
    props.data.auditTable.grantAppendOnly(audit.function);

    new Rule(this, 'AllEventsToAudit', {
      eventBus: props.data.eventBus,
      description: 'Every event of every service reaches the audit trail.',
      eventPattern: { source: [{ prefix: 'memorysmith.' }] as never },
      targets: [new LambdaFunction(audit.function, { retryAttempts: 3 })],
    });

    // ---- svc-discovery ------------------------------------------------------

    const projectionDlq = new Queue(this, 'ProjectionDeadLetter', {
      queueName: 'mv-discovery-dlq',
      retentionPeriod: Duration.days(14),
    });

    const projectionQueue = new Queue(this, 'ProjectionQueue', {
      queueName: 'mv-discovery',
      visibilityTimeout: Duration.minutes(6),
      deadLetterQueue: { queue: projectionDlq, maxReceiveCount: 5 },
    });

    new Rule(this, 'KnowledgeEventsToDiscovery', {
      eventBus: props.data.eventBus,
      description: 'Note and folder events feed the three discovery projections.',
      eventPattern: {
        source: ['memorysmith.knowledge'],
        detailType: [
          'VaultCreated',
          'VaultRenamed',
          'FolderAdded',
          'FolderRenamed',
          'FolderDescribed',
          'FolderMoved',
          'FolderRemoved',
          'NoteCreated',
          'NoteUpdated',
          'NoteMoved',
          'NoteDeleted',
          'NoteRestored',
        ],
      },
      targets: [new SqsQueue(projectionQueue)],
    });

    const projector = new ServiceLambda(this, 'DiscoveryProjector', {
      entry: join(backend, 'services', 'discovery', 'src', 'main', 'handler.ts'),
      description: 'Maintains the link graph, the vector index and the curation facets.',
      environment: {
        DISCOVERY_TABLE: props.data.discoveryTable.table.tableName,
        CONTENT_BUCKET: props.data.contentBucket.bucketName,
      },
      // Embedding is the slow part, and it is asynchronous by design.
      timeout: Duration.minutes(5),
      memorySize: 1024,
      latencyAlarm: false,
    });

    projector.function.addEventSource(
      new SqsEventSource(projectionQueue, { batchSize: 10, reportBatchItemFailures: true }),
    );
    props.data.discoveryTable.table.grantReadWriteData(projector.function);
    props.data.contentBucket.grantRead(projector.function);
    new Alarm(this, 'ProjectionDeadLetterDepth', {
      alarmDescription: 'Discovery projector: messages in the dead-letter queue',
      metric: projectionDlq.metricApproximateNumberOfMessagesVisible({
        period: Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
  }
}
