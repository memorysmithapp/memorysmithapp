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
        actions: [
          'dynamodb:PutItem',
          'dynamodb:BatchWriteItem',
          'dynamodb:DescribeTable',
          // Reading ONE key: whether the trail of a notebook was closed by a
          // purge, which decides whether an entry is appended at all
          // (RN-AUD-011). Asking is not writing, and the Deny below is intact.
          'dynamodb:GetItem',
        ],
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

  /**
   * Reading the trail and appending to it, which is what a transfer needs: an
   * export may carry the history of a notebook (RN-PRT-022) and an import
   * brings one back (RN-PRT-023). It is `grantRead` and `grantAppendOnly`
   * together, which cannot simply be called side by side — the `Deny` each one
   * carries would cancel the `Allow` of the other, and a Deny always wins.
   *
   * What it denies is what the trail is: nothing here alters an entry, and
   * nothing here removes one.
   */
  grantReadAndAppend(grantee: IGrantable): void {
    grantee.grantPrincipal.addToPrincipalPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'dynamodb:Query',
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:BatchWriteItem',
          'dynamodb:DescribeTable',
        ],
        resources: [this.table.tableArn, `${this.table.tableArn}/index/*`],
      }),
    );
    grantee.grantPrincipal.addToPrincipalPolicy(
      new PolicyStatement({
        effect: Effect.DENY,
        actions: ['dynamodb:UpdateItem', 'dynamodb:DeleteItem'],
        resources: [this.table.tableArn, `${this.table.tableArn}/index/*`],
      }),
    );
  }

  /**
   * The ONE grant in the system that lets a principal remove an entry, and it
   * is given to exactly one: the purge worker (rule 6, RN-AUD-011). It is
   * written by hand, action by action, rather than taken from a grant helper,
   * because every helper that hands out a delete hands out more than this.
   *
   * It queries the notebook index to find what to remove, removes it in
   * batches, and writes the one item that marks the trail closed. It can
   * neither change an entry nor read one: nothing here alters what was
   * written, and what it removes it removes whole.
   */
  grantTrailPurge(grantee: IGrantable): void {
    grantee.grantPrincipal.addToPrincipalPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'dynamodb:Query',
          'dynamodb:DeleteItem',
          'dynamodb:BatchWriteItem',
          'dynamodb:PutItem',
          'dynamodb:DescribeTable',
        ],
        resources: [this.table.tableArn, `${this.table.tableArn}/index/*`],
      }),
    );
    grantee.grantPrincipal.addToPrincipalPolicy(
      new PolicyStatement({
        effect: Effect.DENY,
        actions: ['dynamodb:UpdateItem'],
        resources: [this.table.tableArn, `${this.table.tableArn}/index/*`],
      }),
    );
  }

  get tableRef(): ITable {
    return this.table;
  }
}
