/**
 * The public route of the community catalog (#356, #360): a handler of its
 * own, because what it may reach is what makes it safe to answer anybody. Its
 * role reads the catalog entries of the portability table, the status of a
 * subscription and the snapshots of versions, and nothing else; every read
 * starts from an entry, the one way a public request reaches a subscription
 * (INV-02). It writes nothing.
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
import { S3UploadStore } from '@memorysmithapp/svc-portability/adapters/s3';
import { readZip } from '@memorysmithapp/svc-portability/adapters/zip';
import { DynamoSubscriptionAccess, publicCatalogUseCasesOf } from './catalog.js';
import { readVersionDocument } from './composition-root.js';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const uploads = new S3UploadStore(new S3Client({}), required('CONTENT_BUCKET'));
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
        catalog: new DynamoCatalogStore(db, required('PORTABILITY_TABLE')),
        access: new DynamoSubscriptionAccess(db, required('ACCESS_TABLE')),
      },
      { read: (key) => readVersionDocument((at) => uploads.read(at), readZip, key) },
    ),
  ),
);

export const handler = handle(app);
