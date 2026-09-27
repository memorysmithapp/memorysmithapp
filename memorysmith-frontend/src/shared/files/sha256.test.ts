import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { HASH_SLICE_BYTES, Sha256, hashFile } from './sha256';

const node = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

function bytesOf(size: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(size);
  for (let index = 0; index < size; index += 1) bytes[index] = (index * 131 + 7) % 256;
  return bytes;
}

describe('SHA-256 fed in pieces (#253, RN-KNW-055)', () => {
  it('answers what the platform answers, around every edge of a block', () => {
    for (const size of [0, 1, 55, 56, 63, 64, 65, 119, 120, 128, 1000]) {
      const bytes = bytesOf(size);
      expect(new Sha256().update(bytes).hex(), `${size} bytes`).toBe(node(bytes));
    }
  });

  it('answers the same whatever the pieces are', () => {
    const bytes = bytesOf(5000);
    const hash = new Sha256();
    for (const [start, end] of [
      [0, 1],
      [1, 70],
      [70, 64 * 10],
      [640, 641],
      [641, 5000],
    ] as const) {
      hash.update(bytes.subarray(start, end));
    }
    expect(hash.hex()).toBe(node(bytes));
  });

  it('hashes a file a slice at a time, larger than one slice', async () => {
    const bytes = bytesOf(HASH_SLICE_BYTES + 12_345);
    const read: number[] = [];
    const hex = await hashFile(new Blob([bytes]), (done) => read.push(done));
    expect(hex).toBe(node(bytes));
    expect(read).toEqual([HASH_SLICE_BYTES, HASH_SLICE_BYTES + 12_345]);
  });
});
