/**
 * The rebuild of the link graph of an environment, as a run in AWS rather than
 * a process on somebody's computer (#311; architecture-guide.md §11).
 *
 *   list ─► map, one notebook per iteration, a few dozen at once ─► summarise ─► good?
 *
 * A notebook is rebuilt from that notebook alone, so the work splits by
 * notebook and nothing holds a workstation: the run belongs to the state
 * machine, under a role of its own, and survives whoever started it. The
 * console of the execution says how many notebooks are done while it runs, and
 * a notebook that keeps failing after its retries is answered as failed and
 * named in the summary without stopping the others.
 *
 * The notebooks travel in the state of the run, and never through a bucket:
 * the content bucket keys everything by subscription (rule 1), and a bucket of
 * runs would be the third exception the design says does not exist. What a
 * notebook answers is identifiers and counts, about a hundred bytes, so the
 * 256 KiB a state may carry holds the notebooks of an environment many times
 * over.
 */

import { Duration } from 'aws-cdk-lib';
import type { ITable } from 'aws-cdk-lib/aws-dynamodb';
import type { IBucket } from 'aws-cdk-lib/aws-s3';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { RemovalPolicy } from 'aws-cdk-lib';
import {
  Choice,
  Condition,
  DefinitionBody,
  DistributedMap,
  Fail,
  JsonPath,
  LogLevel,
  Pass,
  StateMachine,
  StateMachineType,
  Succeed,
  TaskInput,
} from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';
import { ServiceLambda } from './service-lambda.js';

/** How many notebooks are rebuilt at once: the concurrency quota is the account's (§20.1). */
export const REPROJECTION_CONCURRENCY = 20;

export interface LinkReprojectionProps {
  readonly entry: string;
  readonly stateMachineName: string;
  readonly knowledgeTable: ITable;
  readonly discoveryTable: ITable;
  readonly contentBucket: IBucket;
}

export class LinkReprojection extends Construct {
  readonly stateMachine: StateMachine;

  constructor(scope: Construct, id: string, props: LinkReprojectionProps) {
    super(scope, id);

    const steps = new ServiceLambda(this, 'LinkReprojection', {
      entry: props.entry,
      description: 'Rebuilds the link graph: lists the notebooks, rebuilds one, sums a run.',
      environment: {
        KNOWLEDGE_TABLE: props.knowledgeTable.tableName,
        DISCOVERY_TABLE: props.discoveryTable.tableName,
        CONTENT_BUCKET: props.contentBucket.bucketName,
      },
      // The listing scans the whole table, and a notebook of thousands of
      // notes reads each one: neither answers a person who is waiting.
      timeout: Duration.minutes(10),
      memorySize: 1024,
      latencyAlarm: false,
    });
    props.knowledgeTable.grantReadData(steps.function);
    props.discoveryTable.grantReadWriteData(steps.function);
    props.contentBucket.grantRead(steps.function);

    const mode = JsonPath.stringAt('$$.Execution.Input.mode');
    const run = JsonPath.stringAt('$$.Execution.Name');

    const list = new LambdaInvoke(this, 'List the live notebooks', {
      lambdaFunction: steps.function,
      payload: TaskInput.fromObject({ step: 'list', mode, run }),
      payloadResponseOnly: true,
    });

    const rebuild = new LambdaInvoke(this, 'Rebuild one notebook', {
      lambdaFunction: steps.function,
      payload: TaskInput.fromObject({
        step: 'notebook',
        mode,
        run,
        subscriptionId: JsonPath.stringAt('$.subscriptionId'),
        notebookId: JsonPath.stringAt('$.notebookId'),
      }),
      payloadResponseOnly: true,
    });
    rebuild.addRetry({
      errors: ['States.ALL'],
      maxAttempts: 2,
      interval: Duration.seconds(5),
      backoffRate: 3,
    });
    // A notebook that keeps failing is an answer of its own, and the others
    // go on: the summary names it.
    const failed = new Pass(this, 'Name the notebook that failed', {
      parameters: {
        'subscriptionId.$': '$.subscriptionId',
        'notebookId.$': '$.notebookId',
        failed: true,
        'error.$': '$.failure.Error',
      },
    });
    rebuild.addCatch(failed, { errors: ['States.ALL'], resultPath: '$.failure' });

    const map = new DistributedMap(this, 'Every notebook', {
      itemsPath: '$.notebooks',
      maxConcurrency: REPROJECTION_CONCURRENCY,
      label: 'notebooks',
    });
    map.itemProcessor(rebuild);

    const summary = new LambdaInvoke(this, 'Summarise the run', {
      lambdaFunction: steps.function,
      payload: TaskInput.fromObject({
        step: 'summarise',
        mode,
        run,
        results: JsonPath.listAt('$'),
      }),
      payloadResponseOnly: true,
    });

    // A run that lost an edge or left a notebook failed is not called good,
    // and its summary is the cause, so the console says why.
    const verdict = new Choice(this, 'Is the run good?')
      .when(Condition.booleanEquals('$.good', true), new Succeed(this, 'Good'))
      .otherwise(
        new Fail(this, 'Not good', {
          error: 'ReprojectionNotGood',
          causePath: JsonPath.jsonToString(JsonPath.objectAt('$')),
        }),
      );

    const logs = new LogGroup(this, 'Logs', {
      retention: RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.stateMachine = new StateMachine(this, 'StateMachine', {
      stateMachineName: props.stateMachineName,
      stateMachineType: StateMachineType.STANDARD,
      definitionBody: DefinitionBody.fromChainable(list.next(map).next(summary).next(verdict)),
      timeout: Duration.hours(6),
      logs: { destination: logs, level: LogLevel.ERROR },
    });
  }
}
