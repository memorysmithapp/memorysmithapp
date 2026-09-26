/**
 * The order in which a trail gives up space (#235), which a phone broke when
 * the order was left to how each engine shares flex shrinking.
 */

import { describe, expect, it } from 'vitest';
import { fitTrail, type TrailWidths } from './trail-fit';

// Separator 5, gap 6 on each side: every crumb after the first costs 17 + its width.
const base: Omit<TrailWidths, 'middle' | 'last' | 'available'> = {
  notebook: 216,
  separator: 5,
  gap: 6,
  more: 23,
  notebookMin: 72,
};

describe('a trail that fits', () => {
  it('shows every crumb whole', () => {
    const fit = fitTrail({ ...base, middle: [123], last: 69, available: 500 });
    expect(fit).toEqual({ hidden: 0, notebook: 216, last: 69 });
  });
});

describe('a trail that does not fit', () => {
  it('shortens the notebook first, and keeps the middle and the last whole', () => {
    // The case of the iPhone: 358 px for *Leitura de Sistema… / Business Knowledge / Capabilities*.
    const fit = fitTrail({ ...base, middle: [123], last: 69, available: 358 });
    expect(fit).toEqual({ hidden: 0, notebook: 358 - (17 + 123) - (17 + 69), last: 69 });
  });

  it('collapses the middle before the last crumb shortens', () => {
    // 72 + 140 + 86 = 298 does not fit in 290, so Business Knowledge goes.
    const fit = fitTrail({ ...base, middle: [123], last: 69, available: 290 });
    expect(fit.hidden).toBe(1);
    expect(fit.last).toBe(69);
    expect(fit.notebook).toBe(290 - (17 + 23) - (17 + 69));
  });

  it('collapses as few crumbs as it can, nearest the notebook first', () => {
    const fit = fitTrail({ ...base, middle: [66, 159, 203], last: 214, available: 643 });
    // With one collapsed: 72 + 40 + 176 + 220 + 231 = 739; with two: 72 + 40 + 220 + 231 = 563.
    expect(fit.hidden).toBe(2);
    expect(fit.last).toBe(214);
  });

  it('shortens the last crumb only when the notebook is at its least and the middle is gone', () => {
    const fit = fitTrail({ ...base, middle: [66, 159, 203], last: 214, available: 240 });
    expect(fit.hidden).toBe(3);
    expect(fit.notebook).toBe(72);
    expect(fit.last).toBe(240 - 72 - 40 - 17);
  });

  it('never gives the notebook less than its minimum, nor more than its name', () => {
    const short = fitTrail({ ...base, notebook: 40, middle: [], last: 400, available: 300 });
    expect(short.notebook).toBe(40);
    const long = fitTrail({ ...base, middle: [], last: 20, available: 1000 });
    expect(long.notebook).toBe(216);
  });

  it('keeps the notebook alone within the width', () => {
    expect(fitTrail({ ...base, middle: [], last: null, available: 150 })).toEqual({
      hidden: 0,
      notebook: 150,
      last: null,
    });
  });
});
