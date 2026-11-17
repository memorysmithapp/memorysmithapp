import { bytesSupport, type NotebookFileDto } from '@memorysmithapp/contracts';

/**
 * A kept file checked against the person's original (#466, RN-KNW-090).
 *
 * The product keeps exactly the bytes whoever kept the file declared, and
 * cannot know whether those were the person's: a chat may hand its model a
 * reduced photo, or an image saved again, and the agent keeps that, truthfully.
 * So the person checks. Their file is hashed **in this browser**, a slice at a
 * time, and nothing of it is sent: the same size and SHA-256 is the original;
 * anything else is a difference, and this says what it is — the sizes, the type
 * each one's bytes announce, and for an image its dimensions, color mode,
 * alpha channel, color profile, EXIF and how much of the picture changed.
 *
 * Everything that reads a file or draws one is a port, so each step is proved
 * without a browser; what is left here is arithmetic over bytes.
 */

/**
 * Above this many pixels on either side, the pictures are not drawn: two
 * canvases of 40 megapixels are already some 320 MB of a tab, and the metadata
 * and the hashes still say whether the files differ (RN-KNW-090).
 */
export const PIXEL_CEILING = 40_000_000;

/**
 * What is read of each side to tell its type and describe an image: a
 * signature sits in the first bytes, and the header of a JPEG may follow an
 * EXIF block and a color profile of tens of kilobytes each.
 */
export const HEAD_BYTES = 1024 * 1024;

/** About how many pixels are compared, whatever the size of the picture. */
export const SAMPLE_TARGET = 4_000_000;

export type ColorMode = 'gray' | 'rgb' | 'indexed' | 'cmyk';

/** What the header of an image says about it, before a pixel is decoded. */
export interface ImageFacts {
  readonly width: number | null;
  readonly height: number | null;
  readonly color: ColorMode | null;
  /** An alpha channel, or a transparent color, declared by the file. */
  readonly alpha: boolean;
  /** An embedded color profile (ICC). */
  readonly icc: boolean;
  readonly exif: boolean;
}

/** One side of the comparison: the kept file, or the person's. */
export interface FileSide {
  readonly bytes: number;
  readonly sha256: string;
  /** The type the bytes announce, `null` when no signature is recognised. */
  readonly type: string | null;
  readonly image: ImageFacts | null;
}

/** How much of the picture is the same, once both are drawn at the kept file's size. */
export interface PixelStats {
  samples: number;
  identical: number;
  /** The sum of the absolute differences of every channel of every sample. */
  sumDifference: number;
  peak: number;
}

export type PixelVerdict =
  | {
      readonly kind: 'compared';
      readonly samples: number;
      /** The share of samples identical in every channel, from 0 to 1. */
      readonly identicalShare: number;
      /** The mean absolute difference per channel, from 0 to 255. */
      readonly meanDifference: number;
      readonly peakDifference: number;
    }
  /** One side is above `PIXEL_CEILING`: only the metadata and the hashes were compared. */
  | { readonly kind: 'over-ceiling'; readonly ceiling: number }
  /** The browser cannot draw one of the two, or its size is unknown. */
  | { readonly kind: 'undrawable' };

export type CheckReport =
  | { readonly identical: true; readonly bytes: number; readonly sha256: string }
  | {
      readonly identical: false;
      readonly kept: FileSide;
      readonly local: FileSide;
      /** `null` when the two are not both images. */
      readonly pixels: PixelVerdict | null;
      /** The kept file could not be read back, so only its size and hash are known. */
      readonly keptUnread: boolean;
    };

export type CheckPhase =
  { phase: 'hashing'; read: number; total: number } | { phase: 'reading' } | { phase: 'comparing' };

