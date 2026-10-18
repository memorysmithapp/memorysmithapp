/**
 * The cost budgets of the account (#279).
 *
 * A budget belongs to the account, not to an environment, and production owns
 * the account, so only production declares them, beside the topic of its
 * alarms, and a delivery of production creates them. Two of them:
 *
 * - the whole account, above the floor it costs standing still, so an alert
 *   says something happened rather than that a month went by;
 * - staging alone, read through the tag `app:environment` (#280), so a runaway
 *   staging is told apart from the use of production.
 *
 * Both notify the address the alarms notify, which arrives as context from the
 * variable `ALARM_EMAIL` of the delivery and is never in the repository.
 */

import { CfnBudget } from 'aws-cdk-lib/aws-budgets';
import { Construct } from 'constructs';
import type { EnvironmentConfig } from '../config/environments.js';

/** One alert of a budget: the kind of spend and the percentage of the limit. */
export interface BudgetAlert {
  readonly kind: 'ACTUAL' | 'FORECASTED';
  readonly percent: number;
}

/** A budget as this account declares it. */
export interface BudgetSpec {
  readonly name: string;
  /** US dollars a month. */
  readonly limit: number;
  /** Only the cost of the resources carrying this `app:environment`, or the whole account. */
  readonly environment?: string;
  readonly alerts: readonly BudgetAlert[];
}

/**
 * The fixed base of the account after 0.11.0 is about US$ 6–7 a month, so the
 * whole account is held at 12 and staging, which costs cents on a normal day,
 * at 3. The names differ from the two budgets made by hand before these, which
 * are deleted once these exist, because a budget name is unique in an account.
 */
export const BUDGETS: readonly BudgetSpec[] = [
  {
    name: 'memorysmith-account-monthly',
    limit: 12,
    alerts: [
      { kind: 'ACTUAL', percent: 80 },
      { kind: 'ACTUAL', percent: 100 },
      { kind: 'FORECASTED', percent: 100 },
    ],
  },
  {
    name: 'memorysmith-staging-monthly',
    limit: 3,
    environment: 'staging',
    alerts: [
      { kind: 'ACTUAL', percent: 100 },
      { kind: 'FORECASTED', percent: 100 },
    ],
  },
];

export class CostBudgets extends Construct {
  constructor(scope: Construct, id: string, props: { readonly environment: EnvironmentConfig }) {
    super(scope, id);
    const address = props.environment.alarmEmail;
    if (props.environment.name !== 'production' || !address) {
      throw new Error(
        `The budgets belong to the account, which production owns, and need its address: ${props.environment.name} declares none.`,
      );
    }
    for (const spec of BUDGETS) {
      new CfnBudget(this, spec.name, {
        budget: {
          budgetName: spec.name,
          budgetType: 'COST',
          timeUnit: 'MONTHLY',
          budgetLimit: { amount: spec.limit, unit: 'USD' },
          ...(spec.environment
            ? { costFilters: { TagKeyValue: [`user:app:environment$${spec.environment}`] } }
            : {}),
        },
        notificationsWithSubscribers: spec.alerts.map((alert) => ({
          notification: {
            notificationType: alert.kind,
            comparisonOperator: 'GREATER_THAN',
            threshold: alert.percent,
            thresholdType: 'PERCENTAGE',
          },
          subscribers: [{ subscriptionType: 'EMAIL', address }],
        })),
      });
    }
  }
}
