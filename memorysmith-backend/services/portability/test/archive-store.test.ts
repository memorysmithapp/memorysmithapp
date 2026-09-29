/**
 * The link of a kept export (#255). It is signed for the bucket, as it always
 * was, and answered on the host of the product, which the distribution
 * forwards to the bucket with its own Host.
 */

import { S3Client } from '@aws-sdk/client-s3';
import { describe, expect, it } from 'vitest';
import { S3ArchiveStore } from '../src/adapters/s3.js';

const s3 = new S3Client({
  region: 'us-east-1',
  credentials: { accessKeyId: 'AKIAEXAMPLE', secretAccessKey: 'secret' },
});
const KEY = 's/SUB/exports/T/Caderno.notebook.zip';

describe('the link of an export', () => {
  it('is answered on the files host, with the path and the signature of the bucket', async () => {
    const store = new S3ArchiveStore(s3, 'content-bucket', 'https://files.stg.memorysmith.app');
    const url = new URL(await store.presign(KEY, 900));

    expect(url.host).toBe('files.stg.memorysmith.app');
    expect(url.pathname).toBe(`/${KEY}`);
    expect(url.searchParams.get('response-content-disposition')).toBe(
      'attachment; filename="Caderno.notebook.zip"',
    );
    // Signed for the host S3 will see, which is the bucket's own.
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('keeps the host of the bucket when no host of the product is given', async () => {
    const url = new URL(await new S3ArchiveStore(s3, 'content-bucket').presign(KEY, 900));

    expect(url.host).toBe('content-bucket.s3.us-east-1.amazonaws.com');
  });
});