export interface CheckPorts {
  /** The SHA-256 of the person's file, read a slice at a time (RN-KNW-055). */
  hash(file: Blob, progress: (read: number, total: number) => void): Promise<string>;
  /** The first bytes of the kept file. */
  keptHead(bytes: number): Promise<Uint8Array>;
  /** The kept file whole. */
  keptWhole(): Promise<Blob>;
  /**
   * Draws both pictures at the size of the kept one and compares every
   * `step`-th pixel of every `step`-th row; `null` when one cannot be drawn.
   */
  comparePixels(kept: Blob, local: Blob, step: number): Promise<PixelStats | null>;
}

/** The images a browser draws on a canvas, which is what the pixels need. */
const DRAWABLE = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

const ascii = (bytes: Uint8Array, from: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(from, from + length));

/** Brands of the ISO base media format that are pictures, not films. */
const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']);

/**
 * The type the bytes announce, by their signature, read by the very check the
 * API runs before it keeps a file (`bytesSupport`, RN-KNW-075), with the few
 * types a phone or a camera hands over that the product does not keep.
 */
export function typeReadFrom(head: Uint8Array): string | null {
  if (head.length === 0) return null;
  if (head.length >= 12 && ascii(head, 4, 4) === 'ftyp') {
    const brand = ascii(head, 8, 4).toLowerCase();
    if (HEIF_BRANDS.has(brand)) return 'image/heic';
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    return brand.startsWith('qt') ? 'video/quicktime' : 'video/mp4';
  }
  // A Word, Excel or PowerPoint document is a Zip archive, and its signature
  // cannot tell the three apart.
  if (head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04) {
    return 'application/zip';
  }
  if (
    (head[0] === 0x49 && head[1] === 0x49 && head[2] === 0x2a && head[3] === 0x00) ||
    (head[0] === 0x4d && head[1] === 0x4d && head[2] === 0x00 && head[3] === 0x2a)
  ) {
    return 'image/tiff';
  }
  for (const type of [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/pdf',
    'audio/wav',
    'audio/ogg',
    'video/webm',
    'audio/mpeg',
    'image/svg+xml',
  ]) {
    if (bytesSupport(type, head)) return type;
  }
  if (head[0] === 0x42 && head[1] === 0x4d) return 'image/bmp';
  // Text that decodes and carries no NUL: a CSV, or any text.
  if (bytesSupport('text/csv', head)) return 'text/plain';
  return null;
}

