/**
 * How a note is laid on paper (#258), in this browser.
 *
 * Three choices, each made in the bar of the page drawn for paper:
 *
 * - **Where the properties go**: a **cover** page of their own, the text
 *   starting on the next sheet, which is the default; a page at the **end**,
 *   after the text; or **none**. A box beside the text was offered first and
 *   removed, because on paper it ran past the edge of the page.
 * - **How a wide table fits**: its text **wraps** inside its cells, which is
 *   the default, or the table **shrinks** until it fits.
 * - **The orientation** of the A4 sheet: **portrait** by default, or
 *   **landscape**.
 *
 * They are a convenience of the device, like the way Home was left, so they
 * live in `localStorage` and never in the product. Everything is inside a
 * try/catch: a browser that keeps nothing prints with the defaults.
 */

export const PROPERTY_PLACEMENTS = ['cover', 'end', 'none'] as const;
export type PropertyPlacement = (typeof PROPERTY_PLACEMENTS)[number];

export const TABLE_FITS = ['wrap', 'shrink'] as const;
export type TableFit = (typeof TABLE_FITS)[number];

export const ORIENTATIONS = ['portrait', 'landscape'] as const;
export type Orientation = (typeof ORIENTATIONS)[number];

interface Choice<V extends string> {
  readonly key: string;
  readonly values: readonly V[];
  readonly fallback: V;
}

const PLACEMENT: Choice<PropertyPlacement> = {
  key: 'memorysmith.printProperties',
  values: PROPERTY_PLACEMENTS,
  fallback: 'cover',
};
const TABLES: Choice<TableFit> = {
  key: 'memorysmith.printTables',
  values: TABLE_FITS,
  fallback: 'wrap',
};
const ORIENTATION: Choice<Orientation> = {
  key: 'memorysmith.printOrientation',
  values: ORIENTATIONS,
  fallback: 'portrait',
};

function recalled<V extends string>(choice: Choice<V>): V {
  try {
    const stored = localStorage.getItem(choice.key);
    // A value no longer offered — `side`, before it was removed — is the default.
    return (choice.values as readonly (string | null)[]).includes(stored)
      ? (stored as V)
      : choice.fallback;
  } catch {
    return choice.fallback;
  }
}

/** The default is the absence of the entry. */
function remembered<V extends string>(choice: Choice<V>, value: V): void {
  try {
    if (value === choice.fallback) localStorage.removeItem(choice.key);
    else localStorage.setItem(choice.key, value);
  } catch {
    // Storage refused or full: the next print starts on the default, nothing else.
  }
}

export const propertyPlacement = (): PropertyPlacement => recalled(PLACEMENT);
export const rememberPropertyPlacement = (value: PropertyPlacement): void =>
  remembered(PLACEMENT, value);

export const tableFit = (): TableFit => recalled(TABLES);
export const rememberTableFit = (value: TableFit): void => remembered(TABLES, value);

export const orientation = (): Orientation => recalled(ORIENTATION);
export const rememberOrientation = (value: Orientation): void => remembered(ORIENTATION, value);
