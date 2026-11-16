import type { NotebookFileDto } from '@memorysmithapp/contracts';
import { deleteNotebookFile, getNotebookFiles, linkToFile } from '../../shared/api/source';
import { hashFile } from '../../shared/files/sha256';
import { ATTACH_PORTS } from '../note/attach-ports';
import type { KeepOriginalPorts } from './keep-original';
import { addSamples, emptyStats, type CheckPorts, type PixelStats } from './original';

/**
 * What the check against the original talks to in a browser (#466,
 * RN-KNW-090): the slice hasher the upload already uses for the person's file,
 * and the files host for the kept one, read by `fetch` from a signed link —
 * the host answers the site's origin with CORS on a read, so the bytes reach
 * this page and are decoded here, never sent anywhere.
 */

/** How many pixels of a row band are read from a canvas at once. */
const BAND_PIXELS = 4_000_000;

/** A fresh link to the kept file, and the bytes behind it, never from the cache. */
async function readKept(notebookId: string, fileId: string): Promise<Response> {
  const link = await linkToFile(notebookId, fileId);
  // `no-store`: a response the browser cached for an `<img>` carries no CORS
  // answer, and reusing it would refuse the read.
  const response = await fetch(link.url, { cache: 'no-store', mode: 'cors' });
  if (!response.ok) throw new Error(`The files host answered ${response.status}`);
  return response;
}

function canvasOf(
  width: number,
  height: number,
): {
  context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  release: () => void;
} {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('No 2D canvas');
    return {
      context,
      release: () => {
        canvas.width = 0;
        canvas.height = 0;
      },
    };
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('No 2D canvas');
  return {
    context,
    release: () => {
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}

/**
 * The stored values of each picture, untouched by a color profile: the
 * profile is reported apart, and converting would hide the pixels behind it.
 */
const DECODE: ImageBitmapOptions = { colorSpaceConversion: 'none', premultiplyAlpha: 'none' };

export function checkPorts(notebookId: string, fileId: string): CheckPorts {
  return {
    hash: hashFile,
    keptHead: async (bytes) => {
      const response = await readKept(notebookId, fileId);
      const reader = response.body?.getReader();
      if (!reader) return new Uint8Array(await response.arrayBuffer()).slice(0, bytes);
      const chunks: Uint8Array[] = [];
      let read = 0;
      while (read < bytes) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        read += value.length;
      }
      // Only the start was wanted: the rest never travels.
      await reader.cancel().catch(() => undefined);
      const head = new Uint8Array(Math.min(read, bytes));
      let at = 0;
      for (const chunk of chunks) {
        const take = chunk.subarray(0, head.length - at);
        head.set(take, at);
        at += take.length;
        if (at >= head.length) break;
      }
      return head;
    },
    keptWhole: async () => (await readKept(notebookId, fileId)).blob(),
    comparePixels: async (kept, local, step): Promise<PixelStats | null> => {
      let keptImage: ImageBitmap;
      let localImage: ImageBitmap;
      try {
        keptImage = await createImageBitmap(kept, DECODE);
      } catch {
        return null;
      }
      try {
        localImage = await createImageBitmap(local, DECODE);
      } catch {
        keptImage.close();
        return null;
      }
      // Both drawn at the size of the kept one, as it is shown.
      const width = keptImage.width;
      const height = keptImage.height;
      const a = canvasOf(width, height);
      const b = canvasOf(width, height);
      try {
        a.context.drawImage(keptImage, 0, 0);
        b.context.imageSmoothingQuality = 'high';
        b.context.drawImage(localImage, 0, 0, width, height);
        const stats = emptyStats();
        const rows = Math.max(1, Math.floor(BAND_PIXELS / width));
        for (let top = 0; top < height; top += rows) {
          const band = Math.min(rows, height - top);
          addSamples(
            stats,
            a.context.getImageData(0, top, width, band).data,
            b.context.getImageData(0, top, width, band).data,
            width,
            top,
            step,
          );
        }
        return stats;
      } finally {
        keptImage.close();
        localImage.close();
        a.release();
        b.release();
      }
    },
  };
}

export function keepOriginalPorts(notebookId: string, kept: NotebookFileDto): KeepOriginalPorts {
  return {
    attach: ATTACH_PORTS,
    remove: () => deleteNotebookFile(notebookId, kept.fileId),
    list: () => getNotebookFiles(notebookId),
  };
}
