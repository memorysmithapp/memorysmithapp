/**
 * ServiceLambda: no service reaches production without observability and the
 * mandatory alarms, each with the destination it notifies. Where the
 * environment carries no alarms, as staging does, it creates none (#267).
 *
 * Forgetting them stops being possible by omission, which is the whole reason
 * this construct exists instead of a helper function someone may skip.
 *
 * It also DECLARES the log group of every function. A group created by the
 * Lambda service is not owned by CloudFormation, so `cdk destroy` leaves it
 * behind, and without retention it never expires and is billed forever.
 */

import { Duration, RemovalPolicy, type Size } from 'aws-cdk-lib';
import { ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { Architecture, Runtime, type ILayerVersion } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, type NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { mandatoryAlarm } from './alarms.js';
import { deploymentOf, deploymentVariables } from './deployment.js';

/**
 * What every bundle opens with: a `require` for the CommonJS a dependency
 * still calls, in an ES module. The import is renamed because esbuild cannot
 * see the banner — a dependency that imports `createRequire` itself at the top
 * of the bundle (puppeteer does) declared it twice, and the function never
 * started (#263).
 */
export const LAMBDA_BANNER =
  "import{createRequire as __bannerCreateRequire}from'module';const require=__bannerCreateRequire(import.meta.url);";

export interface ServiceLambdaProps {
  readonly entry: string;
  readonly description: string;
  readonly environment?: Record<string, string>;
  readonly timeout?: Duration;
  readonly memorySize?: number;
  /**
   * The p99 alarm, for a function somebody waits on: the core API, the agent
   * and the trigger of every sign-in. A function that runs a handful of times
   * a day has a p99 of almost nothing, which is noise and not a signal (#318).
   */
  readonly latencyAlarm?: boolean;
  readonly bundling?: NodejsFunctionProps['bundling'];
  /**
   * ARM by default. A function that carries a binary built for one
   * architecture only — the browser of the renderer of prints — says which.
   */
  readonly architecture?: Architecture;
  readonly layers?: ILayerVersion[];
  /** What `/tmp` holds, for a function that unpacks something there. */
  readonly ephemeralStorageSize?: Size;
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
      architecture: props.architecture ?? Architecture.ARM_64,
      ...(props.layers ? { layers: props.layers } : {}),
      ...(props.ephemeralStorageSize ? { ephemeralStorageSize: props.ephemeralStorageSize } : {}),
      memorySize: props.memorySize ?? 512,
      timeout: props.timeout ?? Duration.seconds(15),
      description: props.description,
      logGroup,
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        // Powertools writes the one line of each operation, named by this
        // service, with the subscriptionId on it. The subscription
        // is never a metric dimension: a question about one subscription is a
        // query of the logs, not a metric per subscription.
        POWERTOOLS_SERVICE_NAME: id,
        POWERTOOLS_LOG_LEVEL: 'INFO',
        POWERTOOLS_METRICS_NAMESPACE: 'MemorySmith',
        // Where it runs and what it is, as configuration and never as a
        // constant of the bundle.
        ...deploymentVariables(deploymentOf(this)),
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
        banner: LAMBDA_BANNER,
        ...props.bundling,
      },
    });

    // ---- The mandatory alarms ---------------------------------
    // Through mandatoryAlarm, which attaches the topic of the environment and
    // creates nothing where the environment carries no alarms (#267).

    mandatoryAlarm(this, 'Errors', {
      alarmDescription: `${id}: invocation errors`,
      metric: this.function.metricErrors({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });

    // No alarm on throttles per function: no function reserves concurrency, so
    // a throttle is the account reaching its limit, and the one alarm of the
    // account in the network stack says so (#318).

    if (props.latencyAlarm === true) {
      mandatoryAlarm(this, 'Duration', {
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
