/**
 * Storage, events and the five tables (architecture-guide.md, sections 9, 17).
 *
 * One table per service, and no service reads the table of another. They are
 * declared together because they are one lifecycle: they are what has to exist
 * before any function can start.
 */

import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { EventBus } from 'aws-cdk-lib/aws-events';
import { BlockPublicAccess, Bucket, BucketEncryption, HttpMethods } from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';
import { AppendOnlyTable, SubscriptionTable } from '../constructs/subscription-table.js';
import { physicalName, type EnvironmentConfig } from '../config/environments.js';

export interface DataStackProps extends StackProps {
  readonly environment: EnvironmentConfig;
  /** The only origin that reads the content bucket from a browser. */
  readonly siteOrigin: string;
  /** Destroying data on `cdk destroy` is only ever acceptable in a sandbox. */
  readonly retainData?: boolean;
}

export class DataStack extends Stack {
  readonly contentBucket: Bucket;
  readonly eventBus: EventBus;
  readonly accessTable: SubscriptionTable;
  readonly knowledgeTable: SubscriptionTable;
  readonly discoveryTable: SubscriptionTable;
  readonly portabilityTable: SubscriptionTable;
  readonly auditTable: AppendOnlyTable;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const removalPolicy = props.retainData === false ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN;
    const named = (base: string): string => physicalName(props.environment, base);

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
      /**
       * What the SITE may do on this bucket from a browser, and nothing else
       * reaches it: every object here is opened by a pre-signed URL, for one
       * key, for minutes. CORS widens the VERB the browser may use, never the
       * reach of the signature.
       *
       * GET is the download of an export. PUT is the upload of a `.notebook`
       * before it is imported: without it the browser asks S3 whether it may
       * upload, is told no, and the import dies in the preflight, before a
       * byte leaves and before the API ever hears of it.
       */
      cors: [
        {
          allowedMethods: [HttpMethods.GET, HttpMethods.PUT],
          allowedOrigins: [props.siteOrigin],
          allowedHeaders: ['*'],
        },
      ],
      /**
       * The upload of an IMPORT is a derived artefact and a short-lived one:
       * the notebook it describes is either written or it is not, and either
       * way the file has done its job (RN-PRT-014). It expires by TAG rather
       * than by prefix, because the prefix carries the subscription and there
       * is one per customer, while the tag is written by the adapter.
       *
       * An EXPORT used to wear the same tag, and the rule threw it away a day
       * later. That was wrong: the notebook an export was made of can be
       * deleted, and the export is then the one way back (RN-PRT-020). An
       * export is kept until whoever generated it deletes it, and it counts
       * towards the storage of the subscription while it is kept (RN-SUB-021).
       *
       * The rule touches nothing else in the bucket: a Content Slot carries no
       * such tag, and its versions are the historical reconstruction itself.
       */
      lifecycleRules: [
        {
          id: 'ExpireImportUploads',
          enabled: true,
          tagFilters: { lifecycle: 'export' },
          expiration: Duration.days(1),
          noncurrentVersionExpiration: Duration.days(1),
        },
      ],
    });

    // What the adapter tests of the staging pipeline write to.
    new CfnOutput(this, 'ContentBucketName', { value: this.contentBucket.bucketName });

    this.eventBus = new EventBus(this, 'EventBus', { eventBusName: named('mv-events') });

    this.accessTable = new SubscriptionTable(this, 'AccessTable', {
      tableName: named('mv-access'),
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
      tableName: named('mv-knowledge'),
      // The stream is the outbox: state change and publication are atomic.
      stream: true,
      removalPolicy,
      indexes: [
        // Notebooks of a workspace, already carrying the note count.
        // The notebooks of the subscription, already carrying the note count.
        { name: 'GSI1', partitionKey: 'GSI1PK', sortKey: 'GSI1SK' },
        // Notes of a folder, in the defined order. SPARSE: a deleted note
        // loses these attributes and leaves every listing (section 12.4).
        { name: 'GSI2', partitionKey: 'GSI2PK', sortKey: 'GSI2SK' },
      ],
    });

    this.discoveryTable = new SubscriptionTable(this, 'DiscoveryTable', {
      tableName: named('mv-discovery'),
      removalPolicy,
    });

    /**
     * The transfers: a notebook on its way out, a document on its way in, and
     * the exports a person keeps (RN-PRT-019, RN-PRT-020). It is the first
     * table this context owns, because an export used to leave nothing behind
     * but an object nothing listed, and a job that reports its progress has to
     * be somewhere both the worker and the interface can reach.
     */
    this.portabilityTable = new SubscriptionTable(this, 'PortabilityTable', {
      tableName: named('mv-portability'),
      removalPolicy,
    });

    this.auditTable = new AppendOnlyTable(this, 'AuditTable', {
      tableName: named('mv-audit'),
      // The trail always retains, whatever the environment: it is the one
      // thing that cannot be rebuilt from anything else.
      removalPolicy: RemovalPolicy.RETAIN,
      indexes: [{ name: 'GSI1', partitionKey: 'GSI1PK', sortKey: 'GSI1SK' }],
    });
  }
}