/** What the header of a PNG, a JPEG, a GIF or a WebP says, or `null` for anything else. */
export function imageFacts(head: Uint8Array, type: string | null): ImageFacts | null {
  switch (type) {
    case 'image/png':
      return pngFacts(head);
    case 'image/jpeg':
      return jpegFacts(head);
    case 'image/gif':
      return gifFacts(head);
    case 'image/webp':
      return webpFacts(head);
    default:
      return null;
  }
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function pngFacts(head: Uint8Array): ImageFacts | null {
  if (head.length < 33) return null;
  const view = viewOf(head);
  const colorType = head[25];
  const facts: Mutable<ImageFacts> = {
    width: view.getUint32(16),
    height: view.getUint32(20),
    color: colorType === 0 || colorType === 4 ? 'gray' : colorType === 3 ? 'indexed' : 'rgb',
    alpha: colorType === 4 || colorType === 6,
    icc: false,
    exif: false,
  };
  // The chunks, by their lengths; the image data is skipped, never read.
  for (let offset = 8; offset + 8 <= head.length;) {
    const length = view.getUint32(offset);
    const name = ascii(head, offset + 4, 4);
    if (name === 'iCCP') facts.icc = true;
    else if (name === 'eXIf') facts.exif = true;
    else if (name === 'tRNS') facts.alpha = true;
    else if (name === 'IEND') break;
    offset += 12 + length;
  }
  return facts;
}

function jpegFacts(head: Uint8Array): ImageFacts | null {
  const view = viewOf(head);
  const facts: Mutable<ImageFacts> = {
    width: null,
    height: null,
    color: null,
    alpha: false,
    icc: false,
    exif: false,
  };
  let offset = 2;
  while (offset + 4 <= head.length) {
    if (head[offset] !== 0xff) break;
    const marker = head[offset + 1] ?? 0;
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    // Markers that stand alone, with no length after them.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break;
    const length = view.getUint16(offset + 2);
    const data = offset + 4;
    if (marker === 0xe1 && ascii(head, data, 6) === 'Exif\0\0') facts.exif = true;
    if (marker === 0xe2 && ascii(head, data, 12) === 'ICC_PROFILE\0') facts.icc = true;
    const frame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (frame && data + 6 <= head.length) {
      facts.height = view.getUint16(data + 1);
      facts.width = view.getUint16(data + 3);
      const components = head[data + 5];
      facts.color = components === 1 ? 'gray' : components === 4 ? 'cmyk' : 'rgb';
    }
    offset += 2 + length;
  }
  return facts;
}

function gifFacts(head: Uint8Array): ImageFacts | null {
  if (head.length < 10) return null;
  const view = viewOf(head);
  let alpha = false;
  // A graphic control extension whose flag declares a transparent color.
  for (let at = 13; at + 4 <= head.length; at += 1) {
    if (head[at] === 0x21 && head[at + 1] === 0xf9 && head[at + 2] === 0x04) {
      if (((head[at + 3] ?? 0) & 0x01) === 1) {
        alpha = true;
        break;
      }
    }
  }
  return {
    width: view.getUint16(6, true),
    height: view.getUint16(8, true),
    color: 'indexed',
    alpha,
    icc: findAscii(head, 'ICCRGBG1'),
    exif: false,
  };
}

function webpFacts(head: Uint8Array): ImageFacts | null {
  if (head.length < 30) return null;
  const view = viewOf(head);
  const chunk = ascii(head, 12, 4);
  if (chunk === 'VP8X') {
    const flags = head[20] ?? 0;
    const width = 1 + ((head[24] ?? 0) | ((head[25] ?? 0) << 8) | ((head[26] ?? 0) << 16));
    const height = 1 + ((head[27] ?? 0) | ((head[28] ?? 0) << 8) | ((head[29] ?? 0) << 16));
    return {
      width,
      height,
      color: 'rgb',
      alpha: (flags & 0x10) !== 0,
      icc: (flags & 0x20) !== 0,
      exif: (flags & 0x08) !== 0,
    };
  }
  if (chunk === 'VP8L') {
    const bits = view.getUint32(21, true);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
      color: 'rgb',
      alpha: ((bits >>> 28) & 1) === 1,
      icc: false,
      exif: false,
    };
  }
  if (chunk === 'VP8 ') {
    return {
      width: view.getUint16(26, true) & 0x3fff,
      height: view.getUint16(28, true) & 0x3fff,
      color: 'rgb',
      alpha: false,
      icc: false,
      exif: false,
    };
  }
  return null;
}

function findAscii(bytes: Uint8Array, text: string): boolean {
  const first = text.charCodeAt(0);
  for (let at = bytes.indexOf(first); at !== -1; at = bytes.indexOf(first, at + 1)) {
    if (ascii(bytes, at, text.length) === text) return true;
  }
  return false;
}

/** Every how many pixels, across and down, a sample is taken. */
export function sampleStep(width: number, height: number): number {
  return Math.max(1, Math.ceil(Math.sqrt((width * height) / SAMPLE_TARGET)));
}

export function emptyStats(): PixelStats {
  return { samples: 0, identical: 0, sumDifference: 0, peak: 0 };
}

/**
 * Adds the samples of one band of rows of the two pictures, RGBA as a canvas
 * hands them, `width` pixels a row, the band starting at row `top`.
 */
