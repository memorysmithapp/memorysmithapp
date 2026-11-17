/**
 * A kept file checked against the person's original (#466, RN-KNW-090): their
 * file is hashed here and nothing of it is sent; the kept one is read only
 * when the two differ, and drawn only when both are pictures under the ceiling.
 */

import { describe, expect, it } from 'vitest';
import {
  addSamples,
  checkOriginal,
  emptyStats,
  imageFacts,
  PIXEL_CEILING,
  sampleStep,
  typeReadFrom,
  verdictOf,
  type CheckPhase,
  type CheckPorts,
} from './original';

const bytes = (...parts: (number[] | string)[]): Uint8Array<ArrayBuffer> =>
  new Uint8Array(
    parts.flatMap((part) =>
      typeof part === 'string' ? [...part].map((char) => char.charCodeAt(0)) : part,
    ),
  );

const u32 = (value: number) => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
];
const u16 = (value: number) => [(value >>> 8) & 0xff, value & 0xff];

/** A PNG header: its signature, IHDR, the chunks given, and IEND. */
function png(
  width: number,
  height: number,
  colorType: number,
  chunks: string[] = [],
): Uint8Array<ArrayBuffer> {
  return bytes(
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    u32(13),
    'IHDR',
    u32(width),
    u32(height),
    [8, colorType, 0, 0, 0],
    [0, 0, 0, 0],
    ...chunks.flatMap((name) => [u32(2), name, [0, 0], [0, 0, 0, 0]]),
    u32(0),
    'IEND',
    [0, 0, 0, 0],
  );
}

/** A JPEG header: SOI, the segments given, a baseline frame and SOS. */
function jpeg(
  width: number,
  height: number,
  components: number,
  segments: { marker: number; data: string }[] = [],
): Uint8Array<ArrayBuffer> {
  return bytes(
    [0xff, 0xd8],
    ...segments.flatMap(({ marker, data }) => [[0xff, marker], u16(data.length + 2), data]),
    [0xff, 0xc0],
    u16(8 + components * 3),
    [8],
    u16(height),
    u16(width),
    [components],
    Array.from({ length: components * 3 }, () => 0),
    [0xff, 0xda, 0, 2],
  );
}

