/**
 * The icon of the site (#389): what a favicon service keeps of memorysmith.app
 * is what an AI client shows beside the connector, so the site serves a real
 * `/favicon.ico`, and its page lists first the PNGs that carry transparency.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ico = readFileSync(new URL('../../../public/favicon.ico', import.meta.url));
const page = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');

/** The images of an ICO: its side and its bytes, each one a PNG here. */
function images(): Array<{ side: number; png: Buffer }> {
  const count = ico.readUInt16LE(4);
  return Array.from({ length: count }, (_, index) => {
    const entry = 6 + 16 * index;
    const size = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    return { side: ico[entry] || 256, png: ico.subarray(offset, offset + size) };
  });
}

describe('the icon of the site (#389)', () => {
  it('is an ICO of the symbol at 16, 32 and 48 px, each a PNG with an alpha channel', () => {
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    const found = images();
    expect(found.map((image) => image.side)).toEqual([16, 32, 48]);
    for (const image of found) {
      expect(image.png.subarray(1, 4).toString('latin1')).toBe('PNG');
      // IHDR: colour type 6 is RGBA, so the corners can be transparent.
      expect(image.png[25]).toBe(6);
    }
  });

  it('is listed after the PNGs and before the SVG, the PNGs larger first', () => {
    const order = [...page.matchAll(/<link rel="icon"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    expect(order).toEqual(['/symbol-192.png', '/symbol-48.png', '/favicon.ico', '/symbol.svg']);
  });
});
