/**
 * The core deployable: the modular monolith behind api.memorysmith.app, plus
 * the outbox relay that drains its stream (architecture-guide.md, 17 and 24).
 *
 * Splitting into six deployables later means instantiating six of these and
 * changing the composition root; the tables, the bucket and the bus do not
 * move (section 24).
 */

import { Duration, Stack, type StackProps } from 'aws-cdk-lib';
import { HttpApi, CorsHttpMethod, DomainName } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { DynamoEventSource, SqsDlq } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Alarm, ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { ARecord, RecordTarget, type IHostedZone } from 'aws-cdk-lib/aws-route53';
import { ApiGatewayv2DomainProperties } from 'aws-cdk-lib/aws-route53-targets';
import type { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import type { Construct } from 'constructs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ServiceLambda } from '../constructs/service-lambda.js';
import type { DataStack } from './data.stack.js';

const here = dirname(fileURLToPath(import.meta.url));
const backend = join(here, '..', '..', 'memorysmith-backend');

export interface ApiStackProps extends StackProps {
  readonly data: DataStack;
  readonly hostedZone: IHostedZone;
  readonly certificate: ICertificate;
  readonly apiDomainName: string;
  readonly cognitoIssuer: string;
  readonly frontendOrigin: string;
}

export class ApiStack extends Stack {
  readonly apiOrigin: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const environment = {
      ACCESS_TABLE: props.data.accessTable.table.tableName,
      KNOWLEDGE_TABLE: props.data.knowledgeTable.table.tableName,
      DISCOVERY_TABLE: props.data.discoveryTable.table.tableName,
      AUDIT_TABLE: props.data.auditTable.table.tableName,
      CONTENT_BUCKET: props.data.contentBucket.bucketName,
      EVENT_BUS_NAME: props.data.eventBus.eventBusName,
      COGNITO_ISSUER: props.cognitoIssuer,
    };

    const api = new ServiceLambda(this, 'CoreApi', {
      entry: join(backend, 'apps', 'core-monolith', 'src', 'handler.ts'),
      description: 'MemorySmith core API: access, knowledge, discovery and audit reads.',
      environment,
      timeout: Duration.seconds(29),
      memorySize: 1024,
    });

    props.data.accessTable.table.grantReadWriteData(api.function);
    props.data.knowledgeTable.table.grantReadWriteData(api.function);
    props.data.discoveryTable.table.grantReadWriteData(api.function);
    props.data.contentBucket.grantReadWrite(api.function);
    // The API READS the trail and can never write it: the Deny travels with
    // the grant (PE4).
    props.data.auditTable.grantRead(api.function);
    // ---- The outbox relay ---------------------------------------------------

    const relayDlq = new Queue(this, 'RelayDeadLetter', {
      queueName: 'mv-outbox-dlq',
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

    // ---- The HTTP surface ---------------------------------------------------

    const domain = new DomainName(this, 'ApiDomain', {
      domainName: props.apiDomainName,
      certificate: props.certificate,
    });

    const httpApi = new HttpApi(this, 'HttpApi', {
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
        maxAge: Duration.hours(1),
      },
      defaultDomainMapping: { domainName: domain },
    });

    new ARecord(this, 'ApiRecord', {
      zone: props.hostedZone,
      recordName: props.apiDomainName,
      target: RecordTarget.fromAlias(
        new ApiGatewayv2DomainProperties(domain.regionalDomainName, domain.regionalHostedZoneId),
      ),
    });

    this.apiOrigin = `https://${props.apiDomainName}`;
    void httpApi;
  }
}
