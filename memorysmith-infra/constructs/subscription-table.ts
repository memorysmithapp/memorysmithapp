/**
 * The two table constructs (architecture-guide.md, section 5.4).
 *
 * SubscriptionTable is the ordinary shape: single table, on-demand, PITR on,
 * TTL attribute, and the two indexes the designs use.
 *
 * AppendOnlyTable is where PE4 stops being policy and becomes permission. The
 * explicit Deny on UpdateItem and DeleteItem lives HERE, and it is the
 * difference between "we do not alter the log" and "we cannot alter the log".
 * Only the second one answers a regulator.
 */

import { RemovalPolicy } from 'aws-cdk-lib';
import {
  AttributeType,
  BillingMode,
  ProjectionType,
  StreamViewType,
  Table,
  TableEncryption,
  type ITable,
} from 'aws-cdk-lib/aws-dynamodb';
import { Effect, PolicyStatement, type IGrantable } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface SubscriptionTableProps {
  readonly tableName: string;
  /** The outbox needs a stream; a projection table does not. */
  readonly stream?: boolean;
  readonly indexes?: Array<{ name: string; partitionKey: string; sortKey?: string }>;
  readonly removalPolicy?: RemovalPolicy;
}

export class SubscriptionTable extends Construct {
  readonly table: Table;

  constructor(scope: Construct, id: string, props: SubscriptionTableProps) {
    super(scope, id);

    this.table = new Table(this, 'Table', {
      tableName: props.tableName,
      partitionKey: { name: 'PK', type: AttributeType.STRING },
      sortKey: { name: 'SK', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      encryption: TableEncryption.AWS_MANAGED,
      // The bucket is opaque, so losing this table beyond the PITR window
      // would leave a pile of .md nobody can interpret (section 26).
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      timeToLiveAttribute: 'ttl',
      ...(props.stream ? { stream: StreamViewType.NEW_IMAGE } : {}),
      removalPolicy: props.removalPolicy ?? RemovalPolicy.RETAIN,
    });

    for (const index of props.indexes ?? []) {
      this.table.addGlobalSecondaryIndex({
        indexName: index.name,
        partitionKey: { name: index.partitionKey, type: AttributeType.STRING },
        ...(index.sortKey ? { sortKey: { name: index.sortKey, type: AttributeType.STRING } } : {}),
        projectionType: ProjectionType.ALL,
      });
    }
  }
}

export class AppendOnlyTable extends Construct {
  readonly table: Table;

  constructor(scope: Construct, id: string, props: SubscriptionTableProps) {
    super(scope, id);
    this.table = new SubscriptionTable(this, 'Inner', props).table;
  }

  /**
   * Grants exactly what an append-only writer needs, and DENIES the rest.
   * The Deny is explicit rather than implicit because an explicit Deny cannot
   * be overridden by any other policy attached to the same principal: not by a
   * future grant, not by an operator, not by a bug.
   */
  grantAppendOnly(grantee: IGrantable): void {
    grantee.grantPrincipal.addToPrincipalPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['dynamodb:PutItem', 'dynamodb:BatchWriteItem', 'dynamodb:DescribeTable'],
        resources: [this.table.tableArn, `${this.table.tableArn}/index/*`],
      }),
    );
    grantee.grantPrincipal.addToPrincipalPolicy(
      new PolicyStatement({
        effect: Effect.DENY,
        actions: ['dynamodb:UpdateItem', 'dynamodb:DeleteItem', 'dynamodb:BatchGetItem'],
        resources: [this.table.tableArn, `${this.table.tableArn}/index/*`],
      }),
    );
  }

  /** Reading the trail is a different permission from writing it. */
  grantRead(grantee: IGrantable): void {
    grantee.grantPrincipal.addToPrincipalPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['dynamodb:Query', 'dynamodb:GetItem'],
        resources: [this.table.tableArn, `${this.table.tableArn}/index/*`],
      }),
    );
    grantee.grantPrincipal.addToPrincipalPolicy(
      new PolicyStatement({
        effect: Effect.DENY,
        actions: ['dynamodb:UpdateItem', 'dynamodb:DeleteItem', 'dynamodb:PutItem'],
        resources: [this.table.tableArn, `${this.table.tableArn}/index/*`],
      }),
    );
  }

  get tableRef(): ITable {
    return this.table;
  }
}
