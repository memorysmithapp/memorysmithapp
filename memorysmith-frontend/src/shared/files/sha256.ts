/**
 * SHA-256, fed in pieces (#253, RN-KNW-055).
 *
 * `crypto.subtle.digest` takes the whole input at once, so hashing a file with
 * it means holding the whole file in memory: a recording of a few hundred
 * megabytes is a tab that runs out of it before the first part is sent. The
 * browser has no streaming digest, so this is one — FIPS 180-4, the same answer
 * as `digest`, reading the file a slice at a time.
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (value: number, bits: number): number => (value >>> bits) | (value << (32 - bits));

export class Sha256 {
  private readonly state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  private readonly block = new Uint8Array(64);
  private readonly words = new Uint32Array(64);
  private filled = 0;
  /** Bytes seen so far; a Number holds lengths far beyond any file here. */
  private length = 0;

  update(bytes: Uint8Array): this {
    let offset = 0;
    this.length += bytes.length;
    if (this.filled > 0) {
      const take = Math.min(64 - this.filled, bytes.length);
      this.block.set(bytes.subarray(0, take), this.filled);
      this.filled += take;
      offset = take;
      if (this.filled < 64) return this;
      this.compress(this.block, 0);
      this.filled = 0;
    }
    for (; offset + 64 <= bytes.length; offset += 64) this.compress(bytes, offset);
    if (offset < bytes.length) {
      this.block.set(bytes.subarray(offset));
      this.filled = bytes.length - offset;
    }
    return this;
  }

  /** The digest in lowercase hex, which is how the API reads a hash. */
  hex(): string {
    const bits = this.length * 8;
    const tail = new Uint8Array(this.filled < 56 ? 64 : 128);
    tail.set(this.block.subarray(0, this.filled));
    tail[this.filled] = 0x80;
    const view = new DataView(tail.buffer);
    view.setUint32(tail.length - 8, Math.floor(bits / 0x1_0000_0000));
    view.setUint32(tail.length - 4, bits >>> 0);
    for (let offset = 0; offset < tail.length; offset += 64) this.compress(tail, offset);
    return [...this.state].map((word) => word.toString(16).padStart(8, '0')).join('');
  }

  private compress(bytes: Uint8Array, offset: number): void {
    const w = this.words;
    for (let index = 0; index < 16; index += 1) {
      const at = offset + index * 4;
      w[index] =
        ((bytes[at] ?? 0) << 24) |
        ((bytes[at + 1] ?? 0) << 16) |
        ((bytes[at + 2] ?? 0) << 8) |
        (bytes[at + 3] ?? 0);
    }
    for (let index = 16; index < 64; index += 1) {
      const a = w[index - 15] ?? 0;
      const b = w[index - 2] ?? 0;
      const s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3);
      const s1 = rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10);
      w[index] = ((w[index - 16] ?? 0) + s0 + (w[index - 7] ?? 0) + s1) | 0;
    }
    const state = this.state;
    let a = state[0] ?? 0;
    let b = state[1] ?? 0;
    let c = state[2] ?? 0;
    let d = state[3] ?? 0;
    let e = state[4] ?? 0;
    let f = state[5] ?? 0;
    let g = state[6] ?? 0;
    let h = state[7] ?? 0;
    for (let index = 0; index < 64; index += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const choice = (e & f) ^ (~e & g);
      const t1 = (h + s1 + choice + (K[index] ?? 0) + (w[index] ?? 0)) | 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + majority) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    state[0] = ((state[0] ?? 0) + a) | 0;
    state[1] = ((state[1] ?? 0) + b) | 0;
    state[2] = ((state[2] ?? 0) + c) | 0;
    state[3] = ((state[3] ?? 0) + d) | 0;
    state[4] = ((state[4] ?? 0) + e) | 0;
    state[5] = ((state[5] ?? 0) + f) | 0;
    state[6] = ((state[6] ?? 0) + g) | 0;
    state[7] = ((state[7] ?? 0) + h) | 0;
  }
}

/** How much of a file is read into memory at once while it is hashed. */
export const HASH_SLICE_BYTES = 8 * 1024 * 1024;

/**
 * The SHA-256 of a file, read a slice at a time, saying how far it got. Only
 * one slice is ever in memory, whatever the size of the file.
 */
export async function hashFile(
  file: Blob,
  progress: (read: number, total: number) => void = () => undefined,
): Promise<string> {
  const hash = new Sha256();
  for (let start = 0; start < file.size; start += HASH_SLICE_BYTES) {
    const slice = file.slice(start, start + HASH_SLICE_BYTES);
    hash.update(new Uint8Array(await slice.arrayBuffer()));
    progress(Math.min(file.size, start + HASH_SLICE_BYTES), file.size);
  }
  return hash.hex();
}
