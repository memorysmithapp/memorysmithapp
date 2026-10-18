/**
 * Both HTTP APIs write access logs, in production and in staging, to a log
 * group kept a month (#269).
 *
 * Neither the core API nor the connector wrote one, so a request the gateway
 * refused before the function — a throttle, a bad signature on the binding
 * route — left no trace anywhere.
 */

import { Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { ACCESS_LOG_FORMAT } from '../constructs/access-log.js';
import { appFor, stacksOf } from './stacks.js';

type StageResource = {
  Properties: { AccessLogSettings?: { DestinationArn: unknown; Format: string } };
};

describe.each(['production', 'staging'] as const)('the access logs of %s', (environment) => {
  const { api, agent, all } = stacksOf(
    appFor(environment, environment === 'production' ? { alarmEmail: 'ops@example.com' } : {}),
  );

  it.each([
    ['the core API', api],
    ['the connector', agent],
  ] as const)('are written by %s, in JSON, to a group kept a month', (_name, stack) => {
    const template = Template.fromStack(stack);
    const stages = Object.values(
      template.findResources('AWS::ApiGatewayV2::Stage') as Record<string, StageResource>,
    );
    expect(stages).toHaveLength(1);
    const settings = stages[0]!.Properties.AccessLogSettings;
    expect(settings).toBeDefined();
    expect(JSON.parse(settings!.Format)).toEqual(ACCESS_LOG_FORMAT);
    // The destination is a group of this stack, declared with its retention.
    expect(JSON.stringify(settings!.DestinationArn)).toMatch(/AccessLogs/);
    template.hasResourceProperties('AWS::Logs::LogGroup', { RetentionInDays: 30 });
  });

  it('carry the request id, the route, the status and both latencies, and no path or address', () => {
    expect(Object.values(ACCESS_LOG_FORMAT)).toEqual(
      expect.arrayContaining([
        '$context.requestId',
        '$context.routeKey',
        '$context.status',
        '$context.responseLatency',
        '$context.integrationLatency',
      ]),
    );
    const variables = Object.values(ACCESS_LOG_FORMAT).join(' ');
    expect(variables).not.toMatch(/\$context\.(path|identity|domainName)|\$request\./);
  });

  it('and every log group of the product is kept one month, no more and no less', () => {
    for (const stack of all) {
      const groups = Template.fromStack(stack).findResources('AWS::Logs::LogGroup');
      for (const [id, group] of Object.entries(groups) as Array<
        [string, { Properties?: Record<string, unknown> }]
      >) {
        expect([id, group.Properties?.['RetentionInDays']]).toEqual([id, 30]);
      }
    }
  });
});