export function addSamples(
  stats: PixelStats,
  kept: Uint8ClampedArray,
  local: Uint8ClampedArray,
  width: number,
  top: number,
  step: number,
): void {
  const rows = Math.floor(kept.length / (width * 4));
  for (let row = 0; row < rows; row += 1) {
    if ((top + row) % step !== 0) continue;
    for (let column = 0; column < width; column += step) {
      const at = (row * width + column) * 4;
      let largest = 0;
      for (let channel = 0; channel < 4; channel += 1) {
        const difference = Math.abs((kept[at + channel] ?? 0) - (local[at + channel] ?? 0));
        stats.sumDifference += difference;
        if (difference > largest) largest = difference;
      }
      stats.samples += 1;
      if (largest === 0) stats.identical += 1;
      if (largest > stats.peak) stats.peak = largest;
    }
  }
}

export function verdictOf(stats: PixelStats): PixelVerdict {
  const samples = stats.samples;
  return {
    kind: 'compared',
    samples,
    identicalShare: samples > 0 ? stats.identical / samples : 0,
    meanDifference: samples > 0 ? stats.sumDifference / (samples * 4) : 0,
    peakDifference: stats.peak,
  };
}

async function headOf(file: Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, HEAD_BYTES).arrayBuffer());
}

const pixelsOf = (facts: ImageFacts | null): number | null =>
  facts?.width && facts.height ? facts.width * facts.height : null;

/**
 * Checks the kept file against the person's: their file is hashed here, and
 * nothing of it leaves the browser. The kept file is read only when the two
 * differ, and drawn only when both are pictures a canvas draws, under the
 * ceiling.
 */
export async function checkOriginal(
  ports: CheckPorts,
  kept: Pick<NotebookFileDto, 'bytes' | 'sha256'>,
  file: File,
  phase: (now: CheckPhase) => void = () => undefined,
): Promise<CheckReport> {
  phase({ phase: 'hashing', read: 0, total: file.size });
  const sha256 = await ports.hash(file, (read, total) => phase({ phase: 'hashing', read, total }));
  if (file.size === kept.bytes && sha256 === kept.sha256) {
    return { identical: true, bytes: file.size, sha256 };
  }

  phase({ phase: 'reading' });
  const localHead = await headOf(file);
  const localType = typeReadFrom(localHead);
  const local: FileSide = {
    bytes: file.size,
    sha256,
    type: localType,
    image: imageFacts(localHead, localType),
  };

  // A kept file that cannot be read back still differs: what is known of it is shown.
  const keptHead = await ports.keptHead(HEAD_BYTES).catch(() => null);
  const keptType = keptHead ? typeReadFrom(keptHead) : null;
  const keptSide: FileSide = {
    bytes: kept.bytes,
    sha256: kept.sha256,
    type: keptType,
    image: keptHead ? imageFacts(keptHead, keptType) : null,
  };
  const report = { identical: false as const, kept: keptSide, local, keptUnread: !keptHead };

  const images =
    keptType?.startsWith('image/') === true && localType?.startsWith('image/') === true;
  if (!images) return { ...report, pixels: null };

  const keptPixels = pixelsOf(keptSide.image);
  const localPixels = pixelsOf(local.image);
  if ((keptPixels ?? 0) > PIXEL_CEILING || (localPixels ?? 0) > PIXEL_CEILING) {
    return { ...report, pixels: { kind: 'over-ceiling', ceiling: PIXEL_CEILING } };
  }
  if (
    keptPixels === null ||
    localPixels === null ||
    !DRAWABLE.has(keptType ?? '') ||
    !DRAWABLE.has(localType ?? '')
  ) {
    return { ...report, pixels: { kind: 'undrawable' } };
  }

  phase({ phase: 'comparing' });
  try {
    const whole = await ports.keptWhole();
    const keptFacts = keptSide.image;
    const stats = await ports.comparePixels(
      whole,
      file,
      sampleStep(keptFacts?.width ?? 1, keptFacts?.height ?? 1),
    );
    return { ...report, pixels: stats ? verdictOf(stats) : { kind: 'undrawable' } };
  } catch {
    return { ...report, pixels: { kind: 'undrawable' } };
  }
}
