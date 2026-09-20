/**
 * Drawing a picture somebody chose down to what an avatar is (#168).
 *
 * It happens HERE, in the browser, and not on the server, for two reasons that
 * point the same way: the bytes that cross the network are the bytes that get
 * stored, so a ten-megabyte photograph never travels at all; and an avatar is
 * bounded rather than budgeted — it rides on no notebook and counts against no
 * quota — so what keeps that honest is that nothing large can arrive.
 *
 * The result is a square, because every surface that draws an avatar draws a
 * square, and cropping to the middle is what a person expects of a face.
 */

/** The side of the square, and the ceiling the API refuses anything over. */
export const PICTURE_SIDE = 256;
export const PICTURE_MAX_BYTES = 64 * 1024;

export interface PreparedPicture {
  readonly mime: 'image/png' | 'image/jpeg' | 'image/webp';
  /** The bytes, base64, which is how they travel to the API. */
  readonly bytes: string;
  /** The same picture as a data URL, for the preview beside the choice. */
  readonly preview: string;
}

function decode(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('not-an-image'));
    };
    image.src = url;
  });
}

function base64Of(dataUrl: string): string {
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

/**
 * Draws the file to a square of `PICTURE_SIDE` and encodes it, trying JPEG at
 * falling quality until it is under the ceiling. JPEG and not WebP because it
 * is the one every browser this product runs in can WRITE, and the type is
 * declared to the API as what it actually encoded.
 *
 * It answers null when the file is not an image the browser can decode, which
 * is the same answer the API would give and one round trip earlier.
 */
export async function preparePicture(file: File): Promise<PreparedPicture | null> {
  let image: HTMLImageElement;
  try {
    image = await decode(file);
  } catch {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = PICTURE_SIDE;
  canvas.height = PICTURE_SIDE;
  const context = canvas.getContext('2d');
  if (!context) return null;

  // The middle square of the picture, which is where a face is.
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  if (side === 0) return null;
  context.drawImage(
    image,
    (image.naturalWidth - side) / 2,
    (image.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    PICTURE_SIDE,
    PICTURE_SIDE,
  );

  for (const quality of [0.85, 0.7, 0.55, 0.4]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const bytes = base64Of(dataUrl);
    // Base64 carries three bytes in every four characters, padding aside.
    if ((bytes.length * 3) / 4 <= PICTURE_MAX_BYTES) {
      return { mime: 'image/jpeg', bytes, preview: dataUrl };
    }
  }
  return null;
}
