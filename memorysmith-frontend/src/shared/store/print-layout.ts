/**
 * Where the properties of a note go on paper (#258), in this browser.
 *
 * Four answers, because a note is printed for different readers: a **side**
 * box in the top-right corner of the first page, which is the closest to what
 * the screen shows without spending a sheet and is therefore the default; a
 * **cover** page of their own, the text starting on the next sheet; the
 * **end**, after the text; or **none**.
 *
 * It is a convenience of the device, like the way Home was left, so it lives
 * in `localStorage` and never in the product. Everything is inside a
 * try/catch: a browser that keeps nothing prints with the default.
 */

export const PROPERTY_PLACEMENTS = ['side', 'cover', 'end', 'none'] as const;
export type PropertyPlacement = (typeof PROPERTY_PLACEMENTS)[number];

const KEY = 'memorysmith.printProperties';
const DEFAULT: PropertyPlacement = 'side';

function isPlacement(value: unknown): value is PropertyPlacement {
  return (PROPERTY_PLACEMENTS as readonly unknown[]).includes(value);
}

/** Where the properties went the last time a note was printed here. */
export function propertyPlacement(): PropertyPlacement {
  try {
    const stored = localStorage.getItem(KEY);
    return isPlacement(stored) ? stored : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

/** Remembers the choice. The default is the absence of the entry. */
export function rememberPropertyPlacement(placement: PropertyPlacement): void {
  try {
    if (placement === DEFAULT) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, placement);
  } catch {
    // Storage refused or full: the next print starts on the default, nothing else.
  }
}
