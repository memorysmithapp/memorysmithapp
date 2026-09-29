/**
 * The link of a kept file (#255). It is signed for the bucket, as it always
 * was, and answered on the host of the product, which the distribution
 * forwards to the bucket with its own Host.
 */

import { S3Client } from '@aws-sdk/client-s3';
import { SubscriptionContext, SubscriptionId } from '@memorysmith/kernel';
import { describe, expect, it } from 'vitest';
import { S3FileStore } from '../src/adapters/outbound/s3/S3FileStore.js';
import { contentRef, unwrap } from './fixtures.js';

const SUBSCRIPTION = SubscriptionId.generate().value;
const SUBSCRIPTION_CONTEXT = unwrap(
  SubscriptionContext.fromClaims({
    sub: 'user-owner',
    subscription_id: SUBSCRIPTION,
    subscription_status: 'active',
  }),
);

const s3 = new S3Client({
  region: 'us-east-1',
  credentials: { accessKeyId: 'AKIAEXAMPLE', secretAccessKey: 'secret' },
});

describe('the link of a file', () => {
  it('is answered on the files host, with the path and the signature of the bucket', async () => {
    const store = new S3FileStore(
      SUBSCRIPTION_CONTEXT,
      s3,
      'content-bucket',
      'https://files.stg.memorysmith.app',
    );
    const kept = contentRef();
    const { url } = await store.signedUrl(kept, 'Contrato.pdf', 'application/pdf', 'attachment');
    const link = new URL(url);

    expect(link.host).toBe('files.stg.memorysmith.app');
    expect(link.pathname).toBe(`/s/${SUBSCRIPTION}/f/${kept.contentId.value}`);
    expect(link.searchParams.get('versionId')).toBe(kept.versionId);
    expect(link.searchParams.get('response-content-type')).toBe('application/pdf');
    expect(link.searchParams.get('response-content-disposition')).toBe(
      'attachment; filename="Contrato.pdf"',
    );
    expect(link.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
    expect(link.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('keeps the host of the bucket when no host of the product is given', async () => {
    const store = new S3FileStore(SUBSCRIPTION_CONTEXT, s3, 'content-bucket');
    const { url } = await store.signedUrl(contentRef(), 'foto.png', 'image/png', 'inline');

    expect(new URL(url).host).toBe('content-bucket.s3.us-east-1.amazonaws.com');
  });
});
