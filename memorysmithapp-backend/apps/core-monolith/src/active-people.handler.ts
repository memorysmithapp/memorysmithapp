/**
 * The people who used the product, counted once a day (#270).
 *
 * An active person did at least one operation, through the web or through an
 * agent, so the count is of the distinct `userId` of the operation lines of the
 * core API and of the connector, the two doors a person or an agent comes in
 * by. Logs are kept a month, which is enough to count a month, and not enough
 * to see a trend longer than that: so the three counts are written as metrics,
 * which CloudWatch keeps for fifteen months.
 *
 * What is written is three numbers with no dimension. No metric is ever kept
 * per person or per subscription: a question about one of them is a query of
 * the logs, never a series of its own.
 */

import {
  CloudWatchLogsClient,
  GetQueryResultsCommand,
  StartQueryCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { observe } from '@memorysmithapp/observability';

/** The namespace of the metrics of the product, the one `ServiceLambda` declares. */
export const NAMESPACE = 'MemorySmith';

/** The three windows counted, each written as the metric of its name. */
export const WINDOWS = [
  { metric: 'ActivePeopleDaily', days: 1 },
  { metric: 'ActivePeopleWeekly', days: 7 },
  { metric: 'ActivePeopleMonthly', days: 30 },
] as const;

/** Distinct people with at least one operation line in the window. */
export const ACTIVE_PEOPLE_QUERY =
  'filter message = "operation" and ispresent(userId) | stats count_distinct(userId) as people';

const DAY_SECONDS = 24 * 60 * 60;

export interface Counter {
  /** The distinct people of the log groups between two instants, in seconds. */
  count(logGroups: readonly string[], from: number, to: number): Promise<number>;
}

/** Counts through Logs Insights: one query per window, read when it completes. */
export class InsightsCounter implements Counter {
  constructor(
    private readonly logs: CloudWatchLogsClient,
    private readonly wait: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  async count(logGroups: readonly string[], from: number, to: number): Promise<number> {
    const started = await this.logs.send(
      new StartQueryCommand({
        logGroupNames: [...logGroups],
        startTime: from,
        endTime: to,
        queryString: ACTIVE_PEOPLE_QUERY,
      }),
    );
    const queryId = started.queryId;
    if (!queryId) throw new Error('Logs Insights started no query.');
    for (;;) {
      const results = await this.logs.send(new GetQueryResultsCommand({ queryId }));
      if (results.status === 'Complete') {
        const field = results.results?.[0]?.find((cell) => cell.field === 'people');
        return Number(field?.value ?? 0);
      }
      if (results.status !== 'Running' && results.status !== 'Scheduled') {
        throw new Error(
          `The query of active people ended ${results.status ?? 'without a status'}.`,
        );
      }
      await this.wait(1000);
    }
  }
}

/** Counts the three windows ending at `now` and writes them, stamped at `now`. */
export async function writeActivePeople(input: {
  readonly counter: Counter;
  readonly metrics: Pick<CloudWatchClient, 'send'>;
  readonly logGroups: readonly string[];
  readonly now: Date;
}): Promise<Record<string, number>> {
  const to = Math.floor(input.now.getTime() / 1000);
  const counted: Record<string, number> = {};
  for (const window of WINDOWS) {
    counted[window.metric] = await input.counter.count(
      input.logGroups,
      to - window.days * DAY_SECONDS,
      to,
    );
  }
  await input.metrics.send(
    new PutMetricDataCommand({
      Namespace: NAMESPACE,
      MetricData: WINDOWS.map((window) => ({
        MetricName: window.metric,
        Value: counted[window.metric] ?? 0,
        Unit: 'Count',
        Timestamp: input.now,
      })),
    }),
  );
  return counted;
}

function logGroupsOf(raw: string | undefined): string[] {
  const groups = (raw ?? '').split(',').filter(Boolean);
  if (groups.length === 0) throw new Error('Missing required environment variable: LOG_GROUPS');
  return groups;
}

export function handler(): Promise<void> {
  return observe({ operation: 'active-people' }, async () => {
    await writeActivePeople({
      counter: new InsightsCounter(new CloudWatchLogsClient({})),
      metrics: new CloudWatchClient({}),
      logGroups: logGroupsOf(process.env['LOG_GROUPS']),
      now: new Date(),
    });
  });
}
