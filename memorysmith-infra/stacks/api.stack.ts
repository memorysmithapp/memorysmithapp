/**
 * The core deployable: the modular monolith behind api.memorysmith.app, plus
 * the outbox relay that drains its stream (architecture-guide.md, 17 and 24).
 *
 * Splitting into six deployables later means instantiating six of these and
 * changing the composition root; the tables, the bucket and the bus do not
 * move (section 24).
 */

import { Duration, Size, Stack, type StackProps } from 'aws-cdk-lib';
import { HttpApi, CorsHttpMethod, DomainName, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpIamAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Rule } from 'aws-cdk-lib/aws-events';
import { SqsQueue } from 'aws-cdk-lib/aws-events-targets';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import {
  Architecture,
  Code,
  LayerVersion,
  Runtime,
  StartingPosition,
} from 'aws-cdk-lib/aws-lambda';
import { DynamoEventSource, SqsDlq, SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Alarm, ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { ARecord, RecordTarget, type IHostedZone } from 'aws-cdk-lib/aws-route53';
import { ApiGatewayv2DomainProperties, CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import {
  AllowedMethods,
  CacheCookieBehavior,
  CacheHeaderBehavior,
  CachePolicy,
  CacheQueryStringBehavior,
  Distribution,
  OriginProtocolPolicy,
  OriginRequestPolicy,
  PriceClass,
  ResponseHeadersPolicy,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import type { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import type { IUserPool } from 'aws-cdk-lib/aws-cognito';
import type { Construct } from 'constructs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { ServiceLambda } from '../constructs/service-lambda.js';
import type { DataStack } from './data.stack.js';
import { physicalName, type EnvironmentConfig } from '../config/environments.js';

const here = dirname(fileURLToPath(import.meta.url));
const backend = join(here, '..', '..', 'memorysmith-backend');

/**
 * The browser the renderer of prints carries (#263): the compressed Chromium
 * of `@sparticuz/chromium`, as the portability service depends on it — the
 * version the lockfile pins, built for x86_64 and for the Amazon Linux of the
 * runtime. It is a layer, because esbuild bundles code and not a binary.
 */
const chromiumBinaries = join(
  dirname(
    createRequire(join(backend, 'services', 'portability', 'package.json')).resolve(
      '@sparticuz/chromium',
    ),
  ),
  '..',
  'bin',
);

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
  /** The host the parts of an upload are sent to, and its certificate (#241). */
  readonly uploadsDomainName: string;
  readonly uploadsCertificate: ICertificate;
  /** The host a kept file and an export are read from, and its certificate (#255). */
  readonly filesDomainName: string;
  readonly filesCertificate: ICertificate;
  readonly cognitoIssuer: string;
  /** The app client of the connector proxy, whose tokens write as a connector. */
  readonly connectorClientId: string;
  /**
   * The app client of the interface. The API proves a current password by
   * authenticating with it before setting a new one (#168, RN-ACC-023), which
   * is how a change is told apart from a recovery without widening the scopes
   * of the token the browser holds.
   */
  readonly webClientId: string;
  readonly frontendOrigin: string;
  /** The pool whose accounts record the language they are written to in (RN-ACC-018). */
  readonly userPool: IUserPool;
}

export class ApiStack extends Stack {
  readonly apiOrigin: string;
  /** Where the parts of an upload are sent (#241). */
  readonly uploadsOrigin: string;
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

    /**
     * Where a print is handed to its renderer (#263, RN-PRT-031). Starting a
     * browser and drawing a note does not fit in the 29 seconds of the API
     * either. A message is never retried: a person is waiting on it, and the
     * renderer leaves the reason when it cannot make the file.
     */
    const printDlq = new Queue(this, 'PrintDeadLetter', {
      queueName: physicalName(props.environment, 'mv-print-dlq'),
      retentionPeriod: Duration.days(4),
    });
    const printQueue = new Queue(this, 'PrintQueue', {
      queueName: physicalName(props.environment, 'mv-print'),
      // Longer than the timeout of the renderer.
      visibilityTimeout: Duration.minutes(3),
      deadLetterQueue: { queue: printDlq, maxReceiveCount: 1 },
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
      PRINT_QUEUE_URL: printQueue.queueUrl,
      CONNECTOR_CLIENT_ID: props.connectorClientId,
      USER_POOL_ID: props.userPool.userPoolId,
      WEB_CLIENT_ID: props.webClientId,
      // Where a signed part is answered, instead of the bucket's own name (#241).
      UPLOADS_ORIGIN: `https://${props.uploadsDomainName}`,
      // Where a link to a kept file or an export is answered (#255).
      FILES_ORIGIN: `https://${props.filesDomainName}`,
    };

    const api = new ServiceLambda(this, 'CoreApi', {
      entry: join(backend, 'apps', 'core-monolith', 'src', 'handler.ts'),
      description: 'MemorySmith core API: access, knowledge, discovery and audit reads.',
      environment,
      timeout: Duration.seconds(29),
      memorySize: 1024,
    });

    /**
     * What the API does on an account of the pool: writes its language and
     * its name, reads the name back, and changes the password of whoever
     * proved the current one (RN-ACC-018, RN-ACC-021, RN-ACC-023). The last
     * one is three actions, because a change is an authentication, a set and
     * the end of the other sessions.
     */
    props.userPool.grant(
      api.function,
      'cognito-idp:AdminUpdateUserAttributes',
      'cognito-idp:AdminGetUser',
      'cognito-idp:AdminInitiateAuth',
      'cognito-idp:AdminSetUserPassword',
      'cognito-idp:AdminUserGlobalSignOut',
    );
    props.data.accessTable.table.grantReadWriteData(api.function);
    props.data.knowledgeTable.table.grantReadWriteData(api.function);
    props.data.discoveryTable.table.grantReadWriteData(api.function);
    props.data.portabilityTable.table.grantReadWriteData(api.function);
    transferQueue.grantSendMessages(api.function);
    printQueue.grantSendMessages(api.function);
    /**
     * Read and put, and deliberately NOT delete. `grantReadWrite` carries
     * `s3:DeleteObject*`, which includes deleting a version, and only ONE
     * principal in this system may do that: the purge worker below
     * (RN-KNW-047). The API writes revisions and never destroys one.
     */
    props.data.contentBucket.grantRead(api.function);
    props.data.contentBucket.grantPut(api.function);
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
    /**
     * An upload in parts is thrown away by deleting its row, and a finish
     * destroys the parts it joined (RN-PRT-027, RN-PRT-028): the same delete of
     * a version, scoped to `uploads/` and to nothing else — an upload is not a
     * file yet, and no revision of a file or a note is within its reach.
     */
    api.function.addToRolePolicy(
      new PolicyStatement({
        actions: ['s3:DeleteObject', 's3:DeleteObjectVersion'],
        resources: [props.data.contentBucket.arnForObjects('s/*/uploads/*')],
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

    // The same relay over mv-access, whose outbox nothing drained until a
    // share of a notebook had to reach the trail (RN-ACC-024). Access events
    // move no counter, so it only reads the stream and publishes.
    const accessRelay = new ServiceLambda(this, 'AccessOutboxRelay', {
      entry: join(backend, 'apps', 'core-monolith', 'src', 'access-relay.handler.ts'),
      description: 'Drains the transactional outbox of Access into the event bus.',
      environment: {
        ACCESS_TABLE: props.data.accessTable.table.tableName,
        EVENT_BUS_NAME: props.data.eventBus.eventBusName,
      },
      timeout: Duration.seconds(30),
    });

    accessRelay.function.addEventSource(
      new DynamoEventSource(props.data.accessTable.table, {
        startingPosition: StartingPosition.TRIM_HORIZON,
        batchSize: 25,
        retryAttempts: 3,
        onFailure: new SqsDlq(relayDlq),
      }),
    );
    props.data.eventBus.grantPutEventsTo(accessRelay.function);

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
        // A purged notebook keeps its life in the trail and loses what
        // happened inside it (RN-AUD-011).
        AUDIT_TABLE: props.data.auditTable.table.tableName,
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

    /**
     * And the one principal that may remove an entry of the trail (rule 6,
     * RN-AUD-011). It is the same worker for the same reason: what destroys is
     * one thing, reached through a port of its own. Every other role of the
     * system keeps its explicit Deny.
     */
    props.data.auditTable.grantTrailPurge(purge.function);

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
        // An IMPORT writes as the person who asked for it, so the worker
        // resolves the role they hold where the API resolves it (RN-PRT-018).
        ACCESS_TABLE: props.data.accessTable.table.tableName,
        // An export may carry the history of the notebook (RN-PRT-022), and an
        // import brings one back (RN-PRT-023).
        AUDIT_TABLE: props.data.auditTable.table.tableName,
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
    /**
     * An export READS the notebook and an import WRITES one, through the same
     * use cases the API writes with: the same quota, the same limits and the
     * same events, which reach the outbox of this table (RN-PRT-018).
     */
    props.data.knowledgeTable.table.grantReadWriteData(transfers.function);
    props.data.portabilityTable.table.grantReadWriteData(transfers.function);
    // Read alone: the worker resolves a role and never changes one.
    props.data.accessTable.table.grantReadData(transfers.function);
    props.data.contentBucket.grantRead(transfers.function);
    props.data.contentBucket.grantPut(transfers.function);
    /**
     * An import discards its upload once it ends, whichever way it ended
     * (RN-PRT-014). The API used to hold this, because the import used to run
     * there; it runs HERE now, and the permission travels with the work.
     *
     * It is a delete of the current object under `imports/` and nowhere else,
     * and never of a version: on a versioned bucket it leaves a marker, the
     * lifecycle rule of the tag expires what is left, and no revision of a
     * note is within its reach (rule 8).
     */
    transfers.function.addToRolePolicy(
      new PolicyStatement({
        actions: ['s3:DeleteObject'],
        resources: [props.data.contentBucket.arnForObjects('s/*/imports/*')],
      }),
    );
    /**
     * The trail, read and appended to and nothing else: an export may carry
     * the history of a notebook and an import writes one back, keeping the
     * person and the instant each entry carried (RN-PRT-022, RN-PRT-023).
     * Altering an entry is denied here as everywhere, and removing one belongs
     * to the purge alone (rule 6).
     */
    props.data.auditTable.grantReadAndAppend(transfers.function);

    // A message here is an export somebody asked for and will never get.
    new Alarm(this, 'TransferDeadLetterDepth', {
      alarmDescription: 'Transfer worker: messages in the dead-letter queue',
      metric: transferDlq.metricApproximateNumberOfMessagesVisible({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });

    // ---- The renderer of prints (#263) ---------------------------------------

    const chromium = new LayerVersion(this, 'Chromium', {
      code: Code.fromAsset(chromiumBinaries),
      compatibleArchitectures: [Architecture.X86_64],
      compatibleRuntimes: [Runtime.NODEJS_22_X],
      description: 'The compressed Chromium the renderer of prints opens pages in.',
    });

    const printer = new ServiceLambda(this, 'PrintRenderer', {
      entry: join(backend, 'apps', 'core-monolith', 'src', 'print.handler.ts'),
      description: 'Opens the print page of a note as the person who asked, and saves it as a PDF.',
      environment: {
        CONTENT_BUCKET: props.data.contentBucket.bucketName,
        // The page is opened on the application, and reaches its API and the
        // host its pictures are served on — and nothing else.
        SITE_ORIGIN: props.frontendOrigin,
        API_ORIGIN: `https://${props.apiDomainName}`,
        FILES_ORIGIN: `https://${props.filesDomainName}`,
        CHROMIUM_DIRECTORY: '/opt',
      },
      // The binary is built for x86_64 only, and it unpacks into /tmp.
      architecture: Architecture.X86_64,
      layers: [chromium],
      memorySize: 2048,
      ephemeralStorageSize: Size.mebibytes(1024),
      timeout: Duration.minutes(2),
    });
    // One note at a time: a browser draws one page well, and a batch would
    // make one long note hold up the others.
    printer.function.addEventSource(new SqsEventSource(printQueue, { batchSize: 1 }));
    // It writes the file, or the reason there is none, under `prints/` alone:
    // it reads nothing of the bucket, and the page reads the note through the
    // API, as the person who asked.
    props.data.contentBucket.grantPut(printer.function, 's/*/prints/*');

    new Alarm(this, 'PrintDeadLetterDepth', {
      alarmDescription: 'Print renderer: messages in the dead-letter queue',
      metric: printDlq.metricApproximateNumberOfMessagesVisible({ period: Duration.minutes(5) }),
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

    /**
     * The host the parts of an upload are sent to (#241, RN-PRT-027). A part is
     * signed by S3 exactly as before, for the bucket's own host, and answered on
     * this one: CloudFront forwards every query string and every header but
     * Host, so S3 receives the very request that was signed — same path, same
     * query, its own host — and checks the signature itself. Nothing re-signs,
     * nothing authorises in between, and no function sees the bytes, so the
     * 6 MB of a request stays out of the way.
     *
     * Caching is off and every method is allowed: what reaches the bucket is
     * only what a signature of S3 already allows, and the bucket keeps blocking
     * public access. The Origin header travels too, so the CORS of the bucket
     * answers the site as it does on the bucket's own host.
     */
    const uploads = new Distribution(this, 'UploadsDistribution', {
      comment: `MemorySmith uploads (${props.environment.name})`,
      domainNames: [props.uploadsDomainName],
      certificate: props.uploadsCertificate,
      priceClass: PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: new HttpOrigin(props.data.contentBucket.bucketRegionalDomainName, {
          protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
        }),
        allowedMethods: AllowedMethods.ALLOW_ALL,
        cachePolicy: CachePolicy.CACHING_DISABLED,
        originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
      },
    });
    new ARecord(this, 'UploadsRecord', {
      zone: props.hostedZone,
      recordName: props.uploadsDomainName,
      target: RecordTarget.fromAlias(new CloudFrontTarget(uploads)),
    });
    this.uploadsOrigin = `https://${props.uploadsDomainName}`;

    /**
     * The host a kept file and an export are read from (#255, RN-KNW-050).
     * The same arrangement as the uploads host, in the other direction: the
     * API signs the GET for the bucket's own host and answers it on this one,
     * and CloudFront hands S3 the very request it signed, so the link expires
     * when it always did and an altered one is refused by S3 itself.
     *
     * It is a distribution of its own, with a certificate of its own, rather
     * than a second name on the uploads one: a read allows only a read, and the
     * headers it adds are for what a browser renders. `files.{zone}` is an
     * origin apart from the product's, which is what keeps something somebody
     * uploaded from ever running as the application; `nosniff` and a policy
     * that sandboxes the document and allows no script make that hold by
     * header too — an SVG opened in its own tab runs nothing, while a picture,
     * a PDF and a recording still show where they are opened.
     */
    const filesHeaders = new ResponseHeadersPolicy(this, 'FilesHeaders', {
      comment: `MemorySmith files (${props.environment.name})`,
      securityHeadersBehavior: {
        contentTypeOptions: { override: true },
        contentSecurityPolicy: {
          contentSecurityPolicy:
            "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox",
          override: true,
        },
      },
    });
    /**
     * Why not `CachingDisabled`, as on the uploads host: under it CloudFront
     * drops the `response-content-type` and `response-content-disposition`
     * of the query before it reaches S3, while forwarding every other
     * parameter, so S3 sees a request it never signed and answers
     * `SignatureDoesNotMatch` — found on staging, where a plain signed GET
     * passed and one naming its disposition did not. Those two are what make
     * a PDF open where it is opened and save under its name where it is
     * saved (RN-KNW-050), so they have to arrive. A query string travels
     * whole when the cache policy names it, and naming it needs a TTL above
     * zero; the default stays at zero and S3 sends no Cache-Control, so
     * nothing is kept, and a link is its own key anyway.
     */
    const filesCache = new CachePolicy(this, 'FilesCache', {
      comment: `MemorySmith files (${props.environment.name}): the whole signed query reaches S3`,
      defaultTtl: Duration.seconds(0),
      minTtl: Duration.seconds(0),
      maxTtl: Duration.seconds(1),
      queryStringBehavior: CacheQueryStringBehavior.all(),
      headerBehavior: CacheHeaderBehavior.none(),
      cookieBehavior: CacheCookieBehavior.none(),
    });
    const files = new Distribution(this, 'FilesDistribution', {
      comment: `MemorySmith files (${props.environment.name})`,
      domainNames: [props.filesDomainName],
      certificate: props.filesCertificate,
      priceClass: PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: new HttpOrigin(props.data.contentBucket.bucketRegionalDomainName, {
          protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
        }),
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: filesCache,
        originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        responseHeadersPolicy: filesHeaders,
        viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
      },
    });
    new ARecord(this, 'FilesRecord', {
      zone: props.hostedZone,
      recordName: props.filesDomainName,
      target: RecordTarget.fromAlias(new CloudFrontTarget(files)),
    });
  }
}
