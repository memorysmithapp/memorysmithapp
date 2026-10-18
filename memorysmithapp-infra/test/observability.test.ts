/**
 * Where somebody looks at the product (#270): three dashboards in production
 * and none in staging, and the daily count of active people in both, so
 * staging proves it before production relies on it.
 */

import { Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { appFor, stacksOf } from './stacks.js';

const template = (environment: 'production' | 'staging') =>
  Template.fromStack(
    stacksOf(appFor(environment, { alarmEmail: 'operator@example.com' })).observability,
  );

describe('the dashboards', () => {
  it('are three in production: usage, business flows and golden signals', () => {
    const dashboards = template('production').findResources('AWS::CloudWatch::Dashboard');
    const names = Object.values(dashboards).map(
      (resource) =>
        (resource as { Properties: { DashboardName: string } }).Properties.DashboardName,
    );
    expect(names.sort()).toEqual([
      'memorysmith-flows-production',
      'memorysmith-health-production',
      'memorysmith-usage-production',
    ]);
  });

  it('do not exist in staging', () => {
    template('staging').resourceCountIs('AWS::CloudWatch::Dashboard', 0);
  });

  it('count people from the log, never from a metric per person or subscription', () => {
    const bodies = JSON.stringify(
      template('production').findResources('AWS::CloudWatch::Dashboard'),
    );
    expect(bodies).toContain('count_distinct(userId)');
    expect(bodies).not.toMatch(/"(userId|subscriptionId)"\s*,\s*"/);
  });
});

describe('the daily count of active people', () => {
  it.each(['production', 'staging'] as const)('runs once a day in %s', (environment) => {
    const stack = template(environment);
    stack.hasResourceProperties('AWS::Events::Rule', { ScheduleExpression: 'cron(15 0 * * ? *)' });
    stack.hasResourceProperties('AWS::Lambda::Function', {
      Description: 'Counts the active people of a day, a week and a month, once a day.',
    });
  });

  it('writes only to the namespace of the product', () => {
    const policies = JSON.stringify(template('production').findResources('AWS::IAM::Policy'));
    expect(policies).toContain('cloudwatch:PutMetricData');
    expect(policies).toContain('"cloudwatch:namespace":"MemorySmith"');
  });
});
