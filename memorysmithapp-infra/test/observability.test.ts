/**
 * Where somebody looks at the product (#270): three dashboards wherever a
 * delivery turns them on and none by default (ADR-021), and the daily count of
 * active people in both environments, so staging proves it before production
 * relies on it.
 */

import { Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { appFor, stacksOf } from './stacks.js';

const template = (environment: 'production' | 'staging', dashboards = false) =>
  Template.fromStack(
    stacksOf(appFor(environment, { alarmEmail: 'operator@example.com', dashboards })).observability,
  );

describe('the dashboards', () => {
  it('are three when a delivery turns them on: usage, business flows and golden signals', () => {
    const dashboards = template('production', true).findResources('AWS::CloudWatch::Dashboard');
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

  it.each(['production', 'staging'] as const)('do not exist by default in %s', (environment) => {
    template(environment).resourceCountIs('AWS::CloudWatch::Dashboard', 0);
  });

  it('are drawn in staging too when a delivery turns them on', () => {
    template('staging', true).resourceCountIs('AWS::CloudWatch::Dashboard', 3);
  });

  it('count people from the log, never from a metric per person or subscription', () => {
    const bodies = JSON.stringify(
      template('production', true).findResources('AWS::CloudWatch::Dashboard'),
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

describe('the exports the dashboards read', () => {
  /**
   * A delivery without the dashboards once dropped exports that the
   * Observability stack, deployed last, still imported, and CloudFormation
   * refused it (#340). The exports are the same whether or not they are drawn.
   */
  const exportsOf = (dashboards: boolean) => {
    const { all } = stacksOf(
      appFor('production', { alarmEmail: 'operator@example.com', dashboards }),
    );
    return all
      .flatMap((stack) =>
        Object.values(
          (Template.fromStack(stack).toJSON().Outputs ?? {}) as Record<
            string,
            { Export?: { Name?: string } }
          >,
        ).map((output) => output.Export?.Name),
      )
      .filter((name): name is string => Boolean(name))
      .sort();
  };

  it('are the same whether or not the dashboards are drawn', () => {
    const drawn = exportsOf(true);
    expect(drawn.length).toBeGreaterThan(30);
    expect(exportsOf(false)).toEqual(drawn);
  });
});
