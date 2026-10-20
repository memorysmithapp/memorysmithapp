/**
 * Where somebody looks at the product (#270).
 *
 * Three questions need an answer at a glance: is it being used, and by whom;
 * do the business flows reach their end; is it healthy. Each is a dashboard.
 * They cost money, the health one holding more than the fifty metrics the free
 * allowance covers, so they exist only where a delivery turns them on, in
 * either environment (ADR-021).
 *
 * What a person did is read from the operation lines of the log through Logs
 * Insights wherever a count of distinct people is asked, so no metric is kept
 * per person or per subscription. The logs are kept a month, so the one trend
 * that has to outlive them — the active people of a day, a week and a month —
 * is counted once a day and written as three metrics, kept fifteen months. That
 * count runs in both environments, so staging proves it before production
 * relies on it.
 *
 * It is the last stack a delivery deploys, and it holds no state: it reads the
 * functions, the queues and the APIs the other stacks declared, found in their
 * construct trees, so no stack has to hand it anything.
 */

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Duration, Stack, type StackProps } from 'aws-cdk-lib';
import { HttpApi } from 'aws-cdk-lib/aws-apigatewayv2';
import {
  Dashboard,
  GraphWidget,
  LogQueryVisualizationType,
  LogQueryWidget,
  MathExpression,
  Metric,
  TextWidget,
  type IMetric,
  type IWidget,
} from 'aws-cdk-lib/aws-cloudwatch';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import type { Construct } from 'constructs';
import { physicalName, type EnvironmentConfig } from '../config/environments.js';
import { ServiceLambda } from '../constructs/service-lambda.js';
import type { DataStack } from './data.stack.js';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The namespace the daily count writes to, the one every function declares. */
const NAMESPACE = 'MemorySmith';

/** The latency targets the quality requirements declare, drawn on the request path. */
const TARGETS = [
  { label: 'get_notebook_context p95 target', value: 400 },
  { label: 'create_note / update_note p95 target', value: 600 },
];

export interface ObservabilityStackProps extends StackProps {
  readonly environment: EnvironmentConfig;
  readonly data: DataStack;
  /** The stacks whose functions, queues and APIs are watched. */
  readonly sources: readonly Stack[];
}

