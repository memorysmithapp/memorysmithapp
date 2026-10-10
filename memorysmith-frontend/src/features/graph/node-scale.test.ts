/**
 * The size of a node of the graph is relative to the nodes drawn (#275): with
 * any set of degrees, every radius is within the range of its kind, the
 * largest degree gets the ceiling, the smallest the floor, and a larger degree
 * never gets a smaller radius.
 */

import { describe, expect, it } from 'vitest';
import { COLLISION_GAP, RADIUS, linkLength, radiiOf, radiusScale } from './node-scale';

/** A few hundred notes of a well-linked notebook, and one hub. */
const dense = [...Array.from({ length: 300 }, (_, index) => 9 + (index % 28)), 0, 1, 2, 420];
const small = [0, 1, 1, 2, 3, 3, 4, 5, 6, 8];

describe('the scale of a kind of node', () => {
  for (const [name, degrees] of [
    ['a dense notebook', dense],
    ['a small notebook', small],
    ['two nodes', [4, 90]],
  ] as const) {
    it(`keeps every radius within the range in ${name}`, () => {
      for (const range of [RADIUS.note, RADIUS.value]) {
        const scale = radiusScale(degrees, range);
        for (const degree of degrees) {
          expect(scale(degree)).toBeGreaterThanOrEqual(range.min);
          expect(scale(degree)).toBeLessThanOrEqual(range.max);
        }
        expect(scale(Math.min(...degrees))).toBe(range.min);
        expect(scale(Math.max(...degrees))).toBe(range.max);
      }
    });

    it(`never draws a larger degree smaller in ${name}`, () => {
      const scale = radiusScale(degrees, RADIUS.note);
      const sorted = [...degrees].sort((a, b) => a - b);
      for (let index = 1; index < sorted.length; index++) {
        expect(scale(sorted[index]!)).toBeGreaterThanOrEqual(scale(sorted[index - 1]!));
      }
    });
  }

  it('leaves most notes of a dense notebook well under the ceiling', () => {
    const scale = radiusScale(dense, RADIUS.note);
    const middle = (RADIUS.note.min + RADIUS.note.max) / 2;
    const under = dense.filter((degree) => scale(degree) < middle).length;
    expect(under / dense.length).toBeGreaterThan(0.9);
  });

  it('draws nodes of one degree at one size', () => {
    const none = radiusScale([0, 0, 0], RADIUS.note);
    expect(none(0)).toBe(RADIUS.note.min);
    const even = radiusScale([5, 5], RADIUS.note);
    expect(even(5)).toBeGreaterThan(RADIUS.note.min);
    expect(even(5)).toBeLessThan(RADIUS.note.max);
    expect(radiusScale([], RADIUS.value)(3)).toBe(RADIUS.value.min);
  });

  it('holds a degree it was not built over to the range', () => {
    const scale = radiusScale([2, 10], RADIUS.note);
    expect(scale(0)).toBe(RADIUS.note.min);
    expect(scale(500)).toBe(RADIUS.note.max);
  });

  it('keeps every floor above the radius an unlinked node had, so the pointer still hits it', () => {
    expect(RADIUS.note.min).toBeGreaterThanOrEqual(2.2);
    expect(RADIUS.value.min).toBeGreaterThanOrEqual(3.5);
    expect(RADIUS.value.min).toBeGreaterThan(RADIUS.note.min);
  });
});

describe('the radii of the nodes drawn', () => {
  it('scales notes and values each among their own kind', () => {
    const radii = radiiOf([
      { kind: 'note', degree: 1 },
      { kind: 'note', degree: 40 },
      { kind: 'value', degree: 3 },
      { kind: 'value', degree: 200 },
    ]);
    expect(radii).toEqual([RADIUS.note.min, RADIUS.note.max, RADIUS.value.min, RADIUS.value.max]);
  });

  it('measures a held group again, so its largest note is drawn at the ceiling', () => {
    const notebook = [
      { kind: 'note' as const, degree: 300 },
      { kind: 'note' as const, degree: 4 },
      { kind: 'note' as const, degree: 2 },
    ];
    const whole = radiiOf(notebook);
    const group = radiiOf(notebook.slice(1));
    expect(whole[1]).toBeLessThan(RADIUS.note.max / 2);
    expect(group[0]).toBe(RADIUS.note.max);
    expect(group[1]).toBe(RADIUS.note.min);
  });
});

describe('a link', () => {
  it('is measured between the edges of its nodes', () => {
    expect(linkLength(20, { radius: 3 }, { radius: 13 })).toBe(36);
    expect(COLLISION_GAP).toBeGreaterThan(0);
  });
});
