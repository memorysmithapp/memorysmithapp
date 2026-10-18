/**
 * The cost budgets of the account (#279).
 *
 * Two budgets made by hand overlapped, and the smaller one sat below what the
 * account costs standing still, so it alarmed every month. These cases read
 * the budgets a synthesis declares: where, at which limit, alerting whom.
 */

import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { environmentOf } from '../config/environments.js';
import { BUDGETS, CostBudgets } from '../constructs/budgets.js';
import { ENVIRONMENTS, appFor, stacksOf } from './stacks.js';

const ADDRESS = 'operator@example.com';

type BudgetResource = {
  Properties: {
    Budget: {
      BudgetName: string;
      BudgetLimit: { Amount: number; Unit: string };
      CostFilters?: Record<string, string[]>;
    };
    NotificationsWithSubscribers: Array<{
      Notification: { NotificationType: string; Threshold: number };
      Subscribers: Array<{ SubscriptionType: string; Address: string }>;
    }>;
  };
};

function budgetsOf(template: Template): BudgetResource[] {
  return Object.values(
    template.findResources('AWS::Budgets::Budget') as Record<string, BudgetResource>,
  );
}

describe('the budgets of production', () => {
  const { network, all } = stacksOf(appFor('production', { alarmEmail: ADDRESS }));
  const budgets = budgetsOf(Template.fromStack(network));
  const named = (name: string): BudgetResource => {
    const found = budgets.find((budget) => budget.Properties.Budget.BudgetName === name);
    if (!found) throw new Error(`no budget ${name}`);
    return found;
  };
  const alerts = (budget: BudgetResource): string[] =>
    budget.Properties.NotificationsWithSubscribers.map(
      ({ Notification }) => `${Notification.NotificationType} ${Notification.Threshold}`,
    );

  it('are two, both in the network stack and in no other', () => {
    expect(budgets).toHaveLength(2);
    for (const stack of all.filter((stack) => stack !== network)) {
      Template.fromStack(stack).resourceCountIs('AWS::Budgets::Budget', 0);
    }
  });

  it('hold the whole account at US$ 20, above the floor it costs standing still', () => {
    const account = named('memorysmith-account-monthly');
    expect(account.Properties.Budget.BudgetLimit).toEqual({ Amount: 20, Unit: 'USD' });
    expect(account.Properties.Budget.CostFilters).toBeUndefined();
    expect(alerts(account)).toEqual(['ACTUAL 80', 'ACTUAL 100', 'FORECASTED 100']);
  });

  it('hold staging apart, by the tag of its environment', () => {
    const staging = named('memorysmith-staging-monthly');
    expect(staging.Properties.Budget.CostFilters).toEqual({
      TagKeyValue: ['user:app:environment$staging'],
    });
    expect(alerts(staging)).toEqual(['ACTUAL 100', 'FORECASTED 100']);
  });

  it('alert the address of the delivery, and nobody else', () => {
    for (const budget of budgets) {
      for (const { Subscribers } of budget.Properties.NotificationsWithSubscribers) {
        expect(Subscribers).toEqual([{ SubscriptionType: 'EMAIL', Address: ADDRESS }]);
      }
    }
  });

  it('never take the names of the budgets made by hand, which a name in an account is unique to', () => {
    const names = BUDGETS.map((budget) => budget.name);
    expect(names).not.toContain('memorysmith-monthly');
    expect(names).not.toContain('memorysmith-monthly-cost');
  });

  it('cannot be declared without an address, nor by staging', () => {
    expect(() => environmentOf(appFor('production').node)).toThrow(/no address to notify/);
    const app = new App({ context: { environment: 'staging', environments: ENVIRONMENTS } });
    expect(
      () =>
        new CostBudgets(new Stack(app, 'Loose'), 'Budgets', {
          environment: environmentOf(app.node),
        }),
    ).toThrow(/production owns/);
  });
});

describe('the budgets of staging', () => {
  it('do not exist: the account declares them once, from production', () => {
    for (const stack of stacksOf(appFor('staging')).all) {
      Template.fromStack(stack).resourceCountIs('AWS::Budgets::Budget', 0);
    }
  });
});
