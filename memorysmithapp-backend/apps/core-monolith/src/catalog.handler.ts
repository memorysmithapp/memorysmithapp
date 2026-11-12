/**
 * The public route of the community catalog (#356, #360): a handler of its
 * own, because what it may reach is what makes it safe to answer anybody. Its
 * role reads the catalog entries of the portability table, the status of a
 * subscription, and what a model notebook is read with — the items and the
 * content of a notebook and the trail of its changes (#431) — and writes
 * nothing; every read starts from an entry, the one way a public request
 * reaches a subscription (INV-02), and reads the notebook the entry names.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { Hono } from 'hono';
import { handle } from 'hono/aws-lambda';
import { DEPLOYMENT_HEADERS, deploymentFromVariables } from '@memorysmithapp/contracts';
import { operationErrorHandler, operationLog } from '@memorysmithapp/observability/hono';
import { DynamoCatalogStore } from '@memorysmithapp/svc-portability/adapters/catalog';
import { createPublicCatalogRoutes } from '@memorysmithapp/svc-portability/adapters/catalog-http';
import { DynamoSubscriptionAccess, publicCatalogUseCasesOf } from './catalog.js';
import { buildModelReadingOf, type Infrastructure } from './composition-root.js';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
/** What reads a model notebook where it is, and nothing that writes (#431). */
const infra: Infrastructure = {
  db,
  s3: new S3Client({}),
  knowledgeTable: required('KNOWLEDGE_TABLE'),
  accessTable: required('ACCESS_TABLE'),
  auditTable: required('AUDIT_TABLE'),
  discoveryTable: '',
  portabilityTable: required('PORTABILITY_TABLE'),
  contentBucket: required('CONTENT_BUCKET'),
};
const deployment = deploymentFromVariables(process.env);

const app = new Hono();
app.use('*', operationLog());
app.onError(operationErrorHandler);
app.use('*', async (c, next) => {
  await next();
  c.res.headers.set(DEPLOYMENT_HEADERS.environment, deployment.environment);
  c.res.headers.set(DEPLOYMENT_HEADERS.version, deployment.version);
});
app.route(
  '/public/catalog',
  createPublicCatalogRoutes(
    publicCatalogUseCasesOf(
      {
        catalog: new DynamoCatalogStore(db, infra.portabilityTable),
        access: new DynamoSubscriptionAccess(db, infra.accessTable),
      },
      buildModelReadingOf(infra),
    ),
  ),
);

export const handler = handle(app);
