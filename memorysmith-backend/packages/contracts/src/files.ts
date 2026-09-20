/**
 * What a notebook may keep beside its notes, and how the product tells one
 * kind of bytes from another (#166, RN-KNW-050).
 *
 * **The extension decides nothing.** A file is named whatever whoever kept it
 * called it — `esquema de blocos`, `diagrama.png`, `relatorio.final` — and the
 * name is a name. What decides how it is drawn, whether it may be stored at
 * all and what is served back is the **type**.
 *
 * Which is why the type cannot be taken on trust. A declared type the bytes do
 * not support is the whole of the risk: a file of HTML kept under `image/png`
 * is harmless while it is served as an image and is a page running inside the
 * origin of the product the moment something decides otherwise. So the
 * signature of the bytes is read here — the same few leading bytes `file(1)`
 * reads — and a declaration the bytes contradict is refused.
 *
 * The list is CLOSED. Sixteen types, chosen because each one has an answer to
 * *how is this drawn*, and what is not on it is refused before a byte is
 * stored, with the list in the refusal.
 */

/** One accepted type: how it is drawn, and how its bytes announce themselves. */
export interface FileType {
  readonly mimeType: string;
  /** What a name written with an extension usually ends in. It decides nothing. */
  readonly extensions: readonly string[];
  /** How a reading surface draws it (RN-DSC-061). */
  readonly renders: 'image' | 'audio' | 'video' | 'card';
  /**
   * The signatures the bytes may start with, as hex. Empty when the format
   * carries no magic number of its own and is recognised by `sniff` below.
   */
  readonly magic: readonly string[];
}

export const FILE_TYPES: readonly FileType[] = [
  { mimeType: 'image/png', extensions: ['.png'], renders: 'image', magic: ['89504e470d0a1a0a'] },
  { mimeType: 'image/jpeg', extensions: ['.jpg', '.jpeg'], renders: 'image', magic: ['ffd8ff'] },
  // RIFF....WEBP: the four bytes at offset 8 are what tell it from a WAV.
  { mimeType: 'image/webp', extensions: ['.webp'], renders: 'image', magic: ['52494646'] },
  {
    mimeType: 'image/gif',
    extensions: ['.gif'],
    renders: 'image',
    magic: ['474946383761', '474946383961'],
  },
  // Text, and recognised as text: see `sniff`.
  { mimeType: 'image/svg+xml', extensions: ['.svg'], renders: 'image', magic: [] },
  { mimeType: 'application/pdf', extensions: ['.pdf'], renders: 'card', magic: ['25504446'] },
  {
    mimeType: 'audio/mpeg',
    extensions: ['.mp3'],
    renders: 'audio',
    magic: ['494433', 'fffb', 'fff3', 'fff2'],
  },
  { mimeType: 'audio/wav', extensions: ['.wav'], renders: 'audio', magic: ['52494646'] },
  { mimeType: 'audio/ogg', extensions: ['.ogg'], renders: 'audio', magic: ['4f676753'] },
  { mimeType: 'audio/webm', extensions: ['.weba'], renders: 'audio', magic: ['1a45dfa3'] },
  // ISO base media: `ftyp` sits at offset 4, which `sniff` checks.
  { mimeType: 'video/mp4', extensions: ['.mp4'], renders: 'video', magic: [] },
  { mimeType: 'video/webm', extensions: ['.webm'], renders: 'video', magic: ['1a45dfa3'] },
  { mimeType: 'video/quicktime', extensions: ['.mov'], renders: 'video', magic: [] },
  {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensions: ['.docx'],
    renders: 'card',
    magic: ['504b0304'],
  },
  {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extensions: ['.xlsx'],
    renders: 'card',
    magic: ['504b0304'],
  },
  {
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extensions: ['.pptx'],
    renders: 'card',
    magic: ['504b0304'],
  },
];

export const FILE_MIME_TYPES: readonly string[] = FILE_TYPES.map((each) => each.mimeType);

export function fileTypeOf(mimeType: string): FileType | null {
  return FILE_TYPES.find((each) => each.mimeType === mimeType.trim().toLowerCase()) ?? null;
}

/** How a reading surface draws this type, `card` for anything it cannot draw. */
export function rendersAs(mimeType: string): FileType['renders'] {
  return fileTypeOf(mimeType)?.renders ?? 'card';
}

const hexOf = (bytes: Uint8Array, from: number, length: number): string =>
  [...bytes.slice(from, from + length)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

/**
 * Whether these bytes can be what they say they are.
 *
 * It is a refusal of the obvious lie and not a parser: what it stops is a
 * document arriving under the type of a picture. A `.docx`, a `.xlsx` and a
 * `.pptx` are all Zip archives and cannot be told apart here, which is fine —
 * none of the three is drawn, all three are served as a download, and the
 * three are the same risk exactly.
 */
export function bytesSupport(mimeType: string, bytes: Uint8Array): boolean {
  const type = fileTypeOf(mimeType);
  if (!type) return false;
  if (bytes.length === 0) return false;

  if (type.mimeType === 'image/svg+xml') {
    // Text that opens an SVG or an XML document, after whitespace and a BOM.
    const decoded = new TextDecoder().decode(bytes.slice(0, 256));
    // A byte order mark is not text, and it is what an editor leaves in front
    // of an SVG it saved.
    const head = (decoded.codePointAt(0) === 0xfeff ? decoded.slice(1) : decoded)
      .trimStart()
      .toLowerCase();
    return head.startsWith('<svg') || head.startsWith('<?xml') || head.startsWith('<!doctype svg');
  }

  // ISO base media: the brand sits at offset 4, and the brand is what says
  // whether it is an MP4 or a QuickTime movie.
  if (type.mimeType === 'video/mp4' || type.mimeType === 'video/quicktime') {
    if (hexOf(bytes, 4, 4) !== '66747970') return false;
    const brand = new TextDecoder().decode(bytes.slice(8, 12)).toLowerCase();
    return type.mimeType === 'video/quicktime' ? brand.startsWith('qt') : !brand.startsWith('qt');
  }

  // RIFF carries the format at offset 8: WEBP for the image, WAVE for the audio.
  if (type.mimeType === 'image/webp' || type.mimeType === 'audio/wav') {
    if (hexOf(bytes, 0, 4) !== '52494646') return false;
    const form = new TextDecoder().decode(bytes.slice(8, 12)).toUpperCase();
    return type.mimeType === 'image/webp' ? form === 'WEBP' : form === 'WAVE';
  }

  return type.magic.some((signature) => hexOf(bytes, 0, signature.length / 2) === signature);
}
