/**
 * How a trail that does not fit gives up space (#235), decided by arithmetic
 * and not left to the browser: flex shrinking shared the loss between the
 * notebook and the last crumb in a proportion each engine computes on its
 * own, and on an iPhone the last crumb lost first.
 *
 * The order is fixed:
 *   1. the name of the notebook shortens, down to `notebookMin`;
 *   2. the crumbs of the middle collapse into one `…`, nearest the notebook
 *      first, as few as possible;
 *   3. only then does the last crumb shorten.
 *
 * Every width is the one the element takes whole, measured by the caller.
 */
export interface TrailWidths {
  /** The name of the notebook, whole. */
  readonly notebook: number;
  /** The crumbs between the notebook and the last one, in order. */
  readonly middle: readonly number[];
  /** The last crumb, or null when the trail is the notebook alone. */
  readonly last: number | null;
  /** The `/` between two crumbs. */
  readonly separator: number;
  /** The gap on each side of a separator. */
  readonly gap: number;
  /** The `…` that stands for the collapsed crumbs. */
  readonly more: number;
  /** The width the trail has. */
  readonly available: number;
  /** The least the notebook keeps, when its name is longer than that. */
  readonly notebookMin: number;
}

export interface TrailFit {
  /** How many crumbs of the middle, from the notebook on, collapse into `…`. */
  readonly hidden: number;
  /** The width the notebook is given. */
  readonly notebook: number;
  /** The width the last crumb is given; it shortens only in step 3. */
  readonly last: number | null;
}

export function fitTrail(widths: TrailWidths): TrailFit {
  const { middle, last, separator, gap, more, available } = widths;
  const piece = (width: number) => gap + separator + gap + width;
  const notebookMin = Math.min(widths.notebook, widths.notebookMin);
  const rest = (hidden: number) =>
    (hidden > 0 ? piece(more) : 0) +
    middle.slice(hidden).reduce((total, width) => total + piece(width), 0) +
    (last === null ? 0 : piece(last));

  let hidden = 0;
  while (hidden < middle.length && notebookMin + rest(hidden) > available) hidden += 1;

  const over = notebookMin + rest(hidden) - available;
  if (over > 0) {
    // Nothing of the middle is left to collapse and the notebook is at its
    // least: the last crumb gives up what is still missing.
    return {
      hidden,
      notebook: notebookMin,
      last: last === null ? null : Math.max(0, last - over),
    };
  }
  return {
    hidden,
    notebook: Math.min(widths.notebook, available - rest(hidden)),
    last,
  };
}
