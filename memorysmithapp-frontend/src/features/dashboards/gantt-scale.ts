/**
 * The scale of a Gantt (#383): a tick at the start of every month the bars
 * span, and a label on as many of them as the width it is drawn at holds.
 *
 * A label says the month, and the year only on the first one and where the
 * year changes, so "nov. 26 · dez. · jan. 27" reads as one line in the width of
 * half a dashboard. When the labels would still run into one another, every
 * second, third… month keeps its label, counted from the first, and a year
 * that changes on a month without a label moves to the next one shown.
 */

export interface ScaleMonth {
  /** The start of the month, in milliseconds. */
  readonly at: number;
  /** Where its tick goes, in percent of the scale. */
  readonly left: number;
  /** Its label, or null where the width leaves no room for one. */
  readonly label: string | null;
}

/** What one character of a label takes at the size of the scale, generously. */
const CHARACTER_PX = 7;
/** The gap a label keeps from the next tick. */
const GAP_PX = 8;

export function ganttScale(input: {
  readonly from: number;
  readonly to: number;
  readonly locale: string;
  /** The width the scale is drawn at; 0 while it is not measured yet. */
  readonly widthPx: number;
}): ScaleMonth[] {
  const span = input.to - input.from;
  if (!(span > 0)) return [];
  const month = new Intl.DateTimeFormat(input.locale, { month: 'short', timeZone: 'UTC' });
  const year = new Intl.DateTimeFormat(input.locale, { year: '2-digit', timeZone: 'UTC' });

  const ticks: Array<{ at: number; left: number }> = [];
  const cursor = new Date(input.from);
  cursor.setUTCDate(1);
  cursor.setUTCHours(0, 0, 0, 0);
  while (cursor.getTime() < input.to) {
    const left = ((cursor.getTime() - input.from) / span) * 100;
    if (left >= 0) ticks.push({ at: cursor.getTime(), left });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  if (ticks.length === 0) return [];

  const named = (at: number, withYear: boolean): string =>
    withYear ? `${month.format(at)} ${year.format(at)}` : month.format(at);
  const longest = Math.max(...ticks.map((tick) => named(tick.at, true).length));
  const room = longest * CHARACTER_PX + GAP_PX;
  // Unmeasured, every month is labelled, as the scale always was.
  const step =
    input.widthPx > 0 ? Math.max(1, Math.ceil((room * ticks.length) / input.widthPx)) : 1;

  let shownYear: number | null = null;
  return ticks.map((tick, index) => {
    if (index % step !== 0) return { ...tick, label: null };
    const tickYear = new Date(tick.at).getUTCFullYear();
    const withYear = tickYear !== shownYear;
    shownYear = tickYear;
    return { ...tick, label: named(tick.at, withYear) };
  });
}
