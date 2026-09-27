/**
 * The address of a part (#240, #241). Two things are asserted about what the
 * store signs, because each one was found broken on the real store: the SDK's
 * default checksum must not be in it — a plain PUT of the real bytes would be
 * refused — and it is answered on the host of the product while signing the
 * bucket's own, which is what the distribution forwards to.
 */

import { S3Client } from '@aws-sdk/client-s3';
import { describe, expect, it } from 'vitest';
import { S3PartStore } from '../src/adapters/s3.js';

const credentials = { accessKeyId: 'AKIAEXAMPLE', secretAccessKey: 'secret' };
const s3 = new S3Client({ region: 'us-east-1', credentials });
const signer = new S3Client({
  region: 'us-east-1',
  credentials,
  requestChecksumCalculation: 'WHEN_REQUIRED',
});

describe('the address of a part', () => {
  it('is answered on the uploads host, with the path and the signature of the bucket', async () => {
    const store = new S3PartStore(
      s3,
      signer,
      'content-bucket',
      'https://uploads.stg.memorysmith.app',
    );
    const url = new URL(await store.signPart('s/SUB/uploads/T/whole', 'mp-1', 2, 3600));

    expect(url.host).toBe('uploads.stg.memorysmith.app');
    expect(url.pathname).toBe('/s/SUB/uploads/T/whole');
    expect(url.searchParams.get('partNumber')).toBe('2');
    expect(url.searchParams.get('uploadId')).toBe('mp-1');
    // Signed for the host S3 will see, which is the bucket's own.
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('carries no checksum a PUT of the real bytes could not satisfy', async () => {
    const store = new S3PartStore(s3, signer, 'content-bucket');
    const url = new URL(await store.signPart('s/SUB/uploads/T/whole', 'mp-1', 1, 3600));

    expect(url.host).toBe('content-bucket.s3.us-east-1.amazonaws.com');
    expect([...url.searchParams.keys()].some((key) => key.includes('checksum'))).toBe(false);
  });
});
