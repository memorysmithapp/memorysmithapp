/**
 * Storage, events and the four tables (architecture-guide.md, sections 9, 17).
 *
 * One table per service, and no service reads the table of another. They are
 * declared together because they are one lifecycle: they are what has to exist
 * before any function can start.
 */

import { RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { EventBus } from 'aws-cdk-lib/aws-events';
import { BlockPublicAccess, Bucket, BucketEncryption, HttpMethods } from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';
import { AppendOnlyTable, SubscriptionTable } from '../constructs/subscription-table.js';

export interface DataStackProps extends StackProps {
  /** Destroying data on `cdk destroy` is only ever acceptable in a sandbox. */
  readonly retainData?: boolean;
}

export class DataStack extends Stack {
  readonly contentBucket: Bucket;
  readonly eventBus: EventBus;
  readonly accessTable: SubscriptionTable;
  readonly knowledgeTable: SubscriptionTable;
  readonly discoveryTable: SubscriptionTable;
  readonly auditTable: AppendOnlyTable;

  constructor(scope: Construct, id: string, props: DataStackProps = {}) {
    super(scope, id, props);

    const removalPolicy = props.retainData === false ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN;

    /**
     * The content bucket. VERSIONING IS NOT OPTIONAL: each write to a Content
     * Slot produces an immutable versionId, and that is what read_note(asOf)
     * and the historical reconstruction of section 12.3 rest on.
     */
    this.contentBucket = new Bucket(this, 'ContentBucket', {
      versioned: true,
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy,
      ...(props.retainData === false ? { autoDeleteObjects: true } : {}),
      cors: [
        {
          allowedMethods: [HttpMethods.GET],
          allowedOrigins: ['https://memorysmith.app'],
          allowedHeaders: ['*'],
        },
      ],
    });

    this.eventBus = new EventBus(this, 'EventBus', { eventBusName: 'mv-events' });

    this.accessTable = new SubscriptionTable(this, 'AccessTable', {
      tableName: 'mv-access',
      stream: true,
      removalPolicy,
      indexes: [
        /**
         * Only GSI2 here. GSI1 used to answer "which workspaces do I have",
         * and with that level gone (software-vision.md 4.3) the question is
         * answered by the link partition itself, so the index would be an
         * empty one nobody writes to.
         */
        // The platform queue, metadata only (exception 2 of section 8.3).
        { name: 'GSI2', partitionKey: 'GSI2PK', sortKey: 'GSI2SK' },
      ],
    });

    this.knowledgeTable = new SubscriptionTable(this, 'KnowledgeTable', {
      tableName: 'mv-knowledge',
      // The stream is the outbox: state change and publication are atomic.
      stream: true,
      removalPolicy,
      indexes: [
        // Vaults of a workspace, already carrying the note count.
        // The vaults of the subscription, already carrying the note count.
        { name: 'GSI1', partitionKey: 'GSI1PK', sortKey: 'GSI1SK' },
        // Notes of a folder, in the defined order. SPARSE: a deleted note
        // loses these attributes and leaves every listing (section 12.4).
        { name: 'GSI2', partitionKey: 'GSI2PK', sortKey: 'GSI2SK' },
      ],
    });

    this.discoveryTable = new SubscriptionTable(this, 'DiscoveryTable', {
      tableName: 'mv-discovery',
      removalPolicy,
    });

    this.auditTable = new AppendOnlyTable(this, 'AuditTable', {
      tableName: 'mv-audit',
      // The trail always retains, whatever the environment: it is the one
      // thing that cannot be rebuilt from anything else.
      removalPolicy: RemovalPolicy.RETAIN,
      indexes: [{ name: 'GSI1', partitionKey: 'GSI1PK', sortKey: 'GSI1SK' }],
    });
  }
}