export class ObservabilityStack extends Stack {
  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);

    const found = props.sources.flatMap((stack) => stack.node.findAll());
    const functions = new Map(
      found
        .filter((node): node is ServiceLambda => node instanceof ServiceLambda)
        .map((service) => [service.node.id, service]),
    );
    const named = (name: string): ServiceLambda => {
      const service = functions.get(name);
      if (!service) throw new Error(`No function ${name} to watch.`);
      return service;
    };
    const queues = found.filter((node): node is Queue => node instanceof Queue);
    const apis = found.filter((node): node is HttpApi => node instanceof HttpApi);

    const core = named('CoreApi');
    const agent = named('AgentFunction');

    // ---- The daily count of active people ----------------------------------

    const activePeople = new ServiceLambda(this, 'ActivePeople', {
      entry: join(
        here,
        '..',
        '..',
        'memorysmithapp-backend',
        'apps',
        'core-monolith',
        'src',
        'active-people.handler.ts',
      ),
      description: 'Counts the active people of a day, a week and a month, once a day.',
      timeout: Duration.minutes(2),
      environment: {
        // The two doors a person or an agent comes in by.
        LOG_GROUPS: [core.logGroup.logGroupName, agent.logGroup.logGroupName].join(','),
      },
    });
    activePeople.function.addToRolePolicy(
      new PolicyStatement({
        actions: ['logs:StartQuery'],
        resources: [core.logGroup.logGroupArn, agent.logGroup.logGroupArn],
      }),
    );
    activePeople.function.addToRolePolicy(
      new PolicyStatement({ actions: ['logs:GetQueryResults'], resources: ['*'] }),
    );
    activePeople.function.addToRolePolicy(
      new PolicyStatement({
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
        conditions: { StringEquals: { 'cloudwatch:namespace': NAMESPACE } },
      }),
    );
    new Rule(this, 'ActivePeopleDaily', {
      description: 'Counts the active people once a day, just after midnight UTC.',
      schedule: Schedule.cron({ minute: '15', hour: '0' }),
      targets: [new LambdaFunction(activePeople.function)],
    });

    // The dashboards cost money, so only a delivery that turns them on draws
    // them, in either environment (ADR-021).
    if (!props.environment.dashboards) return;

    const groups = (...names: string[]) => names.map((name) => named(name).logGroup.logGroupName);
    const logs = (
      title: string,
      logGroupNames: string[],
      query: string,
      view: LogQueryVisualizationType = LogQueryVisualizationType.TABLE,
      width = 12,
    ): LogQueryWidget =>
      new LogQueryWidget({ title, logGroupNames, queryString: query, view, width, height: 6 });
    const doors = groups('CoreApi', 'AgentFunction');

    // ---- 1. Usage ------------------------------------------------------------

    const people = (metricName: string, label: string) =>
      new Metric({
        namespace: NAMESPACE,
        metricName,
        statistic: 'Maximum',
        period: Duration.days(1),
        label,
      });
    const daily = people('ActivePeopleDaily', 'DAU');
    const monthly = people('ActivePeopleMonthly', 'MAU');

    new Dashboard(this, 'Usage', {
      dashboardName: physicalName(props.environment, 'memorysmith-usage'),
      defaultInterval: Duration.days(30),
      widgets: [
        [
          new TextWidget({
            markdown:
              '## Usage\nAn active person did at least one operation, through the web or through an agent. Counts are of distinct identifiers, never of a person by name.',
            width: 24,
            height: 2,
          }),
        ],
        [
          new GraphWidget({
            title: 'Active people: DAU, WAU and MAU',
            left: [daily, people('ActivePeopleWeekly', 'WAU'), monthly],
            width: 12,
          }),
          new GraphWidget({
            title: 'DAU / MAU',
            left: [
              new MathExpression({
                expression: 'dau / mau',
                usingMetrics: { dau: daily, mau: monthly },
                label: 'DAU/MAU',
                period: Duration.days(1),
              }),
            ],
            width: 12,
          }),
        ],
        [
          logs(
            'Active people and subscriptions, per day',
            doors,
            'filter message = "operation" | stats count_distinct(userId) as people, count_distinct(subscriptionId) as subscriptions by bin(1d)',
            LogQueryVisualizationType.LINE,
          ),
          logs(
            'Operations by channel, per hour',
            groups('CoreApi'),
            'filter message = "operation" and ispresent(channel) | stats count(*) as operations by channel, bin(1h)',
            LogQueryVisualizationType.LINE,
          ),
        ],
        [
          logs(
            'Agents by client',
            groups('AgentFunction'),
            'filter message = "operation" and channel = "mcp" and ispresent(agentClient) | stats count(*) as calls, count_distinct(userId) as people by agentClient | sort calls desc',
          ),
          logs(
            'MCP tools, by calls',
            groups('AgentFunction'),
            'filter message = "operation" and operation like /^[a-z_]+$/ | stats count(*) as calls by operation | sort calls desc | limit 50',
          ),
        ],
        [
          logs(
            'MCP tools, by refusals',
            groups('AgentFunction'),
            'filter message = "operation" and operation like /^[a-z_]+$/ and outcome in ["refused", "conflict"] | stats count(*) as refusals by operation, errorCode | sort refusals desc | limit 50',
          ),
          logs(
            'Notes written and files kept, per day',
            groups('CoreApi'),
            // The route names what was done: POST …/notes created one, PUT
            // …/notes/:noteId updated one, POST …/files kept a file.
            'filter message = "operation" and status < 300 and (operation like /^POST .*\\/notes$/ or operation like /^PUT .*\\/notes\\/:[A-Za-z]+$/ or operation like /^POST .*\\/files$/) | stats count(*) as count by operation, bin(1d)',
            LogQueryVisualizationType.BAR,
          ),
        ],
      ],
    });

    // ---- 2. Business flows ---------------------------------------------------

    const funnel = (title: string, logGroupNames: string[], steps: string) =>
      logs(
        title,
        logGroupNames,
        `filter message = "operation" and (${steps}) | stats count_distinct(userId) as people, count(*) as times, avg(durationMs) as avgMs by operation, outcome | sort operation`,
      );
    const projectionQueue = queues.find((queue) => queue.node.id === 'ProjectionQueue');

    new Dashboard(this, 'Flows', {
      dashboardName: physicalName(props.environment, 'memorysmith-flows'),
      defaultInterval: Duration.days(7),
      widgets: [
        [
          new TextWidget({
            markdown:
              '## Business flows\nEach table is the steps of one flow: how many distinct people reached each step, how often, and how it ended.',
            width: 24,
            height: 2,
          }),
        ],
        [
          funnel(
            'Onboarding: invitation, sign-in, subscription, first notebook and note',
            [...groups('CustomMessage', 'PreTokenGeneration'), ...doors],
            'operation like /AdminCreateUser|ForgotPassword/ or operation like /^TokenGeneration_(HostedAuth|Authentication|NewPasswordChallenge)$/ or operation like /^POST .*\\/(subscriptions|session\\/welcomed)$/ or operation like /^POST .*\\/notebooks$/ or operation like /^POST .*\\/notes$/',
          ),
          funnel(
            'Connecting an agent: authorization, whoami, first call, first write',
            groups('AgentFunction'),
            'operation like /\\/(authorize|callback|token)$/ or operation in ["whoami", "get_notebook_context", "list_notebooks", "create_note", "update_note"]',
          ),
        ],
        [
          logs(
            'Writing: writes per channel and how they ended',
            groups('CoreApi'),
            'filter message = "operation" and operation like /^(POST|PUT|PATCH|DELETE) .*\\/notebooks/ | stats count(*) as writes by channel, outcome',
          ),
          logs(
            'Writing: conflicts and refusals, by reason',
            groups('CoreApi'),
            'filter message = "operation" and outcome in ["conflict", "refused"] | stats count(*) as times by errorCode, operation | sort times desc | limit 50',
          ),
        ],
        [
          funnel(
            'File upload: begin, parts, finish, discard',
            groups('AgentFunction'),
            'operation in ["begin_file_upload", "send_file_part", "finish_file_upload", "discard_file_upload", "keep_file"]',
          ),
          funnel(
            'Sharing: created, accepted, left and revoked',
            groups('CoreApi'),
            'operation like /\\/shares?(\\/|$)|\\/shared(\\/|$)/',
          ),
        ],
        [
          logs(
            'Portability: exports and imports, and their duration',
            groups('TransferWorker'),
            'filter message = "operation" | stats count(*) as runs, avg(durationMs) as avgMs, max(durationMs) as maxMs by operation, outcome',
          ),
          logs(
            'Print: PDF requested and delivered, and their duration',
            [...groups('PrintRenderer'), ...groups('CoreApi')],
            'filter message = "operation" and (operation like /\\/pdf$/ or operation like /Print|Preview/) | stats count(*) as times, pct(durationMs, 95) as p95Ms by operation, outcome',
          ),
        ],
        [
          new GraphWidget({
            title: 'Projection lag: age of the oldest event waiting for Discovery',
            left: projectionQueue
              ? [
                  projectionQueue.metricApproximateAgeOfOldestMessage({
                    period: Duration.minutes(5),
                    statistic: 'Maximum',
                  }),
                ]
              : [],
            width: 24,
          }),
        ],
      ],
    });

    // ---- 3. Golden signals ---------------------------------------------------

    const fiveMinutes = { period: Duration.minutes(5) };
    const requestPath = new Set(['CoreApi', 'AgentFunction', 'PreTokenGeneration']);
    const perFunction: IWidget[] = [...functions.values()].map((service) => {
      const fn = service.function;
      const latency: IMetric[] = requestPath.has(service.node.id)
        ? ['p50', 'p95', 'p99'].map((statistic) =>
            fn.metricDuration({ ...fiveMinutes, statistic, label: statistic }),
          )
        : [fn.metricDuration({ ...fiveMinutes, statistic: 'p95', label: 'p95' })];
      return new GraphWidget({
        title: `${service.node.id}: latency, traffic and errors`,
        left: latency,
        right: [
          fn.metricInvocations({ ...fiveMinutes, label: 'invocations' }),
          fn.metricErrors({ ...fiveMinutes, label: 'errors' }),
        ],
        leftAnnotations: service.node.id === 'AgentFunction' ? TARGETS : [],
        width: 8,
        height: 6,
      });
    });
    const rows: IWidget[][] = [];
    for (let index = 0; index < perFunction.length; index += 3) {
      rows.push(perFunction.slice(index, index + 3));
    }
    const tables = [
      props.data.accessTable.table,
      props.data.knowledgeTable.table,
      props.data.discoveryTable.table,
      props.data.portabilityTable.table,
      props.data.auditTable.table,
    ];

    new Dashboard(this, 'Health', {
      dashboardName: physicalName(props.environment, 'memorysmith-health'),
      defaultInterval: Duration.days(1),
      widgets: [
        [
          new TextWidget({
            markdown:
              '## Golden signals\nLatency, traffic, errors and saturation of every function. A 4xx is the product refusing as it should; a 5xx is not.',
            width: 24,
            height: 2,
          }),
        ],
        [
          new GraphWidget({
            title: 'HTTP APIs: 4xx and 5xx',
            left: apis.flatMap((api) => [
              api.metricClientError({ ...fiveMinutes, label: `${api.node.id} 4xx` }),
              api.metricServerError({ ...fiveMinutes, label: `${api.node.id} 5xx` }),
            ]),
            width: 12,
          }),
          new GraphWidget({
            title: 'Lambda: concurrency and throttles of the account',
            left: [
              new Metric({
                namespace: 'AWS/Lambda',
                metricName: 'ConcurrentExecutions',
                statistic: 'Maximum',
                ...fiveMinutes,
              }),
            ],
            right: [
              new Metric({
                namespace: 'AWS/Lambda',
                metricName: 'Throttles',
                statistic: 'Sum',
                ...fiveMinutes,
              }),
            ],
            width: 12,
          }),
        ],
        ...rows,
        [
          new GraphWidget({
            title: 'Queues: dead letters and the age of the oldest message',
            left: queues
              .filter((queue) => queue.node.id.endsWith('DeadLetter'))
              .map((queue) =>
                queue.metricApproximateNumberOfMessagesVisible({
                  ...fiveMinutes,
                  statistic: 'Maximum',
                  label: queue.node.id,
                }),
              ),
            right: queues
              .filter((queue) => !queue.node.id.endsWith('DeadLetter'))
              .map((queue) =>
                queue.metricApproximateAgeOfOldestMessage({
                  ...fiveMinutes,
                  statistic: 'Maximum',
                  label: queue.node.id,
                }),
              ),
            width: 12,
          }),
          new GraphWidget({
            title: 'DynamoDB: throttled requests per table',
            left: tables.flatMap((table) =>
              ['ReadThrottleEvents', 'WriteThrottleEvents'].map(
                (metricName) =>
                  new Metric({
                    namespace: 'AWS/DynamoDB',
                    metricName,
                    dimensionsMap: { TableName: table.tableName },
                    statistic: 'Sum',
                    ...fiveMinutes,
                  }),
              ),
            ),
            width: 12,
          }),
        ],
      ],
    });
  }
}
