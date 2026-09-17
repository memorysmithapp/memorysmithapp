/**
 * The core deployable: the modular monolith behind api.memorysmith.app, plus
 * the outbox relay that drains its stream (architecture-guide.md, 17 and 24).
 *
 * Splitting into six deployables later means instantiating six of these and
 * changing the composition root; the tables, the bucket and the bus do not
 * move (section 24).
 */

import { Duration, Stack, type StackProps } from 'aws-cdk-lib';
import { HttpApi, CorsHttpMethod, DomainName, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpIamAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Rule } from 'aws-cdk-lib/aws-events';
import { SqsQueue } from 'aws-cdk-lib/aws-events-targets';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { DynamoEventSource, SqsDlq, SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Alarm, ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { ARecord, RecordTarget, type IHostedZone } from 'aws-cdk-lib/aws-route53';
import { ApiGatewayv2DomainProperties } from 'aws-cdk-lib/aws-route53-targets';
import type { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import type { IUserPool } from 'aws-cdk-lib/aws-cognito';
import type { Construct } from 'constructs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ServiceLambda } from '../constructs/service-lambda.js';
import type { DataStack } from './data.stack.js';
import { physicalName, type EnvironmentConfig } from '../config/environments.js';

const here = dirname(fileURLToPath(import.meta.url));
const backend = join(here, '..', '..', 'memorysmith-backend');

/**
 * Where the connector proxy records which connector a token belongs to
 * (architecture-guide.md, section 13.3). The one route of the API authorized
 * by IAM instead of by a token: no session calls it, and only the role of
 * svc-agent may invoke it.
 */
export const CONNECTOR_BINDING_ROUTE = '/access/connector-bindings';

/**
 * How long a deletion waits before the purge walks what it invalidated. It is
 * far longer than the window of section 10.2, which is the point: a note
 * written into a folder at the instant of its removal has to be in the table
 * before the walk, or its bytes would be the one thing a deletion left behind.
 */
export const PURGE_DELAY = Duration.minutes(1);

export interface ApiStackProps extends StackProps {
  readonly environment: EnvironmentConfig;
  readonly data: DataStack;
  readonly hostedZone: IHostedZone;
  readonly certificate: ICertificate;
  readonly apiDomainName: string;
  readonly cognitoIssuer: string;
  /** The app client of the connector proxy, whose tokens write as a connector. */
  readonly connectorClientId: string;
  readonly frontendOrigin: string;
  /** The pool whose accounts record the language they are written to in (RN-ACC-018). */
  readonly userPool: IUserPool;
}

export class ApiStack extends Stack {
  readonly apiOrigin: string;
  readonly httpApi: HttpApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    /**
     * Where a transfer is handed over (RN-PRT-019). Building the archive of a
     * notebook means reading every note of it, which is exactly what does not
     * fit in the 29 seconds of the API.
     */
    const transferDlq = new Queue(this, 'TransferDeadLetter', {
      queueName: physicalName(props.environment, 'mv-transfer-dlq'),
      retentionPeriod: Duration.days(14),
    });

    const transferQueue = new Queue(this, 'TransferQueue', {
      queueName: physicalName(props.environment, 'mv-transfer'),
      // Longer than the timeout of the worker, or the same job is delivered
      // again while the first invocation is still building the archive.
      visibilityTimeout: Duration.minutes(16),
      deadLetterQueue: { queue: transferDlq, maxReceiveCount: 3 },
    });

    const environment = {
      ACCESS_TABLE: props.data.accessTable.table.tableName,
      KNOWLEDGE_TABLE: props.data.knowledgeTable.table.tableName,
      DISCOVERY_TABLE: props.data.discoveryTable.table.tableName,
      PORTABILITY_TABLE: props.data.portabilityTable.table.tableName,
      AUDIT_TABLE: props.data.auditTable.table.tableName,
      CONTENT_BUCKET: props.data.contentBucket.bucketName,
      EVENT_BUS_NAME: props.data.eventBus.eventBusName,
      COGNITO_ISSUER: props.cognitoIssuer,
      TRANSFER_QUEUE_URL: transferQueue.queueUrl,
      CONNECTOR_CLIENT_ID: props.connectorClientId,
      USER_POOL_ID: props.userPool.userPoolId,
    };

    const api = new ServiceLambda(this, 'CoreApi', {
      entry: join(backend, 'apps', 'core-monolith', 'src', 'handler.ts'),
      description: 'MemorySmith core API: access, knowledge, discovery and audit reads.',
      environment,
      timeout: Duration.seconds(29),
      memorySize: 1024,
    });

    // The one thing the API writes on an account of the pool: its language.
    props.userPool.grant(api.function, 'cognito-idp:AdminUpdateUserAttributes');
    props.data.accessTable.table.grantReadWriteData(api.function);
    props.data.knowledgeTable.table.grantReadWriteData(api.function);
    props.data.discoveryTable.table.grantReadWriteData(api.function);
    props.data.portabilityTable.table.grantReadWriteData(api.function);
    transferQueue.grantSendMessages(api.function);
    /**
     * Read and put, and deliberately NOT delete. `grantReadWrite` carries
     * `s3:DeleteObject*`, which includes deleting a version, and only ONE
     * principal in this system may do that: the purge worker below
     * (RN-KNW-047). The API writes revisions and never destroys one.
     */
    props.data.contentBucket.grantRead(api.function);
    props.data.contentBucket.grantPut(api.function);
    /**
     * An import discards its upload once it ends, whichever way it ended
     * (RN-PRT-014). That is a delete of the current object under `imports/`
     * and nowhere else, and never of a version: on a versioned bucket it
     * leaves a marker, the lifecycle rule of the tag expires what is left, and
     * no revision of a note is within its reach.
     */
    api.function.addToRolePolicy(
      new PolicyStatement({
        actions: ['s3:DeleteObject'],
        resources: [props.data.contentBucket.arnForObjects('s/*/imports/*')],
      }),
    );
    /**
     * Deleting a kept export destroys its bytes (RN-PRT-020), and on a
     * versioned bucket that means deleting a VERSION. It is scoped to
     * `exports/` and to nothing else, so no revision of a note is within its
     * reach: the one principal allowed to destroy one of those is the purge
     * worker below (rule 8). The version is the one the worker recorded when
     * it wrote the archive, so nothing is listed to find it.
     */
    api.function.addToRolePolicy(
      new PolicyStatement({
        actions: ['s3:DeleteObject', 's3:DeleteObjectVersion'],
        resources: [props.data.contentBucket.arnForObjects('s/*/exports/*')],
      }),
    );
    // The API READS the trail and can never write it: the Deny travels with
    // the grant (PE4).
    props.data.auditTable.grantRead(api.function);
    // ---- The outbox relay ---------------------------------------------------

    const relayDlq = new Queue(this, 'RelayDeadLetter', {
      queueName: physicalName(props.environment, 'mv-outbox-dlq'),
      retentionPeriod: Duration.days(14),
    });

    const relay = new ServiceLambda(this, 'OutboxRelay', {
      entry: join(backend, 'apps', 'core-monolith', 'src', 'relay.handler.ts'),
      description: 'Drains the transactional outbox into the event bus.',
      environment: {
        KNOWLEDGE_TABLE: props.data.knowledgeTable.table.tableName,
        EVENT_BUS_NAME: props.data.eventBus.eventBusName,
      },
      timeout: Duration.seconds(30),
    });

    relay.function.addEventSource(
      new DynamoEventSource(props.data.knowledgeTable.table, {
        startingPosition: StartingPosition.TRIM_HORIZON,
        batchSize: 25,
        retryAttempts: 3,
        onFailure: new SqsDlq(relayDlq),
      }),
    );
    props.data.knowledgeTable.table.grantReadWriteData(relay.function);
    props.data.eventBus.grantPutEventsTo(relay.function);

    // The depth of the relay dead-letter queue is one of the four mandatory
    // alarms (section 17): a message sitting there is an event that never
    // reached the trail.
    new Alarm(this, 'RelayDeadLetterDepth', {
      alarmDescription: 'Outbox relay: messages in the dead-letter queue',
      metric: relayDlq.metricApproximateNumberOfMessagesVisible({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });

    // ---- The purge ----------------------------------------------------------

    /**
     * What a deletion invalidated stops existing (RN-KNW-047). The queue is
     * fed by the deletion events themselves and delivers with a DELAY, which
     * is what closes the window of section 10.2: a note that landed in a
     * folder at the instant of its removal is already in the table when the
     * worker walks it.
     */
    const purgeDlq = new Queue(this, 'PurgeDeadLetter', {
      queueName: physicalName(props.environment, 'mv-purge-dlq'),
      retentionPeriod: Duration.days(14),
    });

    const purgeQueue = new Queue(this, 'PurgeQueue', {
      queueName: physicalName(props.environment, 'mv-purge'),
      deliveryDelay: PURGE_DELAY,
      // Longer than the timeout of the worker, or the same message is
      // delivered again while the first invocation is still purging.
      visibilityTimeout: Duration.minutes(16),
      deadLetterQueue: { queue: purgeDlq, maxReceiveCount: 5 },
    });

    new Rule(this, 'DeletionsToPurge', {
      eventBus: props.data.eventBus,
      description: 'Every deletion feeds the purge of what it invalidated.',
      eventPattern: {
        source: ['memorysmith.knowledge'],
        detailType: [
          'NoteDeleted',
          'TemplateDeleted',
          'GuidanceDeleted',
          'FolderRemoved',
          'NotebookDeleted',
        ],
      },
      targets: [new SqsQueue(purgeQueue)],
    });

    const purge = new ServiceLambda(this, 'ContentPurge', {
      entry: join(backend, 'apps', 'core-monolith', 'src', 'purge.handler.ts'),
      description: 'Destroys the content and the items a deletion invalidated.',
      environment: {
        KNOWLEDGE_TABLE: props.data.knowledgeTable.table.tableName,
        CONTENT_BUCKET: props.data.contentBucket.bucketName,
        PURGE_QUEUE_URL: purgeQueue.queueUrl,
      },
      // A subtree larger than one invocation continues in a new message, so
      // the ceiling is what one message should hold open and not what a
      // notebook holds.
      timeout: Duration.minutes(15),
      latencyAlarm: false,
    });

    // One message at a time: each carries a whole deletion, and a batch would
    // make one slow purge hold up four others.
    purge.function.addEventSource(new SqsEventSource(purgeQueue, { batchSize: 1 }));
    props.data.knowledgeTable.table.grantReadWriteData(purge.function);
    // What did not fit in one invocation carries on in a message of its own.
    purgeQueue.grantSendMessages(purge.function);
    props.data.contentBucket.grantRead(purge.function);

    /**
     * The one policy in the system that destroys a byte. It is written by hand
     * rather than taken from a grant helper, because `grantDelete` and
     * `grantReadWrite` hand out more than this and to more principals than
     * this one: listing the versions of an object and deleting them belongs to
     * this role and to no other.
     */
    purge.function.addToRolePolicy(
      new PolicyStatement({
        actions: ['s3:DeleteObject', 's3:DeleteObjectVersion'],
        resources: [props.data.contentBucket.arnForObjects('*')],
      }),
    );
    purge.function.addToRolePolicy(
      new PolicyStatement({
        actions: ['s3:ListBucketVersions'],
        resources: [props.data.contentBucket.bucketArn],
      }),
    );

    // A message in this queue is content that was deleted and still exists,
    // which is a promise of the product left unkept.
    new Alarm(this, 'PurgeDeadLetterDepth', {
      alarmDescription: 'Content purge: messages in the dead-letter queue',
      metric: purgeDlq.metricApproximateNumberOfMessagesVisible({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });

    // ---- The transfer worker ------------------------------------------------

    const transfers = new ServiceLambda(this, 'TransferWorker', {
      entry: join(backend, 'apps', 'core-monolith', 'src', 'transfer.handler.ts'),
      description: 'Builds the archive of an export, and records how far it got.',
      environment: {
        KNOWLEDGE_TABLE: props.data.knowledgeTable.table.tableName,
        PORTABILITY_TABLE: props.data.portabilityTable.table.tableName,
        CONTENT_BUCKET: props.data.contentBucket.bucketName,
      },
      // A notebook of thousands of notes is read note by note from the object
      // store: the ceiling is what one notebook should hold open.
      timeout: Duration.minutes(15),
      memorySize: 1024,
      latencyAlarm: false,
    });

    // One at a time: each message is a whole notebook, and a batch would make
    // one large export hold up the others.
    transfers.function.addEventSource(new SqsEventSource(transferQueue, { batchSize: 1 }));
    props.data.knowledgeTable.table.grantReadData(transfers.function);
    props.data.portabilityTable.table.grantReadWriteData(transfers.function);
    props.data.contentBucket.grantRead(transfers.function);
    props.data.contentBucket.grantPut(transfers.function);

    // A message here is an export somebody asked for and will never get.
    new Alarm(this, 'TransferDeadLetterDepth', {
      alarmDescription: 'Transfer worker: messages in the dead-letter queue',
      metric: transferDlq.metricApproximateNumberOfMessagesVisible({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });

    // ---- The HTTP surface ---------------------------------------------------

    const domain = new DomainName(this, 'ApiDomain', {
      domainName: props.apiDomainName,
      certificate: props.certificate,
    });

    this.httpApi = new HttpApi(this, 'HttpApi', {
      apiName: 'memorysmith-api',
      defaultIntegration: new HttpLambdaIntegration('CoreIntegration', api.function),
      corsPreflight: {
        allowOrigins: [props.frontendOrigin, 'http://localhost:5173'],
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
          CorsHttpMethod.PUT,
          CorsHttpMethod.PATCH,
          CorsHttpMethod.DELETE,
          CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['authorization', 'content-type'],
        // What answered, readable by the interface and by a test (section 23.3).
        exposeHeaders: ['x-memorysmith-environment', 'x-memorysmith-version'],
        maxAge: Duration.hours(1),
      },
      defaultDomainMapping: { domainName: domain },
    });

    // The gateway refuses an unsigned request before it reaches the function,
    // and the function checks that the gateway did (section 14.1).
    this.httpApi.addRoutes({
      path: CONNECTOR_BINDING_ROUTE,
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('ConnectorBindingIntegration', api.function),
      authorizer: new HttpIamAuthorizer(),
    });

    new ARecord(this, 'ApiRecord', {
      zone: props.hostedZone,
      recordName: props.apiDomainName,
      target: RecordTarget.fromAlias(
        new ApiGatewayv2DomainProperties(domain.regionalDomainName, domain.regionalHostedZoneId),
      ),
    });

    this.apiOrigin = `https://${props.apiDomainName}`;
  }
}
