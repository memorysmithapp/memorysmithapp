/**
 * The daily count of active people (#270): three windows ending at the same
 * instant, written as three metrics with no dimension, and Logs Insights read
 * only once its query completes.
 */

import { describe, expect, it } from 'vitest';
import { PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import type { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import {
  ACTIVE_PEOPLE_QUERY,
  InsightsCounter,
  NAMESPACE,
  writeActivePeople,
  type Counter,
} from '../src/active-people.handler.js';

describe('writing the active people', () => {
  it('counts a day, a week and a month back from now, and writes them with no dimension', async () => {
    const asked: Array<[number, number]> = [];
    const counter: Counter = {
      count: async (_groups, from, to) => {
        asked.push([from, to]);
        return { 1: 3, 7: 5, 30: 8 }[(to - from) / 86400] ?? -1;
      },
    };
    const sent: unknown[] = [];
    const now = new Date('2026-10-18T00:15:00Z');
    const counted = await writeActivePeople({
      counter,
      metrics: { send: async (command: unknown) => void sent.push(command) } as never,
      logGroups: ['core', 'agent'],
      now,
    });

    expect(counted).toEqual({
      ActivePeopleDaily: 3,
      ActivePeopleWeekly: 5,
      ActivePeopleMonthly: 8,
    });
    expect(new Set(asked.map(([, to]) => to))).toEqual(new Set([now.getTime() / 1000]));
    const put = sent[0] as PutMetricDataCommand;
    expect(put).toBeInstanceOf(PutMetricDataCommand);
    expect(put.input.Namespace).toBe(NAMESPACE);
    for (const datum of put.input.MetricData ?? []) {
      expect(datum.Dimensions).toBeUndefined();
      expect(datum.Timestamp).toEqual(now);
    }
  });
});

describe('the count through Logs Insights', () => {
  it('waits for the query to complete and reads the distinct people', async () => {
    const statuses = ['Scheduled', 'Running', 'Complete'];
    const commands: Array<{ input: Record<string, unknown> }> = [];
    const logs = {
      send: async (command: { input: Record<string, unknown> }) => {
        commands.push(command);
        if ('queryString' in command.input) return { queryId: 'q-1' };
        const status = statuses.shift();
        return status === 'Complete'
          ? { status, results: [[{ field: 'people', value: '4' }]] }
          : { status };
      },
    } as unknown as CloudWatchLogsClient;

    const people = await new InsightsCounter(logs, async () => undefined).count(['core'], 0, 86400);

    expect(people).toBe(4);
    expect(commands[0]?.input['queryString']).toBe(ACTIVE_PEOPLE_QUERY);
    expect(commands).toHaveLength(4);
  });

  it('fails when the query fails, rather than writing a zero', async () => {
    const logs = {
      send: async (command: { input: Record<string, unknown> }) =>
        'queryString' in command.input ? { queryId: 'q-1' } : { status: 'Failed' },
    } as unknown as CloudWatchLogsClient;
    await expect(
      new InsightsCounter(logs, async () => undefined).count(['core'], 0, 1),
    ).rejects.toThrow(/Failed/);
  });
});
