/**
 * ServiceLambda: no service reaches production without observability and the
 * mandatory alarms (architecture-guide.md, sections 5.4 and 17).
 *
 * Forgetting them stops being possible by omission, which is the whole reason
 * this construct exists instead of a helper function someone may skip.
 *
 * It also DECLARES the log group of every function. A group created by the
 * Lambda service is not owned by CloudFormation, so `cdk destroy` leaves it
 * behind, and without retention it never expires and is billed forever.
 */

import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Alarm, ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, type NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface ServiceLambdaProps {
  readonly entry: string;
  readonly description: string;
  readonly environment?: Record<string, string>;
  readonly timeout?: Duration;
  readonly memorySize?: number;
  /** Alarms are on by default; a projector may opt out of the p99 one. */
  readonly latencyAlarm?: boolean;
  readonly bundling?: NodejsFunctionProps['bundling'];
}

export class ServiceLambda extends Construct {
  readonly function: NodejsFunction;

  constructor(scope: Construct, id: string, props: ServiceLambdaProps) {
    super(scope, id);

    /**
     * The log group is DECLARED, not left to the Lambda service to create.
     * A group created by the service is not owned by CloudFormation, so
     * `cdk destroy` leaves it behind, and without retention it never expires
     * and is billed forever.
     */
    const logGroup = new LogGroup(this, 'Logs', {
      retention: RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.function = new NodejsFunction(this, 'Function', {
      entry: props.entry,
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      memorySize: props.memorySize ?? 512,
      timeout: props.timeout ?? Duration.seconds(15),
      description: props.description,
      logGroup,
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        // Powertools: the subscriptionId goes on every log line and as a
        // metric dimension (section 17).
        POWERTOOLS_SERVICE_NAME: id,
        POWERTOOLS_LOG_LEVEL: 'INFO',
        POWERTOOLS_METRICS_NAMESPACE: 'MemorySmith',
        ...props.environment,
      },
      bundling: {
        format: 'esm' as never,
        target: 'node22',
        sourceMap: true,
        minify: false,
        // The SDK is bundled rather than taken from the runtime, so the
        // version the tests exercise is the version that runs.
        externalModules: [],
        banner: "import{createRequire}from'module';const require=createRequire(import.meta.url);",
        ...props.bundling,
      },
    });

    // ---- The mandatory alarms (section 17) ---------------------------------

    new Alarm(this, 'Errors', {
      alarmDescription: `${id}: invocation errors`,
      metric: this.function.metricErrors({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });

    new Alarm(this, 'Throttles', {
      alarmDescription: `${id}: throttled invocations`,
      metric: this.function.metricThrottles({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });

    if (props.latencyAlarm !== false) {
      new Alarm(this, 'Duration', {
        alarmDescription: `${id}: p99 duration`,
        metric: this.function.metricDuration({
          period: Duration.minutes(5),
          statistic: 'p99',
        }),
        threshold: (props.timeout ?? Duration.seconds(15)).toMilliseconds() * 0.8,
        evaluationPeriods: 3,
        comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: TreatMissingData.NOT_BREACHING,
      });
    }
  }
}