describe('the type read from the bytes', () => {
  it('names what the API checks before it keeps a file', () => {
    expect(typeReadFrom(png(1, 1, 2))).toBe('image/png');
    expect(typeReadFrom(jpeg(1, 1, 3))).toBe('image/jpeg');
    expect(typeReadFrom(bytes('%PDF-1.7'))).toBe('application/pdf');
    expect(typeReadFrom(bytes('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe('image/svg+xml');
  });

  it('tells a photo of a phone from a film by its brand', () => {
    expect(typeReadFrom(bytes([0, 0, 0, 24], 'ftypheic', [0, 0, 0, 0]))).toBe('image/heic');
    expect(typeReadFrom(bytes([0, 0, 0, 24], 'ftypisom', [0, 0, 0, 0]))).toBe('video/mp4');
    expect(typeReadFrom(bytes([0, 0, 0, 24], 'ftypqt  ', [0, 0, 0, 0]))).toBe('video/quicktime');
  });

  it('says an Office document is a Zip archive, text is text, and the rest is unknown', () => {
    expect(typeReadFrom(bytes([0x50, 0x4b, 0x03, 0x04], 'word/'))).toBe('application/zip');
    expect(typeReadFrom(bytes('name;age\nAna;3\n'))).toBe('text/plain');
    expect(typeReadFrom(bytes([0x00, 0x01, 0x02, 0x03]))).toBeNull();
  });
});

describe('what the header of an image says', () => {
  it('reads a PNG: size, color, alpha, a profile and EXIF', () => {
    expect(imageFacts(png(816, 816, 2), 'image/png')).toEqual({
      width: 816,
      height: 816,
      color: 'rgb',
      alpha: false,
      icc: false,
      exif: false,
    });
    expect(imageFacts(png(816, 816, 6, ['iCCP', 'eXIf']), 'image/png')).toMatchObject({
      color: 'rgb',
      alpha: true,
      icc: true,
      exif: true,
    });
    expect(imageFacts(png(10, 10, 3, ['tRNS']), 'image/png')).toMatchObject({
      color: 'indexed',
      alpha: true,
    });
  });

  it('reads a JPEG past its EXIF and its profile to the frame', () => {
    const plain = jpeg(2400, 1800, 3, [{ marker: 0xe0, data: 'JFIF\0' }]);
    expect(imageFacts(plain, 'image/jpeg')).toEqual({
      width: 2400,
      height: 1800,
      color: 'rgb',
      alpha: false,
      icc: false,
      exif: false,
    });
    const tagged = jpeg(2048, 1536, 3, [
      { marker: 0xe1, data: 'Exif\0\0MM' },
      { marker: 0xe2, data: 'ICC_PROFILE\0\x01\x01' },
    ]);
    expect(imageFacts(tagged, 'image/jpeg')).toMatchObject({
      width: 2048,
      height: 1536,
      icc: true,
      exif: true,
    });
    expect(imageFacts(jpeg(4, 4, 4), 'image/jpeg')?.color).toBe('cmyk');
    expect(imageFacts(jpeg(4, 4, 1), 'image/jpeg')?.color).toBe('gray');
  });

  it('reads an extended WebP by its flags', () => {
    const head = bytes(
      'RIFF',
      [0, 0, 0, 0],
      'WEBP',
      'VP8X',
      [10, 0, 0, 0],
      [0x10 | 0x20 | 0x08, 0, 0, 0],
      [0x9f, 0x0f, 0x00], // 3999 + 1
      [0x7f, 0x0b, 0x00], // 2943 + 1
    );
    expect(imageFacts(head, 'image/webp')).toEqual({
      width: 4000,
      height: 2944,
      color: 'rgb',
      alpha: true,
      icc: true,
      exif: true,
    });
  });

  it('says nothing of what is not a raster image', () => {
    expect(imageFacts(bytes('%PDF-1.7'), 'application/pdf')).toBeNull();
  });
});

describe('the pixels compared', () => {
  it('counts identical samples, the mean difference per channel and the largest', () => {
    const stats = emptyStats();
    const kept = new Uint8ClampedArray([10, 20, 30, 255, 0, 0, 0, 255]);
    const local = new Uint8ClampedArray([10, 20, 30, 255, 8, 0, 0, 255]);
    addSamples(stats, kept, local, 2, 0, 1);
    expect(verdictOf(stats)).toEqual({
      kind: 'compared',
      samples: 2,
      identicalShare: 0.5,
      meanDifference: 1,
      peakDifference: 8,
    });
  });

  it('takes every step-th pixel of every step-th row, counted from the top of the picture', () => {
    const stats = emptyStats();
    // A band of 2 rows of 4 pixels, starting at row 3: only row 4 is sampled.
    const band = new Uint8ClampedArray(2 * 4 * 4);
    addSamples(stats, band, band, 4, 3, 2);
    expect(stats.samples).toBe(2);
    expect(stats.identical).toBe(2);
  });

  it('keeps about four million samples whatever the size', () => {
    expect(sampleStep(2048, 1536)).toBe(1);
    expect(sampleStep(8000, 5000)).toBe(4);
  });
});

function file(content: Uint8Array<ArrayBuffer>, name = 'foto.jpg'): File {
  return new File([content], name);
}

function ports(over: Partial<CheckPorts> & { keptBytes?: Uint8Array<ArrayBuffer> } = {}) {
  const calls: string[] = [];
  const port: CheckPorts = {
    hash: async (_file, progress) => {
      calls.push('hash');
      progress(1, 1);
      return 'local'.padEnd(64, '0');
    },
    keptHead: async () => {
      calls.push('keptHead');
      return over.keptBytes ?? new Uint8Array();
    },
    keptWhole: async () => {
      calls.push('keptWhole');
      return new Blob([over.keptBytes ?? new Uint8Array()]);
    },
    comparePixels: async (_kept, _local, step) => {
      calls.push(`comparePixels:${step}`);
      return { samples: 100, identical: 2, sumDifference: 6360, peak: 117 };
    },
    ...over,
  };
  return { port, calls };
}

describe('checking a kept file against the original', () => {
  it('says identical on the same size and SHA-256, and reads nothing of the kept file', async () => {
    const { port, calls } = ports();
    const phases: CheckPhase[] = [];
    const original = file(new Uint8Array(10));
    const report = await checkOriginal(
      port,
      { bytes: 10, sha256: 'local'.padEnd(64, '0') },
      original,
      (now) => phases.push(now),
    );

    expect(report).toEqual({ identical: true, bytes: 10, sha256: 'local'.padEnd(64, '0') });
    expect(calls).toEqual(['hash']);
    expect(phases.every((phase) => phase.phase === 'hashing')).toBe(true);
  });

  it('reports a reduced photo: both sizes, both dimensions, and how much of it changed', async () => {
    const kept = jpeg(2048, 1536, 3, [{ marker: 0xe2, data: 'ICC_PROFILE\0\x01\x01' }]);
    const { port, calls } = ports({ keptBytes: kept });
    const original = file(jpeg(2400, 1800, 3));

    const report = await checkOriginal(port, { bytes: 1960955, sha256: 'b'.repeat(64) }, original);

    expect(report.identical).toBe(false);
    if (report.identical) return;
    expect(report.kept).toMatchObject({
      bytes: 1960955,
      type: 'image/jpeg',
      image: { width: 2048, height: 1536, icc: true },
    });
    expect(report.local).toMatchObject({
      bytes: original.size,
      type: 'image/jpeg',
      image: { width: 2400, height: 1800, icc: false },
    });
    expect(report.pixels).toEqual({
      kind: 'compared',
      samples: 100,
      identicalShare: 0.02,
      meanDifference: 15.9,
      peakDifference: 117,
    });
    expect(calls).toEqual(['hash', 'keptHead', 'keptWhole', 'comparePixels:1']);
  });

  it('compares only the metadata and the hashes above the ceiling, and says so', async () => {
    const { port, calls } = ports({ keptBytes: jpeg(2048, 1536, 3) });
    const original = file(jpeg(8000, 6000, 3));
    expect(8000 * 6000).toBeGreaterThan(PIXEL_CEILING);

    const report = await checkOriginal(port, { bytes: 1, sha256: 'b'.repeat(64) }, original);

    expect(!report.identical && report.pixels).toEqual({
      kind: 'over-ceiling',
      ceiling: PIXEL_CEILING,
    });
    expect(calls).not.toContain('keptWhole');
  });

  it('draws no pixels of a file that is not an image', async () => {
    const { port, calls } = ports({ keptBytes: bytes('%PDF-1.4') });
    const report = await checkOriginal(
      port,
      { bytes: 8, sha256: 'b'.repeat(64) },
      file(bytes('%PDF-1.7 and more'), 'a.pdf'),
    );

    expect(!report.identical && report.pixels).toBeNull();
    expect(!report.identical && report.kept.type).toBe('application/pdf');
    expect(calls).toEqual(['hash', 'keptHead']);
  });

  it('still says they differ when the kept file cannot be read back', async () => {
    const { port } = ports({
      keptHead: () => Promise.reject(new Error('CORS')),
    });
    const report = await checkOriginal(
      port,
      { bytes: 3, sha256: 'b'.repeat(64) },
      file(jpeg(10, 10, 3)),
    );

    expect(report.identical).toBe(false);
    expect(!report.identical && report.keptUnread).toBe(true);
    expect(!report.identical && report.kept.type).toBeNull();
    expect(!report.identical && report.pixels).toBeNull();
  });
});
